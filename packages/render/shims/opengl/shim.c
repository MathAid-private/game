/**
 * @fileoverview
 * @summary Reference OpenGL shim for the C ABI.
 *
 * @description
 * Implements every entry point in `gfx.h` on top of an existing OpenGL
 * 3.3 core context. The shim does not create a window or a context. The
 * caller is responsible for making a context current before calling
 * `gfx_create_device`.
 *
 * The shim uses a single VAO shared across draws. Per-draw state
 * changes bind the caller's vertex and index buffers, set the shader
 * program, and update the uniform buffer.
 *
 * ```text
 *   gfx_create_device       creates the shared VAO and UBO
 *   gfx_create_buffer       glGenBuffers + glBufferData
 *   gfx_create_pipeline     compiles GLSL, links the program
 *   gfx_begin_frame         glViewport + glClear
 *   gfx_draw                binds program, VAO, buffers, uniforms
 *   gfx_end_frame           glFlush
 *   gfx_present             no-op on a caller-managed context
 *   gfx_read_pixels         glReadPixels
 * ```
 *
 * @see gfx.h
 * @author MathAid
 */

#include "gfx.h"

#include <GL/gl.h>
#include <GL/glext.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

/* ----------------------------------------------------------------- */
/*  Internal structures                                               */
/* ----------------------------------------------------------------- */

struct gfx_buffer {
  GLuint id;
  GLenum target;
  size_t size;
};

struct gfx_pipeline {
  GLuint program;
  GLint uniform_mvp;
  GLint uniform_color;
};

struct gfx_device {
  GLuint vao;
  GLuint ubo;
  int32_t viewport_w;
  int32_t viewport_h;
  int32_t frame_open;
};

/* ----------------------------------------------------------------- */
/*  Shader helpers                                                    */
/* ----------------------------------------------------------------- */

static GLuint compile_shader(GLenum type, const char* src) {
  GLuint shader = glCreateShader(type);
  glShaderSource(shader, 1, &src, NULL);
  glCompileShader(shader);
  GLint ok = 0;
  glGetShaderiv(shader, GL_COMPILE_STATUS, &ok);
  if (!ok) {
    char log[1024];
    glGetShaderInfoLog(shader, sizeof(log), NULL, log);
    fprintf(stderr, "gfx: shader compile error: %s\n", log);
    glDeleteShader(shader);
    return 0;
  }
  return shader;
}

static GLuint link_program(const char* vs_src, const char* fs_src) {
  GLuint vs = compile_shader(GL_VERTEX_SHADER, vs_src);
  if (vs == 0) return 0;
  GLuint fs = compile_shader(GL_FRAGMENT_SHADER, fs_src);
  if (fs == 0) {
    glDeleteShader(vs);
    return 0;
  }
  GLuint program = glCreateProgram();
  glAttachShader(program, vs);
  glAttachShader(program, fs);
  glLinkProgram(program);
  glDeleteShader(vs);
  glDeleteShader(fs);
  GLint ok = 0;
  glGetProgramiv(program, GL_LINK_STATUS, &ok);
  if (!ok) {
    char log[1024];
    glGetProgramInfoLog(program, sizeof(log), NULL, log);
    fprintf(stderr, "gfx: program link error: %s\n", log);
    glDeleteProgram(program);
    return 0;
  }
  return program;
}

/* ----------------------------------------------------------------- */
/*  Version                                                           */
/* ----------------------------------------------------------------- */

uint32_t gfx_get_version(void) {
  return ((uint32_t)GFX_VERSION_MAJOR << 16) | (uint32_t)GFX_VERSION_MINOR;
}

/* ----------------------------------------------------------------- */
/*  Device                                                            */
/* ----------------------------------------------------------------- */

gfx_result gfx_create_device(gfx_api api, void* native, gfx_device** out) {
  (void)native;
  if (out == NULL) return GFX_ERR_INVALID_ARG;
  if (api != GFX_API_OPENGL) return GFX_ERR_UNSUPPORTED;

  struct gfx_device* dev = (struct gfx_device*)calloc(1, sizeof(struct gfx_device));
  if (dev == NULL) return GFX_ERR_OUT_OF_MEMORY;

  glGenVertexArrays(1, &dev->vao);
  glBindVertexArray(dev->vao);

  glGenBuffers(1, &dev->ubo);
  glBindBuffer(GL_UNIFORM_BUFFER, dev->ubo);
  glBufferData(GL_UNIFORM_BUFFER, 80, NULL, GL_DYNAMIC_DRAW);
  glBindBuffer(GL_UNIFORM_BUFFER, 0);

  glGetIntegerv(GL_VIEWPORT, (GLint*)&dev->viewport_w);
  // glGetIntegerv writes two ints; the second is the height.
  GLint vp[4] = {0, 0, 0, 0};
  glGetIntegerv(GL_VIEWPORT, vp);
  dev->viewport_w = vp[2];
  dev->viewport_h = vp[3];

  dev->frame_open = 0;
  *out = dev;
  return GFX_OK;
}

void gfx_destroy_device(gfx_device* device) {
  if (device == NULL) return;
  if (device->ubo != 0) glDeleteBuffers(1, &device->ubo);
  if (device->vao != 0) glDeleteVertexArrays(1, &device->vao);
  free(device);
}

gfx_result gfx_get_capabilities(gfx_device* device, gfx_capabilities* out) {
  if (device == NULL || out == NULL) return GFX_ERR_INVALID_ARG;
  memset(out, 0, sizeof(gfx_capabilities));
  out->supports_compute = 0;
  out->supports_geometry_shaders = 1;
  out->supports_capture = 1;
  GLint max_tex = 0;
  glGetIntegerv(GL_MAX_TEXTURE_SIZE, &max_tex);
  out->max_texture_size = max_tex;
  out->max_vertex_count = 1 << 20;
  out->max_index_count = 1 << 22;
  return GFX_OK;
}

/* ----------------------------------------------------------------- */
/*  Buffer                                                            */
/* ----------------------------------------------------------------- */

gfx_result gfx_create_buffer(
    gfx_device* device,
    const void* data,
    size_t size,
    int32_t is_index,
    gfx_buffer** out) {
  if (device == NULL || out == NULL || size == 0) return GFX_ERR_INVALID_ARG;

  struct gfx_buffer* buf = (struct gfx_buffer*)calloc(1, sizeof(struct gfx_buffer));
  if (buf == NULL) return GFX_ERR_OUT_OF_MEMORY;

  buf->target = is_index ? GL_ELEMENT_ARRAY_BUFFER : GL_ARRAY_BUFFER;
  buf->size = size;

  glGenBuffers(1, &buf->id);
  glBindBuffer(buf->target, buf->id);
  glBufferData(buf->target, (GLsizeiptr)size, data, GL_STATIC_DRAW);
  glBindBuffer(buf->target, 0);

  *out = buf;
  return GFX_OK;
}

void gfx_destroy_buffer(gfx_buffer* buffer) {
  if (buffer == NULL) return;
  if (buffer->id != 0) glDeleteBuffers(1, &buffer->id);
  free(buffer);
}

/* ----------------------------------------------------------------- */
/*  Pipeline                                                          */
/* ----------------------------------------------------------------- */

gfx_result gfx_create_pipeline(
    gfx_device* device,
    const char* vs_src,
    const char* fs_src,
    gfx_pipeline** out) {
  if (device == NULL || vs_src == NULL || fs_src == NULL || out == NULL) {
    return GFX_ERR_INVALID_ARG;
  }
  GLuint program = link_program(vs_src, fs_src);
  if (program == 0) return GFX_ERR_INTERNAL;

  struct gfx_pipeline* p = (struct gfx_pipeline*)calloc(1, sizeof(struct gfx_pipeline));
  if (p == NULL) {
    glDeleteProgram(program);
    return GFX_ERR_OUT_OF_MEMORY;
  }
  p->program = program;
  p->uniform_mvp = glGetUniformLocation(program, "u_mvp");
  p->uniform_color = glGetUniformLocation(program, "u_color");
  *out = p;
  return GFX_OK;
}

void gfx_destroy_pipeline(gfx_pipeline* pipeline) {
  if (pipeline == NULL) return;
  if (pipeline->program != 0) glDeleteProgram(pipeline->program);
  free(pipeline);
}

/* ----------------------------------------------------------------- */
/*  Frame lifecycle                                                   */
/* ----------------------------------------------------------------- */

gfx_result gfx_begin_frame(gfx_device* device, const float* clear_color) {
  if (device == NULL) return GFX_ERR_INVALID_ARG;
  if (device->frame_open) return GFX_ERR_INTERNAL;
  device->frame_open = 1;

  glViewport(0, 0, device->viewport_w, device->viewport_h);
  if (clear_color != NULL) {
    glClearColor(clear_color[0], clear_color[1], clear_color[2], clear_color[3]);
    glClear(GL_COLOR_BUFFER_BIT);
  }
  return GFX_OK;
}

gfx_result gfx_draw(
    gfx_device* device,
    gfx_pipeline* pipeline,
    gfx_buffer* vertices,
    gfx_buffer* indices,
    const float* uniform) {
  if (device == NULL || pipeline == NULL || vertices == NULL || indices == NULL) {
    return GFX_ERR_INVALID_ARG;
  }
  if (!device->frame_open) return GFX_ERR_INTERNAL;

  glUseProgram(pipeline->program);

  // Upload the uniform block. The layout matches the shader.
  glBindBuffer(GL_UNIFORM_BUFFER, device->ubo);
  glBufferSubData(GL_UNIFORM_BUFFER, 0, 80, uniform);

  if (pipeline->uniform_mvp >= 0) {
    glUniformMatrix4fv(pipeline->uniform_mvp, 1, GL_FALSE, uniform);
  }
  if (pipeline->uniform_color >= 0) {
    glUniform4fv(pipeline->uniform_color, 1, uniform + 16);
  }

  glBindVertexArray(device->vao);

  glBindBuffer(GL_ARRAY_BUFFER, vertices->id);
  glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 8, (void*)0);
  glEnableVertexAttribArray(0);

  glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, indices->id);

  GLsizei count = (GLsizei)(indices->size / sizeof(uint32_t));
  glDrawElements(GL_TRIANGLES, count, GL_UNSIGNED_INT, 0);

  glBindVertexArray(0);
  glUseProgram(0);
  return GFX_OK;
}

gfx_result gfx_end_frame(gfx_device* device) {
  if (device == NULL) return GFX_ERR_INVALID_ARG;
  if (!device->frame_open) return GFX_ERR_INTERNAL;
  glFlush();
  device->frame_open = 0;
  return GFX_OK;
}

gfx_result gfx_present(gfx_device* device) {
  if (device == NULL) return GFX_ERR_INVALID_ARG;
  // A caller-managed context handles the swap. This is a no-op.
  return GFX_OK;
}

/* ----------------------------------------------------------------- */
/*  Capture                                                           */
/* ----------------------------------------------------------------- */

gfx_result gfx_read_pixels(
    gfx_device* device,
    int32_t x,
    int32_t y,
    int32_t width,
    int32_t height,
    void* out) {
  if (device == NULL || out == NULL) return GFX_ERR_INVALID_ARG;
  if (width <= 0 || height <= 0) return GFX_ERR_INVALID_ARG;
  if (device->frame_open) return GFX_ERR_INTERNAL;

  glReadPixels(x, y, width, height, GL_RGBA, GL_UNSIGNED_BYTE, out);
  return GFX_OK;
}
/**
 * @fileoverview
 * @summary Smoke test for the reference OpenGL shim.
 *
 * @description
 * Creates a headless GL context with EGL, creates a device, draws a
 * single triangle, and reads back the center pixel. Exits with 0 on
 * success. Exits with a non-zero code on failure.
 *
 * Build instructions are in the shims README.
 *
 * @author MathAid
 */

#include "gfx.h"

#include <EGL/egl.h>
#include <GL/gl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static const char* VS_SRC =
    "#version 330 core\n"
    "layout(location = 0) in vec2 a_pos;\n"
    "uniform mat4 u_mvp;\n"
    "void main() {\n"
    "  gl_Position = u_mvp * vec4(a_pos, 0.0, 1.0);\n"
    "}\n";

static const char* FS_SRC =
    "#version 330 core\n"
    "uniform vec4 u_color;\n"
    "out vec4 fragColor;\n"
    "void main() {\n"
    "  fragColor = u_color;\n"
    "}\n";

int main(void) {
  EGLDisplay display = eglGetDisplay(EGL_DEFAULT_DISPLAY);
  if (display == EGL_NO_DISPLAY) {
    fprintf(stderr, "test: no EGL display\n");
    return 1;
  }
  EGLint major, minor;
  if (!eglInitialize(display, &major, &minor)) {
    fprintf(stderr, "test: eglInitialize failed\n");
    return 1;
  }

  EGLint config_attribs[] = {
    EGL_SURFACE_TYPE, EGL_PBUFFER_BIT,
    EGL_RENDERABLE_TYPE, EGL_OPENGL_BIT,
    EGL_RED_SIZE, 8,
    EGL_GREEN_SIZE, 8,
    EGL_BLUE_SIZE, 8,
    EGL_ALPHA_SIZE, 8,
    EGL_NONE,
  };
  EGLConfig config;
  EGLint num_configs;
  if (!eglChooseConfig(display, config_attribs, &config, 1, &num_configs) || num_configs == 0) {
    fprintf(stderr, "test: no matching EGL config\n");
    return 1;
  }

  EGLint pbuffer_attribs[] = {
    EGL_WIDTH, 64,
    EGL_HEIGHT, 64,
    EGL_NONE,
  };
  EGLSurface surface = eglCreatePbufferSurface(display, config, pbuffer_attribs);
  if (surface == EGL_NO_SURFACE) {
    fprintf(stderr, "test: no pbuffer surface\n");
    return 1;
  }

  eglBindAPI(EGL_OPENGL_API);
  EGLContext context = eglCreateContext(display, config, EGL_NO_CONTEXT, NULL);
  if (context == EGL_NO_CONTEXT) {
    fprintf(stderr, "test: no EGL context\n");
    return 1;
  }
  eglMakeCurrent(display, surface, surface, context);

  gfx_device* device = NULL;
  gfx_result r = gfx_create_device(GFX_API_OPENGL, NULL, &device);
  if (r != GFX_OK || device == NULL) {
    fprintf(stderr, "test: gfx_create_device failed: %d\n", r);
    return 1;
  }

  // A single triangle covering the whole viewport.
  const float verts[] = {
    -1.0f, -1.0f,
     3.0f, -1.0f,
    -1.0f,  3.0f,
  };
  const uint32_t idx[] = {0, 1, 2};

  gfx_buffer* vbuf = NULL;
  gfx_buffer* ibuf = NULL;
  if (gfx_create_buffer(device, verts, sizeof(verts), 0, &vbuf) != GFX_OK) {
    fprintf(stderr, "test: vertex buffer failed\n");
    return 1;
  }
  if (gfx_create_buffer(device, idx, sizeof(idx), 1, &ibuf) != GFX_OK) {
    fprintf(stderr, "test: index buffer failed\n");
    return 1;
  }

  gfx_pipeline* pipeline = NULL;
  if (gfx_create_pipeline(device, VS_SRC, FS_SRC, &pipeline) != GFX_OK) {
    fprintf(stderr, "test: pipeline failed\n");
    return 1;
  }

  const float clear[4] = {0.0f, 0.0f, 0.0f, 1.0f};
  const float uniform[20] = {
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
    1.0f, 0.0f, 0.0f, 1.0f,
  };

  if (gfx_begin_frame(device, clear) != GFX_OK) {
    fprintf(stderr, "test: begin frame failed\n");
    return 1;
  }
  if (gfx_draw(device, pipeline, vbuf, ibuf, uniform) != GFX_OK) {
    fprintf(stderr, "test: draw failed\n");
    return 1;
  }
  if (gfx_end_frame(device) != GFX_OK) {
    fprintf(stderr, "test: end frame failed\n");
    return 1;
  }

  unsigned char pixels[64 * 64 * 4];
  if (gfx_read_pixels(device, 0, 0, 64, 64, pixels) != GFX_OK) {
    fprintf(stderr, "test: read pixels failed\n");
    return 1;
  }

  // The center pixel should be red.
  int cx = 32;
  int cy = 32;
  int off = (cy * 64 + cx) * 4;
  unsigned char R = pixels[off];
  unsigned char G = pixels[off + 1];
  unsigned char B = pixels[off + 2];
  if (R < 200 || G > 50 || B > 50) {
    fprintf(stderr, "test: center pixel is not red: (%u, %u, %u)\n", R, G, B);
    return 1;
  }

  gfx_destroy_pipeline(pipeline);
  gfx_destroy_buffer(vbuf);
  gfx_destroy_buffer(ibuf);
  gfx_destroy_device(device);

  eglDestroyContext(display, context);
  eglDestroySurface(display, surface);
  eglTerminate(display);

  printf("test: pass\n");
  return 0;
}
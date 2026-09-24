/**
 * @fileoverview
 * @summary The stable C ABI for native GPU shims.
 *
 * @description
 * Defines the function and type contract every native shim implements.
 * The TypeScript binding layer in the render package links against this
 * header. Each platform shim (OpenGL, Vulkan, DX12, Metal) provides the
 * same entry points. A shim that does not support an API returns
 * GFX_ERR_UNSUPPORTED.
 *
 * The ABI is versioned. `gfx_get_version` returns the current version.
 * A binding that does not match the loaded library fails fast.
 *
 * ```text
 *   +----------------+            +-----------------+
 *   | TypeScript     |            | C shim          |
 *   | binding (koffi)|--calls---->| (this header)   |
 *   +----------------+            +-----------------+
 *                                        |
 *                                        v
 *                                  +-----------+
 *                                  | GPU API   |
 *                                  | (GL, VK,..)|
 *                                  +-----------+
 * ```
 *
 * Memory ownership is explicit. Every `gfx_*_create` returns a handle
 * the caller must free with the matching `gfx_*_destroy`. Buffers
 * allocated by the shim for readback are freed by the shim.
 *
 * @author MathAid
 */

#ifndef GFX_H
#define GFX_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* ----------------------------------------------------------------- */
/*  Version                                                           */
/* ----------------------------------------------------------------- */

/** The major version of this header. Bumped on incompatible changes. */
#define GFX_VERSION_MAJOR 1

/** The minor version of this header. Bumped on additive changes. */
#define GFX_VERSION_MINOR 0

/**
 * @summary Return the ABI version of the loaded shim.
 *
 * @description
 * Encodes the version as `(major << 16) | minor`. The binding layer
 * compares the result against the constants it was compiled with.
 *
 * @return The ABI version.
 */
uint32_t gfx_get_version(void);

/* ----------------------------------------------------------------- */
/*  Result codes                                                      */
/* ----------------------------------------------------------------- */

/**
 * @summary The result code every ABI function returns.
 *
 * @description
 * Zero is success. Every other value is a failure. The binding layer
 * maps each failure code to a TypeScript exception.
 */
typedef enum {
  /** The call succeeded. */
  GFX_OK = 0,
  /** The API is not supported by this shim. */
  GFX_ERR_UNSUPPORTED = 1,
  /** The GPU device was lost or reset. */
  GFX_ERR_DEVICE_LOST = 2,
  /** The shim could not allocate GPU or host memory. */
  GFX_ERR_OUT_OF_MEMORY = 3,
  /** An argument failed validation. */
  GFX_ERR_INVALID_ARG = 4,
  /** An internal shim error. Details are in the shim's log. */
  GFX_ERR_INTERNAL = 5,
} gfx_result;

/* ----------------------------------------------------------------- */
/*  API enumeration                                                   */
/* ----------------------------------------------------------------- */

/**
 * @summary The GPU API a shim targets.
 *
 * @description
 * A single shim implements exactly one API. The value is passed to
 * {@link gfx_create_device} for validation. A mismatch returns
 * GFX_ERR_UNSUPPORTED.
 */
typedef enum {
  GFX_API_DX12 = 1,
  GFX_API_VULKAN = 2,
  GFX_API_METAL = 3,
  GFX_API_OPENGL = 4,
} gfx_api;

/* ----------------------------------------------------------------- */
/*  Opaque handles                                                    */
/* ----------------------------------------------------------------- */

/** An opaque device handle. */
typedef struct gfx_device gfx_device;

/** An opaque buffer handle. */
typedef struct gfx_buffer gfx_buffer;

/** An opaque pipeline handle. */
typedef struct gfx_pipeline gfx_pipeline;

/* ----------------------------------------------------------------- */
/*  Capabilities                                                      */
/* ----------------------------------------------------------------- */

/**
 * @summary The advertised capabilities of a shim.
 *
 * @description
 * Filled by {@link gfx_get_capabilities}. Every field is a boolean
 * encoded as a 32-bit integer. A value of 1 means the feature is
 * available.
 */
typedef struct {
  /** 1 if the shim supports compute shaders. */
  int32_t supports_compute;
  /** 1 if the shim supports geometry shaders. */
  int32_t supports_geometry_shaders;
  /** 1 if the shim can capture pixels from a texture. */
  int32_t supports_capture;
  /** The maximum texture size in pixels on either axis. */
  int32_t max_texture_size;
  /** The maximum number of vertices per draw call. */
  int32_t max_vertex_count;
  /** The maximum number of indices per draw call. */
  int32_t max_index_count;
} gfx_capabilities;

/* ----------------------------------------------------------------- */
/*  Device                                                            */
/* ----------------------------------------------------------------- */

/**
 * @summary Create a device for the given API.
 *
 * @description
 * The `native` argument carries a platform-specific handle. Its meaning
 * depends on the API.
 *
 * ```text
 *   OpenGL    a native window handle, or NULL for a headless context
 *   DX12      an HWND
 *   Metal     an NSView*
 *   Vulkan    a VkInstance, or NULL to create one
 * ```
 *
 * A shim that does not target the requested API returns
 * GFX_ERR_UNSUPPORTED. A shim that cannot allocate GPU resources returns
 * GFX_ERR_OUT_OF_MEMORY.
 *
 * @param api The target API. Must match the shim's compile-time target.
 * @param native A platform-specific handle.
 * @param out On success, receives a pointer to the created device.
 * @return GFX_OK on success, or an error code.
 */
gfx_result gfx_create_device(
    gfx_api api,
    void* native,
    gfx_device** out);

/**
 * @summary Destroy a device.
 *
 * @description
 * Frees every buffer and pipeline the device owns. A buffer or pipeline
 * destroyed before the device does not affect the destroy. Passing NULL
 * is a no-op.
 *
 * @param device The device to destroy.
 */
void gfx_destroy_device(gfx_device* device);

/**
 * @summary Query the shim's capabilities.
 *
 * @description
 * Fills the caller-provided struct. The result is valid for the life of
 * the device. A NULL device returns GFX_ERR_INVALID_ARG.
 *
 * @param device The device.
 * @param out The struct to fill.
 * @return GFX_OK on success, or an error code.
 */
gfx_result gfx_get_capabilities(
    gfx_device* device,
    gfx_capabilities* out);

/* ----------------------------------------------------------------- */
/*  Buffer                                                            */
/* ----------------------------------------------------------------- */

/**
 * @summary Create a GPU buffer from host data.
 *
 * @description
 * Copies the host data into a GPU buffer. The buffer is used either as
 * vertex data or index data, depending on the usage flag. The
 * `data` pointer must be valid for `size` bytes. When `data` is NULL,
 * the buffer is allocated but not initialized.
 *
 * The data is copied at creation time. The caller may free the host
 * buffer immediately after this call returns.
 *
 * @param device The device.
 * @param data The host data to copy, or NULL.
 * @param size The size of the data in bytes.
 * @param is_index 0 for vertex data, 1 for index data.
 * @param out On success, receives a pointer to the created buffer.
 * @return GFX_OK on success, or an error code.
 */
gfx_result gfx_create_buffer(
    gfx_device* device,
    const void* data,
    size_t size,
    int32_t is_index,
    gfx_buffer** out);

/**
 * @summary Destroy a buffer.
 *
 * @param buffer The buffer to destroy.
 */
void gfx_destroy_buffer(gfx_buffer* buffer);

/* ----------------------------------------------------------------- */
/*  Pipeline                                                          */
/* ----------------------------------------------------------------- */

/**
 * @summary Create a render pipeline from shader source.
 *
 * @description
 * Compiles the two shader sources and links them into a pipeline. The
 * source language depends on the API.
 *
 * ```text
 *   OpenGL    GLSL 330 core, vertex and fragment
 *   DX12      HLSL, vs_5_0 and ps_5_0
 *   Metal     MSL, vertex and fragment functions
 *   Vulkan    SPIR-V bytecode (pass as text? see note)
 * ```
 *
 * A shader that fails to compile returns GFX_ERR_INTERNAL. The shim
 * writes a diagnostic to its own log. The binding layer maps the code
 * to a TypeScript error.
 *
 * @param device The device.
 * @param vs_src The vertex shader source.
 * @param fs_src The fragment shader source.
 * @param out On success, receives a pointer to the created pipeline.
 * @return GFX_OK on success, or an error code.
 */
gfx_result gfx_create_pipeline(
    gfx_device* device,
    const char* vs_src,
    const char* fs_src,
    gfx_pipeline** out);

/**
 * @summary Destroy a pipeline.
 *
 * @param pipeline The pipeline to destroy.
 */
void gfx_destroy_pipeline(gfx_pipeline* pipeline);

/* ----------------------------------------------------------------- */
/*  Frame lifecycle                                                   */
/* ----------------------------------------------------------------- */

/**
 * @summary Begin a frame.
 *
 * @description
 * Prepares the shim for a sequence of draw calls. Clears the target
 * surface with the given RGBA color, encoded as four floats in 0 to 1.
 * A NULL color leaves the surface uncleared.
 *
 * Every `gfx_begin_frame` must be matched by exactly one
 * `gfx_end_frame`.
 *
 * @param device The device.
 * @param clear_color Four floats: red, green, blue, alpha. May be NULL.
 * @return GFX_OK on success, or an error code.
 */
gfx_result gfx_begin_frame(
    gfx_device* device,
    const float* clear_color);

/**
 * @summary Submit a draw call.
 *
 * @description
 * Draws the indexed geometry. The pipeline and both buffers must be
 * alive. The uniform data is a 4 by 4 row-major matrix followed by a
 * 4-float color. The shim uploads the uniform and issues the draw.
 *
 * The call must occur between a matching `gfx_begin_frame` and
 * `gfx_end_frame`.
 *
 * @param device The device.
 * @param pipeline The pipeline to use.
 * @param vertices The vertex buffer.
 * @param indices The index buffer.
 * @param uniform 20 floats: 16 for the matrix, 4 for the color.
 * @return GFX_OK on success, or an error code.
 */
gfx_result gfx_draw(
    gfx_device* device,
    gfx_pipeline* pipeline,
    gfx_buffer* vertices,
    gfx_buffer* indices,
    const float* uniform);

/**
 * @summary End the current frame.
 *
 * @description
 * Flushes the draw queue. The frame becomes visible on the next
 * `gfx_present`.
 *
 * @param device The device.
 * @return GFX_OK on success, or an error code.
 */
gfx_result gfx_end_frame(gfx_device* device);

/**
 * @summary Present the frame to the window.
 *
 * @description
 * Swaps the front and back buffers. For a headless context, this is a
 * no-op.
 *
 * @param device The device.
 * @return GFX_OK on success, or an error code.
 */
gfx_result gfx_present(gfx_device* device);

/* ----------------------------------------------------------------- */
/*  Capture                                                           */
/* ----------------------------------------------------------------- */

/**
 * @summary Read pixels from the current frame.
 *
 * @description
 * Copies the given region into the caller-provided buffer. The region
 * is in pixels. The buffer must be at least `width * height * 4` bytes.
 * The output layout is RGBA8 with no padding.
 *
 * The call is valid only after `gfx_end_frame` and before the next
 * `gfx_begin_frame`.
 *
 * @param device The device.
 * @param x The left edge of the region.
 * @param y The top edge of the region.
 * @param width The width in pixels.
 * @param height The height in pixels.
 * @param out The output buffer. Must be at least `width * height * 4`.
 * @return GFX_OK on success, or an error code.
 */
gfx_result gfx_read_pixels(
    gfx_device* device,
    int32_t x,
    int32_t y,
    int32_t width,
    int32_t height,
    void* out);

#ifdef __cplusplus
}
#endif

#endif /* GFX_H */
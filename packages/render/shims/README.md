# `@games/render` native shims

The C ABI every native GPU shim implements, plus a reference OpenGL
shim.

## Layout

```text
shims/
  gfx.h                 The C ABI header
  opengl/shim.c         Reference OpenGL shim
  opengl/CMakeLists.txt
  test/test_shim.c      Smoke test
  test/CMakeLists.txt
  CMakeLists.txt
```

## Build

```bash
cd packages/render/shims
cmake -B build
cmake --build build
```

The build produces `build/opengl/libgfx_opengl.so` (Linux) or the
platform equivalent.

## Test

```bash
./build/test/test_shim
```

Exits with `0` and prints `test: pass` on success.

## Adding a new shim

1. Create `shims/<api>/shim.c`.
2. Include `../gfx.h`.
3. Implement every function in the header.
4. Return `GFX_ERR_UNSUPPORTED` from any entry point the API cannot
   satisfy.
5. Add a `CMakeLists.txt` next to the source.
6. Add the directory to the top-level `CMakeLists.txt`.

The binding layer in `src/renderer/shim/` loads the shared library by
name. It does not need changes when a new shim lands.

---

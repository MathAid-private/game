
# @fileoverview Build configuration for the shim smoke test.

cmake_minimum_required(VERSION 3.16)

project(gfx_test C)

set(CMAKE_C_STANDARD 11)

add_executable(test_shim test_shim.c)
target_include_directories(test_shim PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/..)
target_link_libraries(test_shim PRIVATE gfx_opengl OpenGL::GL EGL)
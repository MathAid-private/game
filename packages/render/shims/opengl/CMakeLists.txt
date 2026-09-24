# @fileoverview Build configuration for the reference OpenGL shim.
#
# @summary Produces a shared library named `gfx_opengl`.
#
# @description The shim links against the platform OpenGL library and
# the system C standard library. It has no other dependencies.

cmake_minimum_required(VERSION 3.16)

project(gfx_opengl C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

add_library(gfx_opengl SHARED shim.c)
target_include_directories(gfx_opengl PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/..)

find_package(OpenGL REQUIRED)
target_link_libraries(gfx_opengl PRIVATE OpenGL::GL)

if(WIN32)
  target_link_libraries(gfx_opengl PRIVATE opengl32)
elseif(APPLE)
  target_link_libraries(gfx_opengl PRIVATE "-framework OpenGL")
endif()
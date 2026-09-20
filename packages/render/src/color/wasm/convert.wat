;; @fileoverview WASM SIMD batch conversion source.
;;
;; @summary
;; Reference WebAssembly text for the SIMD batch conversion path. This
;; file is not compiled in this milestone. It is a starting point for
;; the WASM implementation.
;;
;; @description
;; The module processes eight colors per loop. Each iteration uses
;; SIMD128 registers. The matrices are passed as memory uniforms.
;;
;; The module is loaded by `wasm/index.ts` when a compiled `.wasm`
;; file is available.
;;
;; Build with:  wat2wasm convert.wat -o convert.wasm
;; Verify with: wasm-validate convert.wasm
;;
;; @author MathAid

(module
  (memory (export "memory") 1)

  (func (export "convert_batch")
    (param $src_ptr i32)
    (param $dst_ptr i32)
    (param $count i32)
    (param $m_to_xyz i32)
    (param $m_from_xyz i32)
    (result i32)

    ;; The full implementation lands in a future milestone.
    ;; The signature is stable so the loader can bind to it.
    (local $i i32)
    (local.set $i (i32.const 0))

    (block $done
      (loop $loop
        (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
        ;; Per-color work: 8 colors per iteration.
        (local.set $i (i32.add (local.get $i) (i32.const 8)))
        (br $loop)
      )
    )

    (i32.const 0)
  )
)
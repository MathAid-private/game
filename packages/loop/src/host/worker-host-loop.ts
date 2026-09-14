/**
 * @fileoverview
 * @summary The worker-context host loop — a monotonic clock plus a `MessageChannel` scheduler.
 *
 * @description
 * This module provides `WorkerHostLoop`, the `IHostLoop` for running the engine's loop off the
 * main thread: inside a Web Worker (or a `worker_threads` worker) there is no
 * `requestAnimationFrame`, but `performance` and `MessageChannel` both exist, so the same
 * `MessageChannelScheduler` + `NanoClock` pairing that drives `NodeHostLoop` also drives a worker.
 * It is a named, worker-oriented alias of {@link NodeHostLoop} — the loop runs on the worker's
 * event loop, decoupled from the main thread's frame scheduler.
 *
 * @note
 * Off-thread execution of the *loop* is provided here; transporting the game's render commands
 * back to the main thread's renderer is a separate transport concern (see `SHELVED.md`).
 *
 * @author MathAid
 */

import { NodeHostLoop } from './node-host-loop';

/**
 * @summary The host loop for a worker thread, using `MessageChannel` + `performance.now()`.
 *
 * @description
 * `WorkerHostLoop` is a thin, documented specialization of {@link NodeHostLoop} for worker
 * contexts. Because workers lack `requestAnimationFrame` but have `performance` and
 * `MessageChannel`, the inherited `NanoClock`/`MessageChannelScheduler` composition is exactly the
 * right pump; the class exists so a host names its environment explicitly rather than reusing the
 * server host by accident.
 *
 * @example
 * const engine = new Engine(tetris, { fps: 60 }, new WorkerHostLoop());
 *
 * @see {@link NodeHostLoop}
 * @author MathAid
 */
export class WorkerHostLoop extends NodeHostLoop {}

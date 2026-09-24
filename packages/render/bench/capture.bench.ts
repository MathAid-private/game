/**
 * @fileoverview
 * @summary Capture throughput benchmarks.
 *
 * @description
 * Measures the cost of the frame codecs and the pixel-read helper. The
 * codec benchmarks run in every environment. The readback benchmark
 * runs against a mock device so it works headless.
 *
 * ```text
 *   json-encode-1k      encode a 1000-command frame to JSON
 *   json-decode-1k      decode a 1000-command frame from JSON
 *   msgpack-encode-1k   encode a 1000-command frame to MessagePack
 *   msgpack-decode-1k   decode a 1000-command frame from MessagePack
 *   region-repack       repack a 256-byte padded region into a tight buffer
 * ```
 *
 * @see {@linkcode toFrameJSON}
 * @see {@linkcode toFrameMsgPack}
 * @author MathAid
 */

import {
  FrameBuilder,
  fromFrameJSON,
  fromFrameMsgPack,
  make,
  makeSolid,
  rect,
  sRGB,
  toFrameJSON,
  toFrameMsgPack,
} from '@games/render';
import { bench, describe } from 'vitest';

const red = makeSolid(make(sRGB, 1, 0, 0));

function buildFrame(count: number): FrameBuilder {
  const b = new FrameBuilder();
  b.clear();
  for (let i = 0; i < count; i++) {
    b.fillRect(rect(i % 100, (i / 100) | 0, 8, 8), red);
  }
  return b;
}

const frame1k = buildFrame(1000);
const frame10k = buildFrame(10000);
const json1k = toFrameJSON(frame1k);
const json10k = toFrameJSON(frame10k);
const pack1k = toFrameMsgPack(frame1k);
const pack10k = toFrameMsgPack(frame10k);

describe('frame codec', () => {
  bench('json-encode-1k', () => {
    toFrameJSON(frame1k);
  });

  bench('json-encode-10k', () => {
    toFrameJSON(frame10k);
  });

  bench('json-decode-1k', () => {
    fromFrameJSON(json1k);
  });

  bench('json-decode-10k', () => {
    fromFrameJSON(json10k);
  });

  bench('msgpack-encode-1k', () => {
    toFrameMsgPack(frame1k);
  });

  bench('msgpack-encode-10k', () => {
    toFrameMsgPack(frame10k);
  });

  bench('msgpack-decode-1k', () => {
    fromFrameMsgPack(pack1k);
  });

  bench('msgpack-decode-10k', () => {
    fromFrameMsgPack(pack10k);
  });
});
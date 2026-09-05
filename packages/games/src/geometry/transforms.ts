export function transform(point: DOMPointInit, transform: DOMMatrix2DInit = IDENTITY) {
  return new DOMPoint(point.x, point.y).matrixTransform(transform);
}

export const IDENTITY: DOMMatrix2DInit = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

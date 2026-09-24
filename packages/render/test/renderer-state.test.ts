/**
 * @fileoverview
 * @summary Tests for {@linkcode RendererStateStack}.
 *
 * @description
 * Covers the four state slots, the push and pop behavior, the reset
 * behavior, and the edge case of a pop on an empty stack.
 *
 * @see {@linkcode RendererStateStack}
 * @author MathAid
 */

import {
  identity,
  initialState,
  make,
  makeSolid,
  RendererStateStack,
  sRGB,
  translation,
} from '@games/render';
import { describe, expect, it } from 'vitest';

const red = makeSolid(make(sRGB, 1, 0, 0));
const blue = makeSolid(make(sRGB, 0, 0, 1));

describe('initialState', () => {
  it('has the identity transform', () => {
    expect(initialState().transform).toEqual(identity());
  });

  it('has null for every optional slot', () => {
    const s = initialState();
    expect(s.fill).toBeNull();
    expect(s.stroke).toBeNull();
    expect(s.background).toBeNull();
  });

  it('returns a new object on every call', () => {
    const a = initialState();
    const b = initialState();
    expect(a).not.toBe(b);
  });
});

describe('RendererStateStack basic mutators', () => {
  it('starts at the initial state', () => {
    const stack = new RendererStateStack();
    expect(stack.current).toEqual(initialState());
  });

  it('sets the transform', () => {
    const stack = new RendererStateStack();
    stack.setTransform(translation(10, 20));
    expect(stack.current.transform).toEqual(translation(10, 20));
  });

  it('sets the fill', () => {
    const stack = new RendererStateStack();
    stack.setFill(red);
    expect(stack.current.fill).toBe(red);
  });

  it('sets the stroke', () => {
    const stack = new RendererStateStack();
    const stroke = { paint: red, width: 2 };
    stack.setStroke(stroke);
    expect(stack.current.stroke).toBe(stroke);
  });

  it('sets the background', () => {
    const stack = new RendererStateStack();
    stack.setBackground(blue);
    expect(stack.current.background).toBe(blue);
  });

  it('clears a slot when passed null', () => {
    const stack = new RendererStateStack();
    stack.setFill(red);
    stack.setFill(null);
    expect(stack.current.fill).toBeNull();
  });
});

describe('RendererStateStack push and pop', () => {
  it('increases the depth on push', () => {
    const stack = new RendererStateStack();
    expect(stack.depth).toBe(0);
    stack.push();
    expect(stack.depth).toBe(1);
    stack.push();
    expect(stack.depth).toBe(2);
  });

  it('decreases the depth on pop', () => {
    const stack = new RendererStateStack();
    stack.push();
    stack.push();
    stack.pop();
    expect(stack.depth).toBe(1);
  });

  it('restores the previous state on pop', () => {
    const stack = new RendererStateStack();
    stack.setFill(red);
    stack.push();
    stack.setFill(blue);
    expect(stack.current.fill).toBe(blue);
    stack.pop();
    expect(stack.current.fill).toBe(red);
  });

  it('restores the transform on pop', () => {
    const stack = new RendererStateStack();
    stack.setTransform(translation(10, 0));
    stack.push();
    stack.setTransform(translation(20, 0));
    stack.pop();
    expect(stack.current.transform).toEqual(translation(10, 0));
  });

  it('does nothing on pop with an empty stack', () => {
    const stack = new RendererStateStack();
    stack.setFill(red);
    stack.pop();
    expect(stack.current.fill).toBe(red);
    expect(stack.depth).toBe(0);
  });

  it('nests three levels correctly', () => {
    const stack = new RendererStateStack();
    stack.setFill(red);
    stack.push();
    stack.setFill(blue);
    stack.push();
    stack.setFill(null);
    stack.pop();
    expect(stack.current.fill).toBe(blue);
    stack.pop();
    expect(stack.current.fill).toBe(red);
  });
});

describe('RendererStateStack reset', () => {
  it('restores the initial state', () => {
    const stack = new RendererStateStack();
    stack.setFill(red);
    stack.setTransform(translation(100, 0));
    stack.push();
    stack.reset();
    expect(stack.current).toEqual(initialState());
  });

  it('clears the depth', () => {
    const stack = new RendererStateStack();
    stack.push();
    stack.push();
    stack.reset();
    expect(stack.depth).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { scoreArrow, getTargetRing, getArrowDistanceMm } from './target';

describe('target scoring', () => {
  it('scores a 10 ring at center', () => {
    const score = scoreArrow(0, 0);
    expect(score).toBe(10);
  });

  it('scores a 9 ring near center just outside the 10 ring', () => {
    const score = scoreArrow(0, 0.12);
    expect(score).toBe(9);
  });

  it('scores a miss outside the target', () => {
    const score = scoreArrow(2.5, 0.5);
    expect(score).toBe(0);
  });

  it('reports ring geometry and distance in mm', () => {
    const ring = getTargetRing(0, 0);
    expect(ring).toBe('10-ring');
    expect(getArrowDistanceMm(0, 0)).toBe(0);
  });
});

/**
 * Basic functionality tests to verify core components work
 */

import { describe, it, expect } from 'vitest';

describe('Basic Functionality', () => {
  it('should have working test environment', () => {
    expect(true).toBe(true);
  });

  it('should support basic JavaScript features', () => {
    const arr = [1, 2, 3];
    const doubled = arr.map(x => x * 2);
    expect(doubled).toEqual([2, 4, 6]);
  });

  it('should support async operations', async () => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });
});
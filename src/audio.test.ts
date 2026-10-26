import { describe, expect, it } from 'vitest';
import { clock } from './audio';

describe('clock', () => {
  it('shows minutes and seconds', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(7.9)).toBe('0:07');
    expect(clock(30)).toBe('0:30');
    expect(clock(75)).toBe('1:15');
  });
});

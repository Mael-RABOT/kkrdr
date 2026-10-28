import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { balance, TITLES, titleById } from './shop';

describe('shop', () => {
  it('has unique ids and positive prices', () => {
    expect(new Set(TITLES.map((t) => t.id)).size).toBe(TITLES.length);
    for (const t of TITLES) expect(t.price).toBeGreaterThan(0);
  });
  it('finds titles by id', () => {
    expect(titleById('master')?.price).toBe(50);
    expect(titleById('nope')).toBeUndefined();
    expect(titleById(undefined)).toBeUndefined();
  });
  it('never goes below zero', () => {
    expect(balance(12, 5)).toBe(7);
    expect(balance(3, 5)).toBe(0);
  });
  it('matches the prices in firestore.rules', () => {
    const rules = readFileSync('firestore.rules', 'utf8');
    const block = /function prices\(\) \{\s*return \{([^}]*)\}/.exec(rules)?.[1] ?? '';
    const inRules = Object.fromEntries([...block.matchAll(/'(\w+)':\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]));
    expect(inRules).toEqual(Object.fromEntries(TITLES.map((t) => [t.id, t.price])));
  });
});

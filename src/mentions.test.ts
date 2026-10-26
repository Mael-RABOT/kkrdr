import { describe, expect, it } from 'vitest';
import { mentionedIds, mentionQuery, splitMentions, suggest } from './mentions';
import type { User } from './types';

const user = (id: string, name: string, active = true): User => ({ id, name, admin: false, active });
const users = [user('a', 'Sam'), user('b', 'Sam Lee'), user('c', 'Lou'), user('d', 'Old', false)];

describe('mentionQuery', () => {
  it('finds the @ being typed', () => {
    expect(mentionQuery('hi @Sa', 6)).toEqual({ start: 3, query: 'Sa' });
    expect(mentionQuery('@', 1)).toEqual({ start: 0, query: '' });
    expect(mentionQuery('@Sam L', 6)).toEqual({ start: 0, query: 'Sam L' });
  });
  it('ignores an @ inside a word, on another line or too far back', () => {
    expect(mentionQuery('me@home', 7)).toBeNull();
    expect(mentionQuery('@Sam\nok', 7)).toBeNull();
    expect(mentionQuery('no mention', 10)).toBeNull();
    expect(mentionQuery('@' + 'x'.repeat(31), 32)).toBeNull();
  });
});

describe('suggest', () => {
  it('lists active users starting with the query, any case', () => {
    expect(suggest(users, 'sam').map((u) => u.id)).toEqual(['a', 'b']);
    expect(suggest(users, 'Sam L').map((u) => u.id)).toEqual(['b']);
    expect(suggest(users, 'o').map((u) => u.id)).toEqual([]);
  });
});

describe('splitMentions', () => {
  it('picks the longest name and keeps the rest as text', () => {
    expect(splitMentions('@Sam Lee nice one @lou!', users)).toEqual([{ user: users[1] }, ' nice one ', { user: users[2] }, '!']);
    expect(splitMentions('@Sam, again', users)).toEqual([{ user: users[0] }, ', again']);
  });
  it('leaves unknown names, emails and run-on names alone', () => {
    expect(splitMentions('@Bob hi', users)).toEqual(['@Bob hi']);
    expect(splitMentions('me@Sam', users)).toEqual(['me@Sam']);
    expect(splitMentions('@Samuel', users)).toEqual(['@Samuel']);
  });
});

describe('mentionedIds', () => {
  it('lists each tagged user once', () => {
    expect(mentionedIds('@Sam Lee and @lou, @Lou again', users, 'x')).toEqual(['b', 'c']);
  });
  it('leaves out the author and text that is no mention', () => {
    expect(mentionedIds('@Sam me@Lou @Samuel @nobody', users, 'a')).toEqual([]);
  });
});

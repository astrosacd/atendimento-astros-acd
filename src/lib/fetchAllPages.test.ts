import { describe, expect, test } from 'bun:test';
import { fetchAllPages } from './fetchAllPages';

describe('complete synchronized number loading', () => {
  test('returns all 1001 numbers, including the number beyond the API limit', async () => {
    const source = Array.from({ length: 1001 }, (_, id) => ({ id }));
    const ranges: number[][] = [];
    const rows = await fetchAllPages((from, to) => {
      ranges.push([from, to]);
      return Promise.resolve({ data: source.slice(from, to + 1), error: null });
    });
    expect(rows).toEqual(source);
    expect(rows[1000]).toEqual({ id: 1000 });
    expect(ranges).toEqual([[0, 999], [1000, 1999]]);
  });

  test('loads exact multiples without duplicates and stops on the empty final page', async () => {
    const source = Array.from({ length: 2000 }, (_, id) => id);
    let calls = 0;
    const rows = await fetchAllPages((from, to) => {
      calls++;
      return Promise.resolve({ data: source.slice(from, to + 1), error: null });
    });
    expect(rows).toEqual(source);
    expect(calls).toBe(3);
  });

  test('rejects a failed later page instead of returning incomplete numbers', async () => {
    const failure = new Error('page unavailable');
    await expect(fetchAllPages((from) => Promise.resolve(from === 0
      ? { data: Array.from({ length: 1000 }, (_, id) => id), error: null }
      : { data: null, error: failure }))).rejects.toThrow('page unavailable');
  });
});
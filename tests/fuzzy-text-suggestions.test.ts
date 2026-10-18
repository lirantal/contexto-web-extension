import { describe, expect, it } from 'vitest';
import { rankFuzzyTextSuggestions } from '@/src/shared/fuzzy-text-suggestions';

describe('rankFuzzyTextSuggestions', () => {
  it('returns no suggestions until a query is entered', () => {
    expect(rankFuzzyTextSuggestions(['Berlin'], '   ')).toEqual([]);
  });

  it('ranks exact, prefix, substring, and fuzzy matches in that order', () => {
    expect(rankFuzzyTextSuggestions([
      'B E R L I N',
      'East Berlin',
      'Berliner Platz',
      'Berlin',
    ], 'BERLIN')).toEqual([
      'Berlin',
      'Berliner Platz',
      'East Berlin',
      'B E R L I N',
    ]);
  });

  it('matches query characters in order across a location', () => {
    expect(rankFuzzyTextSuggestions(
      ['San Francisco', 'France', 'Frankfurt', 'Berlin'],
      'sfr',
    )).toEqual(['San Francisco']);
  });

  it('rejects fuzzy candidates whose characters are out of order', () => {
    expect(rankFuzzyTextSuggestions(['San Francisco'], 'fsz')).toEqual([]);
  });

  it('uses alphabetical order to break equal scores', () => {
    expect(rankFuzzyTextSuggestions(['San Francisco', 'San Fernando'], 'sf'))
      .toEqual(['San Fernando', 'San Francisco']);
  });
});

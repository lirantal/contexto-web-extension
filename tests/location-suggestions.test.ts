import { describe, expect, it } from 'vitest';
import { rankLocationSuggestions } from '@/src/shared/location-suggestions';

describe('rankLocationSuggestions', () => {
  it('returns no suggestions until a query is entered', () => {
    expect(rankLocationSuggestions(['Berlin'], '   ')).toEqual([]);
  });

  it('ranks exact, prefix, substring, and fuzzy matches in that order', () => {
    expect(rankLocationSuggestions([
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
    expect(rankLocationSuggestions(
      ['San Francisco', 'France', 'Frankfurt', 'Berlin'],
      'sfr',
    )).toEqual(['San Francisco']);
  });

  it('rejects fuzzy candidates whose characters are out of order', () => {
    expect(rankLocationSuggestions(['San Francisco'], 'fsz')).toEqual([]);
  });

  it('uses alphabetical order to break equal scores', () => {
    expect(rankLocationSuggestions(['San Francisco', 'San Fernando'], 'sf'))
      .toEqual(['San Fernando', 'San Francisco']);
  });
});

function normalizeFuzzyText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function fuzzyGapCount(candidate: string, query: string): number | undefined {
  let candidateIndex = 0;
  let previousMatch = -1;
  let gaps = 0;

  for (const character of query) {
    const matchIndex = candidate.indexOf(character, candidateIndex);
    if (matchIndex < 0) return undefined;
    if (previousMatch >= 0) gaps += matchIndex - previousMatch - 1;
    previousMatch = matchIndex;
    candidateIndex = matchIndex + 1;
  }

  return gaps;
}

function scoreFuzzyText(candidate: string, query: string): number | undefined {
  if (candidate === query) return 0;
  if (candidate.startsWith(query)) return 1;
  if (candidate.includes(query)) return 2;

  const gaps = fuzzyGapCount(candidate, query);
  return gaps === undefined ? undefined : 3 + gaps / 1000;
}

export function rankFuzzyTextSuggestions(suggestions: string[], query: string): string[] {
  const normalizedQuery = normalizeFuzzyText(query);
  if (!normalizedQuery) return [];

  return suggestions
    .map((suggestion) => ({
      suggestion,
      score: scoreFuzzyText(normalizeFuzzyText(suggestion), normalizedQuery),
    }))
    .filter((candidate): candidate is { suggestion: string; score: number } =>
      candidate.score !== undefined)
    .sort((left, right) =>
      left.score - right.score || left.suggestion.localeCompare(right.suggestion))
    .map(({ suggestion }) => suggestion);
}

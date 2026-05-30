export function parseWorkaroundTokens(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function shuffleWorkaroundTokens(tokens: readonly string[]): string[] {
  const shuffled = [...tokens];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

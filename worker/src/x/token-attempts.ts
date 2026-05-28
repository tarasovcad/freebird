import {XExtractError} from "./errors";

export async function fetchWithTokenAttempts<T>(
  tokens: readonly string[],
  simultaneousRequests: number,
  requestWithToken: (token: string) => Promise<T>,
): Promise<T> {
  let lastError: XExtractError | null = null;

  for (let index = 0; index < tokens.length; index += simultaneousRequests) {
    const batch = tokens.slice(index, index + simultaneousRequests);

    try {
      return await Promise.any(batch.map((token) => requestWithToken(token)));
    } catch (error) {
      lastError = getLastAttemptError(error, lastError);
    }
  }

  throw lastError ?? new XExtractError(400, "Extract error");
}

export function normalizeSimultaneousRequests(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.floor(value));
}

function getLastAttemptError(error: unknown, fallback: XExtractError | null): XExtractError | null {
  if (error instanceof AggregateError) {
    const aggregate = error.errors;
    for (let index = aggregate.length - 1; index >= 0; index -= 1) {
      const entry = aggregate[index];
      if (entry instanceof XExtractError) {
        return entry;
      }
    }

    return fallback;
  }

  if (error instanceof XExtractError) {
    return error;
  }

  return fallback;
}

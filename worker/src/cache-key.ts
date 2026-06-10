export function buildCacheKey(
  reqUrl: string,
  urlParam: string | undefined,
  methodParam: string | undefined,
  formatParam: string | undefined,
): Request {
  const {origin} = new URL(reqUrl);
  const canonical = new URL(`${origin}/status`);
  if (urlParam) canonical.searchParams.set("url", urlParam);
  if (methodParam) canonical.searchParams.set("method", methodParam);
  canonical.searchParams.set("format", canonicalizeFormat(formatParam));
  return new Request(canonical.toString(), {method: "GET"});
}

// Collapses format aliases to their canonical name so they share a cache entry.
// Unknown values are preserved so invalid requests don't accidentally hit a
// real cached response.
function canonicalizeFormat(value: string | undefined): string {
  switch (value) {
    case undefined:
    case "full":
    case "raw":
      return "full";
    case "simple":
    case "simplified":
      return "simple";
    default:
      return value;
  }
}

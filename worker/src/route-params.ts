export function parseResponseFormat(value?: string): "full" | "simple" | null {
  if (!value) {
    return "full";
  }

  switch (value) {
    case "full":
    case "raw":
      return "full";
    case "simple":
    case "simplified":
      return "simple";
    default:
      return null;
  }
}

export function parseLanguageParam(value?: string): string | null {
  if (!value) {
    return null;
  }

  const language = value.trim().toLowerCase();
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(language) ? language : null;
}

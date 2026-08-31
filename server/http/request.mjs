export function getHeader(headers, name) {
  if (!headers) {
    return undefined;
  }
  const expected = name.toLowerCase();
  return Object.entries(headers).find(([key]) => key.toLowerCase() === expected)?.[1];
}

export function normalizePath(path) {
  const normalized = path.replace(/\/+$/, "") || "/";
  if (normalized.startsWith("/.netlify/functions/api/")) {
    return normalized.replace("/.netlify/functions/api/", "/api/");
  }
  if (normalized === "/.netlify/functions/api") {
    return "/api";
  }
  return normalized;
}

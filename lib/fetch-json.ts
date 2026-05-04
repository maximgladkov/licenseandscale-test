function readFetchError(res: Response, data: unknown): string {
  if (
    typeof data === "object" &&
    data !== null &&
    "message" in data &&
    typeof (data as { message: unknown }).message === "string"
  ) {
    return (data as { message: string }).message;
  }
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "string"
  ) {
    return (data as { error: string }).error;
  }
  return `Request failed (${res.status})`;
}

export async function fetchJson<T>(
  url: string,
  parse: (json: unknown) => T,
): Promise<T> {
  const r = await fetch(url);
  const json = (await r.json()) as unknown;
  if (!r.ok) {
    throw new Error(readFetchError(r, json));
  }
  return parse(json);
}

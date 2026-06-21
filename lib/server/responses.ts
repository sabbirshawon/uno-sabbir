export function ok<T>(data: T, status = 200) {
  return Response.json(data, { status });
}

export function fail(error: unknown, fallback = "Something went wrong") {
  if (error instanceof Response) return error;

  const message = error instanceof Error ? error.message : fallback;
  const lower = message.toLowerCase();
  const status = lower.includes("not found")
    ? 404
    : lower.includes("permission") || lower.includes("only the host") || lower.includes("not your turn") || lower.includes("not in this room")
      ? 403
      : lower.includes("required") || lower.includes("choose") || lower.includes("cannot") || lower.includes("already") || lower.includes("full")
        ? 400
        : 500;

  return Response.json({ error: message }, { status });
}

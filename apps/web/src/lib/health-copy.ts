export function healthSummary(status: "ok" | "degraded" | "unreachable"): string {
  if (status === "ok") {
    return "The workspace is up.";
  }
  if (status === "degraded") {
    return "The workspace is having trouble reaching a service it needs.";
  }
  return "The workspace could not be reached. Check the connection and try again.";
}

export function checkLabel(name: "database" | "redis", state: "ok" | "error"): string {
  if (name === "database") {
    return state === "ok" ? "Database is reachable." : "Database is not reachable.";
  }
  return state === "ok" ? "Background jobs are reachable." : "Background jobs are not reachable.";
}

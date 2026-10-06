export type AccuracyReport = {
  matched: number;
  total: number;
  misses: string[];
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function fieldAccuracy(expected: unknown, actual: unknown, path = "$"): AccuracyReport {
  if (Array.isArray(expected) || Array.isArray(actual)) {
    const left = Array.isArray(expected) ? expected : [];
    const right = Array.isArray(actual) ? actual : [];
    const length = Math.max(left.length, right.length);
    const report: AccuracyReport = { matched: 0, total: 0, misses: [] };
    if (left.length !== right.length) {
      report.total += 1;
      report.misses.push(`${path}.length`);
    } else if (length === 0) {
      report.total += 1;
      report.matched += 1;
    }
    for (let index = 0; index < length; index += 1) {
      const child = fieldAccuracy(left[index], right[index], `${path}[${index}]`);
      report.matched += child.matched;
      report.total += child.total;
      report.misses.push(...child.misses);
    }
    return report;
  }

  if (isRecord(expected) || isRecord(actual)) {
    const left = isRecord(expected) ? expected : {};
    const right = isRecord(actual) ? actual : {};
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    const report: AccuracyReport = { matched: 0, total: 0, misses: [] };
    for (const key of keys) {
      const child = fieldAccuracy(left[key], right[key], `${path}.${key}`);
      report.matched += child.matched;
      report.total += child.total;
      report.misses.push(...child.misses);
    }
    return report;
  }

  const same =
    typeof expected === "string" && typeof actual === "string"
      ? normalize(expected) === normalize(actual)
      : expected === actual;
  return same ? { matched: 1, total: 1, misses: [] } : { matched: 0, total: 1, misses: [path] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

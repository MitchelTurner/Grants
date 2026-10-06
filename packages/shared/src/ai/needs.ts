const NEEDS = /\[NEEDS:\s*([^\]]+)\]/g;

export function needsMarkers(body: string): string[] {
  return [...body.matchAll(NEEDS)].map((match) => (match[1] ?? "").trim()).filter(Boolean);
}

export function limitsFromText(limit: string): {
  wordLimit: number | null;
  charLimit: number | null;
} {
  const words = /(\d[\d,]*)\s*words?/i.exec(limit);
  const chars = /(\d[\d,]*)\s*characters?/i.exec(limit);
  const parse = (value: string | undefined) => {
    if (!value) return null;
    const number = Number(value.replace(/,/g, ""));
    return Number.isFinite(number) && number > 0 ? number : null;
  };
  return { wordLimit: parse(words?.[1]), charLimit: parse(chars?.[1]) };
}

export function registrationWarnings(registrations: string[], uei: string | null): string[] {
  const needsSam = registrations.some((item) => /sam\.gov|\buei\b|unique entity/i.test(item));
  if (needsSam && !uei) {
    return ["This RFP asks for SAM.gov, and the organization profile has no UEI yet."];
  }
  return [];
}

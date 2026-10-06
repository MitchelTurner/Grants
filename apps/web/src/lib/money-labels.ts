export function paymentLabel(value: string): string {
  if (value === "ADVANCE") return "Paid up front";
  if (value === "MIXED") return "Mixed";
  return "Reimbursement";
}

export function categoryLabel(value: string): string {
  const labels: Record<string, string> = {
    PERSONNEL: "Personnel",
    FRINGE: "Fringe",
    TRAVEL: "Travel",
    FREIGHT: "Freight",
    EQUIPMENT: "Equipment",
    SUPPLIES: "Supplies",
    CONTRACTUAL: "Contractual",
    CONSTRUCTION: "Construction",
    OTHER: "Other",
    INDIRECT: "Indirect",
  };
  return labels[value] ?? "Other";
}

export function reportKindLabel(value: string): string {
  const labels: Record<string, string> = {
    PROGRESS: "Progress",
    FINANCIAL: "Financial",
    FINAL: "Final",
    OTHER: "Other",
  };
  return labels[value] ?? "Report";
}

export function interactionLabel(value: string): string {
  const labels: Record<string, string> = {
    CALL: "Call",
    EMAIL: "Email",
    MEETING: "Meeting",
    SITE_VISIT: "Site visit",
  };
  return labels[value] ?? "Note";
}

export function reimbursementLabel(value: string): string {
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    SUBMITTED: "Submitted",
    PAID: "Paid",
    CANCELED: "Canceled",
  };
  return labels[value] ?? value;
}

export function planLabel(value: string): string {
  if (value === "PRO") return "Pro";
  if (value === "SPONSORED") return "Sponsored";
  return "Free";
}

export function todayInput(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function toIso(local: string): string | null {
  if (!local.trim()) return null;
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "Could not save that.";
}

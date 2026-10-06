import type { ChecklistKind, FunderType } from "./enums";

export type ChecklistTemplateItem = {
  label: string;
  kind: ChecklistKind;
};

export function checklistForFunder(funderType: FunderType | null): ChecklistTemplateItem[] {
  const items: ChecklistTemplateItem[] = [
    { label: "Narrative", kind: "NARRATIVE" },
    { label: "Budget", kind: "BUDGET" },
    { label: "Attachments", kind: "ATTACHMENT" },
  ];
  if (funderType === "FEDERAL") {
    return [
      { label: "Confirm SAM.gov registration is active", kind: "REGISTRATION" },
      ...items,
      { label: "Authorized signature", kind: "SIGNATURE" },
    ];
  }
  return [...items, { label: "Signature", kind: "SIGNATURE" }];
}

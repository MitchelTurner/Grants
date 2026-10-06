export const NEXT_ACTION_PRIORITY = {
  compliance: 0,
  application: 1,
  document: 2,
  opportunity: 3,
} as const;

export type NextActionType = keyof typeof NEXT_ACTION_PRIORITY;

export type NextAction = {
  type: NextActionType;
  title: string;
  dueAt: string;
  href: string;
};

/**
 * Sort by due date, then type priority (compliance, application, document, opportunity).
 * SPEC §8 F13. Callers already filter by the due window.
 */
export function rankNextActions(actions: NextAction[], limit = 5): NextAction[] {
  return [...actions]
    .sort((left, right) => {
      const byDate = left.dueAt.localeCompare(right.dueAt);
      if (byDate !== 0) return byDate;
      return NEXT_ACTION_PRIORITY[left.type] - NEXT_ACTION_PRIORITY[right.type];
    })
    .slice(0, limit);
}

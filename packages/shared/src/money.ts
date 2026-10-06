import Decimal from "decimal.js";

const MONEY = /^\d+(\.\d{1,2})?$/;

export function isMoneyString(value: string): boolean {
  return MONEY.test(value);
}

/** Display-only. Arithmetic stays on Decimal so JSON money is never a float. */
export function formatMoney(value: string | null | undefined): string {
  if (value == null || value === "") {
    return "Amount not set";
  }
  const fixed = new Decimal(value).toFixed(2);
  const [whole, cents] = fixed.split(".");
  const withCommas = (whole ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${withCommas}.${cents ?? "00"}`;
}

export function compareMoney(left: string, right: string): number {
  return new Decimal(left).comparedTo(new Decimal(right));
}

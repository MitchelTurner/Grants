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

export function addMoney(values: Array<string | null | undefined>): string {
  return values
    .reduce((sum, value) => (value ? sum.plus(value) : sum), new Decimal(0))
    .toFixed(2);
}

export function multiplyMoney(left: string, right: string): string {
  return new Decimal(left).times(right).toFixed(2);
}

export function subtractMoney(left: string, right: string): string {
  const gap = new Decimal(left).minus(right);
  return gap.isNegative() ? "0.00" : gap.toFixed(2);
}

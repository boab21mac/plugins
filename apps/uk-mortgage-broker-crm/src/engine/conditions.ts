import type { Condition } from "../types";

export function isShown(showIf: Condition[] | undefined, answers: Record<string, unknown>): boolean {
  if (!showIf || showIf.length === 0) return true;
  return showIf.every((rule) => match(rule, answers[rule.field]));
}

function match(rule: Condition, raw: unknown): boolean {
  const value = Array.isArray(raw) ? raw.map(String).join(", ") : raw == null ? "" : String(raw);
  switch (rule.op) {
    case "eq":
      return value === String(rule.value ?? "");
    case "neq":
      return value !== String(rule.value ?? "");
    case "in":
      return Array.isArray(rule.value) ? rule.value.includes(value) : value === rule.value;
    case "notEmpty":
      return value.trim() !== "" && value !== "0";
    default:
      return true;
  }
}

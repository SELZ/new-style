import { invalidResponse } from "./errors.ts";

type JsonRecord = Record<string, unknown>;

export function record(value: unknown): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    invalidResponse();
  return value as JsonRecord;
}

export function list(value: unknown): unknown[] {
  // Uninitialized optional PHP arrays are encoded as null.
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) invalidResponse();
  return value;
}

export function text(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return invalidResponse();
}

export function requiredText(value: unknown): string {
  const result = text(value);
  if (!result.trim()) invalidResponse();
  return result;
}

export function number(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed))
    return null;
  const result = Number(trimmed);
  return Number.isFinite(result) ? result : null;
}

export function nonnegativeNumber(value: unknown): number | null {
  const result = number(value);
  return result !== null && result >= 0 ? result : null;
}

export function requiredNumber(value: unknown): number {
  const result = nonnegativeNumber(value);
  if (result === null) invalidResponse();
  return result;
}


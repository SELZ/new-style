export type ErrorCode =
  | "http"
  | "network"
  | "invalid-response"
  | "timeout"
  | "validation";

export class ApiError extends Error {
  readonly status: number | null;
  readonly code: ErrorCode;

  constructor(message: string, code: ErrorCode, status: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function getErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Не удалось выполнить запрос. Попробуйте ещё раз.";
}

export function invalidResponse(): never {
  throw new ApiError(
    "Сервер вернул некорректный ответ. Попробуйте позже.",
    "invalid-response",
  );
}


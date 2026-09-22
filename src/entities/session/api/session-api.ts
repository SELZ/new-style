import {
  ApiError, http, record, requiredText, text, type HttpClient,
} from "../../../shared/api/index.ts";
import type { Session } from "../model/types.ts";

export function createSessionApi(client: HttpClient) {
  return {
    async login(phone: string, password: string, signal?: AbortSignal): Promise<Session> {
      try {
        const row = record(await client.request("auth", { phone, password }, { signal }));
        return { token: requiredText(row.token), kkt: text(row.kkt) };
      } catch (error) {
        if (error instanceof ApiError && error.status === 400) {
          throw new ApiError("Неверный телефон или пароль.", "http", 400);
        }
        throw error;
      }
    },
  };
}

export const sessionApi = createSessionApi(http);

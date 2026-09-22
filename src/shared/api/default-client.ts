import { isDemoMode } from "../config/index.ts";
import { createDemoFetch } from "./demo.ts";
import { createHttpClient } from "./http.ts";

// One transport instance keeps demo sessions and account carts shared by all APIs.
export const http = createHttpClient(
  isDemoMode ? { baseUrl: "/b2b", fetch: createDemoFetch() } : {},
);

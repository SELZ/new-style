import { useState } from "react";
import type { Session } from "../entities/session/index.ts";
import { CatalogPage } from "../pages/catalog/index.ts";
import { LoginPage } from "../pages/login/index.ts";

export function App() {
  // Session credentials stay in memory; changing accounts remounts page state.
  const [session, setSession] = useState<Session | null>(null);
  return session
    ? <CatalogPage key={session.token} session={session} onLogout={() => setSession(null)} />
    : <LoginPage onLogin={setSession} />;
}

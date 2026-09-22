// Explicit opt-in: real HTTP is used unless demo mode is enabled.
export const isDemoMode = import.meta.env?.VITE_DEMO_MODE === "true";

// Public synthetic accounts for the local demo transport.
export const demoAccounts = [
  { login: "demo", password: "demo123" },
  { login: "manager", password: "manager123" },
] as const;


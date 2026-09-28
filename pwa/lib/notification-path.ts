/** Notifications only navigate to root-relative AAS paths. */
export function normalizeNotificationPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")
    || /[\\\u0000-\u0020\u007f]/.test(value)) return "/notifications";
  return value;
}

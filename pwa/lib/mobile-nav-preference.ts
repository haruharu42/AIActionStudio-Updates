export const MOBILE_NAV_PREFERENCE_KEY = "aas-pwa-bottom-nav-always";
export const MOBILE_NAV_PREFERENCE_EVENT = "aas-pwa-bottom-nav-preference";
export const MOBILE_NAV_ITEMS_KEY = "aas-pwa-bottom-nav-items";
export const MOBILE_NAV_ITEMS_EVENT = "aas-pwa-bottom-nav-items-preference";

export type MobileNavItemsPreferenceEventDetail = {
  userId: string;
  items: MobileNavItemKey[];
};

export type MobileNavItemKey =
  | "create"
  | "prompts"
  | "workflow"
  | "library"
  | "noteOps"
  | "accountDesign"
  | "images"
  | "tools"
  | "sns"
  | "sidejob"
  | "snsPlan"
  | "publish"
  | "analytics"
  | "ranking"
  | "profile"
  | "missions"
  | "manual"
  | "settings"
  | "inquiries"
  | "adminDashboard"
  | "adminUsers"
  | "adminFree"
  | "adminSales"
  | "adminReleases"
  | "adminFeatures"
  | "adminNotifications"
  | "adminMfa"
  | "adminOperations"
  | "adminInquiries"
  | "adminDevPrompts";

export type MobileNavItem = {
  key: MobileNavItemKey;
  label: string;
  icon: string;
  href: string;
};

const FALLBACK_MOBILE_NAV_ITEM: MobileNavItem = { key: "create", label: "作成", icon: "＋", href: "/create" };

export const USER_MOBILE_NAV_ITEM_OPTIONS: readonly MobileNavItem[] = [
  FALLBACK_MOBILE_NAV_ITEM,
  { key: "prompts", label: "プロンプト", icon: "⌘", href: "/prompts" },
  { key: "workflow", label: "運営", icon: "◎", href: "/workflow" },
  { key: "library", label: "ライブラリ", icon: "▤", href: "/?section=library" },
  { key: "noteOps", label: "note運営", icon: "▣", href: "/note-operations" },
  { key: "accountDesign", label: "設計", icon: "◫", href: "/account-design" },
  { key: "images", label: "画像", icon: "▧", href: "/images" },
  { key: "tools", label: "機能", icon: "▦", href: "/tools" },
  { key: "sns", label: "SNS", icon: "↗", href: "/sns" },
  { key: "sidejob", label: "副業", icon: "◇", href: "/side-hustles/sidejob-planner" },
  { key: "snsPlan", label: "SNS設計", icon: "◎", href: "/sns-plan" },
  { key: "publish", label: "公開", icon: "⇧", href: "/publish" },
  { key: "analytics", label: "分析", icon: "▥", href: "/analytics" },
  { key: "ranking", label: "ランキング", icon: "♛", href: "/ranking" },
  { key: "profile", label: "プロフィール", icon: "♙", href: "/profile" },
  { key: "missions", label: "ミッション", icon: "♧", href: "/missions" },
  { key: "manual", label: "使い方", icon: "?", href: "/manual" },
  { key: "settings", label: "設定", icon: "⚙", href: "/settings" },
  { key: "inquiries", label: "問い合わせ", icon: "✉", href: "/inquiries" },
] as const;

export const ADMIN_MOBILE_NAV_ITEM_OPTIONS: readonly MobileNavItem[] = [
  { key: "adminInquiries", label: "問合せ確認", icon: "✉", href: "/admin/inquiries" },
  { key: "adminDevPrompts", label: "開発依頼", icon: "⌘", href: "/admin/development-prompts" },
  { key: "adminDashboard", label: "管理", icon: "◆", href: "/admin" },
  { key: "adminUsers", label: "ユーザー", icon: "♟", href: "/admin/users" },
  { key: "adminFree", label: "無料設定", icon: "◉", href: "/admin/free-trial" },
  { key: "adminSales", label: "販売", icon: "¥", href: "/admin/sales" },
  { key: "adminReleases", label: "更新管理", icon: "↻", href: "/admin/releases" },
  { key: "adminFeatures", label: "機能管理", icon: "◫", href: "/admin/features" },
  { key: "adminNotifications", label: "通知管理", icon: "🔔", href: "/admin/notifications" },
  { key: "adminMfa", label: "MFA", icon: "◇", href: "/admin/security" },
  { key: "adminOperations", label: "運用", icon: "⚑", href: "/admin/operations" },
] as const;

export const MOBILE_NAV_ITEM_OPTIONS: readonly MobileNavItem[] = [
  ...USER_MOBILE_NAV_ITEM_OPTIONS,
  ...ADMIN_MOBILE_NAV_ITEM_OPTIONS,
] as const;

export const DEFAULT_MOBILE_NAV_ITEMS: readonly MobileNavItemKey[] = ["tools", "create", "library", "settings"];
export const MAX_CUSTOM_MOBILE_NAV_ITEMS = 4;

const USER_VALID_MOBILE_NAV_KEYS = new Set<MobileNavItemKey>(USER_MOBILE_NAV_ITEM_OPTIONS.map((item) => item.key));
const ADMIN_VALID_MOBILE_NAV_KEYS = new Set<MobileNavItemKey>(ADMIN_MOBILE_NAV_ITEM_OPTIONS.map((item) => item.key));

export function mobileNavOptionsFor(isAdmin: boolean): readonly MobileNavItem[] {
  return isAdmin ? MOBILE_NAV_ITEM_OPTIONS : USER_MOBILE_NAV_ITEM_OPTIONS;
}

export function isAdminMobileNavItem(key: MobileNavItemKey): boolean {
  return ADMIN_VALID_MOBILE_NAV_KEYS.has(key);
}

export function readMobileNavAlways(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(MOBILE_NAV_PREFERENCE_KEY) !== "0";
}

export function writeMobileNavAlways(value: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MOBILE_NAV_PREFERENCE_KEY, value ? "1" : "0");
  window.dispatchEvent(new CustomEvent<boolean>(MOBILE_NAV_PREFERENCE_EVENT, { detail: value }));
}

export function normalizeMobileNavItems(value: unknown, isAdmin = false): MobileNavItemKey[] {
  const next: MobileNavItemKey[] = [];
  const allowedKeys = isAdmin
    ? new Set<MobileNavItemKey>([...USER_VALID_MOBILE_NAV_KEYS, ...ADMIN_VALID_MOBILE_NAV_KEYS])
    : USER_VALID_MOBILE_NAV_KEYS;

  if (Array.isArray(value)) {
    for (const raw of value) {
      if (typeof raw !== "string" || !allowedKeys.has(raw as MobileNavItemKey)) continue;
      const key = raw as MobileNavItemKey;
      if (!next.includes(key)) next.push(key);
      if (next.length >= MAX_CUSTOM_MOBILE_NAV_ITEMS) break;
    }
  }

  for (const fallback of DEFAULT_MOBILE_NAV_ITEMS) {
    if (next.length >= MAX_CUSTOM_MOBILE_NAV_ITEMS) break;
    if (!next.includes(fallback)) next.push(fallback);
  }

  for (const option of mobileNavOptionsFor(isAdmin)) {
    if (next.length >= MAX_CUSTOM_MOBILE_NAV_ITEMS) break;
    if (!next.includes(option.key)) next.push(option.key);
  }

  return next.slice(0, MAX_CUSTOM_MOBILE_NAV_ITEMS);
}

export function mobileNavItemsStorageKey(userId?: string | null): string {
  const normalized = userId?.trim();
  return normalized ? `${MOBILE_NAV_ITEMS_KEY}:${normalized}` : MOBILE_NAV_ITEMS_KEY;
}

export function readMobileNavItems(userId?: string | null, isAdmin = false): MobileNavItemKey[] {
  if (typeof window === "undefined") return [...DEFAULT_MOBILE_NAV_ITEMS];
  const scopedKey = mobileNavItemsStorageKey(userId);
  let stored = window.localStorage.getItem(scopedKey);

  // Keep the old device setting as a one-way fallback so existing users do not
  // lose their layout when account-scoped storage is introduced.
  if (stored === null && scopedKey !== MOBILE_NAV_ITEMS_KEY) {
    stored = window.localStorage.getItem(MOBILE_NAV_ITEMS_KEY);
  }
  if (stored === null) return [...DEFAULT_MOBILE_NAV_ITEMS];

  try {
    return normalizeMobileNavItems(JSON.parse(stored), isAdmin);
  } catch {
    return [...DEFAULT_MOBILE_NAV_ITEMS];
  }
}

export function writeMobileNavItems(
  value: readonly MobileNavItemKey[],
  userId?: string | null,
  isAdmin = false,
): MobileNavItemKey[] {
  const next = normalizeMobileNavItems([...value], isAdmin);
  if (typeof window === "undefined") return next;

  const normalizedUserId = userId?.trim() ?? "";
  const key = mobileNavItemsStorageKey(normalizedUserId);
  window.localStorage.setItem(key, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent<MobileNavItemsPreferenceEventDetail>(MOBILE_NAV_ITEMS_EVENT, {
    detail: { userId: normalizedUserId, items: next },
  }));
  return next;
}

export function mobileNavItemFor(key: MobileNavItemKey): MobileNavItem {
  return MOBILE_NAV_ITEM_OPTIONS.find((item) => item.key === key) ?? FALLBACK_MOBILE_NAV_ITEM;
}

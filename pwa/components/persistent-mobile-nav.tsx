"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { useSharedAccessState } from "@/components/access-state-provider";
import { AasReferenceBottomNav, type ReferenceNavKey } from "@/components/aas-reference-shell";
import {
  MOBILE_NAV_PREFERENCE_EVENT,
  MOBILE_NAV_PREFERENCE_KEY,
  readMobileNavAlways,
} from "@/features/navigation";
import { MOBILE_NAV_ITEM_OPTIONS } from "@/lib/mobile-nav-preference";

const HIDDEN_PREFIXES = ["/auth", "/invite", "/terms", "/privacy", "/ai-terms"];
const REFERENCE_SHELL_ROUTES = new Set(["/", "/create", "/ranking", "/profile"]);

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function activeKeyForPathname(pathname: string): ReferenceNavKey {
  const matches = MOBILE_NAV_ITEM_OPTIONS
    .filter((item) => {
      const path = item.href.split("?")[0] || "/";
      return path !== "/" && (pathname === path || pathname.startsWith(path + "/"));
    })
    .sort((a, b) => (b.href.split("?")[0]?.length ?? 0) - (a.href.split("?")[0]?.length ?? 0));
  return matches[0]?.key ?? "";
}

export function PersistentMobileNav() {
  const pathname = usePathname();
  const { state } = useSharedAccessState();
  const signedIn = state.kind !== "loading" && state.kind !== "unavailable" && state.kind !== "signed_out";
  const [alwaysShow, setAlwaysShow] = useState(true);

  useEffect(() => {
    const syncVisibility = () => setAlwaysShow(readMobileNavAlways());
    const onVisibilityPreference = (event: Event) => {
      const custom = event as CustomEvent<boolean>;
      setAlwaysShow(typeof custom.detail === "boolean" ? custom.detail : readMobileNavAlways());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === MOBILE_NAV_PREFERENCE_KEY) syncVisibility();
    };

    queueMicrotask(syncVisibility);
    window.addEventListener(MOBILE_NAV_PREFERENCE_EVENT, onVisibilityPreference);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(MOBILE_NAV_PREFERENCE_EVENT, onVisibilityPreference);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const hiddenRoute = HIDDEN_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
  const referenceShellRoute = REFERENCE_SHELL_ROUTES.has(pathname);
  const desktopNavActive = signedIn && !hiddenRoute;
  const mobileNavVisible = alwaysShow || pathname === "/settings";
  const renderGlobalNav = desktopNavActive && !referenceShellRoute;

  useEffect(() => {
    document.body.classList.toggle("aas-desktop-nav-active", desktopNavActive);
    return () => document.body.classList.remove("aas-desktop-nav-active");
  }, [desktopNavActive]);

  if (!renderGlobalNav) return null;

  const activeKey = activeKeyForPathname(pathname);

  return (
    <>
      {mobileNavVisible ? <div className="persistent-mobile-nav-spacer" aria-hidden="true" /> : null}
      <AasReferenceBottomNav active={activeKey} showMobile={mobileNavVisible} />
    </>
  );
}

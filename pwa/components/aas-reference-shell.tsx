"use client";

import Link from "next/link";

import { SharedMobileBottomNav } from "@/components/shared-mobile-bottom-nav";
import { NotificationHeaderButton } from "@/components/notification-header-button";
import type { MobileNavItemKey } from "@/lib/mobile-nav-preference";
import { useEffect, useMemo, useState } from "react";

import {
  DEFAULT_DESKTOP_NAV_ITEMS,
  DESKTOP_NAV_ITEMS_EVENT,
  DESKTOP_NAV_ITEM_OPTIONS,
  MAX_DESKTOP_NAV_ITEMS,
  desktopNavItemFor,
  readDesktopNavItems,
  writeDesktopNavItems,
  type DesktopNavItemKey,
} from "@/lib/desktop-nav-preference";

export type ReferenceNavKey = "home" | MobileNavItemKey | "";

const AAS_BUILD_SHA = (process.env.NEXT_PUBLIC_AAS_BUILD_SHA ?? "dev").slice(0, 7);

export function AasReferenceHeader({
  hasUnreadNotifications = false,
  notificationHref = "/missions",
  notificationLabel = "ミッション・お知らせ",
}: {
  hasUnreadNotifications?: boolean;
  notificationHref?: string;
  notificationLabel?: string;
} = {}) {
  return (
    <header className="aas-reference-header">
      <Link className="aas-reference-brand" href="/" aria-label="AI Action Studio ホーム">
        <strong>AAS</strong>
        <span>
          <b>AI Action Studio</b>
          <small>AIで副業を、もっと簡単に。</small>
        </span>
      </Link>
      <span className="aas-reference-build" aria-label={`AAS build ${AAS_BUILD_SHA}`}>
        build {AAS_BUILD_SHA}
      </span>
      <nav className="aas-reference-header-actions" aria-label="クイックメニュー">
        <NotificationHeaderButton />
        <Link href={notificationHref} aria-label={notificationLabel}><span aria-hidden="true">♧</span>{hasUnreadNotifications ? <i aria-hidden="true" /> : null}</Link>
        <Link href="/settings" aria-label="メニュー"><span aria-hidden="true">☰</span></Link>
      </nav>
    </header>
  );
}

function NavItem({
  active,
  href,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  href: string;
  icon: string;
  label: string;
  onClick?: () => void;
}) {
  const className = active ? "active" : "";
  if (onClick) {
    return (
      <button className={className} type="button" aria-current={active ? "page" : undefined} onClick={onClick}>
        <span aria-hidden="true">{icon}</span>
        {label}
      </button>
    );
  }
  return (
    <Link className={className} href={href} aria-current={active ? "page" : undefined}>
      <span aria-hidden="true">{icon}</span>
      {label}
    </Link>
  );
}

function DesktopNavCustomizer({
  items,
  onChange,
  onClose,
}: {
  items: DesktopNavItemKey[];
  onChange: (items: DesktopNavItemKey[]) => void;
  onClose: () => void;
}) {
  const selected = useMemo(() => new Set(items), [items]);

  const toggle = (key: DesktopNavItemKey) => {
    if (selected.has(key)) {
      if (items.length <= 1) return;
      onChange(items.filter((item) => item !== key));
      return;
    }
    if (items.length >= MAX_DESKTOP_NAV_ITEMS) return;
    onChange([...items, key]);
  };

  const move = (key: DesktopNavItemKey, direction: -1 | 1) => {
    const index = items.indexOf(key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <section className="aas-desktop-nav-customizer" aria-label="PCナビのカスタマイズ">
      <header>
        <div>
          <strong>ナビをカスタマイズ</strong>
          <small>最大{MAX_DESKTOP_NAV_ITEMS}項目。表示・非表示と順番を変更できます。</small>
        </div>
        <button type="button" onClick={onClose} aria-label="カスタマイズを閉じる">×</button>
      </header>

      <div className="aas-desktop-nav-selected">
        {items.map((key, index) => {
          const item = desktopNavItemFor(key);
          return (
            <div key={key}>
              <span aria-hidden="true">{item.icon}</span>
              <strong>{item.label}</strong>
              <div>
                <button type="button" disabled={index === 0} onClick={() => move(key, -1)} aria-label={item.label + "を左へ"}>←</button>
                <button type="button" disabled={index === items.length - 1} onClick={() => move(key, 1)} aria-label={item.label + "を右へ"}>→</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="aas-desktop-nav-options">
        {DESKTOP_NAV_ITEM_OPTIONS.map((item) => {
          const checked = selected.has(item.key);
          const disabled = !checked && items.length >= MAX_DESKTOP_NAV_ITEMS;
          return (
            <label key={item.key}>
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(item.key)}
              />
              <span aria-hidden="true">{item.icon}</span>
              <strong>{item.label}</strong>
            </label>
          );
        })}
      </div>

      <footer>
        <button type="button" onClick={() => onChange([...DEFAULT_DESKTOP_NAV_ITEMS])}>初期状態に戻す</button>
        <small>ホームと設定は常に表示されます。</small>
      </footer>
    </section>
  );
}

export function AasReferenceBottomNav({
  active,
  onHome,
  onLibrary,
}: {
  active: ReferenceNavKey;
  onHome?: () => void;
  onLibrary?: () => void;
}) {
  const [desktopItems, setDesktopItems] = useState<DesktopNavItemKey[]>([...DEFAULT_DESKTOP_NAV_ITEMS]);
  const [customizing, setCustomizing] = useState(false);

  useEffect(() => {
    const sync = () => setDesktopItems(readDesktopNavItems());
    const onPreference = (event: Event) => {
      const custom = event as CustomEvent<DesktopNavItemKey[]>;
      setDesktopItems(Array.isArray(custom.detail) ? custom.detail : readDesktopNavItems());
    };
    queueMicrotask(sync);
    window.addEventListener(DESKTOP_NAV_ITEMS_EVENT, onPreference);
    return () => window.removeEventListener(DESKTOP_NAV_ITEMS_EVENT, onPreference);
  }, []);

  const updateDesktopItems = (next: DesktopNavItemKey[]) => {
    setDesktopItems(writeDesktopNavItems(next));
  };

  return (
    <>
      <SharedMobileBottomNav
        activeKey={active}
        onHome={onHome}
        onLibrary={onLibrary}
        className="aas-reference-mobile-main-nav"
      />

      <nav className="aas-reference-desktop-nav" aria-label="PCメインナビゲーション">
        <NavItem active={active === "home"} href="/" icon="⌂" label="ホーム" onClick={onHome} />
        {desktopItems.map((key) => {
          const item = desktopNavItemFor(key);
          const isActive = key === active;
          return (
            <NavItem
              key={key}
              active={isActive}
              href={item.href}
              icon={item.icon}
              label={item.label}
              onClick={key === "library" ? onLibrary : undefined}
            />
          );
        })}
        <NavItem active={active === "settings"} href="/settings" icon="⚙" label="設定" />
        <button
          className={customizing ? "customize active" : "customize"}
          type="button"
          aria-expanded={customizing}
          onClick={() => setCustomizing((value) => !value)}
        >
          <span aria-hidden="true">☷</span>
          カスタマイズ
        </button>
      </nav>

      {customizing && (
        <DesktopNavCustomizer
          items={desktopItems}
          onChange={updateDesktopItems}
          onClose={() => setCustomizing(false)}
        />
      )}
    </>
  );
}

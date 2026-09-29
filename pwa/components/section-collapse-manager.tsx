"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PANEL_SELECTOR = [
  "section.admin-panel",
  "article.admin-panel",
  "section.release-admin-panel",
  "section.knowledge-admin-panel",
  "section.admin-promo-panel",
  "section.prompt-admin-panel",
  "section.admin-dev-prompt-panel",
  "section.admin-card.admin-accounts-card",
  "section.admin-card.admin-selected-card",
  "section.admin-card.admin-code-card",
  "article.admin-action-card",
  "section.standalone-card",
  "section.creator-card",
  "section.workflow-panel",
  "section.note-ops-panel",
  "section.side-hustle-wizard-card",
  "section.account-design-panel",
  "section.support-panel",
  "section.tool-group-section",
  "section.action-prompt-recent",
  "section.knowledge-automation-panel",
].join(",");

const DIRECT_HEADER_SELECTOR = [
  ":scope > .admin-panel-heading",
  ":scope > .knowledge-panel-head",
  ":scope > .admin-promo-section-title",
  ":scope > .prompt-admin-panel-head",
  ":scope > .admin-section-head",
  ":scope > .admin-selected-head",
  ":scope > .admin-action-card-head",
  ":scope > .workflow-panel-head",
  ":scope > .note-ops-section-head",
  ":scope > .account-design-section-head",
  ":scope > .support-heading",
  ":scope > .knowledge-automation-head",
  ":scope > .section-title",
].join(",");

const INTERACTIVE_SELECTOR = "button,a,input,select,textarea,label,summary,[role='button']";

function collapseSlug(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^0-9a-z\u3040-\u30ff\u3400-\u9fff_-]/g, "")
    .slice(0, 72);
  return normalized || "section";
}

function directHeader(panel: HTMLElement): HTMLElement | null {
  const known = panel.querySelector<HTMLElement>(DIRECT_HEADER_SELECTOR);
  if (known) return known;

  const heading = panel.querySelector<HTMLElement>("h2,h3");
  if (!heading) return null;

  let candidate: HTMLElement = heading;
  while (candidate.parentElement && candidate.parentElement !== panel) {
    candidate = candidate.parentElement;
  }
  return candidate.parentElement === panel ? candidate : null;
}

function headingLabel(panel: HTMLElement, header: HTMLElement): string {
  return (
    header.querySelector<HTMLElement>("h2,h3,strong")?.textContent
    ?? panel.querySelector<HTMLElement>("h2,h3")?.textContent
    ?? "項目"
  ).trim();
}

export function SectionCollapseManager() {
  const pathname = usePathname();

  useEffect(() => {
    const cleanups = new Map<HTMLElement, () => void>();
    let scheduled = 0;

    const scan = () => {
      scheduled = 0;
      const panels = Array.from(document.querySelectorAll<HTMLElement>(PANEL_SELECTOR));
      const keyCounts = new Map<string, number>();

      for (const panel of panels) {
        if (cleanups.has(panel)) continue;
        if (panel.closest("details")) continue;
        if (panel.dataset.aasCollapse === "off") continue;
        if (panel.children.length < 2) continue;

        const header = directHeader(panel);
        if (!header) continue;

        const label = headingLabel(panel, header);
        const classKey = Array.from(panel.classList).slice(0, 3).join("-");
        const baseKey = `${pathname}:${collapseSlug(classKey)}:${collapseSlug(label)}`;
        const count = (keyCounts.get(baseKey) ?? 0) + 1;
        keyCounts.set(baseKey, count);
        const storageKey = `aas:section-collapse:${baseKey}:${count}`;

        let collapsed = true;
        try {
          const saved = window.localStorage.getItem(storageKey);
          if (saved === "1") collapsed = true;
          if (saved === "0") collapsed = false;
        } catch {
          // Storage can be unavailable in restricted/private browser contexts.
        }

        panel.classList.add("aas-collapsible-panel");
        header.classList.add("aas-section-collapse-header");
        header.setAttribute("role", "button");
        header.setAttribute("tabindex", "0");
        header.setAttribute("aria-label", `${label}を開閉`);

        const apply = (nextCollapsed: boolean, persist: boolean) => {
          collapsed = nextCollapsed;
          panel.classList.toggle("aas-section-collapsed", collapsed);
          header.setAttribute("aria-expanded", collapsed ? "false" : "true");
          header.setAttribute("data-aas-collapse-label", collapsed ? "開く ▼" : "閉じる ▲");
          if (persist) {
            try {
              window.localStorage.setItem(storageKey, collapsed ? "1" : "0");
            } catch {
              // Keep the in-memory UI state even if persistence fails.
            }
          }
        };

        const toggle = () => apply(!collapsed, true);

        const onClick = (event: Event) => {
          const target = event.target;
          if (target instanceof Element && target !== header && target.closest(INTERACTIVE_SELECTOR)) return;
          toggle();
        };

        const onKeyDown = (event: KeyboardEvent) => {
          if (event.target !== header) return;
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          toggle();
        };

        header.addEventListener("click", onClick);
        header.addEventListener("keydown", onKeyDown);
        apply(collapsed, false);

        cleanups.set(panel, () => {
          header.removeEventListener("click", onClick);
          header.removeEventListener("keydown", onKeyDown);
          header.classList.remove("aas-section-collapse-header");
          header.removeAttribute("role");
          header.removeAttribute("tabindex");
          header.removeAttribute("aria-label");
          header.removeAttribute("aria-expanded");
          header.removeAttribute("data-aas-collapse-label");
          panel.classList.remove("aas-collapsible-panel", "aas-section-collapsed");
        });
      }
    };

    const scheduleScan = () => {
      if (scheduled) return;
      scheduled = window.requestAnimationFrame(scan);
    };

    scan();
    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (scheduled) window.cancelAnimationFrame(scheduled);
      for (const cleanup of cleanups.values()) cleanup();
      cleanups.clear();
    };
  }, [pathname]);

  return null;
}

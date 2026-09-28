"use client";

import { useEffect, useState } from "react";

import { useSharedAccessState } from "@/components/access-state-provider";
import { loadMyAppReleaseState, type AppReleaseState } from "@/lib/app-release";

export function ReleasePreviewHomeStatus() {
  const { state: accessState, client } = useSharedAccessState();
  const accessUserId = accessState.kind === "ready" ? accessState.profile.id : "";
  const [state, setState] = useState<AppReleaseState | null>(null);

  useEffect(() => {
    let active = true;
    if (!accessUserId || !client) {
      queueMicrotask(() => {
        if (active) setState(null);
      });
      return () => { active = false; };
    }

    const refresh = async () => {
      try {
        const next = await loadMyAppReleaseState(client);
        if (active) setState(next);
      } catch {
        if (active) setState(null);
      }
    };

    void refresh();

    return () => {
      active = false;
    };
  }, [accessUserId, client]);

  if (
    !state?.signed_in ||
    state.active === false ||
    !state.effective_release ||
    (!state.is_admin_preview && !state.is_tester_preview)
  ) {
    return null;
  }

  const label = state.is_admin_preview ? "管理者確認" : "テスター確認";

  return (
    <aside
      className="release-preview-home-status"
      aria-label={state.is_admin_preview ? "管理者テスト版" : "一般ユーザーテスト版"}
      title="候補版を確認中です。一般公開版とは異なる場合があります。"
    >
      <span>TEST</span>
      <strong>{label}</strong>
      <small>v{state.effective_release.version}</small>
    </aside>
  );
}

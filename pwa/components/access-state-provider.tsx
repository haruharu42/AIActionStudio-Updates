"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { AppLoadingScreen } from "@/components/app-loading-screen";
import { loadAccessState, type AccessState } from "@/lib/phase6-access";
import { getSupabaseClient } from "@/lib/supabase";
import { createSessionRequestLoader } from "@/lib/session-request-loader";
import {
  createDefaultWritingProfile,
  loadWritingProfile,
  setRuntimeWritingProfile,
} from "@/lib/user-personalization";

export type SharedAccessState =
  | AccessState
  | { kind: "loading" }
  | { kind: "unavailable" };

type AccessStateContextValue = {
  state: SharedAccessState;
  client: SupabaseClient | null;
  refresh: () => Promise<void>;
};

const AccessStateContext = createContext<AccessStateContextValue | null>(null);
const BACKGROUND_RECHECK_MIN_INTERVAL_MS = 30_000;

export function AccessStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SharedAccessState>({ kind: "loading" });
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [runtimeProfileReadyUserId, setRuntimeProfileReadyUserId] = useState("");
  const requestLoaderRef = useRef(createSessionRequestLoader(loadAccessState));

  const loadAccessStateOnce = useCallback((activeClient: SupabaseClient) => {
    return requestLoaderRef.current.load(activeClient);
  }, []);

  const refresh = useCallback(async () => {
    const generation = requestLoaderRef.current.generation();
    let activeClient: SupabaseClient;
    try {
      activeClient = getSupabaseClient();
      setClient(activeClient);
      const next = await loadAccessStateOnce(activeClient);
      if (next && generation === requestLoaderRef.current.generation()) setState(next);
    } catch {
      if (generation === requestLoaderRef.current.generation()) setState({ kind: "unavailable" });
    }
  }, [loadAccessStateOnce]);

  useEffect(() => {
    const requestLoader = requestLoaderRef.current;
    let active = true;
    let lastBackgroundCheckAt = 0;
    let activeClient: SupabaseClient;
    try {
      activeClient = getSupabaseClient();
    } catch {
      queueMicrotask(() => {
        if (active) setState({ kind: "unavailable" });
      });
      return;
    }

    const applyAccessState = async (mode: "strict" | "background") => {
      const generation = requestLoader.generation();
      try {
        const next = await loadAccessStateOnce(activeClient);
        if (!next || generation !== requestLoader.generation()) return;
        if (active) {
          if (mode === "strict") {
            lastBackgroundCheckAt = Date.now();
            setState(next);
            return;
          }
          setState((current) => {
            if (
              current.kind === "ready" &&
              next.kind === "ready" &&
              current.profile.id === next.profile.id &&
              current.profile.role === next.profile.role &&
              current.profile.status === next.profile.status
            ) {
              return current;
            }
            return next;
          });
        }
      } catch {
        if (!active || generation !== requestLoader.generation()) return;
        if (mode === "background") {
          setState((current) => current.kind === "ready" ? current : { kind: "unavailable" });
          return;
        }
        setState({ kind: "unavailable" });
      }
    };

    const recheckInBackground = () => {
      if (!active || document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastBackgroundCheckAt < BACKGROUND_RECHECK_MIN_INTERVAL_MS) return;
      lastBackgroundCheckAt = now;
      void applyAccessState("background");
    };

    queueMicrotask(() => {
      if (!active) return;
      setClient(activeClient);
      void applyAccessState("strict");
    });

    const { data } = activeClient.auth.onAuthStateChange((event, session) => {
      if (!session || (event !== "INITIAL_SESSION" && event !== "TOKEN_REFRESHED")) {
        requestLoader.invalidate();
      }
      const generation = requestLoader.generation();
      window.setTimeout(() => {
        if (!active || generation !== requestLoader.generation()) return;
        if (!session) {
          setState({ kind: "signed_out" });
          return;
        }
        if (event === "INITIAL_SESSION") return;
        setState((current) => current.kind === "ready" && current.profile.id !== session.user.id
          ? { kind: "loading" } : current);
        void applyAccessState(event === "TOKEN_REFRESHED" ? "background" : "strict");
      }, 0);
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") recheckInBackground();
    };
    window.addEventListener("focus", recheckInBackground);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      requestLoader.invalidate();
      data.subscription.unsubscribe();
      window.removeEventListener("focus", recheckInBackground);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadAccessStateOnce]);

  const runtimeProfileUserId = state.kind === "ready" ? state.profile.id : "";

  useEffect(() => {
    let active = true;
    if (!client || !runtimeProfileUserId) {
      setRuntimeWritingProfile(null);
      queueMicrotask(() => {
        if (active) setRuntimeProfileReadyUserId("");
      });
      return () => { active = false; };
    }

    setRuntimeWritingProfile(null);
    queueMicrotask(() => {
      if (active) setRuntimeProfileReadyUserId("");
    });

    void loadWritingProfile(client, runtimeProfileUserId).then(
      (profile) => {
        if (!active) return;
        setRuntimeWritingProfile(profile);
        setRuntimeProfileReadyUserId(runtimeProfileUserId);
      },
      () => {
        if (!active) return;
        setRuntimeWritingProfile(createDefaultWritingProfile(runtimeProfileUserId));
        setRuntimeProfileReadyUserId(runtimeProfileUserId);
      },
    );

    return () => {
      active = false;
      setRuntimeWritingProfile(null);
    };
  }, [client, runtimeProfileUserId]);

  const value = useMemo<AccessStateContextValue>(
    () => ({ state, client, refresh }),
    [state, client, refresh],
  );

  const runtimeProfilePending = state.kind === "ready"
    && runtimeProfileReadyUserId !== state.profile.id;

  return (
    <AccessStateContext.Provider value={value}>
      {runtimeProfilePending ? <AppLoadingScreen message="ユーザー設定を準備しています…" /> : children}
    </AccessStateContext.Provider>
  );
}

export function useSharedAccessState(): AccessStateContextValue {
  const value = useContext(AccessStateContext);
  if (!value) {
    throw new Error("useSharedAccessState must be used inside AccessStateProvider.");
  }
  return value;
}

"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert, Loader2 } from "lucide-react";
import {
  ACTIVE_WORKSPACE_STORAGE_KEY,
  API_BASE_URL,
  AUTH_TOKEN_STORAGE_KEY,
  INACTIVITY_TIMEOUT_MS,
  LAST_ACTIVITY_STORAGE_KEY,
  SUPER_ADMIN_STORAGE_KEY,
  canAccessRoute,
  getAuthStorageValue,
  hasAnyPermission as checkAnyPermission,
  hasPermission as checkPermission,
  isApiBackendUrl,
  resolveActiveWorkspace,
  type AuthSessionPayload,
  type AuthUser,
  type WorkspaceSummary,
} from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface AuthContextValue {
  user: AuthUser | null;
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary | null;
  pendingInvitesCount: number;
  loading: boolean;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: readonly string[]) => boolean;
  setSession: (payload: AuthSessionPayload) => void;
  refreshSession: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];
const LOGOUT_EVENT_STORAGE_KEY = "myfinance_logout_at";

let fetchPatched = false;
let unauthorizedHandler: (() => void) | null = null;
let inMemoryAccessToken: string | null = null;
let rawFetchFn: typeof window.fetch | null = null;
let refreshInFlight: Promise<string | null> | null = null;

async function silentRefreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (refreshInFlight) return refreshInFlight;

  const fetcher = rawFetchFn ?? window.fetch.bind(window);
  const workspaceId = getAuthStorageValue(ACTIVE_WORKSPACE_STORAGE_KEY);
  const headers = new Headers();
  if (workspaceId) headers.set("x-workspace-id", workspaceId);

  refreshInFlight = (async () => {
    try {
      const res = await fetcher(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers,
      });
      if (!res.ok) {
        inMemoryAccessToken = null;
        return null;
      }
      const data = (await res.json()) as AuthSessionPayload;
      if (!data?.accessToken) {
        inMemoryAccessToken = null;
        return null;
      }
      inMemoryAccessToken = data.accessToken;
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function ensureFetchPatched() {
  if (typeof window === "undefined" || fetchPatched) return;
  fetchPatched = true;
  const originalFetch = window.fetch.bind(window);
  rawFetchFn = originalFetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!isApiBackendUrl(input)) {
      return originalFetch(input, init);
    }

    const token = inMemoryAccessToken ?? getAuthStorageValue(AUTH_TOKEN_STORAGE_KEY);
    const workspaceId = getAuthStorageValue(ACTIVE_WORKSPACE_STORAGE_KEY);

    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (workspaceId && !headers.has("x-workspace-id")) {
      headers.set("x-workspace-id", workspaceId);
    }

    const response = await originalFetch(input, {
      ...init,
      credentials: init?.credentials ?? "include",
      headers,
    });

    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const isAuthRoute =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/logout") ||
      url.includes("/auth/forgot-password") ||
      url.includes("/auth/reset-password") ||
      url.includes("/auth/change-password");

    if (response.status === 401 && !isAuthRoute) {
      const nextToken = await silentRefreshAccessToken();
      if (nextToken) {
        const retryHeaders = new Headers(headers);
        retryHeaders.set("Authorization", `Bearer ${nextToken}`);
        const retryResponse = await originalFetch(input, {
          ...init,
          credentials: init?.credentials ?? "include",
          headers: retryHeaders,
        });
        if (retryResponse.status !== 401) {
          return retryResponse;
        }
      }
      unauthorizedHandler?.();
    }

    return response;
  };
}

// Patch immediately when imported on client so child useEffects always send auth headers
ensureFetchPatched();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceSummary | null>(null);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  const clearAuth = useCallback(() => {
    inMemoryAccessToken = null;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
      window.localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
      window.localStorage.removeItem(SUPER_ADMIN_STORAGE_KEY);
      window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      window.sessionStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
    }
    setUser(null);
    setWorkspaces([]);
    setActiveWorkspace(null);
    setPendingInvitesCount(0);
  }, []);

  const notifyServerLogout = useCallback(() => {
    if (typeof window === "undefined") return;
    const fetcher = rawFetchFn ?? window.fetch.bind(window);
    void fetcher(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  }, []);

  const logout = useCallback(() => {
    notifyServerLogout();
    clearAuth();
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOGOUT_EVENT_STORAGE_KEY, String(Date.now()));
    }
    router.replace("/login");
  }, [clearAuth, notifyServerLogout, router]);

  useEffect(() => {
    unauthorizedHandler = () => {
      clearAuth();
      if (!PUBLIC_ROUTES.some((r) => window.location.pathname.startsWith(r))) {
        router.replace("/login");
      }
    };
    return () => {
      unauthorizedHandler = null;
    };
  }, [clearAuth, router]);

  const applyProfile = useCallback(
    (data: Omit<AuthSessionPayload, "accessToken">) => {
      const storedWsId = getAuthStorageValue(ACTIVE_WORKSPACE_STORAGE_KEY);
      const resolved = resolveActiveWorkspace(
        data.workspaces,
        storedWsId ?? data.activeWorkspace?.id ?? null,
        data.user.defaultWorkspaceId,
      );

      if (typeof window !== "undefined") {
        if (resolved) {
          window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, resolved.id);
        }
        if (data.user.isSuperAdmin) {
          window.localStorage.setItem(SUPER_ADMIN_STORAGE_KEY, "true");
        } else {
          window.localStorage.removeItem(SUPER_ADMIN_STORAGE_KEY);
        }
      }

      setUser(data.user);
      setWorkspaces(data.workspaces);
      setActiveWorkspace(resolved);
      setPendingInvitesCount(data.pendingInvitesCount ?? 0);
    },
    [],
  );

  const setSession = useCallback(
    (payload: AuthSessionPayload) => {
      inMemoryAccessToken = payload.accessToken;
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        window.sessionStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
        window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
        if (payload.user.isSuperAdmin) {
          window.localStorage.setItem(SUPER_ADMIN_STORAGE_KEY, "true");
        } else {
          window.localStorage.removeItem(SUPER_ADMIN_STORAGE_KEY);
        }

        const preferredId = payload.activeWorkspace?.id ?? payload.workspaces[0]?.id ?? null;
        if (preferredId) {
          window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, preferredId);
        } else {
          window.localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
        }
      }
      applyProfile(payload);
    },
    [applyProfile],
  );

  const refreshSession = useCallback(async () => {
    if (typeof window === "undefined") return;

    const isSuperAdminStored = window.localStorage.getItem(SUPER_ADMIN_STORAGE_KEY) === "true";
    const lastActivityRaw = window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
    if (!isSuperAdminStored && lastActivityRaw && Date.now() - Number(lastActivityRaw) >= INACTIVITY_TIMEOUT_MS) {
      notifyServerLogout();
      clearAuth();
      setLoading(false);
      return;
    }

    try {
      // 1. If we already have an in-memory access token, validate/refresh profile via /auth/me
      if (inMemoryAccessToken) {
        const res = await fetch(`${API_BASE_URL}/auth/me`);
        if (!res.ok) {
          clearAuth();
          return;
        }
        const data = await res.json();
        applyProfile(data);
        return;
      }

      // 2. On page load/reload, exchange HttpOnly refresh cookie for a fresh 15m access token
      const fetcher = rawFetchFn ?? window.fetch.bind(window);
      const workspaceId = getAuthStorageValue(ACTIVE_WORKSPACE_STORAGE_KEY);
      const refreshHeaders = new Headers();
      if (workspaceId) refreshHeaders.set("x-workspace-id", workspaceId);

      const refreshRes = await fetcher(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: refreshHeaders,
      });

      if (refreshRes.ok) {
        const payload = (await refreshRes.json()) as AuthSessionPayload;
        if (payload?.accessToken) {
          setSession(payload);
          return;
        }
      }

      // 3. Backwards-compatible fallback for pre-Phase-3 sessions still holding a legacy localStorage token
      const legacyToken = getAuthStorageValue(AUTH_TOKEN_STORAGE_KEY);
      if (!legacyToken) {
        clearAuth();
        return;
      }
      const meRes = await fetch(`${API_BASE_URL}/auth/me`);
      if (!meRes.ok) {
        clearAuth();
        return;
      }
      const meData = await meRes.json();
      if (!lastActivityRaw) {
        window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()));
      }
      applyProfile(meData);
    } catch {
      // Keep existing state if backend is momentarily unreachable
    } finally {
      setLoading(false);
    }
  }, [applyProfile, clearAuth, notifyServerLogout, setSession]);

  useEffect(() => {
    ensureFetchPatched();
    const timer = window.setTimeout(() => {
      void refreshSession();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshSession]);

  useEffect(() => {
    if (typeof window === "undefined" || !user) return;
    if (user.isSuperAdmin) return;

    let timer: number | undefined;
    let lastRecordedAt = Number(window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY) || Date.now());

    const expireForInactivity = () => {
      notifyServerLogout();
      clearAuth();
      toast.info("Sessão expirada por inatividade (10 minutos).");
      router.replace("/login");
    };

    const scheduleCheck = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      const elapsed = Date.now() - lastRecordedAt;
      const remaining = INACTIVITY_TIMEOUT_MS - elapsed;
      if (remaining <= 0) {
        expireForInactivity();
        return;
      }
      timer = window.setTimeout(() => {
        const stored = Number(window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY) || lastRecordedAt);
        lastRecordedAt = stored;
        if (Date.now() - stored >= INACTIVITY_TIMEOUT_MS) {
          expireForInactivity();
        } else {
          scheduleCheck();
        }
      }, remaining);
    };

    const recordActivity = () => {
      const now = Date.now();
      if (now - lastRecordedAt < 5000) return;
      lastRecordedAt = now;
      window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now));
      scheduleCheck();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const stored = Number(window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY) || lastRecordedAt);
      lastRecordedAt = stored;
      scheduleCheck();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LOGOUT_EVENT_STORAGE_KEY && event.newValue) {
        clearAuth();
        router.replace("/login");
        return;
      }
      if (event.key === LAST_ACTIVITY_STORAGE_KEY && event.newValue) {
        lastRecordedAt = Number(event.newValue);
        scheduleCheck();
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "mousemove",
      "scroll",
      "touchstart",
    ];

    window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(lastRecordedAt));
    const initTimer = window.setTimeout(scheduleCheck, 0);

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, recordActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.clearTimeout(initTimer);
      if (timer !== undefined) window.clearTimeout(timer);
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, recordActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [clearAuth, notifyServerLogout, router, user]);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublicRoute) {
      router.replace("/login");
    } else if (user && isPublicRoute) {
      router.replace("/");
    }
  }, [isPublicRoute, loading, router, user]);

  const switchWorkspace = useCallback(
    (workspaceId: string) => {
      const next = workspaces.find((w) => w.id === workspaceId);
      if (!next || typeof window === "undefined") return;
      window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, next.id);
      setActiveWorkspace(next);
      window.location.reload();
    },
    [workspaces],
  );

  const hasPermission = useCallback(
    (code: string) => checkPermission(activeWorkspace?.permissions, code),
    [activeWorkspace],
  );

  const hasAnyPermission = useCallback(
    (codes: readonly string[]) => checkAnyPermission(activeWorkspace?.permissions, codes),
    [activeWorkspace],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      workspaces,
      activeWorkspace,
      pendingInvitesCount,
      loading,
      hasPermission,
      hasAnyPermission,
      setSession,
      refreshSession,
      switchWorkspace,
      logout,
    }),
    [
      activeWorkspace,
      hasAnyPermission,
      hasPermission,
      loading,
      logout,
      pendingInvitesCount,
      refreshSession,
      setSession,
      switchWorkspace,
      user,
      workspaces,
    ],
  );

  const routeAllowed = canAccessRoute(pathname, user, activeWorkspace);

  return (
    <AuthContext.Provider value={value}>
      {loading && !isPublicRoute ? (
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Carregando sessão...</p>
        </div>
      ) : !user && !isPublicRoute ? (
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Redirecionando para login...</p>
        </div>
      ) : user && !isPublicRoute && !routeAllowed ? (
        <div className="mx-auto mt-16 max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <h2 className="text-lg font-semibold">Acesso restrito</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Seu perfil atual ({activeWorkspace?.roleName ?? "Sem acesso"}) neste workspace não possui permissão para acessar esta página.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" onClick={() => router.push("/configuracoes")}>
              Configurações / Workspaces
            </Button>
            {hasPermission("view:resumo") && (
              <Button onClick={() => router.push("/")}>Ir para Resumo</Button>
            )}
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return ctx;
}


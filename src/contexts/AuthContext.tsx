import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "usuario_pro" | "pim_manager";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  active: boolean;
  track_insights: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  supabaseUser: User | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  isProfileLoading: boolean;
  isLoading: boolean; // kept for backward compat — true until auth ready
}

const AuthContext = createContext<AuthContextType | null>(null);

const LOGIN_TIMEOUT_MS = 8000;
const PROFILE_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}_timeout`)), ms)
    ),
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  // Track whether this is a fresh login (for tracking + inactive account handling)
  const freshLoginRef = useRef(false);

  /** Load profile + role from DB for a given auth user — parallel fetch */
  const loadAppUser = useCallback(async (authUser: User): Promise<AppUser | null> => {
    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("name, email, active, track_insights")
          .eq("id", authUser.id)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", authUser.id)
          .maybeSingle(),
      ]);

      if (profileRes.error || !profileRes.data) {
        console.warn("[Auth] profile_query_error", profileRes.error?.message);
        return null;
      }

      const profile = profileRes.data;

      if (!profile.active) {
        console.warn("[Auth] inactive_user");
        return null;
      }

      const role: AppRole = (roleRes.data?.role as AppRole) || "pim_manager";

      return {
        id: authUser.id,
        name: profile.name,
        email: profile.email,
        role,
        active: profile.active,
        track_insights: profile.track_insights ?? true,
      };
    } catch (err) {
      console.warn("[Auth] profile_query_error", err);
      return null;
    }
  }, []);

  // 1) Bootstrap: restore session from storage + listen for auth changes
  useEffect(() => {
    // onAuthStateChange — lightweight: only sync session state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setSupabaseUser(newSession?.user ?? null);

        if (!newSession) {
          // Signed out
          setUser(null);
        }
      }
    );

    // Restore session from local storage
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setSupabaseUser(existingSession?.user ?? null);
      setIsAuthReady(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 2) Hydrate profile whenever supabaseUser changes (separate from auth callback)
  useEffect(() => {
    if (!isAuthReady) return;

    if (!supabaseUser) {
      setUser(null);
      setIsProfileLoading(false);
      return;
    }

    let cancelled = false;
    setIsProfileLoading(true);

    const hydrate = async () => {
      try {
        const appUser = await withTimeout(
          loadAppUser(supabaseUser),
          PROFILE_TIMEOUT_MS,
          "profile_hydration"
        );

        if (cancelled) return;

        if (appUser) {
          setUser((prev) => {
            // Track login event only on fresh login
            if (!prev && freshLoginRef.current && appUser.track_insights) {
              freshLoginRef.current = false;
              import("@/hooks/useTrackEvent").then(({ trackEventDirect }) => {
                trackEventDirect(appUser.id, appUser.email, appUser.role, "login_success", undefined, true);
              });
            }
            return appUser;
          });
        } else if (freshLoginRef.current) {
          // Fresh login but inactive account — sign out
          freshLoginRef.current = false;
          setUser(null);
          await supabase.auth.signOut();
        }
        // If profile fails on background refresh (not fresh login), keep existing user
      } catch {
        console.warn("[Auth] profile hydration timed out");
        // Don't clear user on timeout during background refresh
      } finally {
        if (!cancelled) setIsProfileLoading(false);
      }
    };

    hydrate();

    return () => { cancelled = true; };
  }, [supabaseUser?.id, isAuthReady, loadAppUser]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      freshLoginRef.current = true;

      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        LOGIN_TIMEOUT_MS,
        "sign_in"
      );

      if (error) {
        freshLoginRef.current = false;
        console.warn("[Auth] invalid_credentials");
        return { success: false, error: "Credenciales inválidas" };
      }

      const authUser = data?.user;
      if (!authUser) {
        freshLoginRef.current = false;
        console.warn("[Auth] missing_auth_user_after_sign_in");
        return { success: false, error: "Problema de autenticación. Intenta de nuevo." };
      }

      // Profile will be loaded by the useEffect above via supabaseUser change
      // But we also do an eager load here for immediate feedback
      const appUser = await withTimeout(
        loadAppUser(authUser),
        LOGIN_TIMEOUT_MS,
        "login_profile"
      );

      if (!appUser) {
        freshLoginRef.current = false;
        await supabase.auth.signOut();
        return { success: false, error: "Cuenta inactiva. Contacta al administrador." };
      }

      setUser(appUser);
      freshLoginRef.current = false;
      return { success: true };
    } catch (err) {
      freshLoginRef.current = false;
      const message = err instanceof Error ? err.message : "unknown";
      console.warn("[Auth] login_timeout_or_network", message);
      await supabase.auth.signOut();
      return { success: false, error: "Problema de conexión. Intenta de nuevo." };
    }
  }, [loadAppUser]);

  const logout = useCallback(async () => {
    setUser(null);
    setSession(null);
    setSupabaseUser(null);
    supabase.auth.signOut().catch(() => {});
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        session,
        login,
        logout,
        isAuthenticated: !!session,
        isAuthReady,
        isProfileLoading,
        isLoading: !isAuthReady,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

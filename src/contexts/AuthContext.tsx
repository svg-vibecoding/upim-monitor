import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
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
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const PROFILE_TIMEOUT_MS = 8000;

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
  const [isLoading, setIsLoading] = useState(true);

  /** Load profile + role from DB for a given auth user */
  const loadAppUser = useCallback(async (authUser: User): Promise<AppUser | null> => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("name, email, active, track_insights")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profileError || !profile) {
        console.warn("[Auth] profile_query_error", profileError?.message);
        return null;
      }

      if (!profile.active) {
        console.warn("[Auth] inactive_user");
        return null;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authUser.id)
        .maybeSingle();

      const role: AppRole = (roleData?.role as AppRole) || "pim_manager";

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

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setSupabaseUser(newSession?.user ?? null);

        if (newSession?.user) {
          try {
            const appUser = await withTimeout(
              loadAppUser(newSession.user),
              PROFILE_TIMEOUT_MS,
              "session_profile"
            );
            if (appUser) {
              setUser((prev) => {
                if (!prev && event === "SIGNED_IN" && appUser.track_insights) {
                  import("@/hooks/useTrackEvent").then(({ trackEventDirect }) => {
                    trackEventDirect(appUser.id, appUser.email, appUser.role, "login_success", undefined, true);
                  });
                }
                return appUser;
              });
            } else {
              setUser(null);
              await supabase.auth.signOut();
            }
          } catch {
            console.warn("[Auth] session profile load timed out");
            setUser(null);
          } finally {
            setIsLoading(false);
          }
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (!existingSession) {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadAppUser]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        PROFILE_TIMEOUT_MS,
        "sign_in"
      );

      if (error) {
        console.warn("[Auth] invalid_credentials");
        return { success: false, error: "Credenciales inválidas" };
      }

      const authUser = data?.user;
      if (!authUser) {
        console.warn("[Auth] missing_auth_user_after_sign_in");
        return { success: false, error: "Problema de autenticación. Intenta de nuevo." };
      }

      const appUser = await withTimeout(
        loadAppUser(authUser),
        PROFILE_TIMEOUT_MS,
        "login_profile"
      );

      if (!appUser) {
        await supabase.auth.signOut();
        return { success: false, error: "Cuenta inactiva. Contacta al administrador." };
      }

      setUser(appUser);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      console.warn("[Auth] login_timeout_or_network", message);
      await supabase.auth.signOut();
      return { success: false, error: "Problema de conexión. Intenta de nuevo." };
    }
  }, [loadAppUser]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setSupabaseUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        session,
        login,
        logout,
        isAuthenticated: !!user,
        isLoading,
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

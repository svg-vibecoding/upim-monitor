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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /** Load profile + role from DB for a given auth user */
  const loadAppUser = useCallback(async (authUser: User): Promise<AppUser | null> => {
    try {
      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("name, email, active")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profileError || !profile) return null;

      // Check active
      if (!profile.active) return null;

      // Fetch role
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
      };
    } catch {
      return null;
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    // Set up listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setSupabaseUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Use setTimeout to avoid potential Supabase auth deadlock
          setTimeout(async () => {
            const appUser = await loadAppUser(newSession.user);
            if (appUser) {
              setUser(appUser);
            } else {
              // Inactive or no profile — sign out
              setUser(null);
              await supabase.auth.signOut();
            }
            setIsLoading(false);
          }, 0);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    // Check existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      if (!existingSession) {
        setIsLoading(false);
      }
      // onAuthStateChange will handle the rest
    });

    return () => subscription.unsubscribe();
  }, [loadAppUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { success: false, error: "Credenciales inválidas" };
    }

    // Wait briefly for onAuthStateChange to fire and load the user
    // The active check happens in loadAppUser
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      const checkInterval = setInterval(() => {
        // Check if loading finished
        if (!isLoading || user !== null) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
        }
      }, 50);

      const timeout = setTimeout(async () => {
        clearInterval(checkInterval);
        // Check if user was set (active) or not (inactive/no profile)
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          const appUser = await loadAppUser(currentSession.user);
          if (!appUser) {
            await supabase.auth.signOut();
            resolve({ success: false, error: "Cuenta inactiva. Contacta al administrador." });
            return;
          }
          setUser(appUser);
          resolve({ success: true });
        } else {
          resolve({ success: false, error: "Error de autenticación" });
        }
      }, 1500);
    });
  }, [loadAppUser, isLoading, user]);

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

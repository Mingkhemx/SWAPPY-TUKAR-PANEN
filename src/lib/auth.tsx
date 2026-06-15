import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

interface User {
  id: string;
  name: string;
  email: string;
  location: string | null;
  phone: string | null;
  avatarUrl: string | null;
  bio: string | null;
  rating: number;
  totalBarters: number;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check initial session and listen for auth changes
  useEffect(() => {
    // Initial session check
    const checkSession = async () => {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchUser(session.user.id);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    };

    // Subscribe to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          await fetchUser(session.user.id);
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    );

    checkSession();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchUser = async (userId: string) => {
    // Try get from users table
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !data) {
      console.warn("Could not fetch user from table, using session metadata");
      // Fall back to session user
      const { data: { user: sessionUser } } = await supabase.auth.getUser();
      if (sessionUser) {
        setUser({
          id: sessionUser.id,
          name: sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0] || "User",
          email: sessionUser.email || "",
          location: sessionUser.user_metadata?.location || null,
          phone: sessionUser.user_metadata?.phone || null,
          avatarUrl: null,
          bio: sessionUser.user_metadata?.bio || null,
          rating: 0,
          totalBarters: 0,
          createdAt: sessionUser.created_at,
        });
      } else {
        setUser(null);
      }
      return;
    }

    setUser({
      id: data.id,
      name: data.name,
      email: data.email,
      location: data.location,
      phone: data.phone,
      avatarUrl: data.avatar_url,
      bio: data.bio,
      rating: data.rating,
      totalBarters: data.total_barters,
      createdAt: data.created_at,
    });
  };

  const login = () => {
    // Supabase handles the session, so no need for manual token handling
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

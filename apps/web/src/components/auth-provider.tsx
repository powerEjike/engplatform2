"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import { db } from "@/lib/firebase";

type UserProfile = { companyId: string; companyName: string; name: string; role: string };
type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  profile: UserProfile | null;
  isProfileLoading: boolean;
  refreshProfile: () => Promise<void>;
  signOutUser: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser);
    setProfile(null);
    setIsProfileLoading(Boolean(nextUser));
    setIsLoading(false);
  }), []);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    setIsProfileLoading(true);
    try {
      const index = await getDoc(doc(db, "userIndex", user.uid));
      if (!index.exists()) return setProfile(null);
      const companyId = String(index.data().companyId);
      const profileDocument = await getDoc(doc(db, "companies", companyId, "users", user.uid));
      const companyDocument = await getDoc(doc(db, "companies", companyId));
      if (!profileDocument.exists() || profileDocument.data().active !== true) {
        setProfile(null);
        await signOut(auth);
        return;
      }
      setProfile({ companyId, companyName: String(companyDocument.data()?.name ?? "Your company"), name: String(profileDocument.data().name ?? user.email ?? "User"), role: String(profileDocument.data().role ?? "") });
    } catch {
      setProfile(null);
    } finally {
      setIsProfileLoading(false);
    }
  }, [user]);

  useEffect(() => { void Promise.resolve().then(refreshProfile); }, [refreshProfile]);

  const value = useMemo(() => ({ user, isLoading, profile, isProfileLoading, refreshProfile, signOutUser: () => signOut(auth) }), [user, isLoading, profile, isProfileLoading, refreshProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}

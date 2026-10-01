import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

let globalSession: Session | null = null;
let globalUser: User | null = null;
let globalLoading = false;
let listeners: Set<() => void> = new Set();

function notify() {
  listeners.forEach((l) => l());
}

export function setAuth(session: Session | null) {
  globalSession = session;
  globalUser = session?.user ?? null;
  globalLoading = false;
  notify();
}

export function useAuth(): AuthState {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    session: globalSession,
    user: globalUser,
    loading: globalLoading,
  };
}

export type SignUpProfile = {
  full_name: string;
  role: 'student' | 'teacher';
};

export async function signUp(
  email: string,
  password: string,
  profile?: SignUpProfile
) {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: profile
      ? {
          data: {
            full_name: profile.full_name,
            role: profile.role,
            email: normalizedEmail,
          },
        }
      : undefined,
  });
  if (!error && data.session && profile) {
    // The Phase 3 trigger creates the profile row on signup.
    // Fill in the full_name and role the user chose.
    // (Trigger already tries to set these from user_metadata,
    // this upsert is a backup in case the trigger ran with old code
    // or hasn't created the row yet — update alone would affect 0 rows.)
    await supabase.from('profiles').upsert(
      {
        id: data.session.user.id,
        email: normalizedEmail,
        full_name: profile.full_name,
        role: profile.role,
      },
      { onConflict: 'id' }
    );
  }
  if (!error && data.session) {
    setAuth(data.session);
  }
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (!error && data.session) {
    setAuth(data.session);
    // Self-heal: kung daan nga account nga blank ang name sa DB pero
    // naa sa metadata, pun-a ang profiles row karon.
    const { syncProfileFromMetadata } = await import('./profiles');
    syncProfileFromMetadata(data.session.user).catch(() => {});
  }
  return { data, error };
}

export async function signOut() {
  setAuth(null);
  supabase.auth.signOut().catch(() => {});
  return { error: null };
}
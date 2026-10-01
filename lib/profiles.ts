import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type Role = 'student' | 'teacher';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Profile;
}

export async function updateProfile(
  userId: string,
  updates: { full_name?: string; role?: Role }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  return { error: error?.message ?? null };
}

// Sync sa user_metadata (full_name/role gikan sa Register) ngadto sa
// profiles table. Mao ni ang fix nganong blank ang name sa Profile:
// kung email-confirmation ON, walay session pag-signUp mao nga ang
// trigger ra ang nagsalig — kung napalya to, blank forever.
// Kini nga function mo-self-heal pag-open sa Profile o pag-signIn.
export async function syncProfileFromMetadata(
  user: User
): Promise<Profile | null> {
  const meta = (user.user_metadata ?? {}) as {
    full_name?: string;
    role?: Role;
  };
  const metaName = meta.full_name?.trim();
  const metaRole = meta.role === 'teacher' ? 'teacher' : undefined;
  const email =
    user.email ?? ((user.user_metadata ?? {}) as any)?.email ?? '';

  const current = await getProfile(user.id);

  // Wala pay row (trigger wala kadagan) → buhata via upsert.
  if (!current) {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email,
          full_name: metaName ?? null,
          role: metaRole ?? 'student',
        },
        { onConflict: 'id' }
      )
      .select('id, email, full_name, role')
      .maybeSingle();
    if (error || !data) return null;
    return data as Profile;
  }

  // Naa nay row pero kulang og name/role → pun-a gikan sa metadata.
  const updates: { full_name?: string; role?: Role } = {};
  if ((!current.full_name || !current.full_name.trim()) && metaName) {
    updates.full_name = metaName;
  }
  if (current.role !== 'teacher' && metaRole === 'teacher') {
    updates.role = 'teacher';
  }
  if (Object.keys(updates).length === 0) return current;

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);
  if (error) return current;
  return { ...current, ...updates };
}
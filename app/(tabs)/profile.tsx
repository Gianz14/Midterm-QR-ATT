import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth, signOut } from '@/lib/auth';
import { maskUserId } from '@/lib/format';
import { getProfile, syncProfileFromMetadata, updateProfile, type Profile } from '@/lib/profiles';

export default function ProfileScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draftName, setDraftName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const loadProfile = useCallback(async () => {
    if (!user) return;
    // Ipakita dayon ang name gikan sa metadata samtang nag-sync sa DB,
    // para dili blank bisag wala pa na-save ang profiles row.
    const metaName =
      ((user.user_metadata ?? {}) as any)?.full_name?.trim?.() || '';
    const p = await syncProfileFromMetadata(user);
    const finalProfile = p ?? (await getProfile(user.id));
    setProfile(finalProfile);
    setDraftName(finalProfile?.full_name?.trim?.() || metaName);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleSaveName = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await updateProfile(user.id, {
      full_name: draftName.trim(),
    });
    setSaving(false);
    if (error) {
      Alert.alert('Error', error);
    } else {
      setProfile((prev) =>
        prev ? { ...prev, full_name: draftName.trim() } : prev
      );
      setEditing(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      router.replace('/login');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to sign out.');
    } finally {
      setLoading(false);
    }
  };

  const metaName =
    ((user?.user_metadata ?? {}) as any)?.full_name?.trim?.() || '';
  const metaRole = ((user?.user_metadata ?? {}) as any)?.role;
  // Parehas sa Teacher tab: teacher kung teacher bisan asa (DB o metadata).
  const isTeacher = profile?.role === 'teacher' || metaRole === 'teacher';
  const displayName = profile?.full_name?.trim?.() || metaName;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>My Profile</Text>
          <Text style={styles.subtitle}>
            Manage your account details and sign out.
          </Text>
        </View>
        <View style={[styles.roleBadge, !isTeacher && styles.roleBadgeStudent]}>
          <Text style={styles.roleBadgeText}>
            {isTeacher ? 'Teacher' : 'Student'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Personal Information</Text>

        <Text style={styles.label}>Name</Text>
        {editing ? (
          <View style={styles.nameEditRow}>
            <View style={styles.inputWrap}>
              <Ionicons
                name="person-outline"
                size={18}
                color={COLORS.textSecondary}
              />
              <TextInput
                style={styles.input}
                value={draftName}
                onChangeText={setDraftName}
                placeholder="e.g. Maria Santos"
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="words"
              />
            </View>
            <Pressable
              style={styles.saveBtn}
              onPress={handleSaveName}
              disabled={saving}
            >
              <Text style={styles.saveText}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.pickerField,
              pressed && styles.pickerFieldPressed,
            ]}
            onPress={() => setEditing(true)}
          >
            <Ionicons name="person-outline" size={20} color={COLORS.primary} />
            <Text style={styles.pickerValue}>
              {displayName || 'Tap to add your name'}
            </Text>
            <View style={styles.editChip}>
              <Text style={styles.editHint}>Edit</Text>
            </View>
          </Pressable>
        )}

        <Text style={styles.label}>Email</Text>
        <View style={styles.readField}>
          <Ionicons name="mail-outline" size={20} color={COLORS.primary} />
          <Text style={styles.readValue}>
            {user?.email ?? profile?.email ?? '—'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Account</Text>

        <Text style={styles.label}>Role</Text>
        <View style={styles.readField}>
          <Ionicons
            name={isTeacher ? 'school-outline' : 'person-circle-outline'}
            size={20}
            color={COLORS.primary}
          />
          <Text style={styles.readValue}>
            {isTeacher ? 'Teacher' : 'Student'}
          </Text>
        </View>

        <Text style={styles.label}>User ID</Text>
        <View style={styles.readField}>
          <Ionicons name="key-outline" size={20} color={COLORS.primary} />
          <Text style={[styles.readValue, styles.monoText]}>
            {maskUserId(user?.id)}
          </Text>
        </View>
      </View>

      <Text style={styles.hint}>
        Tap Edit to update the name shown on attendance records.
      </Text>

      <AppButton
        title="Sign Out"
        icon="log-out-outline"
        onPress={handleSignOut}
        disabled={loading}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginLeft: 8,
  },
  roleBadgeStudent: {
    backgroundColor: COLORS.textSecondary,
  },
  roleBadgeText: {
    color: COLORS.textOnPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 12,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 8,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  pickerField: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerFieldPressed: {
    opacity: 0.85,
  },
  pickerValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginHorizontal: 10,
  },
  readField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  readValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginLeft: 10,
  },
  monoText: {
    fontFamily: 'monospace',
    fontSize: 13,
  },
  editChip: {
    backgroundColor: COLORS.primary + '14',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  editHint: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginLeft: 8,
  },
  saveText: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  hint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    marginBottom: 16,
  },
});
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { getAttendanceHistory, getTeacherEventSummary } from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { getProfile, type Profile } from '@/lib/profiles';

type Tile = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  onPress: () => void;
};

type Stats = {
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel: string;
  secondaryValue: string;
};

const FALLBACK_STATS: Stats = {
  primaryLabel: 'Scans',
  primaryValue: '—',
  secondaryLabel: 'Last scan',
  secondaryValue: '—',
};

export default function Index() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>(FALLBACK_STATS);

  const metaName = ((user?.user_metadata ?? {}) as any)?.full_name?.trim?.() || '';
  const metaRole = ((user?.user_metadata ?? {}) as any)?.role;
  const isTeacher = profile?.role === 'teacher' || metaRole === 'teacher';
  const displayName = profile?.full_name?.trim?.() || metaName;

  const loadStats = useCallback(async () => {
    if (!user) {
      setStats(FALLBACK_STATS);
      return;
    }

    const p = await getProfile(user.id);
    setProfile(p);

    const teacher = p?.role === 'teacher' || metaRole === 'teacher';

    if (teacher) {
      const events = await getTeacherEventSummary(user.id);
      const attendees = events.reduce((sum, e) => sum + e.attendeeCount, 0);
      setStats({
        primaryLabel: 'Events',
        primaryValue: String(events.length),
        secondaryLabel: 'Attendees',
        secondaryValue: String(attendees),
      });
    } else {
      const records = await getAttendanceHistory(user.id);
      setStats({
        primaryLabel: 'Scans',
        primaryValue: String(records.length),
        secondaryLabel: 'Last scan',
        secondaryValue: records[0] ? formatDate(records[0].scannedAt) : '—',
      });
    }
  }, [user, metaRole]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const firstName = (displayName || '').trim().split(/\s+/)[0];

  const tiles: Tile[] = [
    {
      title: 'Scan QR',
      subtitle: 'Record attendance',
      icon: 'qr-code-outline',
      tint: COLORS.success,
      onPress: () => router.push('/scan'),
    },
    {
      title: 'History',
      subtitle: 'Past records',
      icon: 'time-outline',
      tint: COLORS.primary,
      onPress: () => router.push('/history'),
    },
    ...(isTeacher
      ? [
          {
            title: 'Teacher',
            subtitle: 'Create events',
            icon: 'clipboard-outline' as const,
            tint: COLORS.warning,
            onPress: () => router.push('/teacher'),
          },
        ]
      : []),
    {
      title: 'Profile',
      subtitle: 'Your account',
      icon: 'person-outline',
      tint: '#8E5A2B',
      onPress: () => router.push('/profile'),
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Header title="QR Attendance" />

      <View style={styles.greetingRow}>
        <Text style={styles.greeting} numberOfLines={1}>
          {firstName ? `Hi, ${firstName}` : 'Welcome'}
        </Text>
        <View style={[styles.roleBadge, !isTeacher && styles.roleBadgeStudent]}>
          <Ionicons
            name={isTeacher ? 'school-outline' : 'person-circle-outline'}
            size={13}
            color={COLORS.textOnPrimary}
          />
          <Text style={styles.roleBadgeText}>
            {isTeacher ? 'Teacher' : 'Student'}
          </Text>
        </View>
      </View>

      <View style={styles.ctaCard}>
        <Text style={styles.ctaLabel}>READY TO CHECK IN?</Text>
        <Text style={styles.ctaTitle}>Scan the event QR code</Text>
        <Text style={styles.ctaSubtitle}>
          Point your camera at the code posted by the organizer.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
          onPress={() => router.push('/scan')}
        >
          <Ionicons name="scan-outline" size={20} color={COLORS.textOnPrimary} />
          <Text style={styles.ctaButtonText}>Scan Now</Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.primaryValue}</Text>
          <Text style={styles.statLabel}>{stats.primaryLabel}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCard}>
          <Text style={styles.statValue} numberOfLines={1}>
            {stats.secondaryValue}
          </Text>
          <Text style={styles.statLabel}>{stats.secondaryLabel}</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Quick Actions</Text>
      <View style={styles.grid}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.title}
            style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            onPress={tile.onPress}
          >
            <View style={[styles.tileIcon, { backgroundColor: tile.tint + '1A' }]}>
              <Ionicons name={tile.icon} size={22} color={tile.tint} />
            </View>
            <Text style={styles.tileTitle}>{tile.title}</Text>
            <Text style={styles.tileSubtitle}>{tile.subtitle}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.footer}>QR Attendance · v1.0</Text>
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
    paddingBottom: 32,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  greeting: {
    flex: 1,
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginRight: 10,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 5,
  },
  roleBadgeStudent: {
    backgroundColor: COLORS.textSecondary,
  },
  roleBadgeText: {
    color: COLORS.textOnPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  ctaCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
  },
  ctaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textOnPrimary,
    opacity: 0.85,
    letterSpacing: 1,
    marginBottom: 8,
  },
  ctaTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: COLORS.textOnPrimary,
    marginBottom: 6,
  },
  ctaSubtitle: {
    fontSize: 13,
    color: COLORS.textOnPrimary,
    opacity: 0.9,
    lineHeight: 19,
    marginBottom: 18,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.textPrimary,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  ctaButtonPressed: {
    opacity: 0.85,
  },
  ctaButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textOnPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 18,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  tile: {
    width: '47.5%',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginHorizontal: 6,
    marginBottom: 12,
  },
  tilePressed: {
    backgroundColor: COLORS.surface,
  },
  tileIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  tileTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  tileSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  footer: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
});
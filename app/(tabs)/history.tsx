import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import {
  getAttendanceHistory,
  getTeacherEventAttendance,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';
import { useAuth } from '@/lib/auth';
import { formatDateTime, shortId } from '@/lib/format';
import { getProfile, type Role } from '@/lib/profiles';

export default function HistoryScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<TeacherEventAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const profile = await getProfile(user.id);
    const currentRole = profile?.role ?? 'student';
    setRole(currentRole);

    if (currentRole === 'teacher') {
      const events = await getTeacherEventAttendance(user.id);
      setTeacherEvents(events);
      setStudentRecords([]);
    } else {
      const records = await getAttendanceHistory(user.id);
      setStudentRecords(records);
      setTeacherEvents([]);
    }

    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (role === 'teacher') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.listContent}>
        <Text style={styles.title}>Attendance History</Text>
        <Text style={styles.subHeader}>Your events and who attended them</Text>

        {loading ? (
          <Text style={styles.emptyText}>Loading records...</Text>
        ) : teacherEvents.length === 0 ? (
          <Text style={styles.emptyText}>
            You haven't created any events yet. Create one in the Teacher tab.
          </Text>
        ) : (
          teacherEvents.map((event) => (
            <View key={event.eventId} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <View style={styles.countBadge}>
                  <Ionicons name="people-outline" size={14} color={COLORS.textOnPrimary} />
                  <Text style={styles.countBadgeText}>{event.attendeeCount}</Text>
                </View>
              </View>

              <View style={styles.chipRow}>
                <Ionicons name="pricetag-outline" size={14} color={COLORS.textSecondary} />
                <Text style={styles.codeChip}>{event.eventCode}</Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
                <Text style={styles.metaText}>
                  {event.startTime ? formatDateTime(event.startTime) : 'No start time'}
                </Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.attendeeHeader}>Attendees</Text>
              {event.attendees.length === 0 ? (
                <Text style={styles.attendeeEmpty}>No students have scanned yet.</Text>
              ) : (
                event.attendees.map((attendee) => (
                  <View key={attendee.studentId} style={styles.attendeeRow}>
                    <View style={styles.attendeeDot} />
                    <Text style={styles.attendeeName}>
                      {attendee.studentName || shortId(attendee.studentId)}
                    </Text>
                    <Text style={styles.attendeeTime}>
                      {formatDateTime(attendee.scannedAt)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          ))
        )}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Attendance History</Text>
      <Text style={styles.subHeader}>Events you have scanned into</Text>

      {loading ? (
        <Text style={styles.emptyText}>Loading records...</Text>
      ) : studentRecords.length === 0 ? (
        <Text style={styles.emptyText}>
          No records yet. Scan a QR code to register your attendance.
        </Text>
      ) : (
        <FlatList
          data={studentRecords}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.eventTitle}>{item.eventTitle}</Text>
              <View style={styles.chipRow}>
                <Ionicons name="pricetag-outline" size={14} color={COLORS.textSecondary} />
                <Text style={styles.codeChip}>{item.eventId}</Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
                <Text style={styles.metaText}>{formatDateTime(item.scannedAt)}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  subHeader: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  listContent: {
    paddingBottom: 32,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginTop: 8,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
    gap: 4,
  },
  countBadgeText: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  codeChip: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  attendeeHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  attendeeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
    marginRight: 10,
  },
  attendeeName: {
    fontSize: 14,
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  attendeeTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  attendeeEmpty: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
});
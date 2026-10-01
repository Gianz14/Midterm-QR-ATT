import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { createEvent } from '@/lib/events';
import { formatDateTime } from '@/lib/format';
import { getProfile, updateProfile, type Role } from '@/lib/profiles';
import { buildQRPayload } from '@/lib/qr';

function toLocalISO(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

const QUICK_END_OPTIONS = [
  { label: '+30 min', ms: 30 * 60 * 1000 },
  { label: '+1 hour', ms: 60 * 60 * 1000 },
  { label: '+2 hours', ms: 2 * 60 * 60 * 1000 },
];

type EditTarget = 'start' | 'end';

export default function TeacherScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(
    () => new Date(Date.now() + 60 * 60 * 1000)
  );
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editingPart, setEditingPart] = useState<'date' | 'time'>('date');
  const [payload, setPayload] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAndroid = Platform.OS === 'android';

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setRoleLoading(true);
      if (!user) {
        setRole(null);
        setRoleLoading(false);
        return () => {
          active = false;
        };
      }
      // Fallback: kung bag-ong APK, naa nay role sa user_metadata.
      // Mao ni magamit bisag wala pa na-sync ang profiles table.
      const metaRole = (user.user_metadata as any)?.role as Role | undefined;
      getProfile(user.id)
        .then((profile) => {
          if (!active) return;
          const dbRole = profile?.role;
          // ACCEPT kung teacher bisan asa: DB man o metadata.
          // Mao ni ang fix sa daan nga teacher accounts nga na-stuck
          // as 'student' sa DB bisag teacher sila pag-register.
          const effectiveRole: Role =
            dbRole === 'teacher' || metaRole === 'teacher'
              ? 'teacher'
              : (dbRole ?? metaRole ?? 'student');
          setRole(effectiveRole);
          setRoleLoading(false);
          // Self-heal: kung metadata kay teacher pero DB kay student/null,
          // i-sync ang DB para sunod DB na mismo ang sakto.
          if (metaRole === 'teacher' && dbRole !== 'teacher') {
            updateProfile(user.id, { role: 'teacher' }).catch(() => {});
          }
        })
        .catch(() => {
          if (!active) return;
          // Kung di ma-load ang DB (offline/RLS), salig sa metadata.
          setRole(metaRole ?? 'student');
          setRoleLoading(false);
        });
      return () => {
        active = false;
      };
    }, [user])
  );

  const openPicker = (target: EditTarget) => {
    setMessage(null);
    setEditTarget(target);
    setEditingPart('date');
  };

  const onPickerChange = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (!editTarget) return;
    if (event.type === 'dismissed' || !selected) {
      setEditTarget(null);
      setEditingPart('date');
      return;
    }

    const current = editTarget === 'start' ? startDate : endDate;
    const next = new Date(current);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);

    if (editTarget === 'start') setStartDate(next);
    else setEndDate(next);

    if (isAndroid && editingPart === 'date') {
      setEditingPart('time');
    } else {
      setEditTarget(null);
      setEditingPart('date');
    }
  };

  const handleQuickEnd = (ms: number) => {
    setMessage(null);
    setEndDate(new Date(startDate.getTime() + ms));
  };

  const handleCreateEvent = () => {
    const event = {
      eventId: eventId.trim(),
      title: title.trim(),
      start: toLocalISO(startDate),
      end: toLocalISO(endDate),
    };

    if (!event.eventId || !event.title) {
      setMessage('Event title and code are required.');
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      setMessage('End time must be after start time.');
      return;
    }

    createEvent(event).then(({ error }) => {
      if (error) {
        setMessage('Could not save the event. Please try again.');
        return;
      }
      setMessage('Event saved! Scan the QR with the Scan tab to test it.');
      setPayload(buildQRPayload(event));
    });
  };

  if (roleLoading) {
    return (
      <View style={styles.gateContainer}>
        <Text style={styles.gateText}>Checking your account...</Text>
      </View>
    );
  }

  if (role !== 'teacher') {
    return (
      <View style={styles.gateContainer}>
        <Ionicons name="lock-closed-outline" size={40} color={COLORS.textSecondary} />
        <Text style={styles.gateTitle}>Teachers Only</Text>
        <Text style={styles.gateText}>
          Only teacher accounts can create events.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Create Event</Text>
      <Text style={styles.subtitle}>
        Fill in the event details, then scan the generated QR with the Scan tab.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Event Details</Text>
        <TextField
          label="Event Title"
          icon="text-outline"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Founders Day Assembly"
          autoCapitalize="sentences"
        />
        <TextField
          label="Event Code"
          icon="pricetag-outline"
          value={eventId}
          onChangeText={setEventId}
          placeholder="e.g. EVT-2026-0002"
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Schedule</Text>
        <Text style={styles.fieldLabel}>Starts</Text>
        <PickerField
          value={formatDateTime(startDate.toISOString())}
          icon="sunny-outline"
          onPress={() => openPicker('start')}
        />
        <Text style={styles.fieldLabel}>Ends</Text>
        <PickerField
          value={formatDateTime(endDate.toISOString())}
          icon="moon-outline"
          onPress={() => openPicker('end')}
        />
        <Text style={styles.chipsLabel}>Quick end time</Text>
        <View style={styles.chipRow}>
          {QUICK_END_OPTIONS.map((option) => (
            <Pressable
              key={option.label}
              style={({ pressed }) => [
                styles.chip,
                pressed && styles.chipPressed,
              ]}
              onPress={() => handleQuickEnd(option.ms)}
            >
              <Ionicons name="timer-outline" size={14} color={COLORS.primary} />
              <Text style={styles.chipText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {message && (
        <Text style={[styles.message, payload && styles.messageSuccess]}>
          {message}
        </Text>
      )}

      <AppButton
        theme="primary"
        title="Create Event"
        icon="add-circle-outline"
        onPress={handleCreateEvent}
      />

      {editTarget && (
        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={editTarget === 'start' ? startDate : endDate}
            mode={isAndroid ? editingPart : 'datetime'}
            display={isAndroid ? 'default' : 'spinner'}
            onChange={onPickerChange}
          />
        </View>
      )}

      {payload && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>
            Scan this QR code with the Scan tab:
          </Text>
          <View style={styles.qrBox}>
            <QRCode value={payload} size={200} />
          </View>
          <Text style={styles.payloadText}>{payload}</Text>
        </View>
      )}
    </ScrollView>
  );
}

type TextFieldProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoCapitalize: 'none' | 'sentences' | 'words' | 'characters';
};

function TextField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
}: TextFieldProps) {
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <Ionicons
          name={icon}
          size={18}
          color={COLORS.textSecondary}
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize={autoCapitalize}
        />
      </View>
    </>
  );
}

type PickerFieldProps = {
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function PickerField({ value, icon, onPress }: PickerFieldProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.pickerField, pressed && styles.pickerFieldPressed]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={COLORS.primary} />
      <Text style={styles.pickerValue}>{value}</Text>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
    </Pressable>
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  section: {
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
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
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
    backgroundColor: COLORS.surface,
    opacity: 0.85,
  },
  pickerValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginHorizontal: 10,
  },
  chipsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 14,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipPressed: {
    backgroundColor: COLORS.primary + '14',
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  pickerContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  message: {
    fontSize: 14,
    color: COLORS.danger,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  messageSuccess: {
    color: COLORS.success,
  },
  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  payloadText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  gateContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  gateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 12,
    marginBottom: 6,
  },
  gateText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
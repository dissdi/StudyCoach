import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/types';
import { useStudyStore } from '@/store/useStudyStore';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

type Nav = StackNavigationProp<RootStackParamList>;

const QUICK_SUBJECTS = ['수학', '영어', '국어', '과학', '코딩', '자유'];

export default function HomeScreen() {
  const nav = useNavigation<Nav>();
  const { sessions, currentSubject, setSubject, startSession } = useStudyStore();
  const [inputSubject, setInputSubject] = useState(currentSubject);

  const todaySessions = sessions.filter(
    (s) => new Date(s.startTime).toDateString() === new Date().toDateString()
  );
  const todayTotalSec = todaySessions.reduce((acc, s) => acc + s.durationSeconds, 0);
  const todayAvgFocus =
    todaySessions.length > 0
      ? Math.round(todaySessions.reduce((acc, s) => acc + s.avgConcentration, 0) / todaySessions.length)
      : 0;

  const handleStart = () => {
    const sub = inputSubject.trim() || '자유 공부';
    setSubject(sub);
    startSession();
    nav.navigate('Session', { subject: sub });
  };

  const formatSec = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>안녕하세요 👋</Text>
          <Text style={styles.date}>
            {format(new Date(), 'M월 d일 EEEE', { locale: ko })}
          </Text>
        </View>

        {/* 오늘 통계 카드 */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{todayTotalSec > 0 ? formatSec(todayTotalSec) : '-'}</Text>
            <Text style={styles.statLabel}>오늘 공부 시간</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: todayAvgFocus >= 70 ? COLORS.success : todayAvgFocus >= 40 ? COLORS.warning : COLORS.textPrimary }]}>
              {todayAvgFocus > 0 ? `${todayAvgFocus}점` : '-'}
            </Text>
            <Text style={styles.statLabel}>평균 집중도</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{todaySessions.length}회</Text>
            <Text style={styles.statLabel}>세션 수</Text>
          </View>
        </View>

        {/* 과목 선택 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>오늘 뭐 공부해요?</Text>

          {/* 빠른 선택 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
            {QUICK_SUBJECTS.map((sub) => (
              <TouchableOpacity
                key={sub}
                style={[styles.chip, inputSubject === sub && styles.chipActive]}
                onPress={() => setInputSubject(sub)}
              >
                <Text style={[styles.chipText, inputSubject === sub && styles.chipTextActive]}>
                  {sub}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 직접 입력 */}
          <TextInput
            style={styles.input}
            value={inputSubject}
            onChangeText={setInputSubject}
            placeholder="직접 입력..."
            placeholderTextColor={COLORS.textMuted}
            returnKeyType="done"
          />
        </View>

        {/* 시작 버튼 */}
        <TouchableOpacity style={styles.startButton} onPress={handleStart} activeOpacity={0.85}>
          <Text style={styles.startButtonText}>공부 시작  🚀</Text>
        </TouchableOpacity>

        {/* 최근 세션 */}
        {sessions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>최근 세션</Text>
            {sessions.slice(0, 5).map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.sessionRow}
                onPress={() => nav.navigate('Report', { sessionId: s.id })}
              >
                <View>
                  <Text style={styles.sessionSubject}>{s.subject}</Text>
                  <Text style={styles.sessionTime}>
                    {format(new Date(s.startTime), 'HH:mm')} · {formatSec(s.durationSeconds)}
                  </Text>
                </View>
                <View style={styles.sessionRight}>
                  <Text style={[styles.sessionFocus, { color: s.avgConcentration >= 70 ? COLORS.success : s.avgConcentration >= 40 ? COLORS.warning : COLORS.danger }]}>
                    {s.avgConcentration}점
                  </Text>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: SPACING.lg, paddingBottom: 100, gap: SPACING.lg },
  header: { gap: 4 },
  greeting: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary },
  date: { fontSize: 14, color: COLORS.textSecondary },

  statsRow: { flexDirection: 'row', gap: SPACING.sm },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  statLabel: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center' },

  section: { gap: SPACING.sm },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  chips: { flexDirection: 'row' },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.bgCard,
    marginRight: SPACING.sm,
  },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 14, color: COLORS.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  input: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.bgElevated,
  },

  startButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  startButtonText: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

  sessionRow: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionSubject: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '500' },
  sessionTime: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  sessionRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sessionFocus: { fontSize: 16, fontWeight: '700' },
  chevron: { fontSize: 20, color: COLORS.textMuted },
});

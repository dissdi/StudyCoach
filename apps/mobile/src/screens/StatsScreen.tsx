import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useStudyStore } from '@/store/useStudyStore';
import { getFocusColor } from '@/services/cvService';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants';
import { format, startOfWeek, eachDayOfInterval, endOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function StatsScreen() {
  const { sessions } = useStudyStore();

  const weekDays = eachDayOfInterval({
    start: startOfWeek(new Date(), { weekStartsOn: 1 }),
    end: endOfWeek(new Date(), { weekStartsOn: 1 }),
  });

  const weekData = useMemo(() => {
    return weekDays.map((day) => {
      const daySessions = sessions.filter(
        (s) => new Date(s.startTime).toDateString() === day.toDateString()
      );
      const totalMin = Math.round(daySessions.reduce((acc, s) => acc + s.durationSeconds, 0) / 60);
      const avgFocus =
        daySessions.length > 0
          ? Math.round(daySessions.reduce((acc, s) => acc + s.avgConcentration, 0) / daySessions.length)
          : 0;
      return { day, totalMin, avgFocus, count: daySessions.length };
    });
  }, [sessions]);

  const maxMin = Math.max(...weekData.map((d) => d.totalMin), 1);

  const totalAllTime = sessions.reduce((acc, s) => acc + s.durationSeconds, 0);
  const totalHours = Math.floor(totalAllTime / 3600);
  const overallAvg =
    sessions.length > 0
      ? Math.round(sessions.reduce((acc, s) => acc + s.avgConcentration, 0) / sessions.length)
      : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>학습 통계</Text>

        {/* 전체 요약 */}
        <View style={styles.overallRow}>
          <View style={styles.overallCard}>
            <Text style={styles.overallValue}>{totalHours}h</Text>
            <Text style={styles.overallLabel}>총 공부 시간</Text>
          </View>
          <View style={styles.overallCard}>
            <Text style={[styles.overallValue, { color: getFocusColor(overallAvg) }]}>
              {overallAvg > 0 ? `${overallAvg}` : '-'}
            </Text>
            <Text style={styles.overallLabel}>평균 집중도</Text>
          </View>
          <View style={styles.overallCard}>
            <Text style={styles.overallValue}>{sessions.length}</Text>
            <Text style={styles.overallLabel}>총 세션</Text>
          </View>
        </View>

        {/* 이번 주 바 차트 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>이번 주 공부 시간</Text>
          <View style={styles.barChart}>
            {weekData.map(({ day, totalMin, avgFocus }) => {
              const barHeight = Math.max(4, (totalMin / maxMin) * 120);
              const isToday = day.toDateString() === new Date().toDateString();
              return (
                <View key={day.toISOString()} style={styles.barCol}>
                  <Text style={styles.barValue}>{totalMin > 0 ? `${totalMin}m` : ''}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: barHeight,
                          backgroundColor: isToday ? COLORS.primary : COLORS.bgElevated,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barDay, isToday && { color: COLORS.primary, fontWeight: '700' }]}>
                    {format(day, 'EEE', { locale: ko })}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* 세션 없을 때 */}
        {sessions.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📚</Text>
            <Text style={styles.emptyTitle}>아직 공부 기록이 없어요</Text>
            <Text style={styles.emptyDesc}>홈에서 공부를 시작해보세요!</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: SPACING.lg, paddingBottom: 100, gap: SPACING.lg },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary },

  overallRow: { flexDirection: 'row', gap: SPACING.sm },
  overallCard: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  overallValue: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  overallLabel: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center' },

  section: { gap: SPACING.sm },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },

  barChart: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 180,
  },
  barCol: { alignItems: 'center', gap: 4, flex: 1 },
  barValue: { fontSize: 10, color: COLORS.textMuted, height: 14 },
  barTrack: { width: '60%', height: 120, justifyContent: 'flex-end', borderRadius: 4, overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 4 },
  barDay: { fontSize: 11, color: COLORS.textSecondary },

  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxl, gap: SPACING.sm },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary },
  emptyDesc: { fontSize: 14, color: COLORS.textSecondary },
});

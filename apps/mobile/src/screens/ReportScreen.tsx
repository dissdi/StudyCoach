import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@/types';
import { useStudyStore } from '@/store/useStudyStore';
import { getEmotionEmoji, getEmotionLabel, getFocusColor } from '@/services/cvService';
import { COLORS, SPACING, BORDER_RADIUS } from '@/constants';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

type Route = RouteProp<RootStackParamList, 'Report'>;

export default function ReportScreen() {
  const nav = useNavigation();
  const route = useRoute<Route>();
  const { sessions } = useStudyStore();

  const session = useMemo(
    () => sessions.find((s) => s.id === route.params.sessionId),
    [sessions, route.params.sessionId]
  );

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>세션을 찾을 수 없어요.</Text>
          <TouchableOpacity onPress={() => nav.goBack()}>
            <Text style={styles.backText}>돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const formatSec = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}시간 ${m}분 ${s}초`;
    if (m > 0) return `${m}분 ${s}초`;
    return `${s}초`;
  };

  // 감정 분포 계산
  const emotionCounts = session.emotionHistory.reduce<Record<string, number>>((acc, snap) => {
    acc[snap.emotion] = (acc[snap.emotion] ?? 0) + 1;
    return acc;
  }, {});

  const focusColor = getFocusColor(session.avgConcentration);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>세션 리포트</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* 요약 카드 */}
        <View style={styles.summaryCard}>
          <Text style={styles.subject}>{session.subject}</Text>
          <Text style={styles.sessionDate}>
            {format(new Date(session.startTime), 'M월 d일 HH:mm', { locale: ko })}
          </Text>

          <View style={styles.bigStats}>
            <View style={styles.bigStatItem}>
              <Text style={styles.bigStatValue}>{formatSec(session.durationSeconds)}</Text>
              <Text style={styles.bigStatLabel}>공부 시간</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.bigStatItem}>
              <Text style={[styles.bigStatValue, { color: focusColor }]}>
                {session.avgConcentration}
              </Text>
              <Text style={styles.bigStatLabel}>평균 집중도</Text>
            </View>
          </View>
        </View>

        {/* 감정 분포 */}
        {Object.keys(emotionCounts).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>감정 분포</Text>
            <View style={styles.emotionGrid}>
              {Object.entries(emotionCounts).map(([emotion, count]) => {
                const total = session.emotionHistory.length;
                const pct = Math.round((count / total) * 100);
                return (
                  <View key={emotion} style={styles.emotionItem}>
                    <Text style={styles.emotionEmoji}>{getEmotionEmoji(emotion as any)}</Text>
                    <Text style={styles.emotionLabel}>{getEmotionLabel(emotion as any)}</Text>
                    <Text style={styles.emotionPct}>{pct}%</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 코치 메시지 모음 */}
        {session.coachMessages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              코치 메시지 ({session.coachMessages.length}개)
            </Text>
            {session.coachMessages.map((msg) => (
              <View key={msg.id} style={styles.msgRow}>
                <Text style={styles.msgTime}>
                  {format(new Date(msg.timestamp), 'HH:mm')}
                </Text>
                <Text style={styles.msgText}>{msg.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 홈으로 */}
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => nav.navigate('Main' as never)}
        >
          <Text style={styles.homeBtnText}>홈으로 돌아가기</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: SPACING.lg, paddingBottom: 60, gap: SPACING.lg },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: 18, color: COLORS.textSecondary },
  title: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },

  summaryCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    gap: 6,
    alignItems: 'center',
  },
  subject: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  sessionDate: { fontSize: 13, color: COLORS.textSecondary },
  bigStats: { flexDirection: 'row', marginTop: SPACING.md, gap: SPACING.xl },
  bigStatItem: { alignItems: 'center', gap: 4 },
  bigStatValue: { fontSize: 28, fontWeight: '700', color: COLORS.textPrimary },
  bigStatLabel: { fontSize: 12, color: COLORS.textMuted },
  divider: { width: StyleSheet.hairlineWidth, backgroundColor: COLORS.bgElevated, height: 48, alignSelf: 'center' },

  section: { gap: SPACING.sm },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },

  emotionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  emotionItem: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 4,
    minWidth: 80,
  },
  emotionEmoji: { fontSize: 24 },
  emotionLabel: { fontSize: 11, color: COLORS.textSecondary },
  emotionPct: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },

  msgRow: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md,
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'flex-start',
  },
  msgTime: { fontSize: 11, color: COLORS.textMuted, paddingTop: 2, minWidth: 40 },
  msgText: { flex: 1, fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },

  homeBtn: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.bgElevated,
  },
  homeBtnText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '500' },
});

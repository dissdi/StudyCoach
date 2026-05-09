import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/types';
import { useStudyStore } from '@/store/useStudyStore';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useFaceAnalysis } from '@/hooks/useFaceAnalysis';
import { useCoach } from '@/hooks/useCoach';
import { useTTS } from '@/hooks/useTTS';
import { getEmotionEmoji, getEmotionLabel } from '@/services/cvService';

import StudyTimer from '@/components/StudyTimer';
import FocusIndicator from '@/components/FocusIndicator';
import CoachMessage from '@/components/CoachMessage';
import CameraFeed from '@/components/CameraFeed';

import { COLORS, SPACING, BORDER_RADIUS } from '@/constants';

type Nav = StackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Session'>;

export default function StudySessionScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);

  const { status, currentSession, latestFaceResult, pauseSession, resumeSession, finishSession } =
    useStudyStore();
  const { formatted } = useStudyTimer();
  const { onFacesDetected } = useFaceAnalysis();
  useCoach();
  useTTS();

  // 카메라 권한 요청
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission().then((res) => {
        if (res.granted) setCameraReady(true);
      });
    } else {
      setCameraReady(true);
    }
  }, []);

  const handleFinish = () => {
    Alert.alert('세션 종료', '공부를 마무리할까요?', [
      { text: '계속 공부', style: 'cancel' },
      {
        text: '종료',
        style: 'destructive',
        onPress: () => {
          finishSession();
          const sessionId = currentSession?.id ?? '';
          nav.replace('Report', { sessionId });
        },
      },
    ]);
  };

  const face = latestFaceResult;
  const latestCoachMsg =
    currentSession && currentSession.coachMessages.length > 0
      ? currentSession.coachMessages[currentSession.coachMessages.length - 1]
      : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* 상단 헤더 */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleFinish} style={styles.finishBtn}>
            <Text style={styles.finishText}>종료</Text>
          </TouchableOpacity>
          <Text style={styles.subjectText}>
            {route.params?.subject ?? '자유 공부'}
          </Text>
          <TouchableOpacity
            onPress={status === 'running' ? pauseSession : resumeSession}
            style={styles.pauseBtn}
          >
            <Text style={styles.pauseText}>{status === 'running' ? '⏸' : '▶'}</Text>
          </TouchableOpacity>
        </View>

        {/* 타이머 */}
        <View style={styles.timerSection}>
          <StudyTimer formatted={formatted} />
          {status === 'paused' && (
            <Text style={styles.pausedBadge}>일시정지</Text>
          )}
        </View>

        {/* 카메라 피드 */}
        <View style={styles.cameraWrapper}>
          <CameraFeed onFacesDetected={onFacesDetected} isActive={cameraReady} />
        </View>

        {/* 집중도 인디케이터 */}
        <View style={styles.bottomSection}>
          <FocusIndicator
            score={face?.concentrationScore ?? 0}
            emotion={face?.emotion ?? 'unknown'}
            emotionEmoji={getEmotionEmoji(face?.emotion ?? 'unknown')}
            emotionLabel={getEmotionLabel(face?.emotion ?? 'unknown')}
          />

          {/* 코치 메시지 */}
          <CoachMessage message={latestCoachMsg} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, padding: SPACING.md, gap: SPACING.md },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  finishBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,82,82,0.15)',
  },
  finishText: { color: COLORS.danger, fontWeight: '600', fontSize: 14 },
  subjectText: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  pauseBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.bgCard,
  },
  pauseText: { fontSize: 18 },

  timerSection: { alignItems: 'center', gap: 6 },
  pausedBadge: {
    backgroundColor: COLORS.warning + '33',
    color: COLORS.warning,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },

  cameraWrapper: { flex: 1 },

  bottomSection: { gap: SPACING.sm },
});

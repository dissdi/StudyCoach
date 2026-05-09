import { useEffect, useRef } from 'react';
import { useStudyStore } from '@/store/useStudyStore';
import { analyzeMinuteAndCoach, mockAnalyzeMinute } from '@study-coach/shared';
import type { MinuteDataPoint, MinuteReport, CoachMessage } from '@study-coach/shared';

const SNAPSHOT_INTERVAL_SEC = 10;
const SNAPSHOTS_PER_MINUTE = 6;

export function useCoach() {
  const {
    status, latestFaceResult, currentSession, elapsedSec,
    currentSubject, coachPersonality, coachEnabled,
    llmProvider, apiKey, openaiApiKey,
    coachAdjustments, addCoachMessage,
  } = useStudyStore();

  const buffer = useRef<MinuteDataPoint[]>([]);
  const lastSnapshotSec = useRef(-SNAPSHOT_INTERVAL_SEC);

  useEffect(() => {
    if (status !== 'running' || !coachEnabled || !latestFaceResult) return;

    const face = latestFaceResult;

    if (elapsedSec - lastSnapshotSec.current < SNAPSHOT_INTERVAL_SEC) return;
    lastSnapshotSec.current = elapsedSec;

    const point: MinuteDataPoint = {
      offsetSec: buffer.current.length * SNAPSHOT_INTERVAL_SEC,
      concentrationScore: face.concentrationScore,
      emotion: face.emotion,
      eyeOpenAvg: (face.leftEyeOpen + face.rightEyeOpen) / 2,
    };

    buffer.current = [...buffer.current, point];

    if (buffer.current.length < SNAPSHOTS_PER_MINUTE) return;

    const now = Date.now();
    const activeAdjustments = coachAdjustments.filter(
      (a) => a.expiresAt === null || a.expiresAt > now
    );

    const report: MinuteReport = {
      dataPoints: [...buffer.current],
      subject: currentSubject,
      totalStudyMinutes: Math.floor(elapsedSec / 60),
      coachPersonality,
      recentMessages: currentSession?.coachMessages.slice(-2) ?? [],
      userAdjustments: activeAdjustments.length > 0
        ? activeAdjustments.map((a) => a.instruction)
        : undefined,
    };

    buffer.current = [];

    const activeApiKey = llmProvider === 'openai' ? openaiApiKey : apiKey;

    (async () => {
      try {
        const decision = activeApiKey
          ? await analyzeMinuteAndCoach(report, activeApiKey, llmProvider)
          : mockAnalyzeMinute(report);

        if (!decision.needsCoaching || !decision.message) return;

        const msg: CoachMessage = {
          id: `coach-${Date.now()}`,
          text: decision.message,
          tone: decision.tone,
          trigger: 'milestone',
          timestamp: Date.now(),
        };
        addCoachMessage(msg);
      } catch (err) {
        console.error('[useCoach] 분석 실패:', err);
      }
    })();
  }, [elapsedSec]);

  useEffect(() => {
    if (status !== 'running') {
      buffer.current = [];
      lastSnapshotSec.current = -SNAPSHOT_INTERVAL_SEC;
    }
  }, [status]);
}

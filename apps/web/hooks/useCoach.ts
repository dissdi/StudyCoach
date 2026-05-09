'use client';

import { useEffect, useRef } from 'react';
import { useStudyStore } from '@/store/useStudyStore';
import {
  analyzeMinuteAndCoach,
  mockAnalyzeMinute,
  generateCornerCoachMessage,
  mockCornerCoachMessage,
  generateDirectCoachResponse,
  mockDirectReply,
  generateRestStartMessage,
  generateRestMilestoneMessage,
  mockRestStartMessage,
  mockRestMilestoneMessage,
  generateGoalMilestoneMessage,
  mockGoalMilestoneMessage,
} from '@study-coach/shared';
import type { MinuteDataPoint, MinuteReport, CoachMessage } from '@study-coach/shared';

const SNAPSHOT_INTERVAL_SEC = 10;
const DEFAULT_CHECK_SEC     = 30;
const MIN_CHECK_SEC         = 15;
const MAX_CHECK_SEC         = 300;

const SILENCE_KEYWORDS = ['닥쳐', '조용', '그만', '시끄러', '말하지마', '말 하지마', 'quiet', 'shut up', '됐어', '됐고'];

// 빠른 메시지 → 체크 간격 즉시 강제 조정
const QUICK_INTERVAL_MAP: Array<{ keywords: string[]; sec: number }> = [
  { keywords: ['집중 잘', '집중잘', '잘 돼', '잘돼', '혼자 할게', '혼자할게'], sec: 240 },
  { keywords: ['집중이 안', '집중안', '집중 안'], sec: MIN_CHECK_SEC },
];

function getQuickIntervalOverride(text: string): number | null {
  const lower = text.toLowerCase();
  for (const { keywords, sec } of QUICK_INTERVAL_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) return sec;
  }
  return null;
}

function hasSilenceKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return SILENCE_KEYWORDS.some((kw) => lower.includes(kw));
}

export function useCoach() {
  const {
    status,
    latestFaceResult,
    currentSession,
    elapsedSec,
    currentSubject,
    coachPersonality,
    coachEnabled,
    llmProvider,
    openaiApiKey,
    openaiModel,
    anthropicApiKey,
    anthropicModel,
    coachAdjustments,
    isResting,
    restEndTime,
    pendingUserMessage,
    recentUserChats,
    goalDurationSec,
    conversationHistory,
    addCoachMessage,
    setAdaptiveCheckSec,
    clearPendingMessage,
    setCoachTyping,
    applyAdjustment,
    removeAdjustment,
    addToConversationHistory,
  } = useStudyStore();

  const buffer              = useRef<MinuteDataPoint[]>([]);
  const lastSnapshotSec     = useRef(-SNAPSHOT_INTERVAL_SEC);
  const lastLLMSec          = useRef(-DEFAULT_CHECK_SEC);
  const nextCheckSecRef     = useRef(DEFAULT_CHECK_SEC);
  const prevIsRestingRef    = useRef(false);
  const replyingRef         = useRef(false);
  const restMilestonesRef   = useRef({ fired1min: false, fired10sec: false });
  const initialRestDurRef   = useRef(0);
  const goalMilestonesRef   = useRef({ fired5min: false, fired1min: false, firedReached: false });

  // ── 헬퍼 ─────────────────────────────────────────────────────────
  // provider에 따라 올바른 API 키 반환
  const getActiveApiKey = () =>
    llmProvider === 'anthropic' ? anthropicApiKey : openaiApiKey;
  // provider에 따라 올바른 모델 반환
  const getModel = () =>
    llmProvider === 'anthropic'
      ? (anthropicModel || 'claude-3-5-haiku-latest')
      : (openaiModel || 'gpt-4o-mini');

  const hasSilence = () => {
    const now = Date.now();
    return coachAdjustments.some(
      (a) => a.type === 'silence' && (a.expiresAt === null || a.expiresAt > now)
    );
  };

  const getAwakenessRate = () => {
    if (!currentSession || currentSession.emotionHistory.length === 0) return 100;
    const presentCount = currentSession.emotionHistory.filter(
      (s: any) => (s.faceState ?? s.emotion) === 'present'
    ).length;
    return Math.round((presentCount / currentSession.emotionHistory.length) * 100);
  };

  // ── 사용자 채팅 메시지 감지 ──────────────────────────────────────
  useEffect(() => {
    if (!pendingUserMessage || replyingRef.current) return;
    replyingRef.current = true;

    // 채팅 응답 중 주기 분석이 끼어들지 않도록 타이머 리셋
    lastLLMSec.current = elapsedSec;

    const messageSnapshot = pendingUserMessage;
    clearPendingMessage();

    // 빠른 메시지 → 체크 간격 즉시 강제 적용 (LLM 응답 기다리지 않음)
    const intervalOverride = getQuickIntervalOverride(messageSnapshot);
    if (intervalOverride !== null) {
      nextCheckSecRef.current = intervalOverride;
      setAdaptiveCheckSec(intervalOverride);
    }

    if (hasSilenceKeyword(messageSnapshot)) {
      const silenceAdj = {
        type: 'silence' as const,
        label: '음소거',
        instruction: '사용자가 잠시 조용히 해달라고 했다. 10분간 코칭 메시지를 보내지 말 것.',
        expiresAt: Date.now() + 10 * 60 * 1000,
      };
      applyAdjustment(silenceAdj);
      addCoachMessage({
        id: `chat-${Date.now()}`,
        text: '알겠어, 10분 동안 조용히 있을게. 집중해!',
        tone: 'calm',
        trigger: 'manual',
        timestamp: Date.now(),
      });
      setCoachTyping(false);
      replyingRef.current = false;
      return;
    }

    const activeApiKey = getActiveApiKey();
    console.log('[useCoach] 채팅 응답 시도 | provider:', llmProvider, '| apiKey 있음:', !!activeApiKey, '| model:', getModel());
    const context = {
      subject: currentSubject,
      studyDurationSec: elapsedSec,
      goalDurationSec: goalDurationSec > 0 ? goalDurationSec : undefined,
      personality: coachPersonality,
    };

    // 현재 conversationHistory의 마지막 항목은 방금 sendUserMessage에서 추가된 user 메시지
    // 그 이전까지를 히스토리로 전달
    const historySnapshot = conversationHistory.slice(0, -1);

    (async () => {
      try {
        const { text, tone } = activeApiKey
          ? await generateDirectCoachResponse(messageSnapshot, context, activeApiKey, getModel(), historySnapshot)
          : { text: mockDirectReply(messageSnapshot, context), tone: 'calm' as const };

        addCoachMessage({
          id: `chat-${Date.now()}`,
          text,
          tone,
          trigger: 'manual',
          timestamp: Date.now(),
        });
        addToConversationHistory({ role: 'assistant', content: text });
      } catch (err) {
        console.error('[useCoach] 직접 응답 실패:', err);
        const fallback = mockDirectReply(messageSnapshot, context);
        addCoachMessage({
          id: `chat-${Date.now()}`,
          text: fallback,
          tone: 'calm',
          trigger: 'manual',
          timestamp: Date.now(),
        });
        addToConversationHistory({ role: 'assistant', content: fallback });
      } finally {
        setCoachTyping(false);
        replyingRef.current = false;
        // 채팅 응답 완료 후 주기 타이머 리셋 → 즉시 주기 분석 재발동 방지
        lastLLMSec.current = elapsedSec;
      }
    })();
  }, [pendingUserMessage]);

  // ── 휴식 상태 변화 감지 ──────────────────────────────────────────
  useEffect(() => {
    const wasResting = prevIsRestingRef.current;
    prevIsRestingRef.current = isResting;

    if (!wasResting && isResting) {
      restMilestonesRef.current = { fired1min: false, fired10sec: false };
      const durationSec = restEndTime ? Math.round((restEndTime - Date.now()) / 1000) : 300;
      initialRestDurRef.current = durationSec;

      if (hasSilence()) return;

      const activeApiKey = getActiveApiKey();
      const stats = {
        restDurationSec: durationSec,
        subject: currentSubject,
        totalMinutes: Math.floor(elapsedSec / 60),
      };

      (async () => {
        try {
          const text = activeApiKey
            ? await generateRestStartMessage(stats, coachPersonality, activeApiKey, getModel())
            : mockRestStartMessage(Math.round(durationSec / 60), coachPersonality);
          addCoachMessage({ id: `rest-start-${Date.now()}`, text, tone: 'encouraging', trigger: 'milestone', timestamp: Date.now() });
        } catch {
          addCoachMessage({ id: `rest-start-${Date.now()}`, text: mockRestStartMessage(Math.round(durationSec / 60), coachPersonality), tone: 'encouraging', trigger: 'milestone', timestamp: Date.now() });
        }
      })();
      return;
    }

    if (wasResting && !isResting) {
      const activeApiKey = getActiveApiKey();
      const stats = {
        totalMinutes: Math.floor(elapsedSec / 60),
        subject: currentSubject,
        restMinutes: Math.round(initialRestDurRef.current / 60),
      };

      nextCheckSecRef.current = DEFAULT_CHECK_SEC;
      lastLLMSec.current = elapsedSec;
      buffer.current = [];
      setAdaptiveCheckSec(DEFAULT_CHECK_SEC);

      (async () => {
        try {
          const text = activeApiKey
            ? await generateCornerCoachMessage(stats, coachPersonality, activeApiKey, getModel())
            : mockCornerCoachMessage(coachPersonality);
          addCoachMessage({ id: `corner-${Date.now()}`, text, tone: 'encouraging', trigger: 'milestone', timestamp: Date.now() });
        } catch {
          addCoachMessage({ id: `corner-${Date.now()}`, text: mockCornerCoachMessage(coachPersonality), tone: 'encouraging', trigger: 'milestone', timestamp: Date.now() });
        }
      })();
    }
  }, [isResting]);

  // ── 휴식 마일스톤 타이머 (1분 전, 10초 전) ────────────────────────
  useEffect(() => {
    if (!isResting || !restEndTime) return;

    const tick = () => {
      if (hasSilence()) return;

      const remainSec = Math.ceil((restEndTime - Date.now()) / 1000);
      const milestones = restMilestonesRef.current;

      if (
        !milestones.fired1min &&
        remainSec > 0 && remainSec <= 65 && remainSec >= 55 &&
        initialRestDurRef.current >= 90
      ) {
        milestones.fired1min = true;
        const activeApiKey = getActiveApiKey();
        const stats = { subject: currentSubject, totalMinutes: Math.floor(elapsedSec / 60) };
        (async () => {
          try {
            const text = activeApiKey
              ? await generateRestMilestoneMessage('1min', stats, coachPersonality, activeApiKey, getModel())
              : mockRestMilestoneMessage('1min', coachPersonality);
            addCoachMessage({ id: `rest-1min-${Date.now()}`, text, tone: 'encouraging', trigger: 'milestone', timestamp: Date.now() });
          } catch {
            addCoachMessage({ id: `rest-1min-${Date.now()}`, text: mockRestMilestoneMessage('1min', coachPersonality), tone: 'encouraging', trigger: 'milestone', timestamp: Date.now() });
          }
        })();
      }

      if (!milestones.fired10sec && remainSec > 0 && remainSec <= 12 && remainSec >= 6) {
        milestones.fired10sec = true;
        const activeApiKey = getActiveApiKey();
        const stats = { subject: currentSubject, totalMinutes: Math.floor(elapsedSec / 60) };
        (async () => {
          try {
            const text = activeApiKey
              ? await generateRestMilestoneMessage('10sec', stats, coachPersonality, activeApiKey, getModel())
              : mockRestMilestoneMessage('10sec', coachPersonality);
            addCoachMessage({ id: `rest-10sec-${Date.now()}`, text, tone: 'encouraging', trigger: 'milestone', timestamp: Date.now() });
          } catch {
            addCoachMessage({ id: `rest-10sec-${Date.now()}`, text: mockRestMilestoneMessage('10sec', coachPersonality), tone: 'encouraging', trigger: 'milestone', timestamp: Date.now() });
          }
        })();
      }
    };

    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isResting, restEndTime]);

  // ── Adaptive 배치 분석 ────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'running' || !coachEnabled || !latestFaceResult || isResting) return;

    const face = latestFaceResult;

    if (elapsedSec - lastSnapshotSec.current >= SNAPSHOT_INTERVAL_SEC) {
      lastSnapshotSec.current = elapsedSec;
      buffer.current = [
        ...buffer.current,
        {
          offsetSec: buffer.current.length * SNAPSHOT_INTERVAL_SEC,
          faceState: face.faceState,
          eyeOpenAvg: (face.leftEyeOpen + face.rightEyeOpen) / 2,
        },
      ];
    }

    if (buffer.current.length === 0) return;
    if (elapsedSec - lastLLMSec.current < nextCheckSecRef.current) return;
    if (hasSilence()) return;
    if (replyingRef.current) return;  // 채팅 응답 중이면 주기 분석 스킵

    lastLLMSec.current = elapsedSec;
    const dataToSend = [...buffer.current];
    buffer.current = [];

    const now = Date.now();
    const activeAdjustments = coachAdjustments.filter(
      (a) => a.expiresAt === null || a.expiresAt > now
    );

    const goalMins = goalDurationSec > 0 ? Math.floor(goalDurationSec / 60) : undefined;
    const goalRemainSec = goalDurationSec > 0 ? Math.max(0, goalDurationSec - elapsedSec) : undefined;
    const goalRemainMins = goalRemainSec !== undefined ? Math.ceil(goalRemainSec / 60) : undefined;

    const report: MinuteReport = {
      dataPoints: dataToSend,
      subject: currentSubject,
      totalStudyMinutes: Math.floor(elapsedSec / 60),
      totalStudySeconds: elapsedSec,
      coachPersonality,
      recentMessages: currentSession?.coachMessages.slice(-2) ?? [],
      currentCheckIntervalSec: nextCheckSecRef.current,
      recentUserChats: recentUserChats.slice(-3),
      userAdjustments: activeAdjustments.length > 0
        ? activeAdjustments.map((a) => a.instruction)
        : undefined,
      goalDurationMinutes: goalMins,
      goalRemainingMinutes: goalRemainMins,
    };

    const activeApiKey = getActiveApiKey();

    (async () => {
      try {
        const decision = activeApiKey
          ? await analyzeMinuteAndCoach(report, activeApiKey, getModel())
          : mockAnalyzeMinute(report);

        if (typeof decision.nextCheckSec === 'number') {
          const clamped = Math.max(MIN_CHECK_SEC, Math.min(MAX_CHECK_SEC, decision.nextCheckSec));
          nextCheckSecRef.current = clamped;
          setAdaptiveCheckSec(clamped);
        }

        if (!decision.message) return;

        const msg: CoachMessage = {
          id: `coach-${Date.now()}`,
          text: decision.message,
          tone: decision.tone,
          trigger: decision.isQuestion ? 'question' : 'milestone',
          timestamp: Date.now(),
        };
        addCoachMessage(msg);
      } catch (err) {
        console.error('[useCoach] 분석 실패:', err);
      }
    })();
  }, [elapsedSec]);

  // ── adjustment 변경 시 즉시 interval 리셋 ────────────────────────
  useEffect(() => {
    const hasMoreFrequent = coachAdjustments.some((a) => a.type === 'more_frequent');
    if (hasMoreFrequent) {
      nextCheckSecRef.current = MIN_CHECK_SEC;
      lastLLMSec.current = -999999;
      setAdaptiveCheckSec(MIN_CHECK_SEC);
    }
  }, [coachAdjustments]);

  // ── 목표 시간 마일스톤 (5분 전, 1분 전, 달성) ────────────────────
  useEffect(() => {
    if (status !== 'running' || goalDurationSec <= 0 || isResting) return;
    if (hasSilence()) return;

    const remainSec = goalDurationSec - elapsedSec;
    const milestones = goalMilestonesRef.current;
    const activeApiKey = getActiveApiKey();
    const stats = {
      subject: currentSubject,
      totalMinutes: Math.floor(elapsedSec / 60),
      goalMinutes: Math.floor(goalDurationSec / 60),
    };

    // 목표 달성
    if (!milestones.firedReached && remainSec <= 0) {
      milestones.firedReached = true;
      (async () => {
        try {
          const text = activeApiKey
            ? await generateGoalMilestoneMessage('reached', stats, coachPersonality, activeApiKey, getModel())
            : mockGoalMilestoneMessage('reached', stats, coachPersonality);
          addCoachMessage({ id: `goal-reached-${Date.now()}`, text, tone: 'encouraging', trigger: 'milestone', timestamp: Date.now() });
        } catch {
          addCoachMessage({ id: `goal-reached-${Date.now()}`, text: mockGoalMilestoneMessage('reached', stats, coachPersonality), tone: 'encouraging', trigger: 'milestone', timestamp: Date.now() });
        }
      })();
      return;
    }

    // 5분 전 (목표가 8분 이상일 때만)
    if (!milestones.fired5min && remainSec > 0 && remainSec <= 5 * 60 + 10 && remainSec >= 5 * 60 - 10 && goalDurationSec >= 8 * 60) {
      milestones.fired5min = true;
      (async () => {
        try {
          const text = activeApiKey
            ? await generateGoalMilestoneMessage('5min', stats, coachPersonality, activeApiKey, getModel())
            : mockGoalMilestoneMessage('5min', stats, coachPersonality);
          addCoachMessage({ id: `goal-5min-${Date.now()}`, text, tone: 'encouraging', trigger: 'milestone', timestamp: Date.now() });
        } catch {
          addCoachMessage({ id: `goal-5min-${Date.now()}`, text: mockGoalMilestoneMessage('5min', stats, coachPersonality), tone: 'encouraging', trigger: 'milestone', timestamp: Date.now() });
        }
      })();
    }

    // 1분 전 (목표가 3분 이상일 때만)
    if (!milestones.fired1min && remainSec > 0 && remainSec <= 1 * 60 + 10 && remainSec >= 1 * 60 - 10 && goalDurationSec >= 3 * 60) {
      milestones.fired1min = true;
      (async () => {
        try {
          const text = activeApiKey
            ? await generateGoalMilestoneMessage('1min', stats, coachPersonality, activeApiKey, getModel())
            : mockGoalMilestoneMessage('1min', stats, coachPersonality);
          addCoachMessage({ id: `goal-1min-${Date.now()}`, text, tone: 'encouraging', trigger: 'milestone', timestamp: Date.now() });
        } catch {
          addCoachMessage({ id: `goal-1min-${Date.now()}`, text: mockGoalMilestoneMessage('1min', stats, coachPersonality), tone: 'encouraging', trigger: 'milestone', timestamp: Date.now() });
        }
      })();
    }
  }, [elapsedSec]);

  // ── goalDurationSec 변경 시 마일스톤 리셋 ────────────────────────
  useEffect(() => {
    goalMilestonesRef.current = { fired5min: false, fired1min: false, firedReached: false };
  }, [goalDurationSec]);

  // ── 세션 종료/일시정지 시 리셋 ──────────────────────────────────
  useEffect(() => {
    if (status !== 'running') {
      buffer.current = [];
      lastSnapshotSec.current = -SNAPSHOT_INTERVAL_SEC;
      nextCheckSecRef.current = DEFAULT_CHECK_SEC;
      lastLLMSec.current = -DEFAULT_CHECK_SEC;
    }
  }, [status]);
}

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
/** 사용자 발언이 LLM 컨텍스트에서 "방금 한 말"로 취급되는 최대 경과 시간 (초) */
const FRESH_USER_CHAT_SEC   = 120;
/** 같은 사용자 발언으로 코칭이 몇 번 이상 발생하면 그 발언을 더이상 컨텍스트에 포함하지 않음 */
const MAX_COACHINGS_PER_USER_CHAT = 2;

const SILENCE_KEYWORDS = ['닥쳐', '조용', '그만', '시끄러', '말하지마', '말 하지마', 'quiet', 'shut up', '됐어', '됐고'];

function hasSilenceKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return SILENCE_KEYWORDS.some((kw) => lower.includes(kw));
}

// 사용자가 눈/시선 관련 언급을 거부할 때 매칭되는 패턴.
// 책·노트를 보는 자세를 졸음으로 오판해서 반복적으로 짜증 유발하는 경우 차단용.
// 한 번 매칭되면 세션 내내 눈/시선 멘트 금지 + 졸음 트리거 메시지 억제.
const EYE_SUPPRESS_PATTERNS = [
  /눈\s*(을|좀|은)?\s*(보지|보지마|감지|감긴|감김|개방|뜨라|뜨고)/,
  /눈\s*(감|뜨)/,
  /눈빛|눈꺼풀|시선/,
  /책\s*(을|읽|보)/,
  /책읽|독서|글\s*읽|글자\s*읽/,
  /내려다|아래\s*보/,
];

function hasEyeSuppressKeyword(text: string): boolean {
  return EYE_SUPPRESS_PATTERNS.some((re) => re.test(text));
}

// ── 메시지 반복 감지 ────────────────────────────────────────────
/** 텍스트 정규화: 공백·구두점 제거 후 소문자화 */
function normalize(s: string): string {
  return s.replace(/[\s.,!?~·…"'`]/g, '').toLowerCase();
}

/** 두 문자열의 character bigram Jaccard 유사도 (0~1) */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const bigrams = (s: string): Set<string> => {
    const out = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
    return out;
  };
  const A = bigrams(na);
  const B = bigrams(nb);
  let inter = 0;
  A.forEach((g) => { if (B.has(g)) inter++; });
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** 직전 메시지(최대 3개) 중 하나라도 유사도 임계치 이상이면 true */
function isTooSimilarToRecent(candidate: string, recent: { text: string }[], threshold = 0.55): boolean {
  return recent.slice(-3).some((m) => similarity(candidate, m.text) >= threshold);
}

// ── 컨텍스트 없는 응원 풀 (반복 감지 시 fallback) ────────────────
const FALLBACK_ENCOURAGEMENTS: Record<string, string[]> = {
  friend: [
    '잘 하고 있어. 그 페이스 유지하자.',
    '말 안 해도 보여, 너 진짜 집중하고 있는 거.',
    '계속 가자. 내가 옆에 있어.',
    '지금 이 순간이 쌓여서 결과 만들어.',
  ],
  teacher: [
    '잘 하고 있습니다. 계속 그렇게 가세요.',
    '지금의 집중이 곧 실력이 됩니다.',
    '꾸준함이 가장 강한 무기입니다.',
    '한 호흡 가다듬고 다시 한 줄 더 갑시다.',
  ],
  trainer: [
    '회원님 잘 하고 계십니다~! 그대로 가십니다!',
    '회원님 페이스 좋으십니다~ 유지하십니다!',
    '회원님 이미 충분히 달리고 계십니다~!',
    '회원님 한 세트 더 가십니다! 할 수 있습니다!',
  ],
  boxing: [
    '잘 버티고 있어. 그대로 가.',
    '말 필요 없어. 계속 쳐.',
    '리듬 좋아. 흐트러지지 마.',
    '이 라운드도 네 거야. 끝까지 가.',
  ],
  strict_mom: [
    '그래, 잘하고 있어. 계속 해.',
    '엄마가 보고 있어. 지금 그대로 가.',
    '말 안 해도 알아. 너 잘 하고 있는 거.',
    '한 줄만 더, 한 줄만 더 가자.',
  ],
  mentor: [
    '스승은 너를 믿느니라. 가거라.',
    '잘 하고 있다. 그대로 정진하거라.',
    '이 순간이 곧 네놈의 실력이 되느니라.',
    '에잉, 묵묵히 하는 모습이 보기 좋구나.',
    '말이 필요 없다. 계속 가거라.',
  ],
};

function pickFallbackEncouragement(personality: string, elapsedMin: number, lastTexts: string[]): string {
  const pool = FALLBACK_ENCOURAGEMENTS[personality] ?? FALLBACK_ENCOURAGEMENTS.friend;
  // 시간 인정 메시지 (mentor 톤 예시) — 10분 단위로
  const minuteBased: Record<string, (m: number) => string> = {
    mentor:     (m) => `벌써 ${m}분째 정진하고 있구나. 자랑스럽다.`,
    friend:     (m) => `벌써 ${m}분 했어. 진짜 잘하고 있어.`,
    teacher:    (m) => `${m}분 집중했습니다. 훌륭합니다.`,
    trainer:    (m) => `회원님 ${m}분째이십니다~! 대단하십니다!`,
    boxing:     (m) => `${m}분 버텼어. 그게 실력이야.`,
    strict_mom: (m) => `${m}분 했네. 잘했어, 계속 가.`,
  };
  // 짝수 호출에선 시간 기반, 홀수 호출에선 일반 응원에서 랜덤 (이미 비슷한 건 제외)
  const candidates: string[] = [];
  if (elapsedMin >= 5 && minuteBased[personality]) {
    candidates.push(minuteBased[personality](elapsedMin));
  }
  candidates.push(...pool);
  // 직전 메시지와 비슷하지 않은 첫 후보 사용
  const fresh = candidates.find((c) => !lastTexts.some((t) => similarity(c, t) >= 0.55));
  return fresh ?? pool[Math.floor(Math.random() * pool.length)];
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
    coachSuppressEyeMentions,
    setCoachSuppressEyeMentions,
    readingMode,
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

    // 사용자가 눈/시선 관련 멘트를 거부하면 세션 내내 그 주제 봉인.
    // 한 번이라도 매칭되면 false로 되돌리지 않음 — 같은 잔소리 반복 방지.
    if (!coachSuppressEyeMentions && hasEyeSuppressKeyword(messageSnapshot)) {
      setCoachSuppressEyeMentions(true);
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
    // 사용자가 방금 보낸 메시지에 눈/시선 거부 키워드가 있었다면 즉시 반영
    // (위의 setCoachSuppressEyeMentions는 비동기라 이 시점에는 아직 false일 수 있음)
    const eyeSuppressNow = coachSuppressEyeMentions || hasEyeSuppressKeyword(messageSnapshot);
    const context = {
      subject: currentSubject,
      studyDurationSec: elapsedSec,
      goalDurationSec: goalDurationSec > 0 ? goalDurationSec : undefined,
      personality: coachPersonality,
      suppressEyeMentions: eyeSuppressNow,
      readingMode,
    };

    // 현재 conversationHistory의 마지막 항목은 방금 sendUserMessage에서 추가된 user 메시지
    // 그 이전까지를 히스토리로 전달
    const historySnapshot = conversationHistory.slice(0, -1);

    (async () => {
      try {
        const response = activeApiKey
          ? await generateDirectCoachResponse(messageSnapshot, context, activeApiKey, getModel(), historySnapshot)
          : { text: mockDirectReply(messageSnapshot, context), tone: 'calm' as const, nextCheckSec: undefined as number | undefined };

        const { text, tone, nextCheckSec } = response;

        // LLM이 다음 체크 간격을 같이 결정해서 반환했으면 적용 (clamp)
        if (typeof nextCheckSec === 'number' && Number.isFinite(nextCheckSec)) {
          const clamped = Math.max(MIN_CHECK_SEC, Math.min(MAX_CHECK_SEC, nextCheckSec));
          nextCheckSecRef.current = clamped;
          setAdaptiveCheckSec(clamped);
        }

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

    // ── 사용자 발언 신선도 필터 ──
    // FRESH_USER_CHAT_SEC 이내의 발언만 "방금 한 말"로 LLM에 전달.
    // 그보다 오래된 발언은 더이상 fixation의 원인이 되지 않도록 컨텍스트에서 제외.
    const recentCoachMessages = currentSession?.coachMessages ?? [];
    const freshUserChats = recentUserChats
      .filter((c) => (now - c.at) / 1000 <= FRESH_USER_CHAT_SEC)
      // 같은 발언으로 이미 MAX_COACHINGS_PER_USER_CHAT 회 이상 코칭이 발생했으면 제외
      .filter((c) => {
        const coachingsSince = recentCoachMessages.filter((m) => m.timestamp >= c.at).length;
        return coachingsSince < MAX_COACHINGS_PER_USER_CHAT;
      })
      .map((c) => c.text);

    const lastUserChatSecAgo = recentUserChats.length > 0
      ? Math.round((now - recentUserChats[recentUserChats.length - 1].at) / 1000)
      : undefined;

    const report: MinuteReport = {
      dataPoints: dataToSend,
      subject: currentSubject,
      totalStudyMinutes: Math.floor(elapsedSec / 60),
      totalStudySeconds: elapsedSec,
      coachPersonality,
      // 직전 코치 메시지 5개를 전달 → LLM이 본인의 반복을 인지할 수 있게
      recentMessages: recentCoachMessages.slice(-5),
      currentCheckIntervalSec: nextCheckSecRef.current,
      recentUserChats: freshUserChats.slice(-3),
      secondsSinceLastUserChat: lastUserChatSecAgo,
      userAdjustments: activeAdjustments.length > 0
        ? activeAdjustments.map((a) => a.instruction)
        : undefined,
      goalDurationMinutes: goalMins,
      goalRemainingMinutes: goalRemainMins,
      readingMode,
      suppressEyeMentions: coachSuppressEyeMentions,
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

        // ── 눈/시선 멘트 안전망: 사용자가 거부했거나 독서 모드인데 LLM이 어겼다면 응원으로 교체 ──
        let finalText = decision.message;
        const FORBIDDEN_EYE_REGEX = /눈\s*(감|뜨|빛|꺼풀|개방)|시선|졸린|졸음|꾸벅|내려다|고개\s*들|자리\s*(를|좀|에)?\s*(비|들락|앉)|자리비움|돌아와|어디\s*갔|뿌리를?\s*내/;
        if ((coachSuppressEyeMentions || readingMode) && FORBIDDEN_EYE_REGEX.test(finalText)) {
          const elapsedMin = Math.floor(elapsedSec / 60);
          finalText = pickFallbackEncouragement(
            coachPersonality,
            elapsedMin,
            recentCoachMessages.slice(-3).map((m) => m.text),
          );
          console.warn('[useCoach] 눈/시선 금지 규칙 위반 감지 → 응원으로 대체:', decision.message, '→', finalText);
        }

        // ── 반복 안전망: LLM이 지침을 무시하고 비슷한 말을 또 했다면 응원으로 교체 ──
        const recentTexts = recentCoachMessages.slice(-3);
        if (isTooSimilarToRecent(finalText, recentTexts)) {
          const elapsedMin = Math.floor(elapsedSec / 60);
          finalText = pickFallbackEncouragement(
            coachPersonality,
            elapsedMin,
            recentTexts.map((m) => m.text),
          );
          // 응원 모드로 강제 전환 → 다음 체크 간격도 늘려서 말 수를 줄임
          const widerCheck = Math.max(nextCheckSecRef.current, 90);
          nextCheckSecRef.current = widerCheck;
          setAdaptiveCheckSec(widerCheck);
          console.warn('[useCoach] 반복 감지 → 응원 메시지로 대체:', finalText);
        }

        const msg: CoachMessage = {
          id: `coach-${Date.now()}`,
          text: finalText,
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

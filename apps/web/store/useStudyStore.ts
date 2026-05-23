'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  StudySession, SessionStatus, CoachMessage,
  EmotionSnapshot, CoachPersonality, FaceAnalysisResult, ConversationTurn,
  LLMProvider,
} from '@study-coach/shared';
import type { TTSModel } from '@study-coach/shared';

export interface CoachAdjustment {
  id: string;
  type: 'silence' | 'less_sensitive' | 'less_frequent' | 'more_frequent' | 'focused' | 'custom';
  label: string;
  instruction: string;
  expiresAt: number | null;
}

interface StudyState {
  status: SessionStatus;
  currentSession: StudySession | null;
  currentSubject: string;
  subjects: string[];
  elapsedSec: number;
  latestFaceResult: FaceAnalysisResult | null;
  coachPersonality: CoachPersonality;
  coachEnabled: boolean;
  ttsEnabled: boolean;
  ttsModel: TTSModel;
  ttsVolume: number;   // 0~1
  ttsSpeed: number;    // 0.5~2.0
  ttsVoice: string;    // OpenAI TTS 목소리
  edgeTtsVoice: string; // Edge TTS (Microsoft) 목소리
  llmProvider: LLMProvider;       // 'openai' | 'anthropic'
  openaiApiKey: string;
  openaiModel: string;
  anthropicApiKey: string;
  anthropicModel: string;
  sessions: StudySession[];
  coachAdjustments: CoachAdjustment[];
  isResting: boolean;
  restEndTime: number | null;
  adaptiveCheckSec: number;           // LLM이 결정한 현재 체크 간격 (UI 표시용)
  goalDurationSec: number;            // 사용자가 설정한 목표 공부 시간 (0 = 목표 없음)
  pendingUserMessage: string | null;  // 사용자 채팅 메시지 (코치 응답 대기 중)
  recentUserChats: string[];          // 최근 유저 채팅 (자기보고 추출용, 최대 5개)
  coachTyping: boolean;               // 코치 응답 생성 중 여부
  ttsPlayingMessageId: string | null; // TTS 재생 시작된 메시지 ID (텍스트 표시 타이밍 동기화용)
  ttsInterruptCount: number;          // 사용자 메시지 전송 시 증가 → useTTS가 감지해 즉시 중단
  conversationHistory: ConversationTurn[]; // 세션 내 채팅 대화 히스토리 (user ↔ 코치 직접 대화)

  addSubject: (name: string) => void;
  removeSubject: (name: string) => void;
  setSubject: (s: string) => void;
  startSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  finishSession: () => void;
  tickElapsed: () => void;
  updateFaceResult: (r: FaceAnalysisResult) => void;
  addCoachMessage: (m: CoachMessage) => void;
  addEmotionSnapshot: (s: EmotionSnapshot) => void;
  setCoachPersonality: (p: CoachPersonality) => void;
  setCoachEnabled: (v: boolean) => void;
  setTtsEnabled: (v: boolean) => void;
  setTtsModel: (m: TTSModel) => void;
  setTtsVolume: (v: number) => void;
  setTtsSpeed: (v: number) => void;
  setTtsVoice: (v: string) => void;
  setEdgeTtsVoice: (v: string) => void;
  setLlmProvider: (p: LLMProvider) => void;
  setOpenaiApiKey: (k: string) => void;
  setOpenaiModel: (m: string) => void;
  setAnthropicApiKey: (k: string) => void;
  setAnthropicModel: (m: string) => void;
  applyAdjustment: (adj: Omit<CoachAdjustment, 'id'>) => void;
  removeAdjustment: (id: string) => void;
  clearAdjustments: () => void;
  startRest: (durationSec: number) => void;
  endRest: () => void;
  setAdaptiveCheckSec: (sec: number) => void;
  setGoalDuration: (sec: number) => void;
  sendUserMessage: (text: string) => void;
  getRecentUserChats: () => string[];
  clearPendingMessage: () => void;
  setCoachTyping: (v: boolean) => void;
  setTtsPlayingMessageId: (id: string | null) => void;
  addToConversationHistory: (turn: ConversationTurn) => void;
  clearConversationHistory: () => void;
}

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export const useStudyStore = create<StudyState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      currentSession: null,
      currentSubject: '자유 공부',
      subjects: ['국어', '영어', '수학', '과학', '코딩'],
      elapsedSec: 0,
      latestFaceResult: null,
      coachPersonality: 'friend',
      coachEnabled: true,
      ttsEnabled: true,
      ttsModel: 'tts-1' as TTSModel,
      ttsVolume: 1.0,
      ttsSpeed: 1.0,
      ttsVoice: 'nova',
      edgeTtsVoice: 'ko-KR-SunHiNeural',
      llmProvider: 'openai' as LLMProvider,
      openaiApiKey: '',
      openaiModel: 'gpt-4o-mini',
      anthropicApiKey: '',
      anthropicModel: 'claude-3-5-haiku-latest',
      sessions: [],
      coachAdjustments: [],
      isResting: false,
      restEndTime: null,
      adaptiveCheckSec: 30,
      goalDurationSec: 0,
      pendingUserMessage: null,
      coachTyping: false,
      ttsPlayingMessageId: null,
      ttsInterruptCount: 0,
      recentUserChats: [],
      conversationHistory: [],

      addSubject: (name) =>
        set((s) => ({
          subjects: s.subjects.includes(name) ? s.subjects : [...s.subjects, name],
        })),
      removeSubject: (name) =>
        set((s) => ({ subjects: s.subjects.filter((sub) => sub !== name) })),

      setSubject: (s) => set({ currentSubject: s }),

      startSession: () => {
        const session: StudySession = {
          id: genId(),
          startTime: Date.now(),
          subject: get().currentSubject,
          durationSeconds: 0,
          avgConcentration: 0,
          emotionHistory: [],
          coachMessages: [],
        };
        // 세션 시작 시 대화 히스토리 초기화
        set({ status: 'running', currentSession: session, elapsedSec: 0, conversationHistory: [] });
      },

      pauseSession: () => set({ status: 'paused' }),
      resumeSession: () => set({ status: 'running' }),

      finishSession: () => {
        const { currentSession, elapsedSec, sessions } = get();
        if (!currentSession) return;
        const finished: StudySession = {
          ...currentSession,
          endTime: Date.now(),
          durationSeconds: elapsedSec,
          // 각성 점수: present=100, tired=50, absent=0 평균
          avgConcentration:
            currentSession.emotionHistory.length > 0
              ? Math.round(
                  currentSession.emotionHistory.reduce((a: number, s: EmotionSnapshot) => {
                    const state = s.faceState ?? (s as any).emotion;
                    return a + (state === 'present' ? 100 : state === 'tired' ? 50 : 0);
                  }, 0) / currentSession.emotionHistory.length
                )
              : 0,
        };
        set({ status: 'finished', currentSession: finished, sessions: [finished, ...sessions] });
      },

      tickElapsed: () => set((s) => ({ elapsedSec: s.elapsedSec + 1 })),
      updateFaceResult: (r) => set({ latestFaceResult: r }),

      addCoachMessage: (m) =>
        set((s) => ({
          currentSession: s.currentSession
            ? { ...s.currentSession, coachMessages: [...s.currentSession.coachMessages, m] }
            : null,
        })),

      addEmotionSnapshot: (snap) =>
        set((s) => ({
          currentSession: s.currentSession
            ? { ...s.currentSession, emotionHistory: [...s.currentSession.emotionHistory, snap] }
            : null,
        })),

      setCoachPersonality: (p) => set({ coachPersonality: p }),
      setCoachEnabled: (v) => set({ coachEnabled: v }),
      setTtsEnabled: (v) => set({ ttsEnabled: v }),
      setTtsModel: (m) => set({ ttsModel: m }),
      setTtsVolume: (v) => set({ ttsVolume: v }),
      setTtsSpeed: (v) => set({ ttsSpeed: v }),
      setTtsVoice: (v) => set({ ttsVoice: v }),
      setEdgeTtsVoice: (v) => set({ edgeTtsVoice: v }),
      setLlmProvider: (p) => set({ llmProvider: p }),
      setOpenaiApiKey: (k) => set({ openaiApiKey: k }),
      setOpenaiModel: (m) => set({ openaiModel: m }),
      setAnthropicApiKey: (k) => set({ anthropicApiKey: k }),
      setAnthropicModel: (m) => set({ anthropicModel: m }),

      applyAdjustment: (adj) =>
        set((s) => ({
          coachAdjustments: [
            ...s.coachAdjustments.filter((a) => a.type !== adj.type),
            { ...adj, id: genId() },
          ],
        })),
      removeAdjustment: (id) =>
        set((s) => ({ coachAdjustments: s.coachAdjustments.filter((a) => a.id !== id) })),
      clearAdjustments: () => set({ coachAdjustments: [] }),

      startRest: (durationSec) => {
        get().pauseSession();
        set({ isResting: true, restEndTime: Date.now() + durationSec * 1000 });
      },

      endRest: () => {
        get().resumeSession();
        set({ isResting: false, restEndTime: null });
      },

      setAdaptiveCheckSec: (sec) => set({ adaptiveCheckSec: sec }),
      setGoalDuration: (sec) => set({ goalDurationSec: sec }),

      sendUserMessage: (text) => set((s) => ({
        pendingUserMessage: text,
        coachTyping: true,
        ttsInterruptCount: s.ttsInterruptCount + 1,  // TTS 즉시 중단 신호
        recentUserChats: [...s.recentUserChats.slice(-4), text],
        // 유저 메시지를 대화 히스토리에 추가
        conversationHistory: [...s.conversationHistory, { role: 'user' as const, content: text }],
      })),
      getRecentUserChats: () => get().recentUserChats,
      clearPendingMessage: () => set({ pendingUserMessage: null }),
      setCoachTyping: (v) => set({ coachTyping: v }),
      setTtsPlayingMessageId: (id) => set({ ttsPlayingMessageId: id }),

      addToConversationHistory: (turn) =>
        set((s) => ({ conversationHistory: [...s.conversationHistory, turn] })),
      clearConversationHistory: () => set({ conversationHistory: [] }),
    }),
    {
      name: 'study-coach-storage',
      partialize: (s) => ({
        sessions: s.sessions,
        subjects: s.subjects,
        coachPersonality: s.coachPersonality,
        coachEnabled: s.coachEnabled,
        ttsEnabled: s.ttsEnabled,
        ttsModel: s.ttsModel,
        ttsVolume: s.ttsVolume,
        ttsSpeed: s.ttsSpeed,
        ttsVoice: s.ttsVoice,
        edgeTtsVoice: s.edgeTtsVoice,
        llmProvider: s.llmProvider,
        openaiApiKey: s.openaiApiKey,
        openaiModel: s.openaiModel,
        anthropicApiKey: s.anthropicApiKey,
        anthropicModel: s.anthropicModel,
        currentSubject: s.currentSubject,
        // conversationHistory는 세션 한정이므로 persist 제외
      }),
    }
  )
);

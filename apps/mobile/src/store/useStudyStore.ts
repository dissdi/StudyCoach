import { create } from 'zustand';
import type {
  StudySession,
  SessionStatus,
  CoachMessage,
  EmotionSnapshot,
  CoachPersonality,
  FaceAnalysisResult,
  LLMProvider,
} from '@/types';

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
  elapsedSec: number;
  latestFaceResult: FaceAnalysisResult | null;
  coachPersonality: CoachPersonality;
  coachEnabled: boolean;
  ttsEnabled: boolean;
  llmProvider: LLMProvider;
  apiKey: string;
  openaiApiKey: string;
  sessions: StudySession[];
  coachAdjustments: CoachAdjustment[];

  setSubject: (subject: string) => void;
  startSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  finishSession: () => void;
  tickElapsed: () => void;
  updateFaceResult: (result: FaceAnalysisResult) => void;
  addCoachMessage: (msg: CoachMessage) => void;
  addEmotionSnapshot: (snap: EmotionSnapshot) => void;
  setCoachPersonality: (p: CoachPersonality) => void;
  setCoachEnabled: (v: boolean) => void;
  setTtsEnabled: (v: boolean) => void;
  setLlmProvider: (p: LLMProvider) => void;
  setApiKey: (key: string) => void;
  setOpenaiApiKey: (key: string) => void;
  applyAdjustment: (adj: Omit<CoachAdjustment, 'id'>) => void;
  removeAdjustment: (id: string) => void;
  clearAdjustments: () => void;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const useStudyStore = create<StudyState>((set, get) => ({
  status: 'idle',
  currentSession: null,
  currentSubject: '자유 공부',
  elapsedSec: 0,
  latestFaceResult: null,
  coachPersonality: 'friend',
  coachEnabled: true,
  ttsEnabled: true,
  llmProvider: 'anthropic',
  apiKey: '',
  openaiApiKey: '',
  sessions: [],
  coachAdjustments: [],

  setSubject: (subject) => set({ currentSubject: subject }),

  startSession: () => {
    const session: StudySession = {
      id: generateId(),
      startTime: Date.now(),
      subject: get().currentSubject,
      durationSeconds: 0,
      avgConcentration: 0,
      emotionHistory: [],
      coachMessages: [],
    };
    set({ status: 'running', currentSession: session, elapsedSec: 0 });
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
      avgConcentration:
        currentSession.emotionHistory.length > 0
          ? Math.round(
              currentSession.emotionHistory.reduce((acc, s) => acc + s.concentrationScore, 0) /
                currentSession.emotionHistory.length
            )
          : 0,
    };
    set({ status: 'finished', currentSession: finished, sessions: [finished, ...sessions] });
  },

  tickElapsed: () => set((s) => ({ elapsedSec: s.elapsedSec + 1 })),
  updateFaceResult: (result) => set({ latestFaceResult: result }),

  addCoachMessage: (msg) =>
    set((s) => ({
      currentSession: s.currentSession
        ? { ...s.currentSession, coachMessages: [...s.currentSession.coachMessages, msg] }
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
  setLlmProvider: (p) => set({ llmProvider: p }),
  setApiKey: (key) => set({ apiKey: key }),
  setOpenaiApiKey: (key) => set({ openaiApiKey: key }),

  applyAdjustment: (adj) =>
    set((s) => ({
      coachAdjustments: [
        ...s.coachAdjustments.filter((a) => a.type !== adj.type),
        { ...adj, id: generateId() },
      ],
    })),
  removeAdjustment: (id) =>
    set((s) => ({ coachAdjustments: s.coachAdjustments.filter((a) => a.id !== id) })),
  clearAdjustments: () => set({ coachAdjustments: [] }),
}));

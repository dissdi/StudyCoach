// ─── 집중도 / 감정 분석 ────────────────────────────────────────────────
export type EmotionState =
  | 'focused'    // 집중
  | 'tired'      // 졸음
  | 'stressed'   // 스트레스
  | 'happy'      // 밝음/의욕
  | 'absent'     // 자리 비움
  | 'unknown';

export interface FaceAnalysisResult {
  faceDetected: boolean;
  concentrationScore: number;   // 0~100
  emotion: EmotionState;
  leftEyeOpen: number;          // 0~1
  rightEyeOpen: number;         // 0~1
  smilingProbability: number;   // 0~1
  timestamp: number;
}

// ─── 공부 세션 ────────────────────────────────────────────────────────
export type SessionStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface StudySession {
  id: string;
  startTime: number;
  endTime?: number;
  subject: string;
  durationSeconds: number;
  avgConcentration: number;
  emotionHistory: EmotionSnapshot[];
  coachMessages: CoachMessage[];
}

export interface EmotionSnapshot {
  timestamp: number;
  emotion: EmotionState;
  concentrationScore: number;
}

// ─── LLM 코치 ─────────────────────────────────────────────────────────
export type CoachTone = 'encouraging' | 'strict' | 'calm';

export interface CoachMessage {
  id: string;
  text: string;
  tone: CoachTone;
  trigger: 'low_focus' | 'tired' | 'absent' | 'good_job' | 'milestone' | 'manual';
  timestamp: number;
}

export interface CoachContext {
  concentrationScore: number;
  emotion: EmotionState;
  studyDurationSec: number;
  subject: string;
  recentMessages: CoachMessage[];
  coachPersonality: CoachPersonality;
}

export type CoachPersonality = 'friend' | 'teacher' | 'trainer';
export type LLMProvider = 'anthropic' | 'openai';

// ─── 네비게이션 ──────────────────────────────────────────────────────
export type RootStackParamList = {
  Main: undefined;
  Session: { subject?: string };
  Report: { sessionId: string };
};

export type MainTabParamList = {
  Home: undefined;
  Stats: undefined;
  Settings: undefined;
};

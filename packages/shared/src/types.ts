// ─── 얼굴 상태 (단순화: 자리이탈 / 졸음 / 정상 만 감지) ──────────────
export type FaceState =
  | 'present'   // 얼굴 감지됨, 눈 떠있음 → 정상
  | 'tired'     // 얼굴 감지됨, 눈 감김 → 졸음
  | 'absent'    // 얼굴 미감지 → 자리이탈
  | 'unknown';  // 초기화 중

// 하위 호환용 alias (점진적 제거 예정)
export type EmotionState = FaceState;

export interface FaceAnalysisResult {
  faceDetected: boolean;
  faceState: FaceState;
  leftEyeOpen: number;    // 0~1 (내부 계산용)
  rightEyeOpen: number;   // 0~1
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
  avgConcentration: number;   // 각성 점수 (present=100, tired=50, absent=0 평균)
  emotionHistory: EmotionSnapshot[];
  coachMessages: CoachMessage[];
}

export interface EmotionSnapshot {
  timestamp: number;
  faceState: FaceState;
  // 하위 호환용 (구버전 세션 데이터)
  emotion?: FaceState;
}

// ─── LLM 코치 ─────────────────────────────────────────────────────────
export type CoachTone = 'encouraging' | 'strict' | 'calm';
export type CoachPersonality =
  | 'friend'      // 친한 친구
  | 'teacher'     // 선생님
  | 'trainer'     // 트레이너
  | 'boxing'      // 복싱 코치
  | 'strict_mom'  // 엄한 엄마
  | 'warm_mom'    // 자상한 엄마
  | 'mentor';     // 엄한 스승
export type LLMProvider = 'openai' | 'anthropic';

export interface CoachMessage {
  id: string;
  text: string;
  tone: CoachTone;
  trigger: 'tired' | 'absent' | 'milestone' | 'manual' | 'question';
  timestamp: number;
}

export interface CoachContext {
  faceState: FaceState;
  studyDurationSec: number;
  subject: string;
  recentMessages: CoachMessage[];
  coachPersonality: CoachPersonality;
}

// ─── 1분 단위 분석 ────────────────────────────────────────────────────
export interface MinuteDataPoint {
  offsetSec: number;      // 분 시작 기준 경과 초
  faceState: FaceState;
  eyeOpenAvg: number;     // (leftEye + rightEye) / 2
}

export interface MinuteReport {
  dataPoints: MinuteDataPoint[];
  subject: string;
  totalStudyMinutes: number;
  totalStudySeconds: number;          // 초 단위 정밀 공부 시간
  coachPersonality: CoachPersonality;
  recentMessages: CoachMessage[];
  userAdjustments?: string[];
  currentCheckIntervalSec?: number;
  recentUserChats?: string[];
  goalDurationMinutes?: number;       // 목표 시간 (분)
  goalRemainingMinutes?: number;      // 목표까지 남은 시간 (분), 목표 없으면 undefined
}

export interface LLMCoachDecision {
  needsCoaching: boolean;
  message: string | null;
  tone: CoachTone;
  nextCheckSec?: number;
  isQuestion?: boolean;
}

// ─── 채팅 대화 히스토리 ───────────────────────────────────────────────
export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

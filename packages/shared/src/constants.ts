export const THRESHOLDS = {
  lowFocusScore: 40,
  tiredEyeOpen: 0.3,
  absentSeconds: 10,
  milestoneMinutes: [25, 50, 90],
  coachCooldownSec: 60,
} as const;

export const OPENAI_MODEL_DEFAULT = 'gpt-4o-mini';

export const ANTHROPIC_MODEL_DEFAULT = 'claude-3-5-haiku-latest';

export const ANTHROPIC_MODELS = [
  { id: 'claude-3-5-haiku-latest',  label: 'Claude 3.5 Haiku',  desc: '빠르고 저렴 · 기본값',      badge: '추천' },
  { id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet', desc: '균형잡힌 성능',              badge: '' },
  { id: 'claude-haiku-4-5-20251001',label: 'Claude Haiku 4.5',  desc: '최신 경량 모델',             badge: '최신' },
  { id: 'claude-sonnet-4-6',        label: 'Claude Sonnet 4.6', desc: '최신 고성능 모델',           badge: '' },
  { id: 'claude-opus-4-6',          label: 'Claude Opus 4.6',   desc: '최고 성능 · 고비용',         badge: 'Top' },
] as const;

export const OPENAI_MODELS = [
  { id: 'gpt-4o-mini',  label: 'GPT-4o mini',  desc: '빠르고 저렴 · 기본값',     badge: '추천' },
  { id: 'gpt-4o',       label: 'GPT-4o',       desc: '균형잡힌 성능',             badge: '' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', desc: '최신 경량 모델',            badge: '최신' },
  { id: 'gpt-4.1',      label: 'GPT-4.1',      desc: '최신 고성능 모델',          badge: '' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', desc: '빠르고 효율적인 GPT-5 계열', badge: 'New' },
  { id: 'gpt-5.4',      label: 'GPT-5.4',      desc: '높은 지능 · GPT-5 계열',    badge: '' },
  { id: 'gpt-5.5',      label: 'GPT-5.5',      desc: '최고 성능 · 최신 플래그십', badge: 'Top' },
] as const;

// ─── OpenAI TTS ───────────────────────────────────────────────────────────
export type TTSModel = 'tts-1' | 'tts-1-hd';

/** 코치 성격 → OpenAI 목소리 매핑 */
export const OPENAI_TTS_VOICE = {
  friend:  'nova',    // 따뜻하고 친근한 여성
  teacher: 'onyx',   // 침착하고 권위있는 남성
  trainer: 'shimmer', // 밝고 에너제틱한 여성
} as const;

/** 코치 성격 → 발화 속도 (0.25 ~ 4.0) */
export const OPENAI_TTS_SPEED = {
  friend:  1.05,
  teacher: 0.95,
  trainer: 1.15,
} as const;

export const COLORS = {
  bg: '#0F0F1A',
  bgCard: '#1A1A2E',
  bgElevated: '#1E1E35',
  primary: '#7C6FFF',
  primaryLight: '#A89FFF',
  secondary: '#4ECDC4',
  success: '#4CAF50',
  warning: '#FFC107',
  danger: '#FF5252',
  textPrimary: '#F0F0FF',
  textSecondary: '#9898B8',
  textMuted: '#5A5A7A',
} as const;

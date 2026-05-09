export const COLORS = {
  // Background
  bg: '#0F0F1A',
  bgCard: '#1A1A2E',
  bgElevated: '#1E1E35',

  // Primary accent – 보라/인디고
  primary: '#7C6FFF',
  primaryLight: '#A89FFF',
  primaryDark: '#5A4FCC',

  // Secondary accent – 민트
  secondary: '#4ECDC4',
  secondaryLight: '#7FDDD7',

  // Status
  success: '#4CAF50',
  warning: '#FFC107',
  danger: '#FF5252',
  info: '#42A5F5',

  // Text
  textPrimary: '#F0F0FF',
  textSecondary: '#9898B8',
  textMuted: '#5A5A7A',

  // Concentration gradient stops
  focusHigh: '#4CAF50',
  focusMid: '#FFC107',
  focusLow: '#FF5252',
} as const;

export const FONTS = {
  regular: 'System',
  bold: 'System',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const BORDER_RADIUS = {
  sm: 8,
  md: 14,
  lg: 20,
  full: 9999,
} as const;

// LLM 코치 트리거 임계값
export const THRESHOLDS = {
  lowFocusScore: 40,       // 집중도 이 이하면 코칭 트리거
  tiredEyeOpen: 0.3,       // 눈 개방도 이 이하면 졸음 판정
  absentSeconds: 10,       // 10초 이상 얼굴 미감지 → 자리 비움
  milestoneMinutes: [25, 50, 90], // 뽀모도로식 milestone (분)
  coachCooldownSec: 60,    // 같은 트리거 재발동 쿨다운
} as const;

export const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

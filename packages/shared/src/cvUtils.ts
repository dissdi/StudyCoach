import type { FaceState } from './types';

// ─── MediaPipe blendshape 타입 ────────────────────────────────────────
export interface BlendshapeCategory {
  categoryName: string;
  score: number;
}

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
}

function bs(shapes: BlendshapeCategory[], name: string): number {
  return shapes.find((s) => s.categoryName === name)?.score ?? 0;
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * 얼굴 상태 감지 (단순화 버전)
 *
 * 감지 항목:
 *  1. 자리이탈: 얼굴 미감지 → 호출 전 처리 (faceDetected=false)
 *  2. 졸음:    눈이 임계값 이하로 감겨있으면 'tired'
 *  3. 정상:    눈 뜨고 있으면 'present'
 */
export function detectFaceState(
  shapes: BlendshapeCategory[],
): {
  faceState: FaceState;
  leftEyeOpen: number;
  rightEyeOpen: number;
} {
  // eyeBlinkLeft/Right: 0 = 완전히 뜸, 1 = 완전히 감음
  const leftBlink  = bs(shapes, 'eyeBlinkLeft');
  const rightBlink = bs(shapes, 'eyeBlinkRight');
  const leftEyeOpen  = clamp(1 - leftBlink);
  const rightEyeOpen = clamp(1 - rightBlink);
  const avgEyeOpen   = (leftEyeOpen + rightEyeOpen) / 2;

  // 0.3 이하 = 눈이 많이 감긴 상태 (졸음)
  const faceState: FaceState = avgEyeOpen < 0.30 ? 'tired' : 'present';

  return { faceState, leftEyeOpen, rightEyeOpen };
}

// ─── UI 헬퍼 ─────────────────────────────────────────────────────────

export function getFaceStateColor(state: FaceState): string {
  switch (state) {
    case 'present': return '#4CAF50';  // 초록
    case 'tired':   return '#FFC107';  // 노랑
    case 'absent':  return '#FF5252';  // 빨강
    default:        return '#5A5A7A';  // 회색
  }
}

export function getFaceStateEmoji(state: FaceState): string {
  switch (state) {
    case 'present': return '👀';
    case 'tired':   return '😴';
    case 'absent':  return '👻';
    default:        return '⏳';
  }
}

export function getFaceStateLabel(state: FaceState): string {
  switch (state) {
    case 'present': return '집중 중';
    case 'tired':   return '졸음';
    case 'absent':  return '자리비움';
    default:        return '감지 중';
  }
}

// ─── 하위 호환 (기존 코드 점진적 제거 전 임시 유지) ───────────────────
/** @deprecated getFaceStateColor 사용 권장 */
export function getFocusColor(score: number): string {
  if (score >= 70) return '#4CAF50';
  if (score >= 40) return '#FFC107';
  return '#FF5252';
}

/** @deprecated getFaceStateEmoji 사용 권장 */
export function getEmotionEmoji(state: string): string {
  return getFaceStateEmoji(state as FaceState);
}

/** @deprecated getFaceStateLabel 사용 권장 */
export function getEmotionLabel(state: string): string {
  return getFaceStateLabel(state as FaceState);
}

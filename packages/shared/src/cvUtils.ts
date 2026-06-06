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
 * 얼굴 상태 감지
 *
 * MediaPipe `eyeBlinkLeft/Right` blendshape는 "감김"과 "아래 응시"를 구분하지 못한다.
 * 책·노트를 내려다보면 눈꺼풀이 내려와서 blink 스코어가 졸음 수준으로 튄다.
 * → `eyeLookDownLeft/Right`로 감산 보정하면 "내려본 감김"은 졸음 판정에서 제외된다.
 *
 *  1. 자리이탈: 얼굴 미감지 → 호출 전 처리 (faceDetected=false)
 *  2. 졸음:    "아래 응시"를 보정한 눈 감김이 임계값 이상이면 'tired'
 *  3. 정상:    그 외 'present'
 *
 * @param readingMode 사용자가 독서 모드를 켰을 때 졸음 판정을 비활성화 (항상 present)
 */
export function detectFaceState(
  shapes: BlendshapeCategory[],
  readingMode = false,
): {
  faceState: FaceState;
  leftEyeOpen: number;
  rightEyeOpen: number;
} {
  // eyeBlinkLeft/Right: 0 = 완전히 뜸, 1 = 완전히 감음
  const leftBlink  = bs(shapes, 'eyeBlinkLeft');
  const rightBlink = bs(shapes, 'eyeBlinkRight');

  // eyeLookDownLeft/Right: 시선이 아래를 향할수록 1에 가까움.
  // blink 스코어에서 감산해 "책을 내려다보는 자세"를 졸음으로 오판하지 않도록 보정.
  const lookDownL = bs(shapes, 'eyeLookDownLeft');
  const lookDownR = bs(shapes, 'eyeLookDownRight');

  // 0.8 계수는 실측 기반 — 강하게 빼되 진짜 감김(blink≈1, lookDown<0.5)은 살림.
  const LOOK_DOWN_COMPENSATION = 0.8;
  const correctedBlinkL = clamp(leftBlink  - lookDownL * LOOK_DOWN_COMPENSATION);
  const correctedBlinkR = clamp(rightBlink - lookDownR * LOOK_DOWN_COMPENSATION);

  // UI/스냅샷에는 보정된 개방도를 노출 → 책 읽을 때 38% 같은 가짜 값 안 뜸.
  const leftEyeOpen  = clamp(1 - correctedBlinkL);
  const rightEyeOpen = clamp(1 - correctedBlinkR);
  const avgEyeOpen   = (leftEyeOpen + rightEyeOpen) / 2;

  // 독서 모드: 시선이 자연스럽게 아래로 향하므로 졸음 감지 자체를 끔.
  if (readingMode) {
    return { faceState: 'present', leftEyeOpen, rightEyeOpen };
  }

  // 0.25 이하 = 보정 후에도 눈이 많이 감긴 상태 (실제 졸음 가능성).
  const faceState: FaceState = avgEyeOpen < 0.25 ? 'tired' : 'present';

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

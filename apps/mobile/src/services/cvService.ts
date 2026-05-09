/**
 * cvService.ts (mobile)
 * expo-face-detector 결과를 @study-coach/shared 유틸로 파싱합니다.
 */

import type { FaceDetectionResult } from 'expo-face-detector';
import type { FaceAnalysisResult } from '@study-coach/shared';
import { calcConcentration, classifyEmotion } from '@study-coach/shared';

export function parseFaceDetectionResult(detection: FaceDetectionResult): FaceAnalysisResult {
  const faces = detection.faces;

  if (!faces || faces.length === 0) {
    return { faceDetected: false, concentrationScore: 0, emotion: 'absent', leftEyeOpen: 0, rightEyeOpen: 0, smilingProbability: 0, timestamp: Date.now() };
  }

  const face = faces.reduce((prev, curr) =>
    (curr.bounds?.size.width ?? 0) > (prev.bounds?.size.width ?? 0) ? curr : prev
  );

  const leftEye = face.leftEyeOpenProbability ?? 0.8;
  const rightEye = face.rightEyeOpenProbability ?? 0.8;
  const smiling = face.smilingProbability ?? 0;

  return {
    faceDetected: true,
    concentrationScore: calcConcentration(leftEye, rightEye, true),
    emotion: classifyEmotion(true, leftEye, rightEye, smiling),
    leftEyeOpen: leftEye,
    rightEyeOpen: rightEye,
    smilingProbability: smiling,
    timestamp: Date.now(),
  };
}

export { getFocusColor, getEmotionEmoji, getEmotionLabel } from '@study-coach/shared';

/**
 * useFaceAnalysis.ts
 * expo-face-detector 이벤트를 받아 파싱 후 store에 업데이트합니다.
 * StudySessionScreen의 Camera onFacesDetected 콜백과 연결됩니다.
 */

import { useCallback, useRef } from 'react';
import type { FaceDetectionResult } from 'expo-face-detector';
import { parseFaceDetectionResult } from '@/services/cvService';
import { useStudyStore } from '@/store/useStudyStore';

// 감정 스냅샷 기록 주기 (초)
const SNAPSHOT_INTERVAL_SEC = 10;

export function useFaceAnalysis() {
  const { updateFaceResult, addEmotionSnapshot, status, elapsedSec } = useStudyStore();
  const lastSnapshotSec = useRef(0);

  const onFacesDetected = useCallback(
    (result: FaceDetectionResult) => {
      if (status !== 'running') return;

      const analysis = parseFaceDetectionResult(result);
      updateFaceResult(analysis);

      // 일정 주기마다 감정 스냅샷 저장 (리포트용)
      if (elapsedSec - lastSnapshotSec.current >= SNAPSHOT_INTERVAL_SEC) {
        lastSnapshotSec.current = elapsedSec;
        addEmotionSnapshot({
          timestamp: Date.now(),
          emotion: analysis.emotion,
          concentrationScore: analysis.concentrationScore,
        });
      }
    },
    [status, elapsedSec]
  );

  return { onFacesDetected };
}

'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import {
  detectFaceState,
  type BlendshapeCategory,
} from '@study-coach/shared';
import { useStudyStore } from '@/store/useStudyStore';
import type { FaceAnalysisResult } from '@study-coach/shared';

const WASM_CDN  = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const SNAPSHOT_INTERVAL_SEC = 10;
const DETECT_INTERVAL_MS    = 500;   // 2fps

// 졸음 판정: 눈 감김이 N초 이상 지속될 때만 tired 확정
// 8초 → 짧은 책 읽기(한 문단 응시)는 무시, 실제 졸음(고개 끄덕임/긴 감김)만 잡힘.
const TIRED_CONFIRM_SEC = 8;

export function useFaceAnalysis(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const { updateFaceResult, addEmotionSnapshot, status, elapsedSec, readingMode } = useStudyStore();

  const landmarkerRef   = useRef<FaceLandmarker | null>(null);
  const loadedRef       = useRef(false);
  const animFrameRef    = useRef<number>(0);
  const lastSnapshotSec = useRef(0);
  const tiredSinceRef   = useRef<number | null>(null); // 눈 감기 시작 시각

  // ── MediaPipe 초기화 ──────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      if (loadedRef.current) return;
      try {
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const fileset = await FilesetResolver.forVisionTasks(WASM_CDN);
        landmarkerRef.current = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          outputFaceBlendshapes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        loadedRef.current = true;
      } catch (err) {
        console.warn('[FaceAnalysis] MediaPipe 초기화 실패:', err);
      }
    }
    init();
  }, []);

  // ── 단일 프레임 감지 ─────────────────────────────────────────────
  const detect = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !loadedRef.current || !landmarkerRef.current) return;
    if (status !== 'running') return;
    if (video.readyState < 2) return;

    let result: FaceAnalysisResult;

    try {
      const mp = landmarkerRef.current.detectForVideo(video, Date.now());
      const hasface = mp.faceLandmarks.length > 0 && mp.faceBlendshapes.length > 0;

      if (!hasface) {
        tiredSinceRef.current = null;
        result = {
          faceDetected: false,
          faceState: 'absent',
          leftEyeOpen: 0,
          rightEyeOpen: 0,
          timestamp: Date.now(),
        };
      } else {
        const shapes = mp.faceBlendshapes[0].categories as BlendshapeCategory[];
        const { faceState: rawState, leftEyeOpen, rightEyeOpen } = detectFaceState(shapes, readingMode);

        // 졸음 확정: 눈 감김이 TIRED_CONFIRM_SEC 이상 지속돼야 tired
        let confirmedState = rawState;
        if (rawState === 'tired') {
          if (tiredSinceRef.current === null) {
            tiredSinceRef.current = Date.now();
            confirmedState = 'present'; // 아직 확정 아님
          } else if ((Date.now() - tiredSinceRef.current) / 1000 >= TIRED_CONFIRM_SEC) {
            confirmedState = 'tired';
          } else {
            confirmedState = 'present'; // 아직 지속 시간 부족
          }
        } else {
          tiredSinceRef.current = null; // 눈 뜨면 리셋
        }

        result = {
          faceDetected: true,
          faceState: confirmedState,
          leftEyeOpen,
          rightEyeOpen,
          timestamp: Date.now(),
        };
      }
    } catch {
      return;
    }

    updateFaceResult(result);

    if (elapsedSec - lastSnapshotSec.current >= SNAPSHOT_INTERVAL_SEC) {
      lastSnapshotSec.current = elapsedSec;
      addEmotionSnapshot({
        timestamp: Date.now(),
        faceState: result.faceState,
      });
    }
  }, [status, elapsedSec, updateFaceResult, addEmotionSnapshot, videoRef]);

  // ── 감지 루프 ────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'running') {
      cancelAnimationFrame(animFrameRef.current);
      return;
    }
    let last = 0;
    const loop = (ts: number) => {
      if (ts - last > DETECT_INTERVAL_MS) {
        last = ts;
        detect();
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [status, detect]);
}

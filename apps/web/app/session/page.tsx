'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStudyStore } from '@/store/useStudyStore';
import { useStudyTimer } from '@/hooks/useStudyTimer';
import { useFaceAnalysis } from '@/hooks/useFaceAnalysis';
import { useCoach } from '@/hooks/useCoach';
import { useTTS } from '@/hooks/useTTS';
import CoachActionButtons from '@/components/CoachActionButtons';
import VoiceControls from '@/components/VoiceControls';
import CharacterControls from '@/components/CharacterControls';
import { getFaceStateColor, getFaceStateEmoji, getFaceStateLabel } from '@study-coach/shared';
import type { FaceState } from '@study-coach/shared';

const QUICK_GOALS = [
  { label: '5분',  sec: 5  * 60 },
  { label: '10분', sec: 10 * 60 },
  { label: '15분', sec: 15 * 60 },
  { label: '40분', sec: 40 * 60 },
  { label: '50분', sec: 50 * 60 },
];

export default function SessionPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camError, setCamError] = useState('');
  const [isRestPickerOpen, setIsRestPickerOpen] = useState(false);
  const [isGoalPickerOpen, setIsGoalPickerOpen] = useState(false);
  const [restRemainSec, setRestRemainSec] = useState(0);
  const [customGoalMin, setCustomGoalMin] = useState('');

  const {
    status, currentSession, latestFaceResult,
    pauseSession, resumeSession, finishSession, currentSubject,
    isResting, restEndTime, startRest, endRest, adaptiveCheckSec,
    coachTyping, elapsedSec, goalDurationSec, setGoalDuration,
    ttsEnabled, ttsPlayingMessageId,
  } = useStudyStore();
  const { formatted } = useStudyTimer();

  useFaceAnalysis(videoRef);
  useCoach();
  useTTS();

  // 웹캠 시작
  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } })
      .then((stream) => { if (videoRef.current) videoRef.current.srcObject = stream; })
      .catch(() => setCamError('카메라 접근 권한이 필요해요.'));
    return () => {
      if (videoRef.current?.srcObject)
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    };
  }, []);

  // 휴식 카운트다운
  useEffect(() => {
    if (!isResting || !restEndTime) return;
    const tick = () => {
      const remain = Math.ceil((restEndTime - Date.now()) / 1000);
      if (remain <= 0) { endRest(); setRestRemainSec(0); }
      else setRestRemainSec(remain);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [isResting, restEndTime]);

  const handleFinish = () => {
    if (!confirm('세션을 종료할까요?')) return;
    finishSession();
    router.push(`/report/${currentSession?.id}`);
  };

  const handleRestSelect = (sec: number) => {
    setIsRestPickerOpen(false);
    startRest(sec);
  };

  const handleGoalSelect = (sec: number) => {
    setGoalDuration(sec);
    setIsGoalPickerOpen(false);
    setCustomGoalMin('');
  };

  const fmtRemain = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const faceState: FaceState = latestFaceResult?.faceState ?? 'unknown';
  const stateColor = getFaceStateColor(faceState);
  const latestMsg = currentSession?.coachMessages.at(-1) ?? null;
  // TTS 동기화: TTS 켜져 있으면 음성 재생 시작 시에만 텍스트 표시
  const msgVisible = !ttsEnabled || !latestMsg || ttsPlayingMessageId === latestMsg.id;

  // 목표 카운트다운 계산
  const goalRemainSec = goalDurationSec > 0 ? Math.max(0, goalDurationSec - elapsedSec) : 0;
  const goalProgress = goalDurationSec > 0 ? Math.min(1, elapsedSec / goalDurationSec) : 0;
  const goalIsDone = goalDurationSec > 0 && goalRemainSec <= 0;
  const goalIsNearEnd = goalDurationSec > 0 && goalRemainSec > 0 && goalRemainSec <= 60;

  return (
    <main className="min-h-screen bg-bg flex flex-col">

      {/* 상단 바 */}
      <div className="flex items-center justify-between px-6 py-4">
        <button
          onClick={handleFinish}
          className="px-4 py-1.5 rounded-full bg-danger/15 text-danger text-sm font-semibold hover:bg-danger/25 transition-colors"
        >
          종료
        </button>
        <span className="text-white font-semibold">{currentSubject}</span>
        <div className="flex items-center gap-2">
          {!isResting && !isRestPickerOpen && (
            <button
              onClick={() => setIsGoalPickerOpen((v) => !v)}
              className={[
                'px-4 py-1.5 rounded-full text-sm font-semibold transition-colors',
                isGoalPickerOpen
                  ? 'bg-primary/30 text-primary border border-primary/60'
                  : goalDurationSec > 0
                  ? 'bg-primary/15 text-primary'
                  : 'bg-card text-[#9898B8] hover:text-white hover:bg-elevated',
              ].join(' ')}
            >
              {isGoalPickerOpen ? '취소' : goalDurationSec > 0 ? `${Math.floor(goalDurationSec / 60)}분` : '목표'}
            </button>
          )}
          {!isResting && !isGoalPickerOpen && (
            <button
              onClick={() => setIsRestPickerOpen((v) => !v)}
              className={[
                'px-4 py-1.5 rounded-full text-sm font-semibold transition-colors',
                isRestPickerOpen
                  ? 'bg-secondary/30 text-secondary border border-secondary/60'
                  : 'bg-card text-[#9898B8] hover:text-white hover:bg-elevated',
              ].join(' ')}
            >
              {isRestPickerOpen ? '취소' : '휴식'}
            </button>
          )}
          {!isResting && !isRestPickerOpen && !isGoalPickerOpen && (
            <button
              onClick={status === 'running' ? pauseSession : resumeSession}
              className="px-4 py-1.5 rounded-full bg-card text-white text-sm font-semibold hover:bg-elevated transition-colors"
            >
              {status === 'running' ? '일시정지' : '재개'}
            </button>
          )}
        </div>
      </div>

      {/* 목표 시간 피커 */}
      {isGoalPickerOpen && (
        <div className="mx-6 mb-2 bg-card rounded-2xl p-4 flex flex-col gap-3">
          <p className="text-xs uppercase tracking-widest text-[#5A5A7A]">목표 시간 설정</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleGoalSelect(0)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                goalDurationSec === 0
                  ? 'bg-primary text-white'
                  : 'bg-elevated text-[#9898B8] hover:text-white'
              }`}
            >
              없음
            </button>
            {QUICK_GOALS.map((g) => (
              <button
                key={g.sec}
                onClick={() => handleGoalSelect(g.sec)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  goalDurationSec === g.sec && customGoalMin === ''
                    ? 'bg-primary text-white'
                    : 'bg-elevated text-[#9898B8] hover:text-white'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={300}
              value={customGoalMin}
              onChange={(e) => {
                const v = e.target.value;
                setCustomGoalMin(v);
                const n = parseInt(v, 10);
                if (!isNaN(n) && n > 0) setGoalDuration(n * 60);
              }}
              placeholder="직접 입력 (분)"
              className={`flex-1 bg-elevated rounded-xl px-4 py-2.5 text-sm outline-none border transition-colors placeholder:text-[#5A5A7A] ${
                customGoalMin ? 'border-primary text-white' : 'border-transparent text-[#9898B8]'
              } focus:border-primary`}
            />
            {customGoalMin && (
              <button
                onClick={() => { setIsGoalPickerOpen(false); }}
                className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold"
              >
                확인
              </button>
            )}
          </div>
        </div>
      )}

      {/* 본문 */}
      <div className="flex-1 max-w-2xl w-full mx-auto px-6 flex flex-col gap-5 pb-32">

        {/* 타이머 */}
        <div className="text-center py-4">
          <p className="text-xs uppercase tracking-widest text-[#9898B8] mb-1">공부 시간</p>
          <p className="text-7xl font-thin text-white tracking-tight tabular-nums">{formatted}</p>
          {status === 'paused' && !isResting && (
            <span className="inline-block mt-2 px-3 py-1 rounded-full bg-warn/20 text-warn text-xs font-semibold">
              일시정지
            </span>
          )}

          {/* 목표 시간 프로그레스 */}
          {goalDurationSec > 0 && !isResting && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <div className="w-full max-w-xs h-1.5 bg-elevated rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${goalProgress * 100}%`,
                    backgroundColor: goalIsDone ? '#22c55e' : goalIsNearEnd ? '#f59e0b' : '#7C7CFF',
                  }}
                />
              </div>
              <span
                className="text-sm font-medium tabular-nums"
                style={{
                  color: goalIsDone ? '#22c55e' : goalIsNearEnd ? '#f59e0b' : '#9898B8',
                }}
              >
                {goalIsDone
                  ? '🎉 목표 달성!'
                  : `목표까지 ${fmtRemain(goalRemainSec)} 남음`}
              </span>
            </div>
          )}
        </div>

        {/* 휴식 카운트다운 */}
        {isResting && (
          <div className="bg-secondary/10 border border-secondary/30 rounded-2xl p-6 flex flex-col items-center gap-3">
            <p className="text-xs uppercase tracking-widest text-secondary/70">휴식 중</p>
            <p className="text-6xl font-thin text-secondary tabular-nums tracking-tight">
              {fmtRemain(restRemainSec)}
            </p>
            <p className="text-xs text-[#9898B8]">휴식이 끝나면 코치가 응원 메시지를 보내드려요</p>
            <button
              onClick={() => endRest()}
              className="mt-1 px-5 py-2 rounded-full bg-secondary/20 border border-secondary/40 text-secondary text-sm font-semibold hover:bg-secondary/30 transition-colors"
            >
              지금 시작할게요
            </button>
          </div>
        )}

        {/* 웹캠 */}
        <div className={`relative rounded-2xl overflow-hidden bg-card aspect-video max-h-44${isResting ? ' hidden' : ''}`}>
          {camError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#9898B8]">
              <span className="text-4xl">cam</span>
              <span className="text-sm">{camError}</span>
            </div>
          ) : (
            <video ref={videoRef} autoPlay muted playsInline
              className="w-full h-full object-cover scale-x-[-1]" />
          )}
          <div className="absolute top-2.5 left-2.5 w-5 h-5 border-t-2 border-l-2 border-primary rounded-tl" />
          <div className="absolute top-2.5 right-2.5 w-5 h-5 border-t-2 border-r-2 border-primary rounded-tr" />
          <div className="absolute bottom-2.5 left-2.5 w-5 h-5 border-b-2 border-l-2 border-primary rounded-bl" />
          <div className="absolute bottom-2.5 right-2.5 w-5 h-5 border-b-2 border-r-2 border-primary rounded-br" />
        </div>

        {/* 상태 표시 */}
        <div className={`bg-card rounded-2xl px-5 py-4 flex items-center justify-between${isResting ? ' hidden' : ''}`}>
          <div className="flex items-center gap-3">
            <span
              className="w-3 h-3 rounded-full animate-pulse"
              style={{ backgroundColor: stateColor }}
            />
            <span className="text-lg">{getFaceStateEmoji(faceState)}</span>
            <span className="text-white font-medium">{getFaceStateLabel(faceState)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={[
                'w-1.5 h-1.5 rounded-full animate-pulse',
                adaptiveCheckSec <= 30 ? 'bg-warn' : adaptiveCheckSec <= 90 ? 'bg-primary/70' : 'bg-focus/60',
              ].join(' ')}
            />
            <span className="text-[10px] text-[#5A5A7A] tabular-nums">
              {adaptiveCheckSec < 60 ? `체크 ${adaptiveCheckSec}s` : `체크 ${Math.round(adaptiveCheckSec / 60)}m`}
            </span>
          </div>
        </div>

        {/* 코치 메시지 */}
        <div className="bg-card rounded-2xl p-4 min-h-[64px]">
          {coachTyping || (latestMsg && !msgVisible) ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-[#5A5A7A] uppercase tracking-wider">코치</span>
              <div className="flex items-center gap-1.5 py-1">
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          ) : latestMsg ? (
            <div className="flex flex-col gap-1 animate-fadeIn">
              <span className="text-xs text-[#5A5A7A] uppercase tracking-wider">
                {isResting ? '코너 코치'
                  : latestMsg.trigger === 'manual' ? '코치 · 답장'
                  : latestMsg.trigger === 'question' ? '코치 · 질문'
                  : '코치'}
              </span>
              <p className={`font-medium leading-relaxed ${latestMsg.trigger === 'question' ? 'text-secondary' : 'text-white'}`}>
                {latestMsg.text}
              </p>
            </div>
          ) : (
            <p className="text-[#5A5A7A] text-sm text-center py-2">
              {isResting ? '잠시 쉬세요. 곧 다시 시작해요.' : '코치가 지켜보고 있어요'}
            </p>
          )}
        </div>

      </div>

      <CharacterControls />
      <VoiceControls />
      <CoachActionButtons
        isRestPickerOpen={isRestPickerOpen}
        onRestSelect={handleRestSelect}
        onRestPickerClose={() => setIsRestPickerOpen(false)}
        isResting={isResting}
      />
    </main>
  );
}

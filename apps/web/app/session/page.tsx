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

// ─── 통합 채팅 메시지 타입 ────────────────────────────────────────────
type ChatMsg =
  | { kind: 'coach'; id: string; text: string; trigger: string; tone: string; timestamp: number }
  | { kind: 'user'; id: string; text: string; timestamp: number };

const QUICK_GOALS = [
  { label: '5분',  sec: 5  * 60 },
  { label: '10분', sec: 10 * 60 },
  { label: '15분', sec: 15 * 60 },
  { label: '40분', sec: 40 * 60 },
  { label: '50분', sec: 50 * 60 },
];

export default function SessionPage() {
  const router = useRouter();
  const videoRef    = useRef<HTMLVideoElement>(null);
  const overlayRef  = useRef<HTMLDivElement>(null);   // 오버레이 높이 측정용
  const chatListRef = useRef<HTMLDivElement>(null);   // 채팅 스크롤 컨테이너
  const bottomRef   = useRef<HTMLDivElement>(null);   // 자동 스크롤 앵커

  const [camError, setCamError] = useState('');
  const [isRestPickerOpen, setIsRestPickerOpen]   = useState(false);
  const [isGoalPickerOpen, setIsGoalPickerOpen]   = useState(false);
  const [restRemainSec, setRestRemainSec]         = useState(0);
  const [customGoalMin, setCustomGoalMin]         = useState('');
  const [overlayH, setOverlayH]                   = useState(400); // 오버레이 실측 높이 (px)

  // ── 사용자 메시지 타임스탬프 추적 ────────────────────────────────
  // conversationHistory의 user 엔트리에 타임스탬프가 없어서 로컬로 관리
  const userTsRef   = useRef<number[]>([]);           // role:'user' 엔트리 순서별 타임스탬프
  const prevUserLen = useRef(0);

  const {
    status, currentSession, latestFaceResult,
    pauseSession, resumeSession, finishSession, currentSubject,
    isResting, restEndTime, startRest, endRest, adaptiveCheckSec,
    coachTyping, elapsedSec, goalDurationSec, setGoalDuration,
    ttsEnabled, ttsPlayingMessageId, conversationHistory,
  } = useStudyStore();

  const { formatted } = useStudyTimer();
  useFaceAnalysis(videoRef);
  useCoach();
  useTTS();

  // ── 웹캠 시작 ────────────────────────────────────────────────────
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

  // ── 오버레이 높이 측정 (리사이즈 대응) ──────────────────────────
  useEffect(() => {
    if (!overlayRef.current) return;
    const observe = new ResizeObserver(() => {
      if (overlayRef.current) setOverlayH(overlayRef.current.offsetHeight);
    });
    observe.observe(overlayRef.current);
    setOverlayH(overlayRef.current.offsetHeight);
    return () => observe.disconnect();
  }, [isResting, isGoalPickerOpen, goalDurationSec]);

  // ── 사용자 메시지 타임스탬프 기록 ────────────────────────────────
  useEffect(() => {
    const userEntries = conversationHistory.filter((e) => e.role === 'user');
    const newCount = userEntries.length - prevUserLen.current;
    if (newCount > 0) {
      const now = Date.now();
      for (let i = 0; i < newCount; i++) userTsRef.current.push(now - (newCount - 1 - i) * 10);
      prevUserLen.current = userEntries.length;
    }
  }, [conversationHistory]);

  // ── 통합 채팅 메시지 생성 ────────────────────────────────────────
  const coachMsgs: ChatMsg[] = (currentSession?.coachMessages ?? []).map((m) => ({
    kind: 'coach',
    id: m.id,
    text: m.text,
    trigger: m.trigger,
    tone: m.tone,
    timestamp: m.timestamp,
  }));

  const userEntries = conversationHistory.filter((e) => e.role === 'user');
  const userMsgs: ChatMsg[] = userEntries.map((e, i) => ({
    kind: 'user',
    id: `user-${i}`,
    text: e.content,
    timestamp: userTsRef.current[i] ?? Date.now(),
  }));

  const allMsgs: ChatMsg[] = [...coachMsgs, ...userMsgs].sort(
    (a, b) => a.timestamp - b.timestamp
  );

  // ── 새 메시지 시 자동 스크롤 ─────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMsgs.length, coachTyping]);

  // ── 휴식 카운트다운 ──────────────────────────────────────────────
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
  const handleRestSelect  = (sec: number) => { setIsRestPickerOpen(false); startRest(sec); };
  const handleGoalSelect  = (sec: number) => { setGoalDuration(sec); setIsGoalPickerOpen(false); setCustomGoalMin(''); };

  const fmtRemain = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  const faceState: FaceState = latestFaceResult?.faceState ?? 'unknown';
  const stateColor = getFaceStateColor(faceState);

  const goalRemainSec  = goalDurationSec > 0 ? Math.max(0, goalDurationSec - elapsedSec) : 0;
  const goalProgress   = goalDurationSec > 0 ? Math.min(1, elapsedSec / goalDurationSec) : 0;
  const goalIsDone     = goalDurationSec > 0 && goalRemainSec <= 0;
  const goalIsNearEnd  = goalDurationSec > 0 && goalRemainSec > 0 && goalRemainSec <= 60;

  // ── TTS 동기화: 마지막 코치 메시지 ──────────────────────────────
  const latestMsg = currentSession?.coachMessages.at(-1) ?? null;
  const msgVisible = !ttsEnabled || !latestMsg || ttsPlayingMessageId === latestMsg.id;

  return (
    <main className="h-screen overflow-hidden bg-bg relative">

      {/* ══════════════════════════════════════════════════════════
          앞 레이어 (z-20): 상단바 + 타이머 + 웹캠 + 상태
      ══════════════════════════════════════════════════════════ */}
      <div
        ref={overlayRef}
        className="fixed top-0 left-0 right-0 z-20 bg-bg"
        style={{ maxWidth: '42rem', marginLeft: 'auto', marginRight: 'auto' }}
      >
        {/* 상단 바 */}
        <div className="flex items-center justify-between px-6 py-3">
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

        {/* 목표 피커 */}
        {isGoalPickerOpen && (
          <div className="mx-6 mb-2 bg-card rounded-2xl p-4 flex flex-col gap-3">
            <p className="text-xs uppercase tracking-widest text-[#5A5A7A]">목표 시간 설정</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => handleGoalSelect(0)} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${goalDurationSec === 0 ? 'bg-primary text-white' : 'bg-elevated text-[#9898B8] hover:text-white'}`}>없음</button>
              {QUICK_GOALS.map((g) => (
                <button key={g.sec} onClick={() => handleGoalSelect(g.sec)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${goalDurationSec === g.sec && customGoalMin === '' ? 'bg-primary text-white' : 'bg-elevated text-[#9898B8] hover:text-white'}`}>
                  {g.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={300} value={customGoalMin}
                onChange={(e) => { const v = e.target.value; setCustomGoalMin(v); const n = parseInt(v, 10); if (!isNaN(n) && n > 0) setGoalDuration(n * 60); }}
                placeholder="직접 입력 (분)"
                className={`flex-1 bg-elevated rounded-xl px-4 py-2.5 text-sm outline-none border transition-colors placeholder:text-[#5A5A7A] ${customGoalMin ? 'border-primary text-white' : 'border-transparent text-[#9898B8]'} focus:border-primary`}
              />
              {customGoalMin && (
                <button onClick={() => setIsGoalPickerOpen(false)} className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold">확인</button>
              )}
            </div>
          </div>
        )}

        {/* 타이머 (compact) */}
        <div className="text-center pt-2 pb-1">
          <p className="text-[10px] uppercase tracking-widest text-[#5A5A7A] mb-0.5">공부 시간</p>
          <p className="text-5xl font-thin text-white tracking-tight tabular-nums">{formatted}</p>
          {status === 'paused' && !isResting && (
            <span className="inline-block mt-1 px-3 py-0.5 rounded-full bg-warn/20 text-warn text-xs font-semibold">일시정지</span>
          )}
          {goalDurationSec > 0 && !isResting && (
            <div className="mt-2 flex flex-col items-center gap-1">
              <div className="w-48 h-1 bg-elevated rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${goalProgress * 100}%`, backgroundColor: goalIsDone ? '#22c55e' : goalIsNearEnd ? '#f59e0b' : '#7C7CFF' }} />
              </div>
              <span className="text-xs tabular-nums" style={{ color: goalIsDone ? '#22c55e' : goalIsNearEnd ? '#f59e0b' : '#9898B8' }}>
                {goalIsDone ? '🎉 목표 달성!' : `목표까지 ${fmtRemain(goalRemainSec)} 남음`}
              </span>
            </div>
          )}
        </div>

        {/* 웹캠 */}
        {!isResting && (
          <div className="relative mx-4 mb-2 rounded-2xl overflow-hidden bg-card aspect-video max-h-40">
            {camError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#9898B8]">
                <span className="text-3xl">📷</span>
                <span className="text-xs">{camError}</span>
              </div>
            ) : (
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
            )}
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-primary rounded-tl" />
            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-primary rounded-tr" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-primary rounded-bl" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-primary rounded-br" />
          </div>
        )}

        {/* 휴식 중 표시 */}
        {isResting && (
          <div className="mx-4 mb-2 bg-secondary/10 border border-secondary/30 rounded-2xl px-5 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-secondary/70 uppercase tracking-widest">휴식 중</p>
              <p className="text-3xl font-thin text-secondary tabular-nums tracking-tight">{fmtRemain(restRemainSec)}</p>
            </div>
            <button onClick={() => endRest()} className="px-4 py-2 rounded-full bg-secondary/20 border border-secondary/40 text-secondary text-sm font-semibold hover:bg-secondary/30 transition-colors">
              지금 시작
            </button>
          </div>
        )}

        {/* 상태 바 */}
        {!isResting && (
          <div className="mx-4 mb-2 bg-card/80 rounded-xl px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: stateColor }} />
              <span className="text-base">{getFaceStateEmoji(faceState)}</span>
              <span className="text-white text-sm font-medium">{getFaceStateLabel(faceState)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className={['w-1.5 h-1.5 rounded-full animate-pulse', adaptiveCheckSec <= 30 ? 'bg-warn' : adaptiveCheckSec <= 90 ? 'bg-primary/70' : 'bg-focus/60'].join(' ')} />
              <span className="text-[10px] text-[#5A5A7A] tabular-nums">
                {adaptiveCheckSec < 60 ? `체크 ${adaptiveCheckSec}s` : `체크 ${Math.round(adaptiveCheckSec / 60)}m`}
              </span>
            </div>
          </div>
        )}

        {/* 오버레이 하단 그라데이션 페이드 */}
        <div className="h-6 bg-gradient-to-b from-bg to-transparent pointer-events-none" />
      </div>

      {/* ══════════════════════════════════════════════════════════
          뒤 레이어 (z-10): 채팅 스크롤
      ══════════════════════════════════════════════════════════ */}
      <div
        ref={chatListRef}
        className="absolute inset-0 z-10 overflow-y-auto"
        style={{ paddingTop: overlayH + 8, paddingBottom: 160 }}
      >
        <div className="max-w-2xl mx-auto px-4 flex flex-col gap-3">

          {/* 메시지 없을 때 안내 */}
          {allMsgs.length === 0 && !coachTyping && (
            <div className="text-center text-[#3A3A5A] text-sm py-4">
              코치가 지켜보고 있어요
            </div>
          )}

          {/* 통합 채팅 메시지 */}
          {allMsgs.map((msg) => {
            if (msg.kind === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[75%] bg-primary/20 border border-primary/30 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed">
                    {msg.text}
                  </div>
                </div>
              );
            }

            // 코치 메시지
            const isTypingMsg = !msgVisible && msg.id === latestMsg?.id;
            return (
              <div key={msg.id} className="flex justify-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-card border border-elevated flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">
                  🤖
                </div>
                <div className="max-w-[75%] flex flex-col gap-1">
                  <span className="text-[10px] text-[#5A5A7A] uppercase tracking-wider pl-1">
                    {msg.trigger === 'manual' ? '코치 · 답장' : msg.trigger === 'question' ? '코치 · 질문' : '코치'}
                  </span>
                  <div
                    className={`bg-card border border-elevated/60 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed ${
                      msg.trigger === 'question' ? 'text-secondary' : 'text-white'
                    } ${isTypingMsg ? 'opacity-0' : 'opacity-100'} transition-opacity`}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })}

          {/* 타이핑 인디케이터 */}
          {coachTyping && (
            <div className="flex justify-start gap-2.5">
              <div className="w-8 h-8 rounded-full bg-card border border-elevated flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">
                🤖
              </div>
              <div className="bg-card border border-elevated/60 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {/* 자동 스크롤 앵커 */}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          고정 컴포넌트 (각자 fixed로 z-index 관리)
      ══════════════════════════════════════════════════════════ */}
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

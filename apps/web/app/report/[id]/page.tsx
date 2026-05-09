'use client';

import { useParams } from 'next/navigation';
import { useStudyStore } from '@/store/useStudyStore';
import { getFaceStateColor, getFaceStateEmoji, getFaceStateLabel } from '@study-coach/shared';
import type { FaceState } from '@study-coach/shared';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const { sessions } = useStudyStore();
  const session = sessions.find((s) => s.id === id);

  const formatSec = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}시간 ${m}분 ${s}초`;
    if (m > 0) return `${m}분 ${s}초`;
    return `${s}초`;
  };

  if (!session) {
    return (
      <main className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center flex flex-col gap-4">
          <p className="text-[#9898B8]">세션을 찾을 수 없어요.</p>
          <a href="/" className="text-primary hover:underline">홈으로</a>
        </div>
      </main>
    );
  }

  // faceState 기반 집계 (하위 호환: 구버전은 emotion 필드 사용)
  const stateCounts = session.emotionHistory.reduce<Record<string, number>>((acc: Record<string, number>, snap: any) => {
    const state = snap.faceState ?? (snap as any).emotion ?? 'unknown';
    acc[state] = (acc[state] ?? 0) + 1;
    return acc;
  }, {});

  // 각성 점수 색상
  const awakenessColor = getFaceStateColor(
    session.avgConcentration >= 80 ? 'present' :
    session.avgConcentration >= 40 ? 'tired' : 'absent'
  );

  return (
    <main className="min-h-screen bg-bg">
      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <a href="/" className="text-[#9898B8] hover:text-white transition-colors">← 홈</a>
          <h1 className="text-lg font-semibold text-white">세션 리포트</h1>
          <div className="w-10" />
        </div>

        {/* 요약 카드 */}
        <div className="bg-card rounded-2xl p-6 flex flex-col items-center gap-2">
          <h2 className="text-2xl font-bold text-white">{session.subject}</h2>
          <p className="text-sm text-[#9898B8]">
            {format(new Date(session.startTime), 'M월 d일 HH:mm', { locale: ko })}
          </p>
          <div className="flex gap-10 mt-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-white">{formatSec(session.durationSeconds)}</p>
              <p className="text-xs text-[#5A5A7A] mt-1">공부 시간</p>
            </div>
            <div className="w-px bg-elevated" />
            <div className="text-center">
              <p className="text-3xl font-bold" style={{ color: awakenessColor }}>
                {session.avgConcentration}
              </p>
              <p className="text-xs text-[#5A5A7A] mt-1">각성 점수</p>
            </div>
          </div>
        </div>

        {/* 상태 분포 */}
        {Object.keys(stateCounts).length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-base font-semibold text-white">상태 분포</h3>
            <div className="flex gap-3 flex-wrap">
              {Object.entries(stateCounts).map(([state, count]) => {
                const pct = Math.round(((count as number) / session.emotionHistory.length) * 100);
                return (
                  <div key={state} className="bg-card rounded-xl p-4 flex flex-col items-center gap-1 min-w-[80px]">
                    <span className="text-2xl">{getFaceStateEmoji(state as FaceState)}</span>
                    <span className="text-xs text-[#9898B8]">{getFaceStateLabel(state as FaceState)}</span>
                    <span className="text-lg font-bold text-white">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 코치 메시지 */}
        {session.coachMessages.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-base font-semibold text-white">
              코치 메시지 ({session.coachMessages.length}개)
            </h3>
            {session.coachMessages.map((msg: any) => (
              <div key={msg.id} className="bg-card rounded-xl p-4 flex gap-3">
                <span className="text-xs text-[#5A5A7A] pt-0.5 min-w-[40px]">
                  {format(new Date(msg.timestamp), 'HH:mm')}
                </span>
                <p className="text-white text-sm leading-relaxed flex-1">{msg.text}</p>
              </div>
            ))}
          </div>
        )}

        <a
          href="/"
          className="w-full text-center py-4 rounded-2xl bg-card text-[#9898B8] hover:text-white border border-elevated hover:border-primary transition-all"
        >
          홈으로 돌아가기
        </a>
      </div>
    </main>
  );
}

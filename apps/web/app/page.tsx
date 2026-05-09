'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStudyStore } from '@/store/useStudyStore';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const QUICK_SUBJECTS = ['수학', '영어', '국어', '과학', '코딩', '자유'];

export default function HomePage() {
  const router = useRouter();
  const { sessions, currentSubject, setSubject, startSession, setGoalDuration } = useStudyStore();
  const [inputSubject, setInputSubject] = useState(currentSubject);

  const todaySessions = sessions.filter(
    (s) => new Date(s.startTime).toDateString() === new Date().toDateString()
  );
  const todayTotalSec = todaySessions.reduce((a, s) => a + s.durationSeconds, 0);
  const todayAvgFocus =
    todaySessions.length > 0
      ? Math.round(todaySessions.reduce((a, s) => a + s.avgConcentration, 0) / todaySessions.length)
      : 0;

  const formatSec = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
  };

  const handleStart = () => {
    const sub = inputSubject.trim() || '자유 공부';
    setSubject(sub);
    setGoalDuration(0); // 목표 시간은 세션 화면에서 설정
    startSession();
    router.push('/session');
  };

  return (
    <main className="min-h-screen bg-bg">
      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">
        {/* 헤더 */}
        <div>
          <h1 className="text-3xl font-bold text-white">안녕하세요 👋</h1>
          <p className="text-[#9898B8] mt-1">
            {format(new Date(), 'M월 d일 EEEE', { locale: ko })}
          </p>
        </div>

        {/* 네비게이션 */}
        <nav className="flex gap-2">
          {[
            { href: '/', label: '홈' },
            { href: '/stats', label: '통계' },
            { href: '/settings', label: '설정' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-4 py-2 rounded-full bg-card text-[#9898B8] text-sm hover:text-white transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* 오늘 통계 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: todayTotalSec > 0 ? formatSec(todayTotalSec) : '-', label: '오늘 공부 시간' },
            {
              value: todayAvgFocus > 0 ? `${todayAvgFocus}점` : '-',
              label: '각성 점수',
              color: todayAvgFocus >= 80 ? '#4ade80' : todayAvgFocus >= 40 ? '#f59e0b' : todayAvgFocus > 0 ? '#f87171' : undefined,
            },
            { value: `${todaySessions.length}회`, label: '세션 수' },
          ].map((stat) => (
            <div key={stat.label} className="bg-card rounded-2xl p-4 flex flex-col items-center gap-1">
              <span
                className="text-2xl font-bold text-white"
                style={stat.color ? { color: stat.color } : {}}
              >
                {stat.value}
              </span>
              <span className="text-xs text-[#5A5A7A] text-center">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* 과목 선택 */}
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-white">오늘 뭐 공부해요?</h2>
          <div className="flex gap-2 flex-wrap">
            {QUICK_SUBJECTS.map((sub) => (
              <button
                key={sub}
                onClick={() => setInputSubject(sub)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  inputSubject === sub
                    ? 'bg-primary text-white'
                    : 'bg-card text-[#9898B8] hover:text-white'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={inputSubject}
            onChange={(e) => setInputSubject(e.target.value)}
            placeholder="직접 입력..."
            className="bg-card rounded-xl px-4 py-3 text-white text-sm outline-none border border-elevated focus:border-primary transition-colors placeholder:text-[#5A5A7A]"
            onKeyDown={(e) => e.key === 'Enter' && handleStart()}
          />
        </div>

        {/* 시작 버튼 */}
        <button
          onClick={handleStart}
          className="w-full py-4 rounded-2xl bg-primary text-white text-lg font-bold hover:opacity-90 active:scale-95 transition-all"
        >
          공부 시작 🚀
        </button>

        {/* 최근 세션 */}
        {todaySessions.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-white">오늘 공부 기록</h2>
            <div className="flex flex-col gap-2">
              {todaySessions.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  className="bg-card rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-elevated transition-colors"
                  onClick={() => router.push(`/report/${s.id}`)}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-white">{s.subject}</span>
                    <span className="text-xs text-[#5A5A7A]">
                      {format(new Date(s.startTime), 'HH:mm', { locale: ko })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[#9898B8]">{formatSec(s.durationSeconds)}</span>
                    {s.avgConcentration > 0 && (
                      <span className="text-sm font-semibold" style={{ color: '#7C7CFF' }}>
                        {s.avgConcentration}점
                      </span>
                    )}
                    <span className="text-[#5A5A7A] text-xs">›</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

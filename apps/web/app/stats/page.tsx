'use client';

import { useStudyStore } from '@/store/useStudyStore';
import { getFocusColor } from '@study-coach/shared';
import { format, startOfWeek, eachDayOfInterval, endOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function StatsPage() {
  const { sessions } = useStudyStore();

  const weekDays = eachDayOfInterval({
    start: startOfWeek(new Date(), { weekStartsOn: 1 }),
    end: endOfWeek(new Date(), { weekStartsOn: 1 }),
  });

  const weekData = weekDays.map((day) => {
    const daySessions = sessions.filter(
      (s) => new Date(s.startTime).toDateString() === day.toDateString()
    );
    const totalMin = Math.round(daySessions.reduce((a, s) => a + s.durationSeconds, 0) / 60);
    return { day, totalMin, count: daySessions.length };
  });

  const maxMin = Math.max(...weekData.map((d) => d.totalMin), 1);
  const totalHours = Math.floor(sessions.reduce((a, s) => a + s.durationSeconds, 0) / 3600);
  const overallAvg = sessions.length > 0
    ? Math.round(sessions.reduce((a, s) => a + s.avgConcentration, 0) / sessions.length) : 0;

  return (
    <main className="min-h-screen bg-bg">
      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">
        <div className="flex items-center gap-4">
          <a href="/" className="text-[#9898B8] hover:text-white transition-colors">← 홈</a>
          <h1 className="text-2xl font-bold text-white">학습 통계</h1>
        </div>

        {/* 전체 요약 */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: `${totalHours}h`, label: '총 공부 시간' },
            { value: overallAvg > 0 ? `${overallAvg}` : '-', label: '각성 점수', color: overallAvg > 0 ? getFocusColor(overallAvg) : undefined },
            { value: `${sessions.length}`, label: '총 세션' },
          ].map((s) => (
            <div key={s.label} className="bg-card rounded-2xl p-4 flex flex-col items-center gap-1">
              <span className="text-2xl font-bold text-white" style={s.color ? { color: s.color } : {}}>{s.value}</span>
              <span className="text-xs text-[#5A5A7A] text-center">{s.label}</span>
            </div>
          ))}
        </div>

        {/* 이번 주 바 차트 */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-white">이번 주 공부 시간</h2>
          <div className="bg-card rounded-2xl p-5 flex items-end justify-around h-52 gap-2">
            {weekData.map(({ day, totalMin }) => {
              const barHeight = Math.max(4, (totalMin / maxMin) * 120);
              const isToday = day.toDateString() === new Date().toDateString();
              return (
                <div key={day.toISOString()} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-xs text-[#5A5A7A] h-5">
                    {totalMin > 0 ? `${totalMin}m` : ''}
                  </span>
                  <div className="w-full flex justify-center">
                    <div
                      className="w-full max-w-[32px] rounded-t transition-all duration-500"
                      style={{
                        height: barHeight,
                        backgroundColor: isToday ? '#7C6FFF' : '#1E1E35',
                      }}
                    />
                  </div>
                  <span className={`text-xs ${isToday ? 'text-primary font-bold' : 'text-[#9898B8]'}`}>
                    {format(day, 'EEE', { locale: ko })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {sessions.length === 0 && (
          <div className="text-center py-16 flex flex-col items-center gap-3">
            <span className="text-5xl">📚</span>
            <p className="text-white font-semibold text-lg">아직 공부 기록이 없어요</p>
            <a href="/" className="text-primary hover:underline text-sm">홈에서 공부 시작하기</a>
          </div>
        )}
      </div>
    </main>
  );
}

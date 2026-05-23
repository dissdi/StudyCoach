'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStudyStore } from '@/store/useStudyStore';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const SUBJECT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#76D7C4',
  '#F0A500', '#A8E063', '#FD79A8', '#6C5CE7', '#00B894',
];

function formatHMS(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function HomePage() {
  const router = useRouter();
  const {
    sessions,
    setSubject,
    startSession,
    subjects,
    addSubject,
    removeSubject,
  } = useStudyStore();

  const [isAdding, setIsAdding] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('타이머');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  // 오늘 세션 필터
  const todaySessions = sessions.filter(
    (s) => new Date(s.startTime).toDateString() === new Date().toDateString()
  );

  // 총 시간
  const todayTotalSec = todaySessions.reduce((a, s) => a + s.durationSeconds, 0);

  // 과목별 시간
  const subjectTimes: Record<string, number> = {};
  for (const session of todaySessions) {
    subjectTimes[session.subject] = (subjectTimes[session.subject] || 0) + session.durationSeconds;
  }

  const handleStartSubject = (subject: string) => {
    if (editMode) return;
    setSubject(subject);
    startSession();
    router.push('/session');
  };

  const handleAddSubject = () => {
    const name = newSubjectName.trim();
    if (name) {
      addSubject(name);
      setNewSubjectName('');
      setIsAdding(false);
    }
  };

  const handleDeleteRequest = (subject: string) => {
    if (deleteConfirm === subject) {
      removeSubject(subject);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(subject);
    }
  };

  return (
    <main className="min-h-screen bg-bg flex flex-col">
      <div className="max-w-md mx-auto w-full flex flex-col min-h-screen">

        {/* ── 상단 헤더 ── */}
        <div className="px-5 pt-8 pb-2">
          <div className="flex justify-between items-center mb-1">
            <p className="text-[#9898B8] text-sm">
              {format(new Date(), 'M월 d일 EEEE', { locale: ko })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/stats')}
                className="text-xs text-[#9898B8] px-3 py-1.5 rounded-full bg-card hover:text-white transition-colors"
              >
                통계
              </button>
              <button
                onClick={() => router.push('/settings')}
                className="text-xs text-[#9898B8] px-3 py-1.5 rounded-full bg-card hover:text-white transition-colors"
              >
                설정
              </button>
            </div>
          </div>

          {/* 대형 총 시간 */}
          <div className="text-center py-6">
            <div
              className="text-6xl font-bold tracking-wider font-mono"
              style={{ color: todayTotalSec > 0 ? '#FF8C42' : '#3A3A5A' }}
            >
              {formatHMS(todayTotalSec)}
            </div>
            <p className="text-[#5A5A7A] text-xs mt-2">오늘 총 공부 시간</p>
          </div>
        </div>

        {/* ── 탭 바 ── */}
        <div className="flex gap-6 px-5 border-b border-elevated">
          {['타이머', 'To-do', '교재'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-primary text-white'
                  : 'border-transparent text-[#5A5A7A] hover:text-[#9898B8]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── 과목 리스트 ── */}
        <div className="flex-1 overflow-y-auto">
          {subjects.length === 0 && !isAdding && (
            <div className="text-center py-16 text-[#5A5A7A] text-sm">
              과목을 추가해서 공부를 시작해보세요!
            </div>
          )}

          {subjects.map((subject, idx) => {
            const color = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
            const timeSec = subjectTimes[subject] || 0;

            return (
              <div
                key={subject}
                className="flex items-center px-5 py-4 border-b border-elevated/40 hover:bg-card/30 transition-colors group"
              >
                {/* 플레이 버튼 */}
                <button
                  onClick={() => handleStartSubject(subject)}
                  disabled={editMode}
                  className="w-11 h-11 rounded-full flex items-center justify-center mr-4 flex-shrink-0 transition-transform active:scale-90"
                  style={{
                    backgroundColor: color + '22',
                    border: `2px solid ${color}`,
                    opacity: editMode ? 0.5 : 1,
                  }}
                  aria-label={`${subject} 공부 시작`}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill={color}>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>

                {/* 과목 이름 */}
                <span className="flex-1 text-white text-[15px] font-medium">{subject}</span>

                {/* 오늘 누적 시간 */}
                <span
                  className={`text-sm font-mono mr-3 ${
                    timeSec > 0 ? 'text-[#9898B8]' : 'text-[#3A3A5A]'
                  }`}
                >
                  {formatHMS(timeSec)}
                </span>

                {/* 편집 모드: 삭제 버튼 */}
                {editMode && (
                  <button
                    onClick={() => handleDeleteRequest(subject)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      deleteConfirm === subject
                        ? 'bg-red-500 text-white scale-110'
                        : 'bg-red-500/20 text-red-400 hover:bg-red-500/40'
                    }`}
                    title={deleteConfirm === subject ? '한번 더 누르면 삭제' : '삭제'}
                  >
                    {deleteConfirm === subject ? '!' : '×'}
                  </button>
                )}
              </div>
            );
          })}

          {/* ── 과목 추가 행 ── */}
          {isAdding ? (
            <div className="flex items-center px-5 py-4 gap-3">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center mr-0 flex-shrink-0"
                style={{ border: '2px dashed #5A5A7A' }}
              >
                <span className="text-[#5A5A7A] text-lg leading-none">+</span>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="과목 이름 입력..."
                className="flex-1 bg-card rounded-xl px-4 py-2 text-white text-sm outline-none border border-primary placeholder:text-[#5A5A7A]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddSubject();
                  if (e.key === 'Escape') {
                    setIsAdding(false);
                    setNewSubjectName('');
                  }
                }}
              />
              <button
                onClick={handleAddSubject}
                className="text-primary text-sm font-semibold hover:opacity-80 transition-opacity"
              >
                추가
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewSubjectName('');
                }}
                className="text-[#5A5A7A] text-sm hover:text-white transition-colors"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setIsAdding(true);
                setEditMode(false);
              }}
              className="flex items-center gap-3 px-5 py-4 w-full text-left hover:bg-card/30 transition-colors group"
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ border: '2px dashed #5A5A7A' }}
              >
                <span className="text-[#5A5A7A] text-xl leading-none group-hover:text-[#9898B8] transition-colors">+</span>
              </div>
              <span className="text-[#5A5A7A] text-sm group-hover:text-[#9898B8] transition-colors">
                과목 추가
              </span>
            </button>
          )}
        </div>

        {/* ── 하단 편집 버튼 ── */}
        <div className="px-5 py-4 border-t border-elevated flex items-center justify-between">
          <button
            onClick={() => {
              setEditMode(!editMode);
              setDeleteConfirm(null);
              setIsAdding(false);
            }}
            className={`text-sm font-medium transition-colors ${
              editMode ? 'text-primary' : 'text-[#9898B8] hover:text-white'
            }`}
          >
            {editMode ? '완료' : '편집'}
          </button>

          {/* 오늘 세션 수 */}
          <span className="text-xs text-[#5A5A7A]">
            오늘 {todaySessions.length}회 · {formatHMS(todayTotalSec)}
          </span>
        </div>
      </div>
    </main>
  );
}

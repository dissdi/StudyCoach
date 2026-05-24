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

// ─── 타임테이블 컴포넌트 ──────────────────────────────────────────────
// 6블록/행(=10분 단위), 각 블록 내부를 1분 단위 10개 서브셀로 분할
const BLOCKS_PER_HOUR = 6;   // 시간당 블록 수
const MINS_PER_BLOCK  = 10;  // 블록당 분 수
const BLOCK_PX        = 20;  // 블록 한 변 (px) — 정사각형
const SUBCELL_W       = BLOCK_PX / MINS_PER_BLOCK; // 서브셀 너비: 2px
const BLOCK_GAP       = 2;   // 블록 간 간격 (px)
const EMPTY_COLOR     = '#15151F';
const CURRENT_COLOR   = '#252535';

interface TimeTableProps {
  sessions: Array<{ startTime: number; durationSeconds: number; subject: string }>;
  subjects: string[];
}

function TimeTable({ sessions, subjects }: TimeTableProps) {
  // 오늘 자정 (초 단위)
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const midnightSec = todayMidnight.getTime() / 1000;

  // 1분 단위 색상 배열: 하루 1440분
  const minuteColors: (string | null)[] = Array(1440).fill(null);

  for (const session of sessions) {
    const subjectIdx = subjects.indexOf(session.subject);
    const color = SUBJECT_COLORS[subjectIdx >= 0 ? subjectIdx % SUBJECT_COLORS.length : 0];

    const startSec = session.startTime / 1000 - midnightSec;
    const endSec   = startSec + session.durationSeconds;

    const startMin = Math.floor(startSec / 60);
    const endMin   = Math.ceil(endSec / 60); // 1초라도 걸치면 그 분을 포함

    for (let m = Math.max(0, startMin); m < Math.min(1440, endMin); m++) {
      minuteColors[m] = color;
    }
  }

  // 현재 분 인덱스 (현재 시각 블록 하이라이트용)
  const nowSec        = Date.now() / 1000 - midnightSec;
  const currentMinIdx = Math.floor(nowSec / 60);
  const currentBlock  = Math.floor(currentMinIdx / MINS_PER_BLOCK); // 0~143

  return (
    <div className="py-3 px-2 select-none">
      {Array.from({ length: 24 }, (_, h) => (
        <div
          key={h}
          className="flex items-center"
          style={{ marginBottom: BLOCK_GAP }}
        >
          {/* 시간 라벨 */}
          <span
            className="text-[9px] text-[#3A3A5A] text-right flex-shrink-0 leading-none"
            style={{ width: 18, marginRight: BLOCK_GAP * 2 }}
          >
            {String(h).padStart(2, '0')}
          </span>

          {/* 6개 블록 */}
          <div className="flex" style={{ gap: BLOCK_GAP }}>
            {Array.from({ length: BLOCKS_PER_HOUR }, (_, b) => {
              const blockIdx   = h * BLOCKS_PER_HOUR + b;
              const isCurrent  = blockIdx === currentBlock;
              const baseMinIdx = h * 60 + b * MINS_PER_BLOCK;

              return (
                <div
                  key={b}
                  style={{
                    width: BLOCK_PX,
                    height: BLOCK_PX,
                    borderRadius: 2,
                    overflow: 'hidden',
                    display: 'flex',
                    flexShrink: 0,
                    outline: isCurrent ? '1px solid #4A4A6A' : 'none',
                  }}
                >
                  {/* 1분 단위 서브셀 10개 (테두리 없이 이어붙임) */}
                  {Array.from({ length: MINS_PER_BLOCK }, (_, m) => {
                    const minIdx = baseMinIdx + m;
                    const color  = minuteColors[minIdx];
                    const isCurrentMin = minIdx === currentMinIdx;
                    return (
                      <div
                        key={m}
                        style={{
                          width: SUBCELL_W,
                          height: BLOCK_PX,
                          flexShrink: 0,
                          backgroundColor: color ?? (isCurrentMin ? CURRENT_COLOR : EMPTY_COLOR),
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

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
        <div className="px-5 pt-8 pb-2 flex-shrink-0">
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
          <div className="text-center py-5">
            <div
              className="text-6xl font-bold tracking-wider font-mono"
              style={{ color: todayTotalSec > 0 ? '#FF8C42' : '#3A3A5A' }}
            >
              {formatHMS(todayTotalSec)}
            </div>
            <p className="text-[#5A5A7A] text-xs mt-2">오늘 총 공부 시간</p>
          </div>
        </div>

        {/* ── 2컬럼 본문: 과목리스트(좌) + 타임테이블(우) ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* 왼쪽: 과목 리스트 */}
          <div className="flex-1 overflow-y-auto border-r border-elevated">
            {subjects.length === 0 && !isAdding && (
              <div className="text-center py-16 text-[#5A5A7A] text-xs px-3">
                과목을 추가해서<br />공부를 시작해보세요!
              </div>
            )}

            {subjects.map((subject, idx) => {
              const color = SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
              const timeSec = subjectTimes[subject] || 0;

              return (
                <div
                  key={subject}
                  className="flex items-center px-3 py-3 border-b border-elevated/40 hover:bg-card/30 transition-colors"
                >
                  {/* 플레이 버튼 */}
                  <button
                    onClick={() => handleStartSubject(subject)}
                    disabled={editMode}
                    className="w-9 h-9 rounded-full flex items-center justify-center mr-3 flex-shrink-0 transition-transform active:scale-90"
                    style={{
                      backgroundColor: color + '22',
                      border: `2px solid ${color}`,
                      opacity: editMode ? 0.5 : 1,
                    }}
                    aria-label={`${subject} 공부 시작`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill={color}>
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>

                  {/* 과목 이름 + 시간 */}
                  <div className="flex-1 min-w-0">
                    <span className="text-white text-[13px] font-medium truncate block">
                      {subject}
                    </span>
                    <span className={`text-[10px] font-mono ${timeSec > 0 ? 'text-[#9898B8]' : 'text-[#3A3A5A]'}`}>
                      {formatHMS(timeSec)}
                    </span>
                  </div>

                  {/* 편집 모드: 삭제 버튼 */}
                  {editMode && (
                    <button
                      onClick={() => handleDeleteRequest(subject)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all flex-shrink-0 ${
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
              <div className="flex flex-col px-3 py-3 gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder="과목 이름..."
                  className="w-full bg-card rounded-xl px-3 py-2 text-white text-sm outline-none border border-primary placeholder:text-[#5A5A7A]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddSubject();
                    if (e.key === 'Escape') {
                      setIsAdding(false);
                      setNewSubjectName('');
                    }
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddSubject}
                    className="flex-1 text-primary text-xs font-semibold py-1 hover:opacity-80 transition-opacity bg-primary/10 rounded-lg"
                  >
                    추가
                  </button>
                  <button
                    onClick={() => { setIsAdding(false); setNewSubjectName(''); }}
                    className="flex-1 text-[#5A5A7A] text-xs py-1 hover:text-white transition-colors bg-card/50 rounded-lg"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setIsAdding(true); setEditMode(false); }}
                className="flex items-center gap-2 px-3 py-3 w-full text-left hover:bg-card/30 transition-colors"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ border: '2px dashed #3A3A5A' }}
                >
                  <span className="text-[#5A5A7A] text-lg leading-none">+</span>
                </div>
                <span className="text-[#5A5A7A] text-xs">과목 추가</span>
              </button>
            )}
          </div>

          {/* 오른쪽: 타임테이블 */}
          {/* 타임테이블 컬럼 너비: label(18) + gap(4) + 6블록×20px + 5간격×2px + padding(8) */}
          <div className="overflow-y-auto flex-shrink-0" style={{ width: 18 + 4 + BLOCKS_PER_HOUR * BLOCK_PX + (BLOCKS_PER_HOUR - 1) * BLOCK_GAP + 8 }}>
            <TimeTable sessions={todaySessions} subjects={subjects} />
          </div>
        </div>

        {/* ── 하단 편집 버튼 ── */}
        <div className="px-5 py-4 border-t border-elevated flex items-center justify-between flex-shrink-0">
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

          <span className="text-xs text-[#5A5A7A]">
            오늘 {todaySessions.length}회 · {formatHMS(todayTotalSec)}
          </span>
        </div>
      </div>
    </main>
  );
}

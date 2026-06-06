'use client';

import { useMemo, useState } from 'react';
import { useStudyStore } from '@/store/useStudyStore';
import {
  serializeSessions,
  mimeForFormat,
  downloadAsFile,
  makeFilename,
  sessionToChatTurns,
  type ExportFormat,
} from '@/lib/exportChat';
import type { StudySession } from '@study-coach/shared';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const FORMATS: { key: ExportFormat; label: string; desc: string; ext: string }[] = [
  { key: 'json',     label: 'JSON',     desc: '프로그램 분석용 · 가장 풍부',           ext: '.json' },
  { key: 'markdown', label: 'Markdown', desc: '읽기 좋음 · 노션/옵시디언 호환',         ext: '.md'   },
  { key: 'txt',      label: '텍스트',   desc: '단순 텍스트 · 어디서나 열림',            ext: '.txt'  },
];

function fmtHMS(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

export default function ExportPage() {
  const { sessions } = useStudyStore();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null);
  const [justExported, setJustExported] = useState(false);

  // 세션 채팅이 있는 것만 카운트 (참고용)
  const sessionsWithChat = useMemo(
    () => sessions.filter((s) => (s.coachMessages?.length ?? 0) + (s.userMessages?.length ?? 0) > 0),
    [sessions]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(sessions.map((s) => s.id)));
  const clearAll  = () => setSelectedIds(new Set());

  const doExport = (scope: 'all' | 'selected' | 'single', singleSession?: StudySession) => {
    let targets: StudySession[];
    if (scope === 'all') targets = sessions;
    else if (scope === 'single' && singleSession) targets = [singleSession];
    else targets = sessions.filter((s) => selectedIds.has(s.id));

    if (targets.length === 0) {
      alert('내보낼 세션이 없어요.');
      return;
    }

    const content = serializeSessions(targets, selectedFormat);
    const filename = makeFilename(
      scope === 'single' ? 'single' : 'all',
      selectedFormat,
      scope === 'single' ? singleSession : undefined
    );
    downloadAsFile(content, filename, mimeForFormat(selectedFormat));
    setJustExported(true);
    setTimeout(() => setJustExported(false), 2000);
  };

  // ── 클립보드 복사 ─────────────────────────────────────────────────
  const copyToClipboard = async (scope: 'all' | 'selected') => {
    const targets = scope === 'all' ? sessions : sessions.filter((s) => selectedIds.has(s.id));
    if (targets.length === 0) {
      alert('복사할 세션이 없어요.');
      return;
    }
    const content = serializeSessions(targets, selectedFormat);
    try {
      await navigator.clipboard.writeText(content);
      setJustExported(true);
      setTimeout(() => setJustExported(false), 2000);
    } catch {
      alert('클립보드 복사에 실패했어요.');
    }
  };

  const previewSession = sessions.find((s) => s.id === previewSessionId);
  const previewTurns = previewSession ? sessionToChatTurns(previewSession) : [];

  return (
    <main className="min-h-screen bg-bg">
      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* ── 헤더 ── */}
        <div className="flex items-center gap-4">
          <a href="/" className="text-[#9898B8] hover:text-white transition-colors">{'<'}- 홈</a>
          <h1 className="text-2xl font-bold text-white">공부 내역 추출</h1>
        </div>

        <p className="text-sm text-[#9898B8] leading-relaxed">
          AI 코치와 주고받은 채팅 기록을 파일로 저장하거나 클립보드로 복사할 수 있어요.
          전체 세션 또는 원하는 세션만 골라서 추출할 수 있어요.
        </p>

        {/* ── 1. 포맷 선택 ── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-white">1. 추출 형식</h2>
          <div className="grid grid-cols-3 gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.key}
                onClick={() => setSelectedFormat(f.key)}
                className={[
                  'flex flex-col gap-1 p-3 rounded-xl border text-left transition-all',
                  selectedFormat === f.key
                    ? 'border-primary bg-primary/10'
                    : 'border-transparent bg-card hover:border-elevated',
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold ${selectedFormat === f.key ? 'text-primary' : 'text-white'}`}>
                    {f.label}
                  </span>
                  <span className="text-[10px] text-[#5A5A7A] font-mono">{f.ext}</span>
                </div>
                <p className="text-[10px] text-[#5A5A7A] leading-tight">{f.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* ── 2. 일괄 추출 ── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-white">2. 일괄 추출</h2>
          <div className="bg-card rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">전체 세션</p>
                <p className="text-xs text-[#5A5A7A] mt-0.5">
                  {sessions.length}개 세션 · 채팅 포함 {sessionsWithChat.length}개
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard('all')}
                  disabled={sessions.length === 0}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-elevated text-[#9898B8] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  복사
                </button>
                <button
                  onClick={() => doExport('all')}
                  disabled={sessions.length === 0}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  파일 저장
                </button>
              </div>
            </div>

            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between pt-3 border-t border-elevated/40">
                <div>
                  <p className="text-white text-sm font-medium">선택 세션 ({selectedIds.size}개)</p>
                  <p className="text-xs text-[#5A5A7A] mt-0.5">아래 리스트에서 체크된 항목만</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard('selected')}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-elevated text-[#9898B8] hover:text-white transition-colors"
                  >
                    복사
                  </button>
                  <button
                    onClick={() => doExport('selected')}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-secondary text-white hover:bg-secondary/90 transition-colors"
                  >
                    파일 저장
                  </button>
                </div>
              </div>
            )}
          </div>

          {justExported && (
            <p className="text-xs text-[#22c55e] text-center">✓ 완료</p>
          )}
        </section>

        {/* ── 3. 세션별 선택/추출 ── */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">3. 세션별 선택</h2>
            <div className="flex gap-3">
              <button
                onClick={selectAll}
                disabled={sessions.length === 0}
                className="text-xs text-[#9898B8] hover:text-white transition-colors disabled:opacity-40"
              >
                전체 선택
              </button>
              <button
                onClick={clearAll}
                disabled={selectedIds.size === 0}
                className="text-xs text-[#9898B8] hover:text-white transition-colors disabled:opacity-40"
              >
                해제
              </button>
            </div>
          </div>

          {sessions.length === 0 ? (
            <div className="bg-card rounded-2xl p-8 text-center text-[#5A5A7A] text-sm">
              아직 저장된 세션이 없어요. <br />
              <span className="text-xs text-[#3A3A5A]">공부 세션을 한 번 시작해보세요.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sessions.map((s) => {
                const checked = selectedIds.has(s.id);
                const chatCount = (s.coachMessages?.length ?? 0) + (s.userMessages?.length ?? 0);
                return (
                  <div
                    key={s.id}
                    className={[
                      'bg-card rounded-xl p-3 flex items-center gap-3 border transition-colors',
                      checked ? 'border-primary/60' : 'border-transparent',
                    ].join(' ')}
                  >
                    <button
                      onClick={() => toggleSelect(s.id)}
                      className={[
                        'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                        checked
                          ? 'bg-primary border-primary text-white'
                          : 'border-elevated bg-transparent hover:border-primary/60',
                      ].join(' ')}
                      aria-label="세션 선택"
                    >
                      {checked && <span className="text-[10px] leading-none">✓</span>}
                    </button>

                    <button
                      onClick={() => setPreviewSessionId(previewSessionId === s.id ? null : s.id)}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className="text-white text-sm font-medium truncate">{s.subject}</p>
                      <p className="text-[10px] text-[#5A5A7A] mt-0.5">
                        {format(new Date(s.startTime), 'M월 d일 (E) HH:mm', { locale: ko })} ·
                        {' '}{fmtHMS(s.durationSeconds)} ·
                        {' '}채팅 {chatCount}개
                      </p>
                    </button>

                    <button
                      onClick={() => doExport('single', s)}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-elevated text-[#9898B8] hover:bg-primary hover:text-white transition-colors flex-shrink-0"
                    >
                      개별 저장
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 미리보기 ── */}
        {previewSession && previewTurns.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">미리보기</h2>
              <button
                onClick={() => setPreviewSessionId(null)}
                className="text-xs text-[#9898B8] hover:text-white transition-colors"
              >
                닫기
              </button>
            </div>
            <div className="bg-card rounded-2xl p-4 flex flex-col gap-2 max-h-96 overflow-y-auto">
              {previewTurns.map((t, i) => (
                <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={[
                      'max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed',
                      t.role === 'user'
                        ? 'bg-primary/20 border border-primary/30 text-white rounded-br-sm'
                        : 'bg-elevated text-[#D8D8E8] rounded-bl-sm',
                    ].join(' ')}
                  >
                    {t.role === 'coach' && t.trigger && (
                      <span className="text-[9px] text-[#5A5A7A] uppercase tracking-wider block mb-1">
                        코치 · {t.trigger}
                      </span>
                    )}
                    {t.text}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}

// ─── 채팅/공부 내역 추출 유틸 ────────────────────────────────────────
// 세션의 coach 메시지와 user 메시지를 시간순으로 병합해서
// JSON / Markdown / TXT 형식으로 직렬화.

import type { StudySession, CoachMessage, UserChatMessage } from '@study-coach/shared';

export type ExportFormat = 'json' | 'markdown' | 'txt';

export interface ChatTurn {
  role: 'user' | 'coach';
  text: string;
  timestamp: number;
  // coach 전용 메타
  trigger?: CoachMessage['trigger'];
  tone?: CoachMessage['tone'];
}

// ── 세션 → 시간순 채팅 턴 배열 ─────────────────────────────────────
export function sessionToChatTurns(session: StudySession): ChatTurn[] {
  const coachTurns: ChatTurn[] = (session.coachMessages ?? []).map((m) => ({
    role: 'coach',
    text: m.text,
    timestamp: m.timestamp,
    trigger: m.trigger,
    tone: m.tone,
  }));
  const userTurns: ChatTurn[] = (session.userMessages ?? []).map((m: UserChatMessage) => ({
    role: 'user',
    text: m.text,
    timestamp: m.timestamp,
  }));
  return [...coachTurns, ...userTurns].sort((a, b) => a.timestamp - b.timestamp);
}

// ── 날짜 포맷 (로컬 타임존, ISO-ish) ───────────────────────────────
function fmtDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}시간 ${m}분 ${s}초`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

// ── JSON 직렬화 ───────────────────────────────────────────────────
export function sessionsToJSON(sessions: StudySession[]): string {
  const payload = {
    exportedAt: new Date().toISOString(),
    sessionCount: sessions.length,
    sessions: sessions.map((s) => ({
      id: s.id,
      subject: s.subject,
      startTime: s.startTime,
      startTimeISO: new Date(s.startTime).toISOString(),
      endTime: s.endTime,
      durationSeconds: s.durationSeconds,
      avgConcentration: s.avgConcentration,
      chat: sessionToChatTurns(s).map((t) => ({
        role: t.role,
        text: t.text,
        timestamp: t.timestamp,
        timestampISO: new Date(t.timestamp).toISOString(),
        ...(t.trigger ? { trigger: t.trigger } : {}),
        ...(t.tone    ? { tone: t.tone }       : {}),
      })),
    })),
  };
  return JSON.stringify(payload, null, 2);
}

// ── Markdown 직렬화 ───────────────────────────────────────────────
export function sessionsToMarkdown(sessions: StudySession[]): string {
  const lines: string[] = [];
  lines.push(`# 공부 세션 기록`);
  lines.push('');
  lines.push(`- 추출 일시: ${fmtDate(Date.now())}`);
  lines.push(`- 총 세션: ${sessions.length}개`);
  lines.push('');

  for (const s of sessions) {
    lines.push(`---`);
    lines.push('');
    lines.push(`## ${s.subject} — ${fmtDate(s.startTime)}`);
    lines.push('');
    lines.push(`- 공부 시간: ${fmtDuration(s.durationSeconds)}`);
    lines.push(`- 각성 점수: ${s.avgConcentration}`);
    if (s.endTime) lines.push(`- 종료 시각: ${fmtDate(s.endTime)}`);
    lines.push('');

    const turns = sessionToChatTurns(s);
    if (turns.length === 0) {
      lines.push(`_채팅 기록 없음_`);
      lines.push('');
      continue;
    }

    lines.push(`### 채팅 기록`);
    lines.push('');
    for (const t of turns) {
      const time = fmtDate(t.timestamp).slice(11); // HH:MM:SS
      if (t.role === 'user') {
        lines.push(`**[${time}] 나:** ${t.text}`);
      } else {
        const meta = t.trigger ? ` _(${t.trigger})_` : '';
        lines.push(`**[${time}] 코치${meta}:** ${t.text}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ── TXT 직렬화 ────────────────────────────────────────────────────
export function sessionsToTXT(sessions: StudySession[]): string {
  const lines: string[] = [];
  lines.push(`공부 세션 기록`);
  lines.push(`추출 일시: ${fmtDate(Date.now())}`);
  lines.push(`총 세션: ${sessions.length}개`);
  lines.push('');

  for (const s of sessions) {
    lines.push(`========================================`);
    lines.push(`[${s.subject}] ${fmtDate(s.startTime)}`);
    lines.push(`공부 시간: ${fmtDuration(s.durationSeconds)} · 각성 점수: ${s.avgConcentration}`);
    lines.push('');

    const turns = sessionToChatTurns(s);
    if (turns.length === 0) {
      lines.push(`(채팅 기록 없음)`);
      lines.push('');
      continue;
    }

    for (const t of turns) {
      const time = fmtDate(t.timestamp).slice(11);
      const speaker = t.role === 'user' ? '나' : '코치';
      lines.push(`[${time}] ${speaker}: ${t.text}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── 포맷별 디스패치 ────────────────────────────────────────────────
export function serializeSessions(sessions: StudySession[], format: ExportFormat): string {
  switch (format) {
    case 'json':     return sessionsToJSON(sessions);
    case 'markdown': return sessionsToMarkdown(sessions);
    case 'txt':      return sessionsToTXT(sessions);
  }
}

export function mimeForFormat(format: ExportFormat): string {
  switch (format) {
    case 'json':     return 'application/json';
    case 'markdown': return 'text/markdown';
    case 'txt':      return 'text/plain';
  }
}

export function extForFormat(format: ExportFormat): string {
  switch (format) {
    case 'json':     return 'json';
    case 'markdown': return 'md';
    case 'txt':      return 'txt';
  }
}

// ── 브라우저에서 파일 다운로드 트리거 ───────────────────────────────
export function downloadAsFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// ── 파일명 생성 ────────────────────────────────────────────────────
export function makeFilename(scope: 'all' | 'single', format: ExportFormat, session?: StudySession): string {
  const ext = extForFormat(format);
  const stamp = (() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  })();
  if (scope === 'all' || !session) return `study-coach-export-${stamp}.${ext}`;
  // 세션 단일 추출: 과목명에서 파일명 안전 문자만
  const subj = session.subject.replace(/[\\/:*?"<>|]/g, '_');
  const d = new Date(session.startTime);
  const pad = (n: number) => String(n).padStart(2, '0');
  const sessionStamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `study-${subj}-${sessionStamp}.${ext}`;
}

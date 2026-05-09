'use client';

import { useState } from 'react';
import { useStudyStore } from '@/store/useStudyStore';

const QUICK_MESSAGES = [
  '지금 집중 잘 돼',
  '집중이 안 돼',
  '졸린 게 아니에요',
  '혼자 할게요',
];

const REST_OPTIONS = [
  { label: '1분', sec: 60 },
  { label: '5분', sec: 300 },
  { label: '10분', sec: 600 },
];

interface Props {
  isRestPickerOpen: boolean;
  onRestSelect: (sec: number) => void;
  onRestPickerClose: () => void;
  isResting?: boolean;
}

export default function CoachActionButtons({ isRestPickerOpen, onRestSelect, onRestPickerClose, isResting = false }: Props) {
  const { coachTyping, sendUserMessage } = useStudyStore();

  const [chatText, setChatText] = useState('');
  const [customRestInput, setCustomRestInput] = useState('');
  const [showCustomRest, setShowCustomRest] = useState(false);

  const handleQuickSend = (text: string) => {
    if (coachTyping) return;
    sendUserMessage(text);
  };

  const handleChatSend = () => {
    const trimmed = chatText.trim();
    if (!trimmed || coachTyping) return;
    sendUserMessage(trimmed);
    setChatText('');
  };

  const handleCustomRestSubmit = () => {
    const mins = parseFloat(customRestInput);
    if (isNaN(mins) || mins <= 0) return;
    onRestSelect(Math.round(mins * 60));
    setCustomRestInput('');
    setShowCustomRest(false);
  };

  // ── 휴식 선택 모드 ────────────────────────────────────────────────
  if (isRestPickerOpen) {
    return (
      <div className="fixed bottom-6 left-0 right-0 flex flex-col items-center gap-3 z-50 px-4">
        <p className="text-xs text-[#9898B8] tracking-widest uppercase">휴식 시간 선택</p>
        <div className="flex flex-wrap justify-center gap-2 max-w-lg">
          {REST_OPTIONS.map((opt) => (
            <button
              key={opt.sec}
              onClick={() => onRestSelect(opt.sec)}
              className="px-6 py-2.5 rounded-full text-sm font-semibold bg-secondary/20 border border-secondary/50 text-secondary hover:bg-secondary/30 transition-all backdrop-blur-sm shadow-lg"
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => setShowCustomRest((v) => !v)}
            className="px-6 py-2.5 rounded-full text-sm font-semibold bg-[#1A1A2E]/80 border border-white/10 text-[#9898B8] hover:border-secondary/50 hover:text-white transition-all backdrop-blur-sm shadow-lg"
          >
            직접 입력
          </button>
          <button
            onClick={onRestPickerClose}
            className="px-4 py-2.5 rounded-full text-sm font-semibold bg-[#1A1A2E]/80 border border-white/10 text-[#5A5A7A] hover:text-white transition-all backdrop-blur-sm"
          >
            취소
          </button>
        </div>
        {showCustomRest && (
          <div className="flex gap-2 max-w-xs w-full">
            <input
              type="number"
              min="1"
              max="60"
              placeholder="분 단위 입력 (예: 3)"
              value={customRestInput}
              onChange={(e) => setCustomRestInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCustomRestSubmit()}
              className="flex-1 bg-[#1A1A2E]/90 border border-white/15 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-secondary placeholder:text-[#5A5A7A] backdrop-blur-sm"
              autoFocus
            />
            <button
              onClick={handleCustomRestSubmit}
              className="px-4 py-2 rounded-xl bg-secondary/20 border border-secondary/50 text-secondary text-sm font-semibold hover:bg-secondary/30 transition-all"
            >
              시작
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── 일반 모드 ─────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-6 left-0 right-0 flex flex-col items-center gap-2.5 z-50 px-4">

      {/* 빠른 메시지 버튼 행 — 휴식 중엔 숨김 */}
      {!isResting && (
        <div className="flex flex-wrap justify-center gap-2 max-w-lg">
          {QUICK_MESSAGES.map((msg) => (
            <button
              key={msg}
              onClick={() => handleQuickSend(msg)}
              disabled={coachTyping}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 border backdrop-blur-sm bg-[#1A1A2E]/80 border-white/10 text-[#9898B8] hover:border-primary/60 hover:text-white hover:bg-[#1A1A2E] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {msg}
            </button>
          ))}
        </div>
      )}

      {/* 채팅 입력 행 */}
      <div className="flex gap-2 max-w-lg w-full">
        <input
          type="text"
          placeholder={coachTyping ? '코치가 답장 중...' : isResting ? '쉬는 중에도 코치에게 말 걸 수 있어요' : '코치에게 메시지 보내기...'}
          value={chatText}
          onChange={(e) => setChatText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
          disabled={coachTyping}
          maxLength={150}
          className={[
            'flex-1 border rounded-full px-4 py-2 text-white text-sm outline-none transition-colors',
            'backdrop-blur-sm placeholder:text-[#5A5A7A]',
            coachTyping
              ? 'bg-[#1A1A2E]/50 border-white/5 cursor-not-allowed opacity-60'
              : 'bg-[#1A1A2E]/80 border-white/10 focus:border-primary/60',
          ].join(' ')}
        />
        <button
          onClick={handleChatSend}
          disabled={!chatText.trim() || coachTyping}
          className="px-4 py-2 rounded-full bg-primary/80 border border-primary/50 text-white text-sm font-semibold hover:bg-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm"
        >
          {coachTyping ? (
            <span className="flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          ) : '전송'}
        </button>
      </div>
    </div>
  );
}

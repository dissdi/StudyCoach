'use client';

import { useStudyStore } from '@/store/useStudyStore';

const OPENAI_VOICES = [
  { id: 'nova',   label: '노바' },
  { id: 'alloy',  label: '알로이' },
  { id: 'onyx',   label: '오닉스' },
  { id: 'echo',   label: '에코' },
  { id: 'fable',  label: '페이블' },
  { id: 'shimmer',label: '쉬머' },
];

const EDGE_VOICES = [
  { id: 'ko-KR-SunHiNeural',            label: 'SunHi' },
  { id: 'ko-KR-InJoonNeural',           label: 'InJoon' },
  { id: 'ko-KR-HyunsuMultilingualNeural', label: 'Hyunsu' },
];

export default function VoiceControls() {
  const {
    ttsEnabled, ttsVolume, ttsSpeed, ttsVoice, edgeTtsVoice, llmProvider,
    setTtsVolume, setTtsSpeed, setTtsVoice, setEdgeTtsVoice,
  } = useStudyStore();

  if (!ttsEnabled) return null;

  const isEdge = llmProvider === 'anthropic';
  const voices = isEdge ? EDGE_VOICES : OPENAI_VOICES;
  const currentVoice = isEdge ? edgeTtsVoice : ttsVoice;
  const setVoice = isEdge ? setEdgeTtsVoice : setTtsVoice;

  return (
    <div className="fixed right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-5 z-40 select-none">
      <div className="bg-card/80 backdrop-blur-sm border border-white/8 rounded-2xl px-2.5 py-4 flex flex-col items-center gap-4">

        {/* 목소리 선택 */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[9px] text-[#5A5A7A] uppercase tracking-widest">목소리</span>
          <div className="flex flex-col gap-1 w-full">
            {voices.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setVoice(id)}
                className={[
                  'text-[10px] font-medium px-2 py-1 rounded-lg transition-all duration-150 text-center',
                  currentVoice === id
                    ? 'bg-primary/30 text-primary border border-primary/50'
                    : 'text-[#5A5A7A] hover:text-white hover:bg-elevated border border-transparent',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 구분선 */}
        <div className="w-4 h-px bg-white/8" />

        {/* 볼륨 */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-base" title="볼륨">
            {ttsVolume === 0 ? '🔇' : ttsVolume < 0.4 ? '🔈' : ttsVolume < 0.75 ? '🔉' : '🔊'}
          </span>
          <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={ttsVolume}
              onChange={(e) => setTtsVolume(Number(e.target.value))}
              style={{
                writingMode: 'vertical-lr' as any,
                direction: 'rtl',
                WebkitAppearance: 'slider-vertical',
                appearance: 'slider-vertical' as any,
                width: 8,
                height: 80,
                cursor: 'pointer',
                accentColor: '#7C6FFF',
              }}
            />
          </div>
          <span className="text-[10px] text-[#5A5A7A] tabular-nums">
            {Math.round(ttsVolume * 100)}%
          </span>
        </div>

        {/* 구분선 */}
        <div className="w-4 h-px bg-white/8" />

        {/* 속도 */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-base" title="말하는 속도">⚡</span>
          <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.05}
              value={ttsSpeed}
              onChange={(e) => setTtsSpeed(Number(e.target.value))}
              style={{
                writingMode: 'vertical-lr' as any,
                direction: 'rtl',
                WebkitAppearance: 'slider-vertical',
                appearance: 'slider-vertical' as any,
                width: 8,
                height: 80,
                cursor: 'pointer',
                accentColor: '#4ECDC4',
              }}
            />
          </div>
          <span className="text-[10px] text-[#5A5A7A] tabular-nums">
            {ttsSpeed.toFixed(2)}x
          </span>
        </div>

      </div>
    </div>
  );
}

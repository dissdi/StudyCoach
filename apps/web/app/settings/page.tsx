'use client';

import { useState, useEffect } from 'react';
import { useStudyStore } from '@/store/useStudyStore';
import type { CoachPersonality, LLMProvider } from '@study-coach/shared';
import type { TTSModel } from '@study-coach/shared';
import { OPENAI_MODELS, ANTHROPIC_MODELS } from '@study-coach/shared';

const PERSONALITIES: { key: CoachPersonality; label: string; desc: string; emoji: string }[] = [
  { key: 'friend',  label: '친구',     desc: '따뜻하고 편안한 말투',    emoji: '🤝' },
  { key: 'teacher', label: '선생님',   desc: '명확하고 전문적인 피드백', emoji: '👨‍🏫' },
  { key: 'trainer', label: '트레이너', desc: '열정적인 동기부여',        emoji: '💪' },
];

const TTS_MODELS: { key: TTSModel; label: string; desc: string; badge: string }[] = [
  { key: 'tts-1',    label: 'tts-1',    desc: '실시간 최적화 · 저지연',  badge: '추천' },
  { key: 'tts-1-hd', label: 'tts-1-hd', desc: '고품질 음성 · 약간 느림', badge: 'HD' },
];

const TTS_VOICES: { key: string; label: string; desc: string; gender: string }[] = [
  { key: 'alloy',   label: 'Alloy',   desc: '중성적이고 안정적',    gender: '중성' },
  { key: 'ash',     label: 'Ash',     desc: '부드럽고 차분한 남성', gender: '남성' },
  { key: 'coral',   label: 'Coral',   desc: '밝고 친근한 여성',     gender: '여성' },
  { key: 'echo',    label: 'Echo',    desc: '명확하고 젠틀한 남성', gender: '남성' },
  { key: 'fable',   label: 'Fable',   desc: '따뜻하고 이야기하는',  gender: '중성' },
  { key: 'nova',    label: 'Nova',    desc: '활기차고 친근한 여성', gender: '여성' },
  { key: 'onyx',    label: 'Onyx',    desc: '깊고 권위있는 남성',   gender: '남성' },
  { key: 'sage',    label: 'Sage',    desc: '차분하고 지적인 여성', gender: '여성' },
  { key: 'shimmer', label: 'Shimmer', desc: '에너제틱한 여성',      gender: '여성' },
];

const TTS_VOICE_PREVIEW: Record<CoachPersonality, { voice: string; sample: string }> = {
  friend:  { voice: 'nova',    sample: '오늘도 잘 하고 있어! 집중 유지해봐.' },
  teacher: { voice: 'onyx',    sample: '집중도가 양호합니다. 현재 페이스를 유지하세요.' },
  trainer: { voice: 'shimmer', sample: '집중력 최고! 이 에너지 그대로 달려!' },
};

const BROWSER_TTS_SAMPLE: Record<CoachPersonality, string> = {
  friend:  '오늘도 잘 하고 있어! 집중 유지해봐.',
  teacher: '집중도가 양호합니다. 현재 페이스를 유지하세요.',
  trainer: '집중력 최고! 이 에너지 그대로 달려!',
};

// msedge-tts 무료 엔드포인트에서 실제 동작 확인된 목소리만 포함
const EDGE_TTS_VOICES: { key: string; label: string; desc: string; gender: string }[] = [
  { key: 'ko-KR-SunHiNeural',  label: 'SunHi',  desc: '따뜻하고 자연스러운 여성',  gender: '여성' },
  { key: 'ko-KR-InJoonNeural', label: 'InJoon', desc: '차분하고 신뢰감 있는 남성', gender: '남성' },
  { key: 'ko-KR-HyunsuNeural', label: 'Hyunsu', desc: '에너제틱한 젊은 남성',      gender: '남성' },
];

export default function SettingsPage() {
  const {
    coachPersonality, coachEnabled, ttsEnabled, ttsModel, ttsVoice,
    llmProvider, openaiApiKey, openaiModel, anthropicApiKey, anthropicModel, edgeTtsVoice,
    setCoachPersonality, setCoachEnabled, setTtsEnabled, setTtsModel, setTtsVoice,
    setLlmProvider, setOpenaiApiKey, setOpenaiModel, setAnthropicApiKey, setAnthropicModel, setEdgeTtsVoice,
  } = useStudyStore();

  const [openaiInput,             setOpenaiInput]             = useState(openaiApiKey);
  const [anthropicInput,          setAnthropicInput]          = useState(anthropicApiKey);
  const [selectedOpenaiModel,     setSelectedOpenaiModel]     = useState(openaiModel || 'gpt-4o-mini');
  const [selectedAnthropicModel,  setSelectedAnthropicModel]  = useState(anthropicModel || 'claude-3-5-haiku-latest');
  const [customOpenaiModel,       setCustomOpenaiModel]       = useState('');
  const [customAnthropicModel,    setCustomAnthropicModel]    = useState('');
  const [showOpenai,              setShowOpenai]              = useState(false);
  const [showAnthropic,           setShowAnthropic]           = useState(false);
  const [saved,                   setSaved]                   = useState(false);
  const [previewing,              setPreviewing]              = useState(false);

  // Zustand persist는 마운트 직후 hydrate되므로 초기 useState 값이 비어있을 수 있음
  // hydrate 완료 후 store 값이 바뀌면 로컬 state를 동기화
  useEffect(() => {
    if (openaiApiKey)    setOpenaiInput(openaiApiKey);
    if (anthropicApiKey) setAnthropicInput(anthropicApiKey);
    if (openaiModel)     setSelectedOpenaiModel(openaiModel);
    if (anthropicModel)  setSelectedAnthropicModel(anthropicModel);
  }, [openaiApiKey, anthropicApiKey, openaiModel, anthropicModel]);

  const handleSave = () => {
    // 입력 필드가 비어있으면 기존 저장된 키를 유지 (실수로 덮어쓰는 것 방지)
    if (openaiInput.trim())    setOpenaiApiKey(openaiInput.trim());
    if (anthropicInput.trim()) setAnthropicApiKey(anthropicInput.trim());
    setOpenaiModel(selectedOpenaiModel);
    setAnthropicModel(selectedAnthropicModel);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTTSPreview = async () => {
    if (previewing) return;
    setPreviewing(true);
    if (llmProvider === 'anthropic') {
      const sample = BROWSER_TTS_SAMPLE[coachPersonality];
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: sample, voice: edgeTtsVoice }),
        });
        if (!res.ok) throw new Error('edge-tts-failed');
        const blob = await res.blob();
        if (blob.size === 0) throw new Error('empty-audio');
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        // play()는 재생 '시작' 시 resolve, onended는 재생 '완료' 시 호출
        // onerror·재생 실패 모두 catch로 넘겨 finally에서 setPreviewing(false) 보장
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('audio-error')); };
          audio.play().catch(reject);
        });
      } catch {
        // Edge TTS 실패 시 브라우저 TTS fallback
        if (window.speechSynthesis) {
          await new Promise<void>((resolve) => {
            const u = new SpeechSynthesisUtterance(sample);
            u.lang   = 'ko-KR';
            u.onend  = () => resolve();
            u.onerror = () => resolve();
            window.speechSynthesis.speak(u);
          });
        }
      } finally {
        setPreviewing(false);
      }
      return;
    }
    const { sample } = TTS_VOICE_PREVIEW[coachPersonality];
    const key = openaiInput.trim() || openaiApiKey;
    if (key) {
      try {
        const res = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify({ model: ttsModel, input: sample, voice: ttsVoice, speed: 1.0 }),
        });
        if (!res.ok) throw new Error();
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => { URL.revokeObjectURL(url); setPreviewing(false); };
        audio.onerror = () => { setPreviewing(false); };
        await audio.play();
        return;
      } catch { /* fallback */ }
    }
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(sample);
      u.lang = 'ko-KR';
      u.onend = () => setPreviewing(false);
      window.speechSynthesis.speak(u);
    } else { setPreviewing(false); }
  };

  return (
    <main className="min-h-screen bg-bg">
      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">

        <div className="flex items-center gap-4">
          <a href="/" className="text-[#9898B8] hover:text-white transition-colors">{'<'}- 홈</a>
          <h1 className="text-2xl font-bold text-white">설정</h1>
        </div>

        {/* 코치 ON/OFF & TTS */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-white">AI 코치</h2>
          <div className="bg-card rounded-2xl p-4 flex justify-between items-center">
            <div>
              <p className="text-white font-medium">실시간 코칭 활성화</p>
              <p className="text-xs text-[#5A5A7A] mt-0.5">집중도에 따라 코칭 메시지를 보내드려요</p>
            </div>
            <button onClick={() => setCoachEnabled(!coachEnabled)}
              className={`w-12 h-6 rounded-full transition-colors relative ${coachEnabled ? 'bg-primary' : 'bg-elevated'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${coachEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="bg-card rounded-2xl p-4 flex justify-between items-center">
            <div>
              <p className="text-white font-medium">음성 코칭 (TTS)</p>
              <p className="text-xs text-[#5A5A7A] mt-0.5">코치 메시지를 음성으로 읽어드려요</p>
            </div>
            <button onClick={() => setTtsEnabled(!ttsEnabled)}
              className={`w-12 h-6 rounded-full transition-colors relative ${ttsEnabled ? 'bg-secondary' : 'bg-elevated'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow ${ttsEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          {ttsEnabled && (
            <div className="bg-card rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-white font-medium text-sm">TTS 설정</p>
                <button onClick={handleTTSPreview} disabled={previewing}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-secondary/15 text-secondary border border-secondary/30 hover:bg-secondary/25 transition-all disabled:opacity-50">
                  {previewing ? (<><span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" /> 재생 중</>) : '▶ 미리듣기'}
                </button>
              </div>

              {llmProvider === 'anthropic' ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <p className="text-white font-medium text-sm">Edge TTS 목소리</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary/20 text-secondary font-medium">Microsoft · 무료</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {EDGE_TTS_VOICES.map((v) => (
                      <button key={v.key} onClick={() => setEdgeTtsVoice(v.key)}
                        className={['flex flex-col gap-0.5 p-2.5 rounded-xl border text-left transition-all',
                          edgeTtsVoice === v.key ? 'border-secondary bg-secondary/10' : 'border-transparent bg-elevated hover:border-white/10'].join(' ')}>
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-semibold ${edgeTtsVoice === v.key ? 'text-secondary' : 'text-white'}`}>{v.label}</span>
                          <span className="text-[10px] text-[#5A5A7A]">{v.gender}</span>
                        </div>
                        <p className="text-[10px] text-[#5A5A7A] leading-tight">{v.desc}</p>
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#3A3A5A]">고품질 한국어 신경망 음성 · 서버 프록시 경유</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    <p className="text-white font-medium text-sm">TTS 모델</p>
                    <div className="grid grid-cols-2 gap-2">
                      {TTS_MODELS.map((m) => (
                        <button key={m.key} onClick={() => setTtsModel(m.key)}
                          className={['flex flex-col gap-1 p-3 rounded-xl border text-left transition-all',
                            ttsModel === m.key ? 'border-secondary bg-secondary/10' : 'border-transparent bg-elevated hover:border-white/10'].join(' ')}>
                          <div className="flex items-center gap-2">
                            <span className={`font-mono text-sm font-semibold ${ttsModel === m.key ? 'text-secondary' : 'text-white'}`}>{m.label}</span>
                            <span className={['text-[10px] px-1.5 py-0.5 rounded font-medium',
                              ttsModel === m.key ? 'bg-secondary/20 text-secondary' : 'bg-white/5 text-[#5A5A7A]'].join(' ')}>{m.badge}</span>
                          </div>
                          <p className="text-xs text-[#5A5A7A]">{m.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-white font-medium text-sm">목소리</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {TTS_VOICES.map((v) => (
                        <button key={v.key} onClick={() => setTtsVoice(v.key)}
                          className={['flex flex-col gap-0.5 p-2.5 rounded-xl border text-left transition-all',
                            ttsVoice === v.key ? 'border-primary bg-primary/10' : 'border-transparent bg-elevated hover:border-white/10'].join(' ')}>
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-semibold ${ttsVoice === v.key ? 'text-primary' : 'text-white'}`}>{v.label}</span>
                            <span className="text-[10px] text-[#5A5A7A]">{v.gender}</span>
                          </div>
                          <p className="text-[10px] text-[#5A5A7A] leading-tight">{v.desc}</p>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-[#3A3A5A]">
                      {openaiApiKey ? 'OpenAI TTS 사용' : '브라우저 TTS (OpenAI 키 없음)'}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* 코치 스타일 */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-white">코치 스타일</h2>
          {PERSONALITIES.map((opt) => (
            <button key={opt.key} onClick={() => setCoachPersonality(opt.key)}
              className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${
                coachPersonality === opt.key ? 'border-primary bg-primary/10' : 'border-transparent bg-card hover:border-elevated'
              }`}>
              <span className="text-2xl">{opt.emoji}</span>
              <div className="flex-1">
                <p className={`font-semibold ${coachPersonality === opt.key ? 'text-primary' : 'text-white'}`}>{opt.label}</p>
                <p className="text-xs text-[#5A5A7A] mt-0.5">{opt.desc}</p>
              </div>
              {coachPersonality === opt.key && <span className="text-primary font-bold">✓</span>}
            </button>
          ))}
        </div>

        {/* AI 프로바이더 */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">AI 프로바이더</h2>
            <p className="text-xs text-[#5A5A7A] mt-1">
              코칭에 사용할 AI를 선택하세요. Claude 선택 시 TTS는 브라우저 기본 음성이 적용됩니다.
            </p>
          </div>

          <div className="flex bg-card rounded-2xl p-1 gap-1">
            {([
              { id: 'openai' as LLMProvider,    label: 'OpenAI', icon: '⚡', sub: 'GPT 모델 + OpenAI TTS' },
              { id: 'anthropic' as LLMProvider, label: 'Claude', icon: '🧠', sub: 'Anthropic · 브라우저 TTS' },
            ] as const).map((p) => (
              <button key={p.id} onClick={() => setLlmProvider(p.id)}
                className={['flex-1 flex flex-col items-center gap-0.5 py-3 rounded-xl transition-all',
                  llmProvider === p.id ? 'bg-primary text-white' : 'text-[#9898B8] hover:text-white hover:bg-elevated'].join(' ')}>
                <span className="text-lg">{p.icon}</span>
                <span className="text-sm font-semibold">{p.label}</span>
                <span className={`text-[10px] ${llmProvider === p.id ? 'text-white/70' : 'text-[#5A5A7A]'}`}>{p.sub}</span>
              </button>
            ))}
          </div>

          {/* OpenAI 설정 */}
          {llmProvider === 'openai' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">OpenAI API 키</span>
                  <span className="text-[10px] text-[#5A5A7A]">코칭 + TTS 모두 사용</span>
                </div>
                <div className="flex bg-card rounded-xl border border-elevated overflow-hidden focus-within:border-primary transition-colors">
                  <input
                    type={showOpenai ? 'text' : 'password'}
                    value={openaiInput}
                    onChange={(e) => setOpenaiInput(e.target.value)}
                    placeholder="sk-proj-..."
                    className="flex-1 bg-transparent px-4 py-3 text-white text-sm outline-none placeholder:text-[#5A5A7A]"
                  />
                  <button onClick={() => setShowOpenai((v) => !v)}
                    className="px-4 py-3 text-xs text-[#9898B8] hover:text-white transition-colors">
                    {showOpenai ? '숨김' : '표시'}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white">모델</p>
                  <span className="text-[10px] text-[#5A5A7A]">현재: {openaiModel || 'gpt-4o-mini'}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(OPENAI_MODELS as readonly { id: string; label: string; desc: string; badge: string }[]).map((m) => (
                    <button key={m.id}
                      onClick={() => { setSelectedOpenaiModel(m.id); setCustomOpenaiModel(''); }}
                      className={['flex flex-col gap-0.5 px-3 py-2 rounded-xl border text-left transition-all',
                        selectedOpenaiModel === m.id && customOpenaiModel === ''
                          ? 'border-primary bg-primary/10'
                          : 'border-transparent bg-elevated hover:border-white/10'].join(' ')}>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-semibold ${selectedOpenaiModel === m.id && customOpenaiModel === '' ? 'text-primary' : 'text-white'}`}>{m.label}</span>
                        {m.badge && (
                          <span className={['text-[9px] px-1.5 py-0.5 rounded font-medium',
                            m.badge === 'Top'  ? 'bg-warn/20 text-warn' :
                            m.badge === 'New'  ? 'bg-secondary/20 text-secondary' :
                            m.badge === '최신' ? 'bg-focus/20 text-focus' :
                            'bg-primary/20 text-primary'].join(' ')}>{m.badge}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#5A5A7A]">{m.desc}</p>
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={customOpenaiModel}
                  onChange={(e) => { setCustomOpenaiModel(e.target.value); if (e.target.value) setSelectedOpenaiModel(e.target.value); }}
                  placeholder="직접 입력 (예: gpt-5.5)"
                  className={`bg-elevated rounded-xl px-4 py-2.5 text-sm outline-none border transition-colors placeholder:text-[#5A5A7A] ${
                    customOpenaiModel ? 'border-primary text-white' : 'border-transparent text-[#9898B8]'
                  } focus:border-primary`}
                />
              </div>
            </div>
          )}

          {/* Claude (Anthropic) 설정 */}
          {llmProvider === 'anthropic' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">Anthropic API 키</span>
                  <span className="text-[10px] text-[#5A5A7A]">코칭만 사용 · TTS 별도 없음</span>
                </div>
                <div className="flex bg-card rounded-xl border border-elevated overflow-hidden focus-within:border-primary transition-colors">
                  <input
                    type={showAnthropic ? 'text' : 'password'}
                    value={anthropicInput}
                    onChange={(e) => setAnthropicInput(e.target.value)}
                    placeholder="sk-ant-..."
                    className="flex-1 bg-transparent px-4 py-3 text-white text-sm outline-none placeholder:text-[#5A5A7A]"
                  />
                  <button onClick={() => setShowAnthropic((v) => !v)}
                    className="px-4 py-3 text-xs text-[#9898B8] hover:text-white transition-colors">
                    {showAnthropic ? '숨김' : '표시'}
                  </button>
                </div>
                <p className="text-[10px] text-[#5A5A7A]">console.anthropic.com에서 발급받으실 수 있어요.</p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white">모델</p>
                  <span className="text-[10px] text-[#5A5A7A]">현재: {anthropicModel || 'claude-3-5-haiku-latest'}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(ANTHROPIC_MODELS as readonly { id: string; label: string; desc: string; badge: string }[]).map((m) => (
                    <button key={m.id}
                      onClick={() => { setSelectedAnthropicModel(m.id); setCustomAnthropicModel(''); }}
                      className={['flex flex-col gap-0.5 px-3 py-2 rounded-xl border text-left transition-all',
                        selectedAnthropicModel === m.id && customAnthropicModel === ''
                          ? 'border-primary bg-primary/10'
                          : 'border-transparent bg-elevated hover:border-white/10'].join(' ')}>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-semibold ${selectedAnthropicModel === m.id && customAnthropicModel === '' ? 'text-primary' : 'text-white'}`}>{m.label}</span>
                        {m.badge && (
                          <span className={['text-[9px] px-1.5 py-0.5 rounded font-medium',
                            m.badge === 'Top'  ? 'bg-warn/20 text-warn' :
                            m.badge === '최신' ? 'bg-focus/20 text-focus' :
                            'bg-primary/20 text-primary'].join(' ')}>{m.badge}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#5A5A7A]">{m.desc}</p>
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={customAnthropicModel}
                  onChange={(e) => { setCustomAnthropicModel(e.target.value); if (e.target.value) setSelectedAnthropicModel(e.target.value); }}
                  placeholder="직접 입력 (예: claude-opus-4-6)"
                  className={`bg-elevated rounded-xl px-4 py-2.5 text-sm outline-none border transition-colors placeholder:text-[#5A5A7A] ${
                    customAnthropicModel ? 'border-primary text-white' : 'border-transparent text-[#9898B8]'
                  } focus:border-primary`}
                />
              </div>
            </div>
          )}

          <button onClick={handleSave}
            className={`py-3 rounded-xl font-semibold text-sm transition-all ${
              saved ? 'bg-[#4CAF50] text-white' : 'bg-primary hover:bg-primary/90 text-white'
            }`}>
            {saved ? '저장됨 ✓' : '저장'}
          </button>
        </div>

        {/* 데이터 관리 */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-white">데이터</h2>
          <a
            href="/export"
            className="bg-card rounded-2xl p-4 flex justify-between items-center hover:border-elevated border border-transparent transition-colors"
          >
            <div>
              <p className="text-white font-medium">공부 내역 추출</p>
              <p className="text-xs text-[#5A5A7A] mt-0.5">
                AI 코치와의 채팅 기록을 JSON · Markdown · TXT로 저장
              </p>
            </div>
            <span className="text-[#9898B8]">→</span>
          </a>
        </div>

        {/* 앱 정보 */}
        <div className="bg-card rounded-2xl p-6 text-center flex flex-col gap-2">
          <p className="text-xl font-bold text-white">StudyCoach</p>
          <p className="text-xs text-[#5A5A7A]">v0.1.0 Beta</p>
          <p className="text-sm text-[#9898B8] mt-2 leading-relaxed">
            CV + LLM 기반 실시간 공부 코칭<br />
            웹캠으로 집중도를 분석하고 AI가 코칭을 제공합니다.
          </p>
        </div>

      </div>
    </main>
  );
}

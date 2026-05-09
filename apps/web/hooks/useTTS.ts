'use client';

import { useEffect, useRef } from 'react';
import { useStudyStore } from '@/store/useStudyStore';

const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';
const SAMPLE_RATE    = 24000;
const INITIAL_DELAY  = 0.08;

const BROWSER_PITCH: Record<string, number> = {
  friend: 1.1, teacher: 0.95, trainer: 1.15,
};

/** TTS 전달 전 이모티콘·특수기호 제거 */
function stripForTTS(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, '') // 이모티콘 (그림문자 전체)
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')       // Variation Selectors (이모티콘 수식자)
    .replace(/\u{200D}/gu, '')                   // Zero Width Joiner
    .replace(/\s+/g, ' ')                        // 연속 공백 정리
    .trim();
}

function speakWithBrowser(
  text: string,
  personality: string,
  volume: number,
  speed: number,
) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u    = new SpeechSynthesisUtterance(text);
  u.lang     = 'ko-KR';
  u.rate     = speed;
  u.pitch    = BROWSER_PITCH[personality] ?? 1.0;
  u.volume   = volume;
  const voices  = window.speechSynthesis.getVoices();
  const koVoice = voices.find((v) => v.lang.startsWith('ko') && v.localService)
    ?? voices.find((v) => v.lang.startsWith('ko'));
  if (koVoice) u.voice = koVoice;
  window.speechSynthesis.speak(u);
}

// Edge TTS: /api/tts 라우트를 통해 MP3 재생
async function playEdgeTTS(
  text: string,
  voice: string,
  volume: number,
  signal: AbortSignal,
  onReady?: () => void,
): Promise<void> {
  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
    signal,
  });
  if (!response.ok) throw new Error(`Edge TTS ${response.status}`);

  const blob = await response.blob();
  if (signal.aborted) return;

  const url   = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.volume = volume;

  onReady?.();

  await new Promise<void>((resolve, reject) => {
    audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
    audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('audio error')); };
    audio.play().catch(reject);
  });
}

async function streamPCMAudio(
  text: string,
  voice: string,
  speed: number,
  volume: number,
  model: string,
  apiKey: string,
  signal: AbortSignal,
  onFirstChunk?: () => void,
): Promise<void> {
  const response = await fetch(OPENAI_TTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text,
      voice,
      speed,
      response_format: 'pcm',
    }),
    signal,
  });

  if (!response.ok) throw new Error(`TTS API ${response.status}`);
  if (!response.body) throw new Error('No response body');

  const ctx      = new AudioContext({ sampleRate: SAMPLE_RATE });
  const gainNode = ctx.createGain();
  gainNode.gain.value = volume;
  gainNode.connect(ctx.destination);

  if (ctx.state === 'suspended') await ctx.resume();

  let scheduleAt = ctx.currentTime + INITIAL_DELAY;
  let leftover   = new Uint8Array(0);
  const reader   = response.body.getReader();

  try {
    while (true) {
      if (signal.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = new Uint8Array(leftover.length + value.length);
      chunk.set(leftover);
      chunk.set(value, leftover.length);

      const completeSamples = Math.floor(chunk.length / 2);
      if (completeSamples === 0) { leftover = chunk; continue; }

      const float32 = new Float32Array(completeSamples);
      const view    = new DataView(chunk.buffer, chunk.byteOffset, completeSamples * 2);
      for (let i = 0; i < completeSamples; i++) {
        float32[i] = view.getInt16(i * 2, true) / 32768.0;
      }

      const buf    = ctx.createBuffer(1, completeSamples, SAMPLE_RATE);
      buf.copyToChannel(float32, 0);

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(gainNode);

      const playAt = Math.max(ctx.currentTime + 0.01, scheduleAt);
      src.start(playAt);
      if (onFirstChunk) { onFirstChunk(); onFirstChunk = undefined; }
      scheduleAt = playAt + buf.duration;

      leftover = chunk.slice(completeSamples * 2);
    }
  } finally {
    reader.releaseLock();
    const wait = Math.max(0, scheduleAt - ctx.currentTime) * 1000 + 200;
    setTimeout(() => ctx.close(), wait);
  }
}

export function useTTS() {
  const {
    currentSession, ttsEnabled, coachPersonality,
    ttsModel, ttsVolume, ttsSpeed, ttsVoice, edgeTtsVoice,
    llmProvider, openaiApiKey,
    ttsInterruptCount,
    setTtsPlayingMessageId,
  } = useStudyStore();

  const messages     = currentSession?.coachMessages ?? [];
  const lastMessage  = messages.at(-1);
  const lastSpokenId = useRef<string | null>(null);
  const abortRef     = useRef<AbortController | null>(null);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!lastMessage) return;

    // TTS 비활성화 시 즉시 표시
    if (!ttsEnabled) {
      setTtsPlayingMessageId(lastMessage.id);
      return;
    }

    if (lastMessage.id === lastSpokenId.current) return;
    lastSpokenId.current = lastMessage.id;

    abortRef.current?.abort();
    window.speechSynthesis?.cancel();
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);

    const text    = stripForTTS(lastMessage.text); // 이모티콘 제거 후 TTS 전달
    const msgId   = lastMessage.id;

    // 5초 폴백: TTS가 늦어도 텍스트는 반드시 표시
    fallbackTimer.current = setTimeout(() => setTtsPlayingMessageId(msgId), 5000);

    const onReady = () => {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
      setTtsPlayingMessageId(msgId);
    };

    if (llmProvider === 'anthropic') {
      // ── Edge TTS (Microsoft) ──────────────────────────────────
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      playEdgeTTS(text, edgeTtsVoice, ttsVolume, ctrl.signal, onReady).catch((err) => {
        if (err?.name === 'AbortError') return;
        console.warn('[TTS] Edge TTS 실패, 브라우저 TTS fallback:', err);
        setTtsPlayingMessageId(msgId);
        speakWithBrowser(text, coachPersonality, ttsVolume, ttsSpeed);
      });

    } else if (openaiApiKey) {
      // ── OpenAI TTS (PCM 스트리밍) ─────────────────────────────
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      streamPCMAudio(
        text, ttsVoice, ttsSpeed, ttsVolume, ttsModel, openaiApiKey,
        ctrl.signal, onReady,
      ).catch((err) => {
        if (err?.name === 'AbortError') return;
        console.warn('[TTS] OpenAI 스트리밍 실패, 브라우저 TTS fallback:', err);
        setTtsPlayingMessageId(msgId);
        speakWithBrowser(text, coachPersonality, ttsVolume, ttsSpeed);
      });

    } else {
      // ── 브라우저 TTS fallback ─────────────────────────────────
      setTtsPlayingMessageId(msgId);
      speakWithBrowser(text, coachPersonality, ttsVolume, ttsSpeed);
    }
  }, [lastMessage?.id, ttsEnabled, ttsModel, ttsVolume, ttsSpeed, ttsVoice,
      edgeTtsVoice, openaiApiKey, llmProvider, coachPersonality]);

  // 사용자가 채팅을 보내면 즉시 현재 TTS 중단
  useEffect(() => {
    if (ttsInterruptCount === 0) return;
    abortRef.current?.abort();
    window.speechSynthesis?.cancel();
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    // lastSpokenId 리셋 — 이후 새 코치 메시지가 오면 정상 재생
    lastSpokenId.current = null;
  }, [ttsInterruptCount]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);
}

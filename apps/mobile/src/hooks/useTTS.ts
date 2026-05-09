import { useEffect, useRef } from 'react';
import * as Speech from 'expo-speech';
import { useStudyStore } from '@/store/useStudyStore';

const TTS_VOICE_SETTINGS = {
  friend:  { rate: 1.05, pitch: 1.1 },
  teacher: { rate: 0.95, pitch: 0.95 },
  trainer: { rate: 1.15, pitch: 1.15 },
} as const;

export function useTTS() {
  const { currentSession, ttsEnabled, coachPersonality } = useStudyStore();
  const messages = currentSession?.coachMessages ?? [];
  const lastMessage = messages.at(-1);
  const lastSpokenId = useRef<string | null>(null);

  useEffect(() => {
    if (!ttsEnabled || !lastMessage) return;
    if (lastMessage.id === lastSpokenId.current) return;

    lastSpokenId.current = lastMessage.id;

    Speech.stop(); // 이전 발화 중단
    Speech.speak(lastMessage.text, {
      language: 'ko-KR',
      ...TTS_VOICE_SETTINGS[coachPersonality],
    });
  }, [lastMessage?.id, ttsEnabled]);

  useEffect(() => {
    return () => { Speech.stop(); };
  }, []);
}

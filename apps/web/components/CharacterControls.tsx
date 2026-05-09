'use client';

import { useStudyStore } from '@/store/useStudyStore';
import type { CoachPersonality } from '@study-coach/shared';

const CHARACTERS: { personality: CoachPersonality; emoji: string; label: string }[] = [
  { personality: 'boxing',     emoji: '🥊', label: '복싱코치' },
  { personality: 'strict_mom', emoji: '😤', label: '엄한엄마' },
  { personality: 'warm_mom',   emoji: '🤱', label: '따뜻한엄마' },
  { personality: 'mentor',     emoji: '🧙', label: '스승' },
  { personality: 'friend',     emoji: '👊', label: '친구' },
  { personality: 'teacher',    emoji: '📖', label: '선생님' },
  { personality: 'trainer',    emoji: '💪', label: '트레이너' },
];

export default function CharacterControls() {
  const { coachPersonality, setCoachPersonality } = useStudyStore();

  return (
    <div className="fixed left-3 top-1/2 -translate-y-1/2 flex flex-col items-center z-40 select-none">
      <div className="bg-card/80 backdrop-blur-sm border border-white/8 rounded-2xl px-2 py-3 flex flex-col items-center gap-1.5">
        {CHARACTERS.map(({ personality, emoji, label }) => {
          const active = coachPersonality === personality;
          return (
            <button
              key={personality}
              onClick={() => setCoachPersonality(personality)}
              title={label}
              className={[
                'flex flex-col items-center gap-0.5 w-12 py-1.5 rounded-xl transition-all duration-150',
                active
                  ? 'bg-primary/30 border border-primary/60'
                  : 'hover:bg-elevated border border-transparent',
              ].join(' ')}
            >
              <span className="text-xl leading-none">{emoji}</span>
              <span
                className={`text-[9px] leading-tight text-center font-medium ${
                  active ? 'text-primary' : 'text-[#5A5A7A]'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

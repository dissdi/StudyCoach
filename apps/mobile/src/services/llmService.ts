/**
 * llmService.ts (mobile)
 * @study-coach/shared의 llmService를 re-export합니다.
 */

export { generateCoachMessage, getMockCoachMessage } from '@study-coach/shared';

// 아래는 더 이상 사용하지 않음 — shared로 이전됨
import type { CoachContext, CoachMessage, CoachTone } from '@study-coach/shared';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// ─── 페르소나 프롬프트 ─────────────────────────────────────────────────
function getPersonaPrompt(personality: CoachContext['coachPersonality']): string {
  const personas = {
    friend: `당신은 친한 친구 같은 공부 코치입니다.
따뜻하고 격려하는 말투를 사용하고, 반말로 편하게 얘기해요.
예: "잠깐 졸았어? 괜찮아, 물 한 모금 마시고 다시 시작해보자!"`,
    teacher: `당신은 엄격하지만 공정한 선생님 같은 코치입니다.
존댓말을 사용하고, 명확한 피드백을 줍니다.
예: "집중력이 떨어지고 있습니다. 잠시 자세를 바로잡고 집중해 주세요."`,
    trainer: `당신은 열정적인 운동 트레이너 같은 코치입니다.
에너지 넘치는 응원과 동기부여를 합니다.
예: "아직 30분 남았어! 포기하지 마! 넌 할 수 있어!!🔥"`,
  };
  return personas[personality];
}

// ─── 시스템 프롬프트 생성 ─────────────────────────────────────────────
function buildSystemPrompt(ctx: CoachContext): string {
  return `${getPersonaPrompt(ctx.coachPersonality)}

[규칙]
- 메시지는 반드시 1~2문장, 50자 이내로 짧고 임팩트 있게 작성하세요.
- 지금 상황에 딱 맞는 구체적인 코멘트만 하세요.
- 같은 말 반복 금지.
- JSON 형식 없이 텍스트만 반환하세요.`;
}

// ─── 유저 프롬프트 생성 ───────────────────────────────────────────────
function buildUserPrompt(ctx: CoachContext): string {
  const { concentrationScore, emotion, studyDurationSec, subject } = ctx;
  const mins = Math.floor(studyDurationSec / 60);
  const secs = studyDurationSec % 60;

  const emotionLabel: Record<string, string> = {
    focused: '집중 중',
    tired: '졸음/피로',
    stressed: '스트레스',
    happy: '의욕 높음',
    absent: '자리 비움',
    unknown: '감지 불가',
  };

  return `현재 공부 상황:
- 과목: ${subject}
- 공부 시간: ${mins}분 ${secs}초
- 집중도 점수: ${concentrationScore}/100
- 감정 상태: ${emotionLabel[emotion] ?? emotion}

이 상황에 맞는 코칭 메시지를 한국어로 1~2문장 작성해 주세요.`;
}

// ─── 톤 판별 헬퍼 ─────────────────────────────────────────────────────
function determineTone(ctx: CoachContext): CoachTone {
  if (ctx.concentrationScore >= 70) return 'encouraging';
  if (ctx.emotion === 'tired' || ctx.emotion === 'absent') return 'strict';
  return 'calm';
}

// ─── 메인 API 호출 ────────────────────────────────────────────────────
export async function generateCoachMessage(
  ctx: CoachContext,
  apiKey: string
): Promise<CoachMessage> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 150,
      system: buildSystemPrompt(ctx),
      messages: [
        {
          role: 'user',
          content: buildUserPrompt(ctx),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text: string = data?.content?.[0]?.text ?? '잘 하고 있어요! 계속 집중하세요.';

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    text: text.trim(),
    tone: determineTone(ctx),
    trigger: ctx.emotion === 'tired'
      ? 'tired'
      : ctx.emotion === 'absent'
      ? 'absent'
      : ctx.concentrationScore < 40
      ? 'low_focus'
      : ctx.concentrationScore >= 80
      ? 'good_job'
      : 'milestone',
    timestamp: Date.now(),
  };
}

// ─── Mock (API 키 없을 때 테스트용) ──────────────────────────────────
export function getMockCoachMessage(ctx: CoachContext): CoachMessage {
  const messages: Record<string, string[]> = {
    tired: [
      '잠깐 졸았지? 물 한 잔 마시고 다시 힘내보자!',
      '눈이 피로한 것 같아. 20초 동안 멀리 바라봐 봐.',
    ],
    absent: [
      '어디 갔어? 빨리 돌아와서 다시 시작하자!',
      '잠깐 자리 비웠구나. 준비되면 다시 시작해!',
    ],
    low_focus: [
      '집중력이 살짝 떨어지고 있어. 자세 한번 바로잡아봐!',
      '딴생각 하고 있지? 다시 책으로 눈 돌려봐!',
    ],
    good_job: [
      '완전 집중 중이잖아! 이 느낌 유지해!🔥',
      '오늘 컨디션 최고다! 계속 달리자!',
    ],
    default: [
      '잘 하고 있어! 조금만 더 집중해봐.',
      '25분 공부 후엔 5분 쉬는 거 기억해!',
    ],
  };

  const key =
    ctx.emotion === 'tired'
      ? 'tired'
      : ctx.emotion === 'absent'
      ? 'absent'
      : ctx.concentrationScore < 40
      ? 'low_focus'
      : ctx.concentrationScore >= 80
      ? 'good_job'
      : 'default';

  const pool = messages[key];
  const text = pool[Math.floor(Math.random() * pool.length)];

  return {
    id: `mock-${Date.now()}`,
    text,
    tone: determineTone(ctx),
    trigger: key === 'low_focus' ? 'low_focus' : key === 'good_job' ? 'good_job' : (key as any),
    timestamp: Date.now(),
  };
}

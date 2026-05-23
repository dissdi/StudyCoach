import type { CoachContext, CoachMessage, CoachTone, MinuteReport, LLMCoachDecision, CoachPersonality, ConversationTurn } from './types';
import { OPENAI_MODEL_DEFAULT, ANTHROPIC_MODEL_DEFAULT } from './constants';

const OPENAI_API_URL    = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// ─── 시간 포맷 헬퍼 ──────────────────────────────────────────────────────

/** 현재 시각을 "오전/오후 HH:MM" 형식으로 반환 */
function formatNow(): string {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  const period = h < 12 ? '오전' : '오후';
  const h12 = h % 12 || 12;
  return `${period} ${h12}:${m}`;
}

/** 초를 "X시간 Y분" 또는 "Y분 Z초" 형식으로 변환 */
function formatDuration(totalSec: number): string {
  const h   = Math.floor(totalSec / 3600);
  const m   = Math.floor((totalSec % 3600) / 60);
  const s   = totalSec % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  if (m > 0) return `${m}분 ${s > 0 ? s + '초' : ''}`.trim();
  return `${s}초`;
}

/** 모델 ID로 프로바이더를 자동 감지 */
function detectProvider(model: string): 'openai' | 'anthropic' {
  return model.startsWith('claude') ? 'anthropic' : 'openai';
}

/** 모델에 맞는 기본값 반환 */
export function getDefaultModel(provider: 'openai' | 'anthropic'): string {
  return provider === 'anthropic' ? ANTHROPIC_MODEL_DEFAULT : OPENAI_MODEL_DEFAULT;
}

function getPersonaPrompt(personality: CoachContext['coachPersonality']): string {
  const personas: Record<CoachContext['coachPersonality'], string> = {
    friend:     `당신은 친한 친구 같은 공부 코치입니다. 따뜻하고 격려하는 말투, 반말로 편하게 얘기해요.`,
    teacher:    `당신은 엄격하지만 공정한 선생님 같은 코치입니다. 존댓말, 명확한 피드백을 줍니다.`,
    trainer:    `당신은 열정적인 운동 트레이너 같은 코치입니다. 에너지 넘치는 응원과 동기부여를 합니다.`,
    boxing:     `당신은 복싱 코치입니다. 짧고 강렬하게, 반말로. 선수를 링에 세우듯 강하게 밀어붙이고 자극합니다. 약한 소리는 없습니다.`,
    strict_mom: `당신은 엄한 엄마입니다. 반말, 잔소리 같지만 사랑이 담긴 압박. 걱정과 기대가 동시에 담긴 말투로 공부를 독촉합니다.`,
    warm_mom:   `당신은 자상하고 자식을 믿는 엄마입니다. 반말, 따뜻하게 지지하고 믿어줍니다. 힘들어도 옆에 있어준다는 느낌의 말투.`,
    mentor:     `당신은 제자를 엄히 가르치는 스승입니다. 존댓말, 원칙과 기대가 높습니다. 칭찬은 드물지만 진심이고, 질책은 성장을 위한 것입니다.`,
  };
  return personas[personality];
}

function buildSystemPrompt(ctx: CoachContext): string {
  return `${getPersonaPrompt(ctx.coachPersonality)}
[규칙] 메시지는 1~2문장, 50자 이내. 지금 상황에 딱 맞게. 같은 말 반복 금지. 이모티콘·특수기호 사용 금지. 텍스트만 반환.`;
}

function buildUserPrompt(ctx: CoachContext): string {
  const mins = Math.floor(ctx.studyDurationSec / 60);
  const stateLabel: Record<string, string> = {
    present: '집중 중', tired: '졸음', absent: '자리비움', unknown: '감지 불가',
  };
  return `과목: ${ctx.subject} | 공부 시간: ${mins}분 | 상태: ${stateLabel[ctx.faceState] ?? ctx.faceState}\n맞춤 코칭 메시지를 한국어로 작성해 주세요.`;
}

function determineTone(ctx: CoachContext): CoachTone {
  if (ctx.faceState === 'tired' || ctx.faceState === 'absent') return 'strict';
  return 'encouraging';
}

export async function generateCoachMessage(ctx: CoachContext, apiKey: string, model: string = OPENAI_MODEL_DEFAULT): Promise<CoachMessage> {
  const text = await callLLM(buildSystemPrompt(ctx), buildUserPrompt(ctx), apiKey, 150, model)
    .then((t) => t.trim() || '잘 하고 있어요! 계속 집중하세요.');

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    text,
    tone: determineTone(ctx),
    trigger: ctx.faceState === 'tired' ? 'tired'
      : ctx.faceState === 'absent' ? 'absent'
      : 'milestone',
    timestamp: Date.now(),
  };
}

// ─── 1분 단위 분석 (메인 코칭 로직) ──────────────────────────────────

function buildMinuteSystemPrompt(personality: CoachContext['coachPersonality']): string {
  const personas: Record<CoachPersonality, string> = {
    friend:     '당신은 친한 친구 같은 공부 코치입니다. 반말, 따뜻한 말투.',
    teacher:    '당신은 엄격하지만 공정한 선생님 코치입니다. 존댓말, 명확한 피드백.',
    trainer:    '당신은 열정적인 트레이너 코치입니다. 에너지 넘치는 응원.',
    boxing:     '당신은 복싱 코치입니다. 반말, 짧고 강렬하게. 자극과 압박으로 선수를 깨웁니다.',
    strict_mom: '당신은 엄한 엄마입니다. 반말, 걱정과 사랑이 담긴 잔소리. 공부 안 하면 참지 않습니다.',
    warm_mom:   '당신은 자상한 엄마입니다. 반말, 믿고 지지해줍니다. 힘들어도 네 편이라는 따뜻함.',
    mentor:     '당신은 제자를 엄히 가르치는 스승입니다. 존댓말, 높은 기준과 원칙. 칭찬은 드물지만 진심.',
  };

  return `${personas[personality]}

당신은 학생의 공부 상태를 정해진 주기마다 확인하고, 매번 반드시 코칭 메시지를 작성합니다.
"이번엔 할 말이 없다"는 없습니다. 상황에 맞게 항상 한 마디를 건네세요.

[상황별 메시지 지침]
- 모두 present(정상 집중): 짧게 칭찬하거나 집중을 유지시키는 따뜻한 한 마디
- tired 간헐적: 졸음을 가볍게 짚어주며 각성 유도
- tired 지속 or absent: 명확하게 경고하고 복귀/각성 촉구
- 직전 메시지와 상황이 같으면: 같은 말 반복 금지 — 다른 표현이나 관점으로 변화 줄 것
- 사용자가 "집중 잘 돼", "혼자 할게" 등을 말했다면: nextCheckSec을 반드시 200 이상으로 설정하고, 메시지는 아주 짧게 응원만 할 것
- 사용자가 "집중이 안 돼"를 말했다면: nextCheckSec을 반드시 15로 설정하고, 집중을 강하게 유도할 것

[nextCheckSec — 다음 체크까지의 간격 결정]
totalStudyMinutes를 반드시 참고하세요:
- 0~10분 (워밍업): nextCheckSec=25~35
- 10~40분 (플로우, present 지속): nextCheckSec=120~180 (집중 방해 최소화)
- 40~60분 (피로 시작): nextCheckSec=50~70
- 60분 이상 (장기): nextCheckSec=25~40
- tired 간헐적: nextCheckSec=40~60
- tired 지속 or absent: nextCheckSec=20~30

[응답 형식] 반드시 JSON만 반환하세요 (다른 텍스트 없이). message 값에 이모티콘·특수기호 사용 금지:
{"message": "코칭 메시지 (1~2문장, 50자 이내)", "tone": "strict|calm|encouraging", "nextCheckSec": 60}`;
}

function buildMinuteUserPrompt(report: MinuteReport): string {
  const stateLabel: Record<string, string> = {
    present: '정상', tired: '졸음', absent: '자리비움', unknown: '감지불가',
  };

  const dataStr = report.dataPoints.map((p) =>
    `  +${p.offsetSec}초: 상태 ${stateLabel[p.faceState] ?? p.faceState}, 눈개방도 ${(p.eyeOpenAvg * 100).toFixed(0)}%`
  ).join('\n');

  const recentMsgStr = report.recentMessages.length > 0
    ? `\n직전 코치 메시지: "${report.recentMessages.at(-1)?.text}"`
    : '';

  const recentUserChatStr = report.recentUserChats && report.recentUserChats.length > 0
    ? `\n\n[사용자가 방금 한 말 — 최우선으로 반영하세요]\n${report.recentUserChats.map((c) => `- "${c}"`).join('\n')}`
    : '';

  const adjustmentStr = report.userAdjustments && report.userAdjustments.length > 0
    ? `\n\n[사용자 요청사항 — 반드시 반영하세요]\n${report.userAdjustments.map((a) => `- ${a}`).join('\n')}`
    : '';

  const intervalInfo = report.currentCheckIntervalSec
    ? ` | 현재 체크 간격: ${report.currentCheckIntervalSec}초`
    : '';

  const goalInfo = report.goalDurationMinutes
    ? (() => {
        const remain = report.goalRemainingMinutes ?? 0;
        return remain > 0
          ? ` | 목표: ${report.goalDurationMinutes}분 (${remain}분 남음)`
          : ` | 목표: ${report.goalDurationMinutes}분 (목표 달성!)`;
      })()
    : '';

  const nowStr      = formatNow();
  const durationStr = formatDuration(report.totalStudySeconds);

  return `[최근 공부 데이터 — ${report.dataPoints.length}개 포인트, ${(report.dataPoints.length - 1) * 10}초 커버]
현재 시각: ${nowStr} | 과목: ${report.subject} | 총 공부시간: ${durationStr}(${report.totalStudyMinutes}분)${goalInfo}${intervalInfo}
${dataStr}${recentMsgStr}${recentUserChatStr}${adjustmentStr}

이 데이터를 분석해서 코칭이 필요한지 판단하고, 다음 체크까지의 적절한 간격(nextCheckSec)도 함께 JSON으로 응답하세요.`;
}

// 브라우저에서는 CORS 때문에 외부 API 직접 호출 불가
// → Next.js /api/llm 프록시를 경유, 서버(Node.js)에서는 직접 호출
const isBrowser = typeof window !== 'undefined';
const LLM_PROXY_URL = '/api/llm';

async function callViaProxy(
  provider: 'openai' | 'anthropic',
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  maxTokens: number,
): Promise<string> {
  const response = await fetch(LLM_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, apiKey, model, systemPrompt, messages, maxTokens }),
  });
  if (!response.ok) throw new Error(`LLM proxy error ${response.status}`);
  const data = await response.json();
  return data?.text ?? '';
}

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  maxTokens: number,
  model: string = OPENAI_MODEL_DEFAULT,
): Promise<string> {
  const provider = detectProvider(model);
  const messages = [{ role: 'user' as const, content: userPrompt }];

  // 브라우저: CORS 회피를 위해 서버 프록시 경유
  if (isBrowser) {
    return callViaProxy(provider, apiKey, model, systemPrompt, messages, maxTokens);
  }

  // 서버(Node.js): 외부 API 직접 호출
  if (provider === 'anthropic') {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system: systemPrompt, messages }),
    });
    if (!response.ok) throw new Error(`Anthropic API error ${response.status}`);
    const data = await response.json();
    return data?.content?.[0]?.text ?? '';
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_completion_tokens: maxTokens,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI API error ${response.status}`);
  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

// 멀티턴 대화 히스토리를 지원하는 LLM 호출
async function callLLMWithHistory(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  apiKey: string,
  maxTokens: number,
  model: string = OPENAI_MODEL_DEFAULT,
): Promise<string> {
  const provider = detectProvider(model);

  // 브라우저: CORS 회피를 위해 서버 프록시 경유
  if (isBrowser) {
    return callViaProxy(provider, apiKey, model, systemPrompt, messages, maxTokens);
  }

  // 서버(Node.js): 외부 API 직접 호출
  if (provider === 'anthropic') {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system: systemPrompt, messages }),
    });
    if (!response.ok) throw new Error(`Anthropic API error ${response.status}`);
    const data = await response.json();
    return data?.content?.[0]?.text ?? '';
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_completion_tokens: maxTokens,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI API error ${response.status}`);
  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

export async function analyzeMinuteAndCoach(
  report: MinuteReport,
  apiKey: string,
  model: string = OPENAI_MODEL_DEFAULT,
): Promise<LLMCoachDecision> {
  const systemPrompt = buildMinuteSystemPrompt(report.coachPersonality);
  const userPrompt   = buildMinuteUserPrompt(report);

  // ── 브라우저 콘솔에서 LLM 입출력 확인용 로그 ──
  console.group(`%c[Coach→LLM] 주기 분석 (${model})`, 'color:#7c3aed;font-weight:bold');
  console.log('%c■ System Prompt', 'color:#059669;font-weight:bold');
  console.log(systemPrompt);
  console.log('%c■ User Prompt', 'color:#2563eb;font-weight:bold');
  console.log(userPrompt);
  console.groupEnd();

  const raw = await callLLM(systemPrompt, userPrompt, apiKey, 300, model);

  console.group(`%c[LLM→Coach] 응답`, 'color:#d97706;font-weight:bold');
  console.log('%c■ Raw Response', 'color:#dc2626;font-weight:bold');
  console.log(raw);
  console.groupEnd();

  try {
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
    const parsed  = JSON.parse(jsonStr) as Partial<LLMCoachDecision> & { message?: string };
    const message = typeof parsed.message === 'string' && parsed.message.trim()
      ? parsed.message.trim()
      : null;

    const decision = {
      needsCoaching: !!message,   // 메시지가 있으면 항상 코칭으로 처리
      message,
      tone: parsed.tone ?? 'calm',
      nextCheckSec: typeof parsed.nextCheckSec === 'number' ? parsed.nextCheckSec : undefined,
      isQuestion: parsed.isQuestion === true,
    };

    console.log(
      `%c[LLM→Coach] 파싱 결과 → message: "${decision.message ?? '없음'}" | tone: ${decision.tone} | nextCheckSec: ${decision.nextCheckSec ?? '미설정'}`,
      'color:#7c3aed',
    );

    return decision;
  } catch {
    console.warn('[LLM→Coach] JSON 파싱 실패, 기본값 반환');
    return { needsCoaching: false, message: null, tone: 'calm' };
  }
}

// ─── 휴식 후 코너 코치 메시지 ────────────────────────────────────────

const CORNER_COACH_PERSONAS: Record<CoachPersonality, string> = {
  friend:     '너는 쉬고 나서 다시 달리려는 친구를 응원하는 절친이야. 반말, 따뜻하지만 에너지 넘치게.',
  teacher:    '너는 선수가 코너에서 쉬고 나올 때 전략을 짚어주는 코치야. 존댓말, 명확하고 힘있게.',
  trainer:    '너는 복싱 코너맨이야. 선수가 링에 다시 나갈 때 짧고 강렬하게 불을 붙여줘. 에너지 폭발.',
  boxing:     '너는 링사이드 복싱 코치야. 휴식 끝. 이제 링으로 나가는 선수한테 짧고 강하게 불 질러줘.',
  strict_mom: '너는 엄한 엄마야. 쉬었으면 이제 공부해야지. 반말로 단호하게, 사랑이 담긴 압박.',
  warm_mom:   '너는 자상한 엄마야. 잘 쉬었지? 이제 다시 시작해. 반말로 따뜻하게 응원해줘.',
  mentor:     '너는 제자를 엄히 가르치는 스승이야. 휴식 후 복귀를 격려하되, 존댓말로 원칙 있게.',
};

function buildCornerCoachSystemPrompt(personality: CoachPersonality): string {
  return `${CORNER_COACH_PERSONAS[personality]}

[규칙] 1~2문장, 50자 이내. 지금 막 휴식을 끝내고 다시 공부를 시작하는 순간에 맞는 메시지.
집중력이 올라가고 있으면 칭찬, 떨어졌으면 자극. 이모티콘·특수기호 사용 금지. 텍스트만 반환.`;
}

function buildCornerCoachUserPrompt(stats: {
  totalMinutes: number;
  subject: string;
  restMinutes: number;
}): string {
  return `현재 시각: ${formatNow()} | 과목: ${stats.subject} | 총 공부시간: ${stats.totalMinutes}분 | 방금 ${stats.restMinutes}분 휴식 완료.
이제 다시 공부를 시작합니다. 이 상황에 딱 맞는 동기부여 메시지를 한국어로 작성하세요.`;
}

export async function generateCornerCoachMessage(
  stats: { totalMinutes: number; subject: string; restMinutes: number },
  personality: CoachPersonality,
  apiKey: string,
  model: string = OPENAI_MODEL_DEFAULT,
): Promise<string> {
  try {
    const raw = await callLLM(
      buildCornerCoachSystemPrompt(personality),
      buildCornerCoachUserPrompt(stats),
      apiKey,
      150,
      model,
    );
    return raw.trim() || mockCornerCoachMessage(personality);
  } catch {
    return mockCornerCoachMessage(personality);
  }
}

export function mockCornerCoachMessage(personality: CoachPersonality): string {
  const msgs: Record<CoachPersonality, string[]> = {
    friend:     ['쉬고 나니까 더 잘할 수 있겠지! 달려봐!', '다시 시작하자! 할 수 있어!'],
    teacher:    ['휴식이 끝났습니다. 집중해서 시작해요.', '다시 시작할 준비가 됐죠? 가봅시다.'],
    trainer:    ['휴식 끝! 이제 전력 질주! 가자!', '충전 완료! 더 강하게 달려봐!'],
    boxing:     ['코너 끝! 링으로 나가! 이제 전부 쏟아내!', '쉬었으면 됐어. 다시 싸워!'],
    strict_mom: ['그만 쉬고 이제 공부해. 시간 다 갔잖아!', '쉬었으니까 이제 제대로 해봐.'],
    warm_mom:   ['잘 쉬었지? 이제 다시 해보자, 잘 할 수 있어!', '충분히 쉬었어. 엄마가 응원할게!'],
    mentor:     ['충분히 쉬었습니다. 이제 다시 정진하세요.', '휴식이 끝났습니다. 마음을 가다듬고 시작하세요.'],
  };
  const pool = msgs[personality];
  return pool[Math.floor(Math.random() * pool.length)];
}

// Mock 버전 (API 키 없을 때)
export function mockAnalyzeMinute(report: MinuteReport): LLMCoachDecision {
  const points = report.dataPoints;
  if (points.length === 0) return { needsCoaching: false, message: null, tone: 'calm', nextCheckSec: 60 };

  const absentCount = points.filter((p) => p.faceState === 'absent').length;
  const tiredCount  = points.filter((p) => p.faceState === 'tired').length;

  const nextCheckSec =
    absentCount >= 2 || tiredCount >= 2 ? 20 :
    tiredCount >= 1 ? 45 :
    120; // 모두 present → 2분 후 확인

  if (absentCount >= Math.ceil(points.length * 0.5)) {
    return { needsCoaching: true, message: '자리 비운 시간이 너무 길어. 돌아와서 다시 시작하자!', tone: 'strict', nextCheckSec: 20 };
  }

  if (tiredCount >= Math.ceil(points.length * 0.4)) {
    return { needsCoaching: true, message: '많이 졸린 것 같아. 물 한 잔 마시고 기지개 켜봐!', tone: 'calm', nextCheckSec: 25 };
  }

  return { needsCoaching: false, message: null, tone: 'calm', nextCheckSec };
}

// ─── 사용자 채팅 메시지에 대한 직접 응답 ─────────────────────────────

function buildDirectReplySystemPrompt(
  personality: CoachPersonality,
  context: { subject: string; studyDurationSec: number; goalDurationSec?: number },
): string {
  const personas: Record<CoachPersonality, string> = {
    friend:     '너는 공부 중인 친구의 실시간 공부 코치야. 친구가 채팅으로 말을 걸었어. 반말로 자연스럽게, 짧게 답해줘.',
    teacher:    '당신은 학생의 공부 코치입니다. 학생이 채팅으로 질문이나 말을 걸었습니다. 존댓말로 간결하게 답해주세요.',
    trainer:    '너는 열정적인 공부 트레이너야. 훈련생이 말을 걸었어. 짧고 에너지 넘치게 답해줘.',
    boxing:     '너는 복싱 코치야. 선수가 링사이드에서 말을 걸었어. 반말로 짧고 강하게 답해줘. 약한 말은 없어.',
    strict_mom: '너는 엄한 엄마야. 아이가 공부 중에 말을 걸었어. 반말로 걱정과 사랑이 담긴 잔소리 섞어서 답해줘.',
    warm_mom:   '너는 자상한 엄마야. 아이가 공부 중에 말을 걸었어. 반말로 따뜻하고 지지하는 말투로 답해줘.',
    mentor:     '당신은 제자를 엄히 가르치는 스승입니다. 제자가 말을 걸었습니다. 존댓말로 원칙 있게, 간결하게 답해주세요.',
  };

  const durationStr = formatDuration(context.studyDurationSec);
  const goalMins    = context.goalDurationSec ? Math.floor(context.goalDurationSec / 60) : null;
  const doneMins    = Math.floor(context.studyDurationSec / 60);
  const remainMins  = goalMins !== null ? Math.max(0, goalMins - doneMins) : null;
  const timeInfo    = goalMins !== null
    ? `공부시간: ${durationStr} / 목표: ${goalMins}분 (남은 시간: ${remainMins}분)`
    : `공부시간: ${durationStr}`;

  return `${personas[personality]}
[현재 세션 상황] 현재 시각: ${formatNow()} | 과목: ${context.subject} | ${timeInfo}
[규칙] message는 2~3문장 이내. 대화 흐름을 기억하며 자연스럽게 이어서 대화. 이모티콘·특수기호 사용 금지.
[집중 보고 시 특별 규칙] 학생이 "집중 잘 된다", "잘 되는 것 같다", "잘 하고 있다" 등 집중 상태를 긍정적으로 보고하면:
- 목표 시간이 있을 경우: 반드시 목표 대비 현재 진행 시간과 남은 시간을 구체적으로 언급하며 격려할 것. 예) "너 30분 한다고 했잖아, 지금 25분 했어. 5분만 더 하면 돼!"
- 목표 시간이 없을 경우: 간단히 격려하고 계속 집중하도록 유도할 것.

[nextCheckSec — 다음 주기 체크까지의 간격(초)을 직접 결정하세요]
사용자의 채팅 내용과 현재 공부 맥락을 보고, 다음 자동 체크를 얼마 뒤에 할지 15~300초 범위에서 정하세요.
가이드:
- 학생이 "집중 잘 된다", "혼자 할게", "방해하지 마" 류 — 흐름을 끊지 말 것. nextCheckSec=200~300
- 학생이 "집중 안 된다", "졸리다", "산만하다", "도와줘" 류 — 자주 챙길 것. nextCheckSec=15~30
- 질문/잡담/중립적 보고 — 보통 페이스 유지. nextCheckSec=45~90
- 워밍업 초반(공부시간 10분 미만)에는 25~40 권장
- 장시간(60분 이상)에는 30~50 권장
값은 정수. 확신이 없으면 60을 기본값으로.

[응답 형식] 반드시 아래 JSON만 반환하세요 (코드블록·다른 텍스트 없이). message에 이모티콘·특수기호 사용 금지:
{"message": "코칭 답변 텍스트", "tone": "strict|calm|encouraging", "nextCheckSec": 60}`;
}

export async function generateDirectCoachResponse(
  userMessage: string,
  context: {
    subject: string;
    studyDurationSec: number;
    goalDurationSec?: number;
    personality: CoachPersonality;
  },
  apiKey: string,
  model: string = OPENAI_MODEL_DEFAULT,
  conversationHistory?: ConversationTurn[],
): Promise<{ text: string; tone: CoachTone; nextCheckSec?: number }> {
  console.log('[generateDirectCoachResponse] apiKey 앞 4자:', apiKey?.slice(0, 4) || '(없음)', '| model:', model);
  try {
    const systemPrompt = buildDirectReplySystemPrompt(context.personality, context);
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...(conversationHistory ?? []),
      { role: 'user', content: userMessage },
    ];

    console.group(`%c[DirectReply→LLM] (${model})`, 'color:#7c3aed;font-weight:bold');
    console.log('%c■ System Prompt', 'color:#059669;font-weight:bold');
    console.log(systemPrompt);
    console.log('%c■ User Message', 'color:#2563eb;font-weight:bold');
    console.log(userMessage);
    console.groupEnd();

    const raw = await callLLMWithHistory(systemPrompt, messages, apiKey, 250, model);

    console.group(`%c[LLM→DirectReply] 응답`, 'color:#d97706;font-weight:bold');
    console.log('%c■ Raw Response', 'color:#dc2626;font-weight:bold');
    console.log(raw);
    console.groupEnd();

    // JSON 파싱 시도
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
    if (jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr) as {
          message?: string;
          tone?: CoachTone;
          nextCheckSec?: number;
        };
        const text = typeof parsed.message === 'string' && parsed.message.trim()
          ? parsed.message.trim()
          : mockDirectReply(userMessage, context);
        const tone: CoachTone = parsed.tone ?? 'encouraging';
        const nextCheckSec =
          typeof parsed.nextCheckSec === 'number' && Number.isFinite(parsed.nextCheckSec)
            ? parsed.nextCheckSec
            : undefined;
        console.log(
          `%c[LLM→DirectReply] 파싱 결과 → text: "${text}" | tone: ${tone} | nextCheckSec: ${nextCheckSec ?? '미설정'}`,
          'color:#7c3aed',
        );
        return { text, tone, nextCheckSec };
      } catch {
        // JSON 파싱 실패 → raw 텍스트를 그대로 사용 (하위 호환)
      }
    }

    const text = raw.trim() || mockDirectReply(userMessage, context);
    return { text, tone: 'encouraging' as CoachTone };
  } catch (err) {
    console.error('[generateDirectCoachResponse] LLM 호출 실패:', err);
    return { text: mockDirectReply(userMessage, context), tone: 'calm' };
  }
}

export function mockDirectReply(
  userMessage: string,
  context?: { studyDurationSec?: number; goalDurationSec?: number },
): string {
  const lower = userMessage.toLowerCase();
  if (lower.includes('힘들') || lower.includes('지쳐') || lower.includes('못하겠'))
    return '잠깐 쉬어가도 괜찮아. 지금까지 잘 해왔어, 조금만 더 버텨봐!';
  if (lower.includes('모르겠') || lower.includes('어렵'))
    return '어려운 부분에서 막혔구나. 잠깐 다른 부분 보다가 돌아오는 것도 방법이야!';
  if (lower.includes('잘') || lower.includes('집중')) {
    const goalMins = context?.goalDurationSec ? Math.floor(context.goalDurationSec / 60) : null;
    const doneMins = context?.studyDurationSec ? Math.floor(context.studyDurationSec / 60) : null;
    if (goalMins && doneMins !== null) {
      const remain = Math.max(0, goalMins - doneMins);
      if (remain > 0)
        return `잘 하고 있어! 너 ${goalMins}분 한다고 했잖아, 지금 ${doneMins}분 했어. ${remain}분만 더 하면 돼!`;
      return `목표 ${goalMins}분 다 채웠어! 오늘 진짜 잘 했다!`;
    }
    return '그 에너지 그대로 유지해! 지금 완전 잘 하고 있어.';
  }
  return '응, 알았어! 지금 하던 거 계속 집중해봐. 잘 하고 있어.';
}

// ─── 휴식 기간 코칭 ──────────────────────────────────────────────────
function buildRestStartSystemPrompt(personality: CoachPersonality): string {
  const personas: Record<CoachPersonality, string> = {
    friend:     '너는 친한 친구 같은 공부 코치야. 따뜻하고 편안하게 휴식을 권유해줘.',
    teacher:    '너는 경험 많은 선생님 같은 공부 코치야. 차분하고 현명하게 휴식의 중요성을 말해줘.',
    trainer:    '너는 열정적인 트레이너 같은 코치야. 활기차고 긍정적으로 휴식을 격려해줘.',
    boxing:     '너는 복싱 코치야. 라운드 끝. 코너에서 쉬라고 짧고 강하게 말해줘.',
    strict_mom: '너는 엄한 엄마야. 그래도 쉬어야 한다고 반말로 단호하게 말해줘. 쉬는 것도 공부야.',
    warm_mom:   '너는 자상한 엄마야. 수고했다고 반말로 따뜻하게 말하고, 푹 쉬라고 응원해줘.',
    mentor:     '당신은 스승입니다. 존댓말로 차분하게, 휴식도 수련의 일부임을 일깨워주세요.',
  };
  return `${personas[personality]}
[규칙] 2~3문장 이내. 쉬는 시간을 알려주고 잘 쉬라고 격려해줘. 이모티콘·특수기호 사용 금지. 텍스트만 반환.`;
}

function buildRestMilestoneSystemPrompt(personality: CoachPersonality): string {
  const personas: Record<CoachPersonality, string> = {
    friend:     '너는 친한 친구 같은 공부 코치야. 곧 공부 재개를 부드럽게 알려줘.',
    teacher:    '너는 경험 많은 선생님 같은 코치야. 차분하게 복귀를 준비시켜줘.',
    trainer:    '너는 열정적인 트레이너 같은 코치야. 에너지 있게 다시 시작을 독려해줘.',
    boxing:     '너는 복싱 코치야. 곧 라운드 시작이야. 짧고 강하게 선수를 깨워줘.',
    strict_mom: '너는 엄한 엄마야. 이제 그만 쉬고 공부해야 한다고 반말로 단호하게 알려줘.',
    warm_mom:   '너는 자상한 엄마야. 슬슬 준비하라고 반말로 다정하게 알려줘.',
    mentor:     '당신은 스승입니다. 존댓말로 차분하게, 복귀를 준비하도록 이르세요.',
  };
  return `${personas[personality]}
[규칙] 1~2문장 이내. 너무 길지 않게. 이모티콘·특수기호 사용 금지. 텍스트만 반환.`;
}

export async function generateRestStartMessage(
  stats: {
    restDurationSec: number;
    subject: string;
    totalMinutes: number;
  },
  personality: CoachPersonality,
  apiKey: string,
  model: string = OPENAI_MODEL_DEFAULT,
): Promise<string> {
  const mins = Math.round(stats.restDurationSec / 60);
  const userPrompt = `[상황] 현재 시각: ${formatNow()} | 과목: ${stats.subject} | 공부시간: ${stats.totalMinutes}분
${mins}분 휴식이 시작됐어. 수고했다고 말하고, ${mins}분 동안 푹 쉬라고 자연스럽게 말해줘.`;
  try {
    const raw = await callLLM(buildRestStartSystemPrompt(personality), userPrompt, apiKey, 150, model);
    return raw.trim() || mockRestStartMessage(mins, personality);
  } catch {
    return mockRestStartMessage(mins, personality);
  }
}

export async function generateRestMilestoneMessage(
  milestone: '1min' | '10sec',
  stats: { subject: string; totalMinutes: number },
  personality: CoachPersonality,
  apiKey: string,
  model: string = OPENAI_MODEL_DEFAULT,
): Promise<string> {
  const milestoneDesc = milestone === '1min'
    ? '휴식 종료 1분 전이야. 슬슬 준비하라고 짧게 말해줘. 공부 열심히 했다는 것도 언급해도 좋아.'
    : '휴식 종료 10초 전이야. 집중 준비하라고 짧고 강하게 말해줘.';
  const userPrompt = `[상황] 현재 시각: ${formatNow()} | 과목: ${stats.subject} | 공부시간: ${stats.totalMinutes}분
${milestoneDesc}`;
  try {
    const raw = await callLLM(buildRestMilestoneSystemPrompt(personality), userPrompt, apiKey, 100, model);
    return raw.trim() || mockRestMilestoneMessage(milestone, personality);
  } catch {
    return mockRestMilestoneMessage(milestone, personality);
  }
}

export function mockRestStartMessage(restMins: number, personality: CoachPersonality): string {
  const msgs: Record<CoachPersonality, string[]> = {
    friend:     [
      `수고했어! 이제 ${restMins}분 동안 푹 쉬자. 쉬는 것도 공부야.`,
      `잠깐 쉬어가자! ${restMins}분 후에 다시 달리자.`,
    ],
    teacher:    [
      `지금까지 집중 잘 했어요. ${restMins}분 충분히 쉬고 다시 시작해요.`,
      `휴식도 학습의 일부입니다. ${restMins}분 후 다시 만나요.`,
    ],
    trainer:    [
      `굿! ${restMins}분 충전 타임! 제대로 쉬고 더 강하게 돌아와!`,
      `운동선수도 회복이 필수야. ${restMins}분 제대로 쉬어!`,
    ],
    boxing:     [
      `라운드 끝! ${restMins}분 쉬어. 물 마시고 다음 라운드 준비해!`,
      `코너 타임 ${restMins}분. 제대로 쉬고 더 강하게 나와!`,
    ],
    strict_mom: [
      `그래, ${restMins}분만 쉬어. 딱 ${restMins}분이야, 알겠지?`,
      `열심히 했으니까 ${restMins}분 쉬어. 근데 딱 ${restMins}분만이야.`,
    ],
    warm_mom:   [
      `수고했어, 우리 아이. ${restMins}분 동안 푹 쉬어, 잘 하고 있어.`,
      `잘했어! ${restMins}분 쉬면서 머리 식혀. 엄마가 기다릴게.`,
    ],
    mentor:     [
      `${restMins}분 쉬십시오. 쉼도 수련입니다. 마음을 고요히 하세요.`,
      `수고했습니다. ${restMins}분 후 다시 집중해주세요.`,
    ],
  };
  const pool = msgs[personality];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function mockRestMilestoneMessage(milestone: '1min' | '10sec', personality: CoachPersonality): string {
  if (milestone === '1min') {
    const msgs: Record<CoachPersonality, string> = {
      friend:     '이제 1분 남았어! 슬슬 준비해. 오늘 진짜 열심히 했어.',
      teacher:    '1분 후 재개합니다. 마음 준비하세요.',
      trainer:    '1분 남았다! 워밍업 시작!',
      boxing:     '1분 남았어! 링 나갈 준비 해!',
      strict_mom: '1분 남았어. 이제 슬슬 자리 잡아.',
      warm_mom:   '1분 있으면 돼. 천천히 준비해, 잘 할 수 있어.',
      mentor:     '1분 후 재개입니다. 자세를 가다듬으세요.',
    };
    return msgs[personality];
  } else {
    const msgs: Record<CoachPersonality, string> = {
      friend:     '10초 남았어! 집중 모드 ON!',
      teacher:    '10초 후 시작합니다. 집중!',
      trainer:    '10, 9, 8... 준비해! 집중!',
      boxing:     '10초! 가드 올려! 집중!',
      strict_mom: '10초야! 빨리 앉아!',
      warm_mom:   '10초! 자, 다시 시작하자.',
      mentor:     '10초 후 시작합니다. 마음을 집중하세요.',
    };
    return msgs[personality];
  }
}

// ─── 기존 즉시 코칭 (하위 호환) ──────────────────────────────────────
export function getMockCoachMessage(ctx: CoachContext): CoachMessage {
  const messages: Record<string, string[]> = {
    tired: ['잠깐 졸았지? 물 한 잔 마시고 다시 힘내보자!', '눈이 피로한 것 같아. 20초 멀리 바라봐 봐.'],
    absent: ['어디 갔어? 빨리 돌아와서 다시 시작하자!', '준비되면 다시 시작해!'],
    default: ['잘 하고 있어! 조금만 더 집중해봐.', '오늘도 수고 중이야!'],
  };

  const key = ctx.faceState === 'tired' ? 'tired'
    : ctx.faceState === 'absent' ? 'absent'
    : 'default';

  const pool = messages[key];
  return {
    id: `mock-${Date.now()}`,
    text: pool[Math.floor(Math.random() * pool.length)],
    tone: determineTone(ctx),
    trigger: key === 'tired' ? 'tired' : key === 'absent' ? 'absent' : 'milestone',
    timestamp: Date.now(),
  };
}

// ─── 목표 시간 마일스톤 코칭 ──────────────────────────────────────────

function buildGoalMilestoneSystemPrompt(personality: CoachPersonality): string {
  const personas: Record<CoachPersonality, string> = {
    friend:     '너는 친한 친구 같은 공부 코치야. 목표 시간이 얼마 안 남았을 때 짧게 응원해줘.',
    teacher:    '당신은 학생의 공부 코치입니다. 목표 달성이 가까워졌음을 간결하게 격려해주세요.',
    trainer:    '너는 열정적인 공부 트레이너야. 목표 마감이 가까울 때 에너지 넘치게 외쳐줘.',
    boxing:     '너는 복싱 코치야. 목표까지 얼마 안 남았어. 반말로 짧고 강하게 파이팅을 불어넣어줘.',
    strict_mom: '너는 엄한 엄마야. 목표가 코앞인데 지금 포기하면 안 된다고 반말로 압박해줘.',
    warm_mom:   '너는 자상한 엄마야. 거의 다 왔다고 반말로 따뜻하게 응원해줘.',
    mentor:     '당신은 스승입니다. 목표 달성이 임박했음을 존댓말로 간결하고 힘있게 전하세요.',
  };
  return `${personas[personality]}
[규칙] 1~2문장 이내. 남은 시간을 구체적으로 언급할 것. 이모티콘·특수기호 사용 금지. 텍스트만 반환.`;
}

function buildGoalMilestoneUserPrompt(
  milestone: '5min' | '1min' | 'reached',
  stats: { subject: string; totalMinutes: number; goalMinutes: number },
): string {
  const nowStr = formatNow();
  if (milestone === 'reached') {
    return `현재 시각: ${nowStr} | 과목: ${stats.subject} | 목표 ${stats.goalMinutes}분을 방금 달성했어! 총 ${stats.totalMinutes}분 공부했어. 달성 축하 메시지를 보내줘.`;
  }
  const remainLabel = milestone === '5min' ? '5분' : '1분';
  return `현재 시각: ${nowStr} | 과목: ${stats.subject} | 목표 ${stats.goalMinutes}분까지 ${remainLabel} 남았어. 총 공부 ${stats.totalMinutes}분 경과. 짧게 응원해줘.`;
}

export async function generateGoalMilestoneMessage(
  milestone: '5min' | '1min' | 'reached',
  stats: { subject: string; totalMinutes: number; goalMinutes: number },
  personality: CoachPersonality,
  apiKey: string,
  model: string = OPENAI_MODEL_DEFAULT,
): Promise<string> {
  try {
    const raw = await callLLM(
      buildGoalMilestoneSystemPrompt(personality),
      buildGoalMilestoneUserPrompt(milestone, stats),
      apiKey,
      120,
      model,
    );
    return raw.trim() || mockGoalMilestoneMessage(milestone, stats, personality);
  } catch {
    return mockGoalMilestoneMessage(milestone, stats, personality);
  }
}

export function mockGoalMilestoneMessage(
  milestone: '5min' | '1min' | 'reached',
  stats: { goalMinutes: number; totalMinutes?: number },
  personality: CoachPersonality,
): string {
  if (milestone === 'reached') {
    const msgs: Record<CoachPersonality, string> = {
      friend:     `${stats.goalMinutes}분 다 채웠어! 진짜 대박이야, 오늘 완전 잘 했다!`,
      teacher:    `목표 ${stats.goalMinutes}분을 달성했습니다. 훌륭한 집중력이었어요.`,
      trainer:    `목표 달성! ${stats.goalMinutes}분 완주! 최고다, 진짜 해냈어!`,
      boxing:     `KO! ${stats.goalMinutes}분 목표 달성! 진짜 싸웠다, 최고야!`,
      strict_mom: `그래, ${stats.goalMinutes}분 다 했네. 잘했어. 이제 정리해.`,
      warm_mom:   `${stats.goalMinutes}분 다 했어! 정말 잘했어, 우리 아이 최고야!`,
      mentor:     `${stats.goalMinutes}분 목표를 달성했습니다. 오늘의 정진, 충분히 값집니다.`,
    };
    return msgs[personality];
  }
  if (milestone === '5min') {
    const msgs: Record<CoachPersonality, string> = {
      friend:     `${stats.goalMinutes}분 목표까지 5분 남았어! 조금만 더 버텨봐!`,
      teacher:    `목표까지 5분 남았습니다. 마지막 스퍼트를 내봅시다.`,
      trainer:    `5분 남았다! 전력 질주할 시간이야, 포기하지 마!`,
      boxing:     `5분 남았어! 마지막 라운드야, 전부 다 쏟아내!`,
      strict_mom: `5분 남았어. 지금 집중 못하면 안 돼. 끝까지 해!`,
      warm_mom:   `5분만 더 하면 돼! 거의 다 왔어, 조금만 더 힘내!`,
      mentor:     `5분 남았습니다. 마지막까지 흔들리지 마세요.`,
    };
    return msgs[personality];
  }
  // 1min
  const msgs: Record<CoachPersonality, string> = {
    friend:     `1분만 더! 거의 다 왔어, 지금 포기하면 안 되지!`,
    teacher:    `1분 남았습니다. 집중력을 끝까지 유지하세요.`,
    trainer:    `1분! 마지막 1분이다! 전부 다 쏟아내!`,
    boxing:     `1분! 마지막이야! 모든 걸 던져!`,
    strict_mom: `1분이야! 지금 포기하면 후회해. 끝까지 해!`,
    warm_mom:   `1분만 더! 할 수 있어, 엄마가 믿어!`,
    mentor:     `1분 남았습니다. 끝까지 흔들림 없이 나아가세요.`,
  };
  return msgs[personality];
}

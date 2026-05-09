import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_URL    = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export async function POST(request: NextRequest) {
  const { provider, apiKey, model, systemPrompt, messages, maxTokens } = await request.json();

  if (!apiKey)   return NextResponse.json({ error: 'apiKey required' }, { status: 400 });
  if (!model)    return NextResponse.json({ error: 'model required' },  { status: 400 });
  if (!messages) return NextResponse.json({ error: 'messages required' }, { status: 400 });

  try {
    if (provider === 'anthropic') {
      const res = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens ?? 200,
          system: systemPrompt,
          messages,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('[/api/llm] Anthropic error:', data);
        return NextResponse.json({ error: data }, { status: res.status });
      }
      return NextResponse.json({ text: data?.content?.[0]?.text ?? '' });
    }

    // OpenAI
    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_completion_tokens: maxTokens ?? 200,
        messages: systemPrompt
          ? [{ role: 'system', content: systemPrompt }, ...messages]
          : messages,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[/api/llm] OpenAI error:', data);
      return NextResponse.json({ error: data }, { status: res.status });
    }
    return NextResponse.json({ text: data?.choices?.[0]?.message?.content ?? '' });

  } catch (err) {
    console.error('[/api/llm] 서버 오류:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

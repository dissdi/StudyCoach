import { NextRequest, NextResponse } from 'next/server';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export async function POST(request: NextRequest) {
  const { text, voice = 'ko-KR-SunHiNeural' } = await request.json();

  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'text required' }, { status: 400 });
  }

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const { audioStream } = tts.toStream(text);

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      audioStream.on('end', resolve);
      audioStream.on('error', reject);
    });

    const audioBuffer = Buffer.concat(chunks);

    // 오디오 데이터가 없으면 해당 목소리가 지원되지 않는 것
    if (audioBuffer.length === 0) {
      console.warn(`[Edge TTS] 오디오 없음 (지원 안 되는 목소리일 수 있음): ${voice}`);
      return NextResponse.json({ error: `Voice not supported: ${voice}` }, { status: 500 });
    }

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[Edge TTS] 오류:', err);
    return NextResponse.json({ error: 'TTS 생성 실패' }, { status: 500 });
  }
}

#!/usr/bin/env node
/**
 * GPT-Live 「설명으로 목소리 만들기」(prompt-to-voice, 2026-10-30) — 여성 배역 3차 후보를 글 설명으로 만든다.
 * 유호님 10-30 「a가 제일 나아」(GPT-Live 기본 여성 목소리 넷이 Gemini Kore에 못 미침) → 「응, 만들어 봐」.
 *   node 목소리만들기.mjs            → 아래 설명마다 /v1/audio/voices(type prompt)로 하나씩 만들고 id를 .tmp 작업 폴더 만든목소리.json에 적는다
 * 만들기는 무료, 쓸 때만 GPT-Live 세션 값. 설명은 소리 성질만 쓴다 — 실존 인물 · 다른 회사 목소리 흉내를 쓰지 않는다(OpenAI 이용 규칙).
 * 이미 만든 이름은 건너뛴다(조직당 100개 상한). 키는 녹음.mjs와 같은 차례로 고르고 값은 찍지 않는다.
 * 10-30: 키 목록의 키는 「모델 호출만」이라 401(api.voices.write 없음) — 그날 세 목소리는 플랫폼 화면(Audio → Voices → Create voice →
 *   Write a prompt, 아래 설명 · 견본말 그대로 → Save voice)으로 만들었다. 이 파일은 그 설명의 정본이다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 키로부르기 } from '../../../../realtime-roleplay/lib/오픈AI키.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 저장소 = path.resolve(여기, '..', '..', '..', '..', '..');
const 작업 = process.env.SYNK_ROLEPLAY_WORK || path.join(저장소, '.tmp', 'realtime-roleplay-20261029');
const 바탕 = (process.env.SYNK_OPENAI_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');

// 한국어 입말 견본 — 말투를 한국어 쪽으로 잡게 준다(대본과 다른 일상 말)
const 견본말 = '안녕하세요! 오늘 날씨 진짜 좋죠? 저는 아까 친구랑 카페에서 커피 한 잔 마셨어요. 아, 그리고 이번 주말에는 공연 보러 갈 거예요. 혹시 시간 괜찮으면 같이 갈래요? 천천히 생각해 보고 알려 줘요. 기다릴게요!';
export const 설명들 = {
  '만든-또렷함': 'A bright, clear adult feminine voice in her mid-20s. A native Korean speaker with a natural standard Seoul accent. Mid-to-slightly-high pitch, clean timbre with no raspiness, crisp articulation, friendly and confident delivery at a natural conversational pace. Expressive like a real person talking, never exaggerated.',
  '만든-단단함': 'A firm, grounded adult feminine voice in her late 20s. A native Korean speaker with a natural standard Seoul accent. Mid-range pitch, smooth and slightly rich timbre, very clear articulation, calm confidence, steady and natural conversational pace. Warm but not breathy.',
  '만든-따뜻함': 'A warm, lively adult feminine voice in her early 30s. A native Korean speaker with a natural standard Seoul accent. Mid-range pitch, smooth timbre with a light natural texture, gentle expressive intonation that sounds like a real person chatting, relaxed natural pace, kind and approachable.',
};

const 파일 = path.join(작업, '만든목소리.json');
const 있음 = fs.existsSync(파일) ? JSON.parse(fs.readFileSync(파일, 'utf8')) : {};
for (const [이름, 설명] of Object.entries(설명들)) {
  if (있음[이름]?.id) { console.log(`[목소리] 있음 ${이름}`); continue; }
  const { res, 키 } = await 키로부르기((v) => fetch(`${바탕}/audio/voices`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${v}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'prompt', name: `SYNK 상대역 ${이름}`, prompt: 설명, model: 'auto', script_hint: 견본말 }),
  }));
  const 답 = await res.json();
  if (!답.id) throw new Error(`id 없는 답: ${JSON.stringify(답).slice(0, 200)}`);
  있음[이름] = { id: 답.id, 설명, 만든때: new Date().toISOString(), 키 };
  fs.mkdirSync(작업, { recursive: true });
  fs.writeFileSync(파일, `${JSON.stringify(있음, null, 2)}\n`);
  console.log(`[목소리] 만듦 ${이름} · 키 ${키}`);
}

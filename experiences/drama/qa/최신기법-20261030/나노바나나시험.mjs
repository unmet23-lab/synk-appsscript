#!/usr/bin/env node
/**
 * 1화 태오 시작 그림의 나노바나나 시험(2026-10-31) — 유호님 「이 느낌을 nanobanana pro로 만들어볼수있어? 로맨스재질로 실사느낌으로, 지금 우리가 pulse에서 아이돌 그룹들 만들고있잖아」.
 * Gemini 웹(구독 안, 크레딧 0)으로 굽는다. 실행기는 PULSE 걸그룹 ego를 옮긴 것이고, engine 'pro'는 3.1 Pro(나노바나나 프로), 없으면 4 Argon 높음(나노바나나 2.1 — PULSE 아이돌이 쓴 판).
 * 빛 · 피부 줄은 걸그룹 시험 2차 공통 꼬리(C:\SYNK-LoRA\casting\idol_gg_20261030\prompts2.py TAIL2)를 남자 주인공 · 야외로 옮겼다.
 *
 *   T1 같은 태오(Sunburst 시작 그림을 Image 1로) + 로맨스 빛
 *   N1 글로만, 같은 장면(참조를 넣으면 참조 인물을 닮는다 — 엔진 자체의 얼굴을 본다)
 *   N2 글로만, 벚꽃길(로맨스를 더 세게 — 1화 3월 초 설정은 잠시 놓는다)
 *
 *   node 나노바나나시험.mjs <작업>     <작업>/나노바나나/ego/jobs.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { 선배생김, 선배틀 } from './영상시험.mjs';

const 작업 = process.argv[2];
if (!작업) { console.error('쓰는 법: node 나노바나나시험.mjs <작업 폴더>'); process.exit(2); }

const 앞 = `Create one photograph. A still from a Korean first-love romance drama — the male lead smiling at the girl he is about to fall for — shot by a top Seoul drama studio: bright, sunlit, dreamy and sweet, still unmistakably a real photograph of a real person, never an illustration or a 3D render.`;

const 꼬리 = `Light and color: bright, high-key, luminous and fresh — a large soft frontal light that falls evenly on both sides of his face, a warm golden backlight that makes the edges of his hair and shoulders glow, a gentle dreamy bloom only on the brightest highlights, and a clean pastel grade with lifted, milky-bright shadows. No haze over his face; nothing grey, dull, muddy or desaturated; no vintage film look and no film grain. 85mm lens at f/2 at eye level, the background softly out of focus.
A natural pose caught mid-moment, head tilted about 5 degrees, both eyes on the lens.
The skin must look like an unretouched real photograph: clearly visible pores on the cheeks and nose, fine vellus hair, a natural soft shine, tiny natural unevenness; absolutely no porcelain, airbrushed or plastic skin. No moles, beauty marks or spots on his face. Natural dark-brown irises. A few flyaway hairs catch the backlight. Five-fingered hands.
He is clearly an adult man of 23 with adult facial proportions, not a teenager. Give him his own distinct, original face that does not resemble any famous person, idol or actor. No text, letters, numbers, logos, watermark or border anywhere — the small school crest on his jacket has no lettering.`;

const 벚꽃자리 = `PLACE: a Korean university campus avenue in full spring bloom — a long road lined with blooming cherry trees, soft pink-white petals drifting through the air around him, red brick campus buildings far behind him, a few students in light spring jackets far behind, and the low warm sun behind him lighting the blossoms.`;

const 참조글 = `Image 1 shows this exact young man — same face, hair, clothes and framing. The light, color and mood follow this prompt.`;

const 그대로 = `${앞}\n${선배생김}\n${선배틀}\n${꼬리}`;
const 벚꽃 = `${앞}\n${선배생김}\n${선배틀.split('PLACE:')[0].trimEnd()}\n${벚꽃자리}\n${꼬리}`;
const 시작그림 = path.resolve(작업, '받음/vid-senior-real.png').replace(/\\/g, '/');

const 글 = {
 T1: { 글: `${참조글}\n${그대로}`, refs: [시작그림] },
 N1: { 글: 그대로, refs: [] },
 N2: { 글: 벚꽃, refs: [] },
};
// 입력칸에서 줄바꿈이 두 글자로 세어져 실행기의 글 길이 확인에 걸린다(10-31) — 한 줄로 잇는다
const 한줄 = (글) => 글.split('\n').map((줄) => 줄.trim()).join(' ');
const 작업들 = {};
for (const [이름, 판] of Object.entries(글)) {
 작업들[`${이름}p`] = { id: `${이름}p`, ratio: '9:16', engine: 'pro', refs: 판.refs, prompt: 한줄(판.글) };
 작업들[`${이름}a`] = { id: `${이름}a`, ratio: '9:16', refs: 판.refs, prompt: 한줄(판.글) };
}
const 나갈 = path.join(작업, '나노바나나', 'ego', 'jobs.json');
fs.mkdirSync(path.dirname(나갈), { recursive: true });
fs.writeFileSync(나갈, JSON.stringify(작업들, null, 1));
for (const [id, j] of Object.entries(작업들)) console.log(id, j.engine || '2.1', j.refs.length, j.prompt.length);

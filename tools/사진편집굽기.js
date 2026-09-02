#!/usr/bin/env node
/**
 * 사진 편집 굽기 — **돈 안 내고** 사진 한 장을 «그대로 두고» 고쳐 받는다.
 *
 * ■ 🔴 왜 생겼나 (유호 지적 09-02)
 *   내가 코스튬을 만들려면 「이미지 열쇠(API) 호출 1컷 ≈190원」이라고만 말씀드렸다.
 *   유호님 반문: **「우리 gpt도 있는데 gpt로 뽑으면 무료 아니야? 제미나이도 무료있는데 왜 돈이 들어?
 *   돈 안내고 할수있는걸 굳이 돈 내고 할 필요는 없잖아 · 자동화를 말하는거야」**
 *   맞는 지적이었다 — 나는 «가장 비싼 문»만 보고 멈췄다.
 *
 * ■ 실제로 찾은 무료 통로 (09-02 실측)
 *   유호님이 이미 내고 계신 **허깅페이스 PRO**($9/월 · 계정 q121235 · 2026-10-01 갱신)가
 *   **ZeroGPU 하루 40분**을 준다. 그 위에서 도는 이미지 «편집» Space 를 부르면
 *   **호출당 추가 요금이 0** 이다(구독 안에 든 몫을 쓰는 것이라 새 계산서가 안 나온다).
 *   실측: `FLUX.1-Kontext-Dev` · `Qwen-Image-Edit-2511-LoRAs-Fast` 둘 다 RUNNING · zero-a10g.
 *
 * ■ 왜 «편집»이어야 하나 — 마스코트가 사진이기 때문이다
 *   몽글은 펠트 실물 사진이다. 새로 «생성»하면 몸까지 AI 가 그려 재질이 갈리고
 *   (08-15 「고무·왁스」 반려), 무엇보다 정본이 흔들린다(학생이 「어제랑 다르네」).
 *   편집 모델은 원본을 두고 시킨 곳만 고친다 — 그게 이 통로의 전부다.
 *   🔑 그리고 나온 그림을 그대로 쓰지 않는다: **바뀐 부분만 오려 원본에 얹는다**
 *      (`tools/표정워프.js` 의 눈 갈아끼우기와 같은 통로). 몸은 원본 픽셀 100% 로 남는다.
 *
 * ■ 이 도구가 «안» 하는 것
 *   채택 판정을 안 한다. 산출은 시안이고, 「몸이 안 변했나」는 `tools/편집검증.js` 가 잰다.
 *
 * 쓰기:
 *   node tools/사진편집굽기.js --그림 <입력.png> --지시 "..." [--나갈곳 <출력.png>]
 *                              [--공방 kontext|qwen] [--걸음 28] [--세기 2.5] [--씨 0]
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

/* 공방 — 어느 Space 를 부르나. 둘 다 ZeroGPU 라 PRO 몫으로 돈다(추가 요금 0).
 * 🔑 이름을 여기 한 곳에만 둔다 — 두 곳에 적으면 「어느 게 현행인가」가 갈린다. */
const 공방들 = {
  kontext: {
    이름: 'black-forest-labs/FLUX.1-Kontext-Dev',
    주소: 'https://black-forest-labs-flux-1-kontext-dev.hf.space',
    함수: 'infer',
    /* /infer 의 입력 차례: input_image · prompt · seed · randomize_seed · guidance_scale · steps */
    인자: (그림, 지시, o) => [그림, 지시, o.씨, o.씨 === 0, o.세기, o.걸음],
  },
  qwen: {
    이름: 'prithivMLmods/Qwen-Image-Edit-2511-LoRAs-Fast',
    주소: 'https://prithivmlmods-qwen-image-edit-2511-loras-fast.hf.space',
    함수: 'infer',
    인자: (그림, 지시, o) => [그림, 지시, o.씨, o.씨 === 0, o.세기, o.걸음],
  },
};

const 인자 = (() => {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) o[a[i].slice(2)] = a[i + 1];
  return o;
})();

function 열쇠() {
  /* 🔑 OAuth 판 토큰이 `~/.cache/huggingface/token` 에 산다(memory huggingface-pro-subscription).
     `hf auth login` 판이 아니다 — 그 자리를 찾아 헤매지 마라. */
  const p = process.env.HF_TOKEN_PATH || path.join(os.homedir(), '.cache', 'huggingface', 'token');
  if (!fs.existsSync(p)) throw new Error(`허깅페이스 열쇠가 없다: ${p}`);
  return fs.readFileSync(p, 'utf8').trim();
}

/** 그림 한 장을 Space 에 올린다 → gradio 가 쓰는 파일 dict 를 돌려준다. */
async function 올리기(주소, 파일, 토큰) {
  const 몸 = new FormData();
  몸.append('files', new Blob([fs.readFileSync(파일)], { type: 'image/png' }), path.basename(파일));
  const r = await fetch(`${주소}/gradio_api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${토큰}` },
    body: 몸,
  });
  if (!r.ok) throw new Error(`업로드 실패 ${r.status} — ${(await r.text()).slice(0, 200)}`);
  const [경로] = await r.json();
  return { path: 경로, url: `${주소}/gradio_api/file=${경로}`, orig_name: path.basename(파일), meta: { _type: 'gradio.FileData' } };
}

/** 함수를 부르고 결과가 올 때까지 기다린다(gradio 는 두 걸음이다 — 부르고, 흘러오는 것을 읽는다). */
async function 부르기(주소, 함수, 데이터, 토큰) {
  const r = await fetch(`${주소}/gradio_api/call/${함수}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${토큰}` },
    body: JSON.stringify({ data: 데이터 }),
  });
  if (!r.ok) throw new Error(`호출 실패 ${r.status} — ${(await r.text()).slice(0, 300)}`);
  const { event_id: 표 } = await r.json();
  if (!표) throw new Error('event_id 가 안 왔다 — Space 가 규격을 바꿨나');

  const s = await fetch(`${주소}/gradio_api/call/${함수}/${표}`, { headers: { Authorization: `Bearer ${토큰}` } });
  if (!s.ok) throw new Error(`결과 통로 실패 ${s.status}`);

  /* 흘러오는 줄을 읽는다. `complete` 면 끝, `error` 면 그 자리에서 던진다 —
     조용히 빈손으로 돌아가면 그것이 「성공한 얼굴을 한 0」이다. */
  const 읽개 = s.body.getReader();
  const 해독 = new TextDecoder();
  let 남은 = '';
  let 사건 = null;
  for (;;) {
    const { value, done } = await 읽개.read();
    if (done) break;
    남은 += 해독.decode(value, { stream: true });
    const 줄들 = 남은.split('\n');
    남은 = 줄들.pop();
    for (const 줄 of 줄들) {
      if (줄.startsWith('event: ')) 사건 = 줄.slice(7).trim();
      else if (줄.startsWith('data: ')) {
        const 몸 = 줄.slice(6);
        if (사건 === 'error') throw new Error(`Space 오류 — ${몸.slice(0, 300)}`);
        if (사건 === 'complete') return JSON.parse(몸);
      }
    }
  }
  throw new Error('결과가 안 왔다(흐름이 끊겼다) — ZeroGPU 몫이 다 됐거나 Space 가 자는 중일 수 있다');
}

(async () => {
  const 그림 = 인자['그림'];
  const 지시 = 인자['지시'];
  if (!그림 || !지시) {
    console.error('쓰기: node tools/사진편집굽기.js --그림 <입력.png> --지시 "..." [--나갈곳 <출력.png>] [--공방 kontext|qwen]');
    process.exit(1);
  }
  if (!fs.existsSync(그림)) throw new Error(`입력 그림이 없다: ${그림}`);
  const 공방 = 공방들[인자['공방'] || 'kontext'];
  if (!공방) throw new Error(`모르는 공방: ${인자['공방']} — 있는 것: ${Object.keys(공방들).join(', ')}`);

  const 손잡이 = {
    걸음: Number(인자['걸음'] ?? 28),
    세기: Number(인자['세기'] ?? 2.5),
    씨: Number(인자['씨'] ?? 0),
  };
  const 나갈곳 = path.resolve(인자['나갈곳'] || 그림.replace(/\.png$/i, '') + '_편집.png');
  const 토큰 = 열쇠();

  console.log(`사진 편집 — ${공방.이름} (ZeroGPU · PRO 몫 · 호출 요금 0)`);
  console.log(`  그림: ${path.basename(그림)} · 지시: ${지시.slice(0, 60)}${지시.length > 60 ? '…' : ''}`);

  const 잰시각 = Date.now();
  const 올린것 = await 올리기(공방.주소, 그림, 토큰);
  const 답 = await 부르기(공방.주소, 공방.함수, 공방.인자(올린것, 지시, 손잡이), 토큰);

  const 결과 = Array.isArray(답) ? 답[0] : 답;
  const 주소 = 결과?.url || (결과?.path ? `${공방.주소}/gradio_api/file=${결과.path}` : null);
  if (!주소) throw new Error(`결과에 그림이 없다 — ${JSON.stringify(답).slice(0, 300)}`);

  const 받은 = await fetch(주소, { headers: { Authorization: `Bearer ${토큰}` } });
  if (!받은.ok) throw new Error(`결과 내려받기 실패 ${받은.status}`);
  fs.mkdirSync(path.dirname(나갈곳), { recursive: true });
  fs.writeFileSync(나갈곳, Buffer.from(await 받은.arrayBuffer()));

  console.log(`  → ${path.relative(process.cwd(), 나갈곳)}`
    + ` (${(fs.statSync(나갈곳).size / 1024).toFixed(0)}KB · ${((Date.now() - 잰시각) / 1000).toFixed(1)}초)`);
  console.log('  ⚠ 시안이다 — 「몸이 안 변했나」는 node tools/편집검증.js 가 잰다.');
})().catch((e) => { console.error(`🔴 ${e.message}`); process.exit(1); });

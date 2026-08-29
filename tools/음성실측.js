#!/usr/bin/env node
'use strict';
/**
 * 음성실측 — **제미나이 TTS 로 몽골어가 실제로 소리가 되는가**를 재는 실측 도구 (신설 2026-08-29).
 *
 * ■ 왜 있나 · 왜 «제품에 안 붙는가»
 *   조사에서 「Gemini TTS 공식 언어표에 몽골어(mn)가 있다」가 나왔다. 구글의 다른 음성 엔진
 *   (Chirp 3 HD)은 53 로케일에 몽골어가 **없어서** 이 통로가 사실상 유일하다.
 *   그런데 지금 이걸 제품에 배선하면 안 되는 까닭이 둘이다:
 *     · 가이드(몽글)의 목소리는 **무언(옹알이)이 원칙**이다 — `tools/감각층소리합성.js` 머리말
 *       「말이 아니다: 낱말·음소 0, 음높이 곡선만」. 말하는 음성을 붙이면 그 원칙을 깬다.
 *     · 학생이 0명이라 **몽골어 음성을 들을 사람이 아직 없다.** 소비자 0인 코드를 상주시키지 않는다.
 *   ⇒ 이 파일은 철학 Ⅰ-9④ 「시도는 많이, 상주는 적게」 그대로다 — **되는지만 재고 판정 재료를 남긴다.**
 *   제품에 붙이기로 «유호님이» 정하는 날, 모델 픽은 여기가 아니라 `tools/모델정책.js` 로 옮긴다.
 *
 * ■ 무엇을 재나 (기계가 잴 수 있는 것만)
 *   모델별 성공/실패와 오류 원문 · 응답 시간 · 바이트 · 재생 길이 · **무음이 아닌가**(피크·RMS·무음 표본 비율) ·
 *   **역듣기**(구운 소리를 다시 받아쓰게 해 원문과 낱말 대조 — 「낱말이 소리에 실렸나」).
 *   🔴 **음질·억양·「몽골어답게 들리는가」는 이 도구가 판정하지 않는다.** 그건 귀의 몫이고,
 *      기계가 「좋다」고 적으면 그게 곧 거짓 초록이다 — 보고서는 「유호님이 들으셔야 한다」로 남긴다.
 *
 * ■ 문장은 어디서 오나 — **지어내지 않는다**
 *   전부 이 저장소의 «라이브 제품 코드»에서 그대로 가져왔다(파일:줄은 아래 문장표에 박혀 있다).
 *   한 값이 두 곳에 살면 반드시 갈리므로, 부르기 전에 **원본 파일에 그 문장이 아직 그대로 있는지
 *   대조한다.** 갈라졌으면 조용히 옛 문장으로 굽지 않고 크게 실패한다(종료코드 2).
 *   대조군으로 한국어 한 줄을 같이 굽는다 — 몽골어만 이상한 건지 원래 그런 건지 가르기 위해서다.
 *
 * ■ 쓰는 법
 *   node tools/음성실측.js --목록        # 이 키로 보이는 TTS 모델을 API 에 물어본다(굽기 0회)
 *   node tools/음성실측.js --모델        # 후보 모델들 × 문장 1개 — 어느 모델이 사나
 *   node tools/음성실측.js --문장        # 사는 모델 × 문장 4개(몽골어 3 + 한국어 대조군 1)
 *   node tools/음성실측.js --목소리      # 사는 모델 × 문장 1개 × 목소리 여럿
 *   node tools/음성실측.js --역듣기      # 구운 wav 를 다시 받아쓰게 해 원문과 낱말 대조
 *   node tools/음성실측.js --전부        # 위 넷을 차례로
 *   옵션: --출력 <폴더>(기본 = 환경변수 SYNK_음성출력 또는 OS 임시폴더) · --모델픽 <id> · --간격 <ms>
 *
 * ■ 함정 (실측 2026-08-29)
 *   · 응답은 **헤더 없는 raw PCM** 이다(`audio/L16;codec=pcm;rate=24000`). 그대로 .wav 로 저장하면
 *     플레이어가 못 연다 — 44바이트 RIFF 머리를 우리가 붙여야 사람이 듣는다.
 *   · 샘플레이트를 24000 으로 **박지 않는다.** 응답 mimeType 이 말해 주는 값을 읽는다
 *     (박아 두면 구글이 바꾸는 날 재생 속도만 틀린 채 「성공」으로 보인다).
 *     mimeType 을 못 읽으면 추측하지 말고 그 한 건을 실패로 적는다.
 *   · 무료 티어는 분당 호출 상한이 낮다 — 호출 사이를 띄우고 429/500/503 은 재시도한다.
 *   · 🚫 오디오를 **저장소 안에 만들지 않는다.** 소비자 0 자산이 git 에 쌓이면 안 된다.
 *
 * 종료코드: 0=전부 성공 · 2=한 건이라도 실패/확인 불가 · 1=실행 오류(키 없음·정본 갈라짐 등)
 * 키:      tools/모델정책.js 의 `제미나이키()` 가 정본이다(경로는 env GEMINI_KEY_PATH).
 *          🚫 키 값을 찍지도 파일에 적지도 않는다.
 * ⚠ 무료 티어는 입력이 구글 학습에 쓰일 수 있다 — 학생 개인정보 금지, 이미 공개된 제품 카피 전용.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const 정책 = require('./모델정책.js');
// 낱말 대조자는 **새로 만들지 않는다** — 몽골어대조.js 가 이미 쥔 자를 그대로 빌린다
// (같은 판정을 두 곳에서 따로 재면 반드시 갈린다).
const { 토큰대조 } = require('./몽골어대조.js');

const 저장소 = path.resolve(__dirname, '..');
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const 호출타임아웃 = 180_000; // 오디오는 텍스트보다 오래 걸린다(실측 3.9초였지만 긴 문장·혼잡 대비)
const 재시도지연 = [10_000, 30_000]; // 무료 티어 분당 상한(429)·순간 장애(500/503)

/* 후보 모델 — **여기가 정본이 아니다.** 이 파일은 「되는지 재는」 도구고, 제품이 쓰기로 정해지는 날
 * 픽은 tools/모델정책.js 로 간다. 지금 거기 안 적는 까닭: 아무도 안 쓰는 픽을 정본에 앉히면
 * 「정책이 골랐다」는 얼굴로 낡아 간다. `--목록` 이 API 실물과 이 표를 대조해 준다. */
const 후보모델 = [
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts',
  'gemini-2.5-pro-preview-tts',
];

/* 목소리 후보 — 구글 문서의 프리빌트 이름들이다(문서에서 옮긴 값 = **실측 아님**).
 * 없는 이름이면 API 가 400 으로 거절하는데, 그 거절 자체가 이 도구의 측정값이다. */
const 후보목소리 = ['Kore', 'Puck', 'Charon', 'Aoede', 'Leda', 'Zephyr'];
const 기본목소리 = 'Kore';

/* ── 문장표 — 전부 라이브 제품 코드에서 온 실물이다 ────────────────────────────────
 * `원문`  = 파일에 실제로 박혀 있는 글자(치환 자리 `{x}` 포함) → 이것으로 정본 대조를 한다.
 * `읽힐글` = 치환을 끝낸, 실제로 굽는 글자. 치환이 없으면 원문과 같다.
 * 🔴 이 넷 중 어느 것도 **원어민 검수를 지나지 않았다**(검수표의 「몽골어 확정」 칸이 아직 비어 있다 —
 *    docs/함께한날_몽골어_검수표.md · docs/_ops/검수꾸러미/*.tsv 실측 2026-08-29).
 *    그러므로 「이상하게 들린다」가 나와도 **TTS 탓인지 번역 탓인지 이 도구는 못 가른다.** */
const 문장표 = [
  {
    코드: 'MN1',
    갈래: '학부모 안내',
    언어: 'mn',
    출처: '엔진_콘텐츠AI.js',
    출처설명: 'HL_TPL — 월간 학부모 하이라이트 메일',
    한국어: '이번 달도 교실에서 자기 자리를 지켰어요.',
    원문: 'Энэ сард ч хичээлдээ тогтмол оролцлоо.',
  },
  {
    코드: 'MN2',
    갈래: '학생 격려',
    언어: 'mn',
    출처: '엔진_콘텐츠AI.js',
    출처설명: 'HL_TPL — 연속 출석 인정',
    한국어: '연속 출석 10일 — 습관이 실력이 되는 중이에요.',
    원문: 'Дараалан {x} өдөр ирлээ — зуршил чадвар болж байна.',
    치환: { '{x}': '10' }, // 코드가 숫자를 끼우는 자리 — 굽기엔 실제 값이 필요하다
  },
  {
    코드: 'MN3',
    갈래: '수업(숙제) 안내',
    언어: 'mn',
    출처: '엔진_콘텐츠AI.js',
    출처설명: '숙제 카드 HW105',
    한국어: '집에 있는 물건 5개의 한국어 이름을 적어 오세요.',
    원문: 'Гэртээ байгаа 5 зүйлийн солонгос нэрийг бичээд ирээрэй.',
  },
  {
    코드: 'KO1',
    갈래: '대조군(한국어)',
    언어: 'ko',
    출처: '엔진_콘텐츠AI.js',
    출처설명: 'MN1 과 «같은 줄»의 한국어 짝 — 조건을 언어 하나만 바꾼다',
    한국어: '이번 달도 교실에서 자기 자리를 지켰어요.',
    원문: '이번 달도 교실에서 자기 자리를 지켰어요.',
  },
];

// ── 정본 대조 ───────────────────────────────────────────────────────────────────
/** 문장이 출처 파일에 «지금도 그대로» 있는지 본다. 없으면 갈라진 것이다 — 조용히 굽지 않는다. */
function 정본대조(항목) {
  const p = path.join(저장소, 항목.출처);
  if (!fs.existsSync(p)) return { ok: false, 이유: `출처 파일이 없다 → ${항목.출처}` };
  const 본문 = fs.readFileSync(p, 'utf8');
  if (!본문.includes(항목.원문)) {
    return { ok: false, 이유: `출처 파일에 그 문장이 없다(정본이 갈라졌다) → ${항목.출처}` };
  }
  const 줄 = 본문.slice(0, 본문.indexOf(항목.원문)).split('\n').length;
  return { ok: true, 줄 };
}

function 읽힐글(항목) {
  let s = 항목.원문;
  for (const [자리, 값] of Object.entries(항목.치환 || {})) s = s.split(자리).join(값);
  return s;
}

// ── 오디오 ─────────────────────────────────────────────────────────────────────
/** `audio/L16;codec=pcm;rate=24000` 을 뜯는다. 못 뜯으면 **추측하지 않고** null 을 낸다. */
function 오디오형식(mimeType) {
  const s = String(mimeType || '');
  const 비트 = /(?:^|\/)L(\d+)\b/i.exec(s);
  const 레이트 = /\brate=(\d+)/i.exec(s);
  if (!비트 || !레이트) return null;
  return { 비트: Number(비트[1]), 레이트: Number(레이트[1]), 채널: 1 };
}

/** raw PCM 앞에 44바이트 RIFF 머리를 붙인다 — 이게 있어야 사람이 더블클릭으로 듣는다. */
function WAV만들기(pcm, 형식) {
  const { 비트, 레이트, 채널 } = 형식;
  const 블록 = (채널 * 비트) / 8;
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);      // PCM 서브청크 크기
  h.writeUInt16LE(1, 20);       // 형식 1 = PCM
  h.writeUInt16LE(채널, 22);
  h.writeUInt32LE(레이트, 24);
  h.writeUInt32LE(레이트 * 블록, 28);
  h.writeUInt16LE(블록, 32);
  h.writeUInt16LE(비트, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** 「소리가 들어 있나」를 잰다 — 크기만으로는 무음 파일도 커 보인다. 16비트만 잰다. */
function 소리측정(pcm, 형식) {
  if (형식.비트 !== 16) return { 잼: false, 이유: `16비트가 아니라 못 쟀다(L${형식.비트})` };
  const n = Math.floor(pcm.length / 2);
  if (n === 0) return { 잼: false, 이유: '표본 0개' };
  let 피크 = 0, 제곱합 = 0, 무음표본 = 0;
  const 무음문턱 = 32768 * 0.01; // 만재의 1% 아래 = 사실상 무음
  for (let i = 0; i < n; i++) {
    const v = pcm.readInt16LE(i * 2);
    const a = Math.abs(v);
    if (a > 피크) 피크 = a;
    제곱합 += v * v;
    if (a < 무음문턱) 무음표본++;
  }
  const rms = Math.sqrt(제곱합 / n);
  const dB = (x) => (x <= 0 ? -Infinity : 20 * Math.log10(x / 32768));
  return {
    잼: true,
    표본수: n,
    초: n / 형식.레이트 / 형식.채널,
    피크dBFS: dB(피크),
    RMSdBFS: dB(rms),
    무음비율: 무음표본 / n,
    // 판정: 피크가 만재의 1% 도 못 넘거나 표본의 99% 가 무음이면 「소리 없음」이다
    소리있음: 피크 >= 무음문턱 && 무음표본 / n < 0.99,
  };
}

// ── API ────────────────────────────────────────────────────────────────────────
function 재시도가능(status) { return status === 429 || status === 500 || status === 503; }

async function TTS호출(key, model, 글, 목소리) {
  for (let 회 = 0; ; 회++) {
    const t0 = Date.now();
    let res, 본문;
    try {
      res = await fetch(`${BASE}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 글 }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 목소리 } } },
          },
        }),
        signal: AbortSignal.timeout(호출타임아웃),
      });
      본문 = await res.json();
    } catch (e) {
      if (회 < 재시도지연.length) { await 쉼(재시도지연[회]); continue; }
      return { ok: false, 오류: `네트워크/타임아웃: ${e.message}`, ms: Date.now() - t0 };
    }
    const ms = Date.now() - t0;
    if (!res.ok) {
      if (재시도가능(res.status) && 회 < 재시도지연.length) { await 쉼(재시도지연[회]); continue; }
      const msg = (본문 && 본문.error && 본문.error.message) || JSON.stringify(본문).slice(0, 300);
      return { ok: false, 오류: `HTTP ${res.status} — ${msg}`, ms, status: res.status };
    }
    const c = 본문.candidates && 본문.candidates[0];
    const part = c && c.content && c.content.parts && c.content.parts.find((p) => p.inlineData);
    if (!part) {
      // 200 인데 오디오가 없다 — 「성공」으로 접으면 안 되는 자리다
      return { ok: false, 오류: `200 이지만 오디오 없음(finishReason=${(c && c.finishReason) || '?'})`, ms };
    }
    const 형식 = 오디오형식(part.inlineData.mimeType);
    if (!형식) return { ok: false, 오류: `mimeType 을 못 읽었다 — "${part.inlineData.mimeType}"(추측하지 않는다)`, ms };
    return {
      ok: true, ms, 형식,
      mimeType: part.inlineData.mimeType,
      pcm: Buffer.from(part.inlineData.data, 'base64'),
      토큰: (본문.usageMetadata && 본문.usageMetadata.totalTokenCount) || null,
    };
  }
}

const 쉼 = (ms) => new Promise((r) => setTimeout(r, ms));

/* 🔴 Windows·Node 24 실측(2026-08-29): fetch 소켓이 살아 있는 채 `process.exit()` 를 부르면
 * libuv 가 `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` 로 죽고 **종료코드가 127 로
 * 덮인다.** 그러면 「실패 2건(코드 2)」이 「도구가 없다(127)」로 둔갑한다 — 이 저장소가 싫어하는
 * 무늬 그대로다. 그래서 keep-alive 풀을 먼저 닫고 exitCode 만 세운다. */
async function 깨끗이끝내기(코드) {
  const d = globalThis[Symbol.for('undici.globalDispatcher.1')];
  if (d && typeof d.close === 'function') { try { await d.close(); } catch (_) { /* 닫기 실패는 결과를 안 바꾼다 */ } }
  process.exitCode = 코드;
}

// ── 역듣기(왕복) ────────────────────────────────────────────────────────────────
/* 🔑 나(AI)는 소리를 «못 듣는다». 그래서 「좋게 들린다」는 쓸 수 없고, 대신 기계가 잴 수 있는
 *   질문 하나로 바꾼다: **구운 소리에서 원래 낱말이 되돌아 나오는가.**
 *   구운 wav 를 다시 제미나이에 넣어 받아쓰게 하고, 원문과 낱말 단위로 대조한다.
 *
 * ⚠ 이 자가 재는 것과 «안» 재는 것을 헷갈리면 안 된다:
 *   잰다   = 낱말이 소리에 실려 있는가(음소가 뭉개졌으면 받아쓰기가 무너진다).
 *   안 잰다 = 억양·발음의 «몽골어다움»·듣기 좋음. 러시아어 억양으로 또박또박 읽어도 이 점수는 높다.
 * ⚠ 받아쓰는 모델이 몽골어를 못하면 낮은 점수가 TTS 탓으로 «오인»된다 —
 *   그래서 한국어 대조군(KO1)을 같은 자로 재서 자 자신을 견제한다.
 * 🔴 **이 자는 흔들린다 — 점수 하나를 근거로 삼지 마라**(2026-08-29 실측).
 *   «같은 wav 파일 하나»를 세 번 받아쓰게 했더니 100% · 83% · 83% 로 갈렸다
 *   (`сард` ↔ `сарт` — 소리는 한 벌인데 받아쓰기가 매번 달랐다). 즉 흔들림의 «일부»는
 *   굽기가 아니라 **받아쓰기 쪽**에 있다. 같은 날 한국어 대조군은 두 실행 다 100% 로 안 흔들렸다.
 *   ⇒ 이 숫자는 「낱말이 소리에 실렸나」의 **성긴 문지기**지 품질 점수가 아니다.
 *     80% 아래가 나오면 「나쁘다」가 아니라 「그 문장을 유호님이 들어 보실 자리」로 읽어라.
 * 받아쓰기 모델은 `tools/모델정책.js` 의 무료 픽을 그대로 쓴다(여기서 또 고르지 않는다). */
async function 역듣기(key, wav경로, 언어) {
  const 픽 = 정책.제미나이설정(); // 무료최상
  const 언어이름 = 언어 === 'mn' ? '몽골어' : '한국어';
  for (let 회 = 0; ; 회++) {
    let res, 본문;
    try {
      res = await fetch(`${BASE}/models/${픽.model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `이 오디오는 ${언어이름} 음성이다. 들리는 대로 ${언어이름}로 받아써라. 고쳐 쓰거나 다듬지 말고, 받아쓴 글만 출력해라. 설명·따옴표 금지.` },
              { inlineData: { mimeType: 'audio/wav', data: fs.readFileSync(wav경로).toString('base64') } },
            ],
          }],
          generationConfig: { thinkingConfig: { thinkingLevel: 픽.thinking_level } },
        }),
        signal: AbortSignal.timeout(호출타임아웃),
      });
      본문 = await res.json();
    } catch (e) {
      if (회 < 재시도지연.length) { await 쉼(재시도지연[회]); continue; }
      return { ok: false, 오류: `네트워크/타임아웃: ${e.message}` };
    }
    if (!res.ok) {
      if (재시도가능(res.status) && 회 < 재시도지연.length) { await 쉼(재시도지연[회]); continue; }
      return { ok: false, 오류: `HTTP ${res.status} — ${((본문.error || {}).message || '').slice(0, 200)}` };
    }
    const c = 본문.candidates && 본문.candidates[0];
    const t = c && c.content && c.content.parts && c.content.parts.map((p) => p.text || '').join('').trim();
    // 빈 답을 「0건 일치」로 접지 않는다 — 못 받아쓴 것과 틀리게 받아쓴 것은 다른 사건이다
    if (!t) return { ok: false, 오류: `받아쓰기가 비었다(finishReason=${(c && c.finishReason) || '?'}) — 「확인 불가」다` };
    return { ok: true, 받아쓴글: t, 모델: 픽.model };
  }
}

/** 구두점·대소문자를 걷어내고 낱말만 남긴다 — 「.」 하나로 점수가 흔들리면 자가 아니다. */
function 낱말만(s) {
  return String(s).toLowerCase().replace(/[.,!?;:«»"'()—–-]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── 실행 ───────────────────────────────────────────────────────────────────────
const 장부 = []; // 한 줄 = 한 번의 굽기

async function 한판(key, model, 항목, 목소리, 출력폴더) {
  const 글 = 읽힐글(항목);
  const r = await TTS호출(key, model, 글, 목소리);
  const 짧은모델 = model.replace(/^gemini-/, '').replace(/-preview$/, '');
  const 이름 = `${항목.코드}_${짧은모델}_${목소리}.wav`;
  if (!r.ok) {
    console.log(`  🔴 ${항목.코드}/${목소리} — ${r.오류}  (${r.ms}ms)`);
    장부.push({ 모델: model, 코드: 항목.코드, 목소리, ok: false, 오류: r.오류, ms: r.ms });
    return false;
  }
  const 측정 = 소리측정(r.pcm, r.형식);
  const wav = WAV만들기(r.pcm, r.형식);
  const 경로 = path.join(출력폴더, 이름);
  fs.writeFileSync(경로, wav);
  const 소리 = 측정.잼
    ? `${측정.소리있음 ? '소리 있음' : '🔴 무음 의심'} · ${측정.초.toFixed(2)}초 · 피크 ${측정.피크dBFS.toFixed(1)}dBFS · RMS ${측정.RMSdBFS.toFixed(1)}dBFS · 무음표본 ${(측정.무음비율 * 100).toFixed(1)}%`
    : `⚠ 소리 못 잼 — ${측정.이유}`;
  console.log(`  ✅ ${항목.코드}/${목소리} — ${r.ms}ms · ${(wav.length / 1024).toFixed(1)}KB · ${소리}`);
  console.log(`     → ${경로}`);
  장부.push({
    모델: model, 코드: 항목.코드, 갈래: 항목.갈래, 언어: 항목.언어, 목소리,
    ok: true, ms: r.ms, 바이트: wav.length, mimeType: r.mimeType, 경로,
    초: 측정.잼 ? 측정.초 : null,
    피크dBFS: 측정.잼 ? 측정.피크dBFS : null,
    RMSdBFS: 측정.잼 ? 측정.RMSdBFS : null,
    무음비율: 측정.잼 ? 측정.무음비율 : null,
    소리있음: 측정.잼 ? 측정.소리있음 : null,
  });
  return 측정.잼 ? 측정.소리있음 : true;
}

async function 모델목록(key) {
  const res = await fetch(`${BASE}/models?pageSize=1000`, { headers: { 'x-goog-api-key': key } });
  if (!res.ok) {
    console.error(`🔴 조회 실패 ${res.status} — **안 돌린 것**이지 「모델이 없다」가 아니다.`);
    return 2;
  }
  const ms = ((await res.json()).models || []).map((m) => ({
    id: String(m.name || '').replace(/^models\//, ''),
    메서드: m.supportedGenerationMethods || [],
  }));
  const tts = ms.filter((m) => /tts|audio|speech/i.test(m.id));
  console.log(`이 키로 보이는 모델 ${ms.length}개 중 음성 계열 ${tts.length}개:`);
  for (const m of tts) {
    const 굽기가능 = m.메서드.includes('generateContent');
    console.log(`  ${굽기가능 ? '🔊' : '  '} ${m.id}  [${m.메서드.join(', ')}]`);
  }
  console.log('\n이 파일의 후보 표 대조:');
  const 산것 = new Set(ms.map((m) => m.id));
  let 최악 = 0;
  for (const id of 후보모델) {
    const ok = 산것.has(id);
    if (!ok) 최악 = 2;
    console.log(`  ${ok ? '✅' : '🔴'} ${id}${ok ? '' : ' — 이 키로는 안 보인다(ID 가 낡았거나 등급 밖)'}`);
  }
  return 최악;
}

async function main() {
  const argv = process.argv.slice(2);
  const 플래그 = new Set(argv.filter((a) => a.startsWith('--')));
  const 값 = (이름, 기본) => {
    const i = argv.indexOf(이름);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : 기본;
  };

  const key = 정책.제미나이키();
  if (!key) {
    console.error(`🔴 키를 못 읽었다(${정책.제미나이키경로()}) — 이건 「실패」가 아니라 **미실행**이다.`);
    console.error('   키는 파일로만 다룬다. 경로 변경은 env GEMINI_KEY_PATH.');
    return 깨끗이끝내기(1);
  }

  if (플래그.has('--목록')) { return 깨끗이끝내기(await 모델목록(key)); }

  // 정본 대조 — 굽기 전에 전부 확인한다. 하나라도 갈라졌으면 옛 글자로 굽지 않는다.
  console.log('■ 정본 대조 — 문장이 라이브 코드에 «지금도» 있는가');
  let 갈라짐 = false;
  for (const 항목 of 문장표) {
    const r = 정본대조(항목);
    if (r.ok) console.log(`  ✅ ${항목.코드} ${항목.출처}:${r.줄} — ${항목.출처설명}`);
    else { console.log(`  🔴 ${항목.코드} — ${r.이유}`); 갈라짐 = true; }
  }
  if (갈라짐) {
    console.error('\n🔴 정본이 갈라졌다 — 옛 문장으로 구우면 「라이브 문장을 쟀다」가 거짓이 된다. 멈춘다.');
    return 깨끗이끝내기(1);
  }

  const 출력폴더 = 값('--출력', process.env.SYNK_음성출력 || path.join(os.tmpdir(), 'synk-음성실측'));
  fs.mkdirSync(출력폴더, { recursive: true });
  if (path.resolve(출력폴더).startsWith(저장소 + path.sep)) {
    console.error(`🔴 출력 폴더가 저장소 안이다 → ${출력폴더}. 소비자 0 오디오를 git 에 쌓지 않는다.`);
    return 깨끗이끝내기(1);
  }
  console.log(`\n■ 출력 폴더: ${출력폴더}`);

  const 간격 = Number(값('--간격', '4000'));
  const 단계플래그 = ['--모델', '--문장', '--목소리', '--역듣기'].filter((f) => 플래그.has(f));
  const 전부 = 플래그.has('--전부') || 단계플래그.length === 0;
  // 역듣기는 «이 실행에서 구운» 파일만 되듣는다(장부가 있어야 원문과 짝지을 수 있다).
  // 그래서 --역듣기 만 주면 ②를 먼저 굽는다 — 안 그러면 「되들을 게 없다」로 조용히 0건이 된다.
  const 문장단계 = 전부 || 플래그.has('--문장') || 플래그.has('--역듣기');
  let 사는모델 = 값('--모델픽', null);

  // ① 모델 — 어느 후보가 실제로 몽골어를 구워 주나
  if (전부 || 플래그.has('--모델')) {
    console.log('\n■ ① 모델 — 후보 × 문장 MN1 × 목소리 ' + 기본목소리);
    for (const m of 후보모델) {
      console.log(` ▸ ${m}`);
      const ok = await 한판(key, m, 문장표[0], 기본목소리, 출력폴더);
      if (ok && !사는모델) 사는모델 = m;
      await 쉼(간격);
    }
  }
  if (!사는모델) 사는모델 = 후보모델[0];

  // ② 문장 — 몽골어 셋 + 한국어 대조군
  if (문장단계) {
    console.log(`\n■ ② 문장 — ${사는모델} × 문장 4개(몽골어 3 · 한국어 대조군 1) × ${기본목소리}`);
    for (const 항목 of 문장표) {
      // ①에서 이미 구운 조합은 다시 굽지 않는다(무료 티어 상한을 아낀다)
      if (장부.some((r) => r.모델 === 사는모델 && r.코드 === 항목.코드 && r.목소리 === 기본목소리)) {
        console.log(`  ↷ ${항목.코드} — ①에서 이미 구웠다`);
        continue;
      }
      await 한판(key, 사는모델, 항목, 기본목소리, 출력폴더);
      await 쉼(간격);
    }
  }

  // ③ 목소리 — 같은 몽골어 문장을 여러 목소리로
  if (전부 || 플래그.has('--목소리')) {
    console.log(`\n■ ③ 목소리 — ${사는모델} × MN1 × ${후보목소리.length}종`);
    for (const v of 후보목소리) {
      if (장부.some((r) => r.모델 === 사는모델 && r.코드 === 'MN1' && r.목소리 === v)) {
        console.log(`  ↷ ${v} — 이미 구웠다`);
        continue;
      }
      await 한판(key, 사는모델, 문장표[0], v, 출력폴더);
      await 쉼(간격);
    }
  }

  // ④ 역듣기 — 구운 소리에서 원래 낱말이 되돌아 나오나
  if (전부 || 플래그.has('--역듣기')) {
    const 대상 = 장부.filter((r) => r.ok && r.모델 === 사는모델 && r.목소리 === 기본목소리);
    if (!대상.length) {
      console.log('\n■ ④ 역듣기 — 🔴 되들을 파일이 없다(앞 단계가 아무것도 안 구웠다). **미실행**이지 통과가 아니다.');
    } else {
      console.log(`\n■ ④ 역듣기 — 구운 wav ${대상.length}개를 다시 받아쓰게 해 원문과 대조한다`);
      console.log('   (재는 것 = 낱말이 소리에 실렸나 · 안 재는 것 = 억양·「몽골어다움」·듣기 좋음)');
      for (const r of 대상) {
        const 항목 = 문장표.find((x) => x.코드 === r.코드);
        const 답 = await 역듣기(key, r.경로, 항목.언어);
        if (!답.ok) {
          console.log(`  🔴 ${r.코드} — ${답.오류}`);
          r.역듣기 = { ok: false, 오류: 답.오류 };
          await 쉼(간격);
          continue;
        }
        const 원 = 낱말만(읽힐글(항목));
        const 되 = 낱말만(답.받아쓴글);
        const d = 토큰대조(원, 되);
        const 일치율 = d.전체토큰 ? 1 - d.다른토큰 / d.전체토큰 : 0;
        console.log(`  ${일치율 >= 0.8 ? '✅' : '⚠'} ${r.코드}(${항목.언어}) 낱말 일치 ${(일치율 * 100).toFixed(0)}% — 다른 토큰 ${d.다른토큰}/${d.전체토큰}`);
        console.log(`     원문 : ${읽힐글(항목)}`);
        console.log(`     받아씀: ${답.받아쓴글.replace(/\s+/g, ' ')}`);
        r.역듣기 = { ok: true, 모델: 답.모델, 받아쓴글: 답.받아쓴글, 일치율, 다른토큰: d.다른토큰, 전체토큰: d.전체토큰 };
        await 쉼(간격);
      }
    }
  }

  // ── 요약 ──
  const 성공 = 장부.filter((r) => r.ok);
  const 실패 = 장부.filter((r) => !r.ok);
  const 무음 = 성공.filter((r) => r.소리있음 === false);
  console.log('\n══ 요약 ══');
  console.log(`굽기 ${장부.length}회 = 성공 ${성공.length} + 실패 ${실패.length}`);
  console.log(`성공 ${성공.length}건 = 소리 있음 ${성공.filter((r) => r.소리있음 === true).length} + 무음 의심 ${무음.length} + 못 잼 ${성공.filter((r) => r.소리있음 === null).length}`);
  for (const r of 실패) console.log(`  🔴 ${r.모델} / ${r.코드} / ${r.목소리} — ${r.오류}`);
  if (성공.length) {
    const t = 성공.map((r) => r.ms);
    console.log(`응답 시간: 최소 ${Math.min(...t)}ms · 중앙 ${t.slice().sort((a, b) => a - b)[Math.floor(t.length / 2)]}ms · 최대 ${Math.max(...t)}ms`);
  }
  const 역들은것 = 장부.filter((r) => r.역듣기);
  if (역들은것.length) {
    const 잰것 = 역들은것.filter((r) => r.역듣기.ok);
    console.log(`역듣기 ${역들은것.length}건 = 잰 것 ${잰것.length} + 확인 불가 ${역들은것.length - 잰것.length}`);
    for (const r of 잰것) console.log(`  ${r.코드}(${(문장표.find((x) => x.코드 === r.코드) || {}).언어}) 낱말 일치 ${(r.역듣기.일치율 * 100).toFixed(0)}%`);
  }
  console.log(`\n🔴 음질·억양·「몽골어답게 들리는가」는 여기 없다 — 유호님이 들으셔야 한다.`);
  console.log(`   들으실 곳: ${출력폴더}`);

  // 장부 원본도 남긴다(보고서가 이 숫자를 인용한다). 저장소 밖이다.
  const 장부경로 = path.join(출력폴더, '장부.json');
  fs.writeFileSync(장부경로, JSON.stringify({ 언제: new Date().toISOString(), 장부 }, null, 2), 'utf8');
  console.log(`   장부: ${장부경로}`);

  // 「확인 불가」도 2다 — 못 잰 것을 0(초록)으로 접으면 그게 이 저장소가 여러 번 데인 무늬다.
  const 역듣기불가 = 장부.filter((r) => r.역듣기 && !r.역듣기.ok).length;
  return 깨끗이끝내기(실패.length || 무음.length || 역듣기불가 ? 2 : 0);
}

if (require.main === module) {
  main().catch((e) => { console.error(`실행 오류: ${e && e.message}`); 깨끗이끝내기(1); });
}

module.exports = { 오디오형식, WAV만들기, 소리측정, 정본대조, 읽힐글, 문장표, 후보모델 };

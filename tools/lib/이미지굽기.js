/* 이미지 굽기 공용 통로 — Gemini 이미지 모델 1컷 호출 (2026-08-15).
 *
 * 왜 있나: 같은 fetch·키읽기·base64 동봉·저장 코드가 `재질굽기.js`·`파생굽기.js` 에 각각
 * 인라인으로 있었다. 세 번째 사본을 만드는 대신 통로를 하나 뺐다(CLAUDE.md 신뢰성 §
 * 「3번째 = 원인을 쓸 수 없게 만든다」). 기존 둘은 «건드리지 않았다» — 이미 구운 자산의
 * 출처라 동작을 바꾸면 그 자산의 재현성이 끊긴다. 이관은 별도 일감(작업대기열).
 *
 * ⚠돈이 든다 — 1컷 ≈ 190원. 유호님 승인 없이 배치로 돌리지 않는다.
 * ⚠우하단 생성 표식(sparkle)이 출력에 붙는다 — 코너라 크롭·누끼로 떨어진다.
 *   비가시 SynthID 는 그대로 산다(🚫지우려는 시도).
 *
 * 2026-09-02 · `크기` 손잡이를 붙였다(1K·2K·4K). **기본값은 안 바꿨다** — 이미 구운 자산의
 *   재현성을 지키려면 인자를 안 준 호출이 옛 그림과 같은 픽셀을 내야 한다(머리말 「건드리지 않았다」).
 *   라디오 무대판이 2K 를 부른다: 1280×720 에 깔면서 우하단 표식을 «잘라» 버려야 해서
 *   1K(≈1344×768)로는 잘라낸 뒤 확대가 물린다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

/* 🔑 그림은 **「돈」 열쇠**를 쓴다 — 공짜 몫이 원리상 없다(구글 공식 가격표 09-03: Nano Banana Pro
 * = Free Tier 「Not available」 · 1K/2K 한 장 $0.134 · 4K $0.24). 유호 확정 09-03 「글은 공짜, 그림은 유료」.
 * 경로 정본은 `tools/모델정책.js` 하나다 — 09-03 전엔 이 파일이 같은 문자열을 따로 박아 두고 있었다. */
const 기본키경로 = require('../모델정책.js').제미나이키경로('돈');
/* 🔴 **모델 «이름»도 문마다 다르다** — 09-04 에 주소만 Vertex 로 옮기고 이름을 안 고쳐서 09-05 에 404 를 밟았다:
 *   `Publisher model .../models/nano-banana-pro-preview was not found`.
 *   AI Studio 이름 `nano-banana-pro-preview` ↔ Vertex 이름 `gemini-3-pro-image`(같은 그림 모델).
 * 🔑 주소를 옮길 때 «이름표»도 같이 옮겼는지 본다 — 문만 갈면 그 문에 없는 이름을 부르게 된다.
 *   Vertex 에 실재하는 그림 모델(09-05 목록 실측) = `gemini-3-pro-image` · `gemini-3.1-flash-image` ·
 *   `gemini-3.1-flash-image-preview` · `gemini-3.1-flash-lite-image`. */
const 기본모델 = process.env.SYNK_IMAGE_MODEL || 'gemini-3-pro-image';

function 키(키경로 = 기본키경로) {
  const raw = fs.readFileSync(키경로, 'utf8');
  const m = raw.match(/AQ\.[A-Za-z0-9_\-.]+/) || raw.match(/AIza[A-Za-z0-9_\-]{20,}/);
  return m ? m[0] : raw.trim().split(/\r?\n/).filter(Boolean).pop();
}

const mime = (p) => (/\.jpe?g$/i.test(p) ? 'image/jpeg' : 'image/png');

/* ══════════════ 돈 게이트 (2026-09-03 · 유호 확정 「세운다」) ══════════════
 *
 * ■ 왜 붙였나 — 09-03 에 «글» 쪽에서 같은 사고를 실물로 밟았다
 *   몫이 이미 바닥인 줄 모르고 시험지를 28발 던졌고, 벽(429)을 만난 프로그램이 칸마다 4~5번
 *   다시 던져 하루 몫을 두 칸 만에 태웠다. 64분과 몫 전량을 날렸고 **답은 2칸**이었다.
 *   그쪽은 공짜라 0원으로 끝났지만, **여기는 같은 사고가 그대로 돈이다**(1컷 ≈ 190원).
 *
 * ■ 규칙 셋 — 싼 것을 앞에, 비싼 것을 뒤에
 *   ① 예상비용()   0원 — 몇 장에 얼마인가. 배치를 시작하기 «전»에 사람이 본다.
 *   ② 돈열쇠생존()  0원 — 크레딧이 살아 있나. **공짜 몫이 있는 «글» 모델로 물어본다**
 *      (그림 모델로 물으면 프로브 자체가 190원이다). 크레딧이 마르면 그 프로젝트는 글까지
 *      429 로 막힌다 — 09-02 실측(「prepayment credits are depleted」)이 그 근거다.
 *   ③ 돈벽 잠금    0원 — 한 번 벽을 만나면 **그 다음 호출은 던지기 전에 거절한다.**
 *      배치 도중 크레딧이 마르면 남은 장이 전부 「거절당하는 요청」이 되는데, 그게 09-03 의
 *      재시도 폭풍과 같은 모양이다. 여기서는 첫 벽에서 통째로 선다.
 *
 * 🔑 **성공 경로는 한 글자도 안 바뀐다** — 이미 구운 자산의 재현성을 지킨다(머리말 「건드리지 않았다」).
 *   달라지는 것은 «실패가 빨라지는 것» 하나다. */
let 돈벽 = null;   // { 때, 상태, 사유 } — 세워지면 이 프로세스에서 그림을 더 안 굽는다

/** 장당 달러 (구글 공식 가격표 09-03 · 머리말과 같은 출처). 모르는 크기는 1K 로 친다. */
const 장당달러 = { '1K': 0.134, '2K': 0.134, '4K': 0.24 };

/** 0원. 「N장에 얼마인가」를 굽기 전에 셈한다. */
function 예상비용(장수, 크기 = '1K', 환율 = 1400) {
  const 달러 = (장당달러[크기] ?? 장당달러['1K']) * 장수;
  return { 장수, 크기, 달러: Number(달러.toFixed(3)), 원: Math.round(달러 * 환율) };
}

/** 0원. 「돈」 열쇠가 살아 있나 — 공짜 몫이 있는 글 모델로 물어본다(그림 모델로 물으면 돈이 든다). */
async function 돈열쇠생존({ timeoutMs = 15000 } = {}) {
  return require('../모델정책.js').제미나이생존({ 용도: '돈', timeoutMs });
}

/** 지금 그림을 구워도 되나. 벽이 서 있으면 «왜»와 함께 false. */
const 구워도되나 = () => (돈벽 ? { 된다: false, 벽: 돈벽 } : { 된다: true });

/** 배치 시작 «전» 게이트 — 0원. 얼마 드는지 말하고, 크레딧이 죽어 있으면 한 장도 안 굽게 false.
 *  🔑 게이트를 부르는 쪽이 둘(펠트색굽기·라디오무대굽기)이라 **여기 한 곳에만** 둔다. */
async function 배치게이트(장수, 크기 = '1K') {
  const 값 = 예상비용(장수, 크기);
  console.log(`■ 굽기 게이트 — ${값.장수}장 × ${값.크기} ≈ $${값.달러} (약 ${값.원.toLocaleString()}원)`);
  const s = await 돈열쇠생존();
  if (s.살았나 === true) { console.log('  ✅ 「돈」 열쇠가 살아 있다 — 굽는다.'); return true; }
  if (s.살았나 === null) {
    console.log(`  🟠 **못 물어봤다**(${s.종류}) — 「살았다」가 아니다. 굽되 첫 장에서 벽을 만나면 거기서 선다.`);
    return true;
  }
  console.log(`  🔴 「돈」 열쇠가 막혀 있다(${s.상태} ${s.종류}) — **한 장도 안 굽는다**(0원).`);
  if (s.사유) console.log(`     ${String(s.사유).slice(0, 200)}`);
  console.log('     충전은 유호님 손이다: AI Studio → 결제. 찬 뒤 같은 명령을 다시 돌린다.');
  return false;
}

/* 돈이 마른 신호만 벽으로 센다 — 402(결제) · 403 중 billing 문면 · 429 중 «크레딧» 문면.
 * 400(잘못된 지시)이나 500(저쪽 사고)은 벽이 아니다. 그건 그 장만의 실패다.
 *
 * 🔑 **429 는 두 가지다**(09-05 실측으로 갈랐다):
 *   ㉠ 「Resource exhausted. Please try again later」 = **분당 몫**이다. 잠시 뒤 스스로 풀린다
 *      — 크레딧 43만 원이 살아 있는데도 났고, 40초를 두고 다시 던지니 그대로 구워졌다.
 *   ㉡ 「prepayment credits are depleted」 류 = **크레딧**이다. 안 풀린다.
 *   09-05 전에는 둘을 같이 벽으로 세워, 23장 배치가 첫 장에서 통째로 섰다(0장 구움).
 *   ㉠을 벽으로 세우면 «기다리면 되는 일»에 배치를 버리게 된다.
 *   ⚠ 그래도 ㉠이 그 장의 «실패»인 것은 같다 — 부르는 쪽이 기다렸다 다시 던진다
 *      (`공방굽기.js` 가 90초를 두고 한 번만 다시 던진다. 무한 재시도는 09-03 의 그 사고다). */
function 몫벽인가(status, 본문) {
  return status === 429 && !/credit|billing|payment|depleted/i.test(String(본문 || ''));
}

function 돈벽인가(status, 본문) {
  if (status === 402) return true;
  if (status === 429) return !몫벽인가(status, 본문);
  return status === 403 && /billing|quota|credit|payment/i.test(String(본문 || ''));
}

/** 한 컷 굽는다. 참조 경로가 하나라도 없으면 «굽기 전에» 던진다(빈 참조로 구우면 색이 갈린다). */
async function 한컷({ 이름, 지시, 참조 = [], 비율 = '1:1', 크기 = '1K', 저장경로, k, 모델 = 기본모델 }) {
  if (돈벽) {
    const e = new Error(`${이름} 안 던졌다 — 돈 벽이 서 있다(${돈벽.상태}): ${String(돈벽.사유).slice(0, 160)}`
      + `\n   크레딧이 마른 뒤의 호출은 전부 거절당한다. 충전 뒤 다시 돌린다(유호님 손).`);
    e.돈벽 = true; e.안던졌다 = true;
    throw e;
  }
  for (const r of 참조) if (!fs.existsSync(r)) throw new Error(`${이름} 참조 없음 — ${r}`);
  const parts = [{ text: 지시 }];
  for (const r of 참조) {
    parts.push({ inline_data: { mime_type: mime(r), data: fs.readFileSync(r).toString('base64') } });
  }
  const t0 = Date.now();
  /* 🚪 주소 정본 = `모델정책.제미나이URL('돈', 모델)`(09-04). 그림은 「돈」 열쇠라 **Vertex AI 문**으로 간다 —
   * 무료 크레딧 $300 이 AI Studio 문에는 안 먹고 그 문에는 먹기 때문이다(구글 공식). */
  const res = await fetch(require('../모델정책.js').제미나이URL('돈', 모델), {
    method: 'POST',
    // 🔑 Vertex 문은 API 키를 못 받는다(조직 밖 프로젝트 · 09-04) — 인증 머리는 정책이 낸다.
    headers: await require('../모델정책.js').제미나이헤더('돈'),
    body: JSON.stringify({
      // 🔑 `role` 은 Vertex 문이 요구한다(없으면 400 · 09-04) — AI Studio 도 받는 형태다.
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { imageSize: 크기, aspectRatio: 비율 } },
    }),
  });
  const 초 = ((Date.now() - t0) / 1000).toFixed(1);
  if (!res.ok) {
    const 본문 = (await res.text()).slice(0, 400);
    /* 돈이 마른 신호면 **벽을 세운다** — 이 뒤의 장들은 던지기 전에 거절된다.
     * 09-03 에 글 쪽에서 밟은 「벽에 대고 계속 던지기」를 여기서는 첫 장에서 끊는다. */
    if (돈벽인가(res.status, 본문)) {
      돈벽 = { 때: new Date().toISOString(), 상태: res.status, 사유: 본문 };
      const e = new Error(`${이름} 거절 ${res.status} (${초}초) — **돈 벽**이다. 남은 장은 안 던진다.\n   ${본문}`);
      e.돈벽 = true;
      throw e;
    }
    const e = new Error(`${이름} 거절 ${res.status} (${초}초) — ${본문}`);
    if (몫벽인가(res.status, 본문)) e.몫벽 = true;   // 부르는 쪽이 기다렸다 한 번 다시 던진다
    throw e;
  }
  const j = await res.json();
  const img = (j?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData || p.inline_data);
  if (!img) throw new Error(`${이름} 이미지 없음 (${초}초) — ${JSON.stringify(j).slice(0, 400)}`);
  fs.mkdirSync(path.dirname(저장경로), { recursive: true });
  fs.writeFileSync(저장경로, Buffer.from((img.inlineData || img.inline_data).data, 'base64'));
  console.log(`✅ ${이름} — ${초}초 · ${(fs.statSync(저장경로).size / 1024).toFixed(0)}KB`
    + ` · 토큰 ${j?.usageMetadata?.totalTokenCount ?? '?'} · 참조 ${참조.length}장`);
  return 저장경로;
}

module.exports = { 키, 한컷, 기본모델, 예상비용, 돈열쇠생존, 구워도되나, 돈벽인가, 몫벽인가, 장당달러, 배치게이트 };

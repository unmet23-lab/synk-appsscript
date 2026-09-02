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
const 기본모델 = 'nano-banana-pro-preview';

function 키(키경로 = 기본키경로) {
  const raw = fs.readFileSync(키경로, 'utf8');
  const m = raw.match(/AQ\.[A-Za-z0-9_\-.]+/) || raw.match(/AIza[A-Za-z0-9_\-]{20,}/);
  return m ? m[0] : raw.trim().split(/\r?\n/).filter(Boolean).pop();
}

const mime = (p) => (/\.jpe?g$/i.test(p) ? 'image/jpeg' : 'image/png');

/** 한 컷 굽는다. 참조 경로가 하나라도 없으면 «굽기 전에» 던진다(빈 참조로 구우면 색이 갈린다). */
async function 한컷({ 이름, 지시, 참조 = [], 비율 = '1:1', 크기 = '1K', 저장경로, k, 모델 = 기본모델 }) {
  for (const r of 참조) if (!fs.existsSync(r)) throw new Error(`${이름} 참조 없음 — ${r}`);
  const parts = [{ text: 지시 }];
  for (const r of 참조) {
    parts.push({ inline_data: { mime_type: mime(r), data: fs.readFileSync(r).toString('base64') } });
  }
  const t0 = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${모델}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': k, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { imageSize: 크기, aspectRatio: 비율 } },
    }),
  });
  const 초 = ((Date.now() - t0) / 1000).toFixed(1);
  if (!res.ok) throw new Error(`${이름} 거절 ${res.status} (${초}초) — ${(await res.text()).slice(0, 400)}`);
  const j = await res.json();
  const img = (j?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData || p.inline_data);
  if (!img) throw new Error(`${이름} 이미지 없음 (${초}초) — ${JSON.stringify(j).slice(0, 400)}`);
  fs.mkdirSync(path.dirname(저장경로), { recursive: true });
  fs.writeFileSync(저장경로, Buffer.from((img.inlineData || img.inline_data).data, 'base64'));
  console.log(`✅ ${이름} — ${초}초 · ${(fs.statSync(저장경로).size / 1024).toFixed(0)}KB`
    + ` · 토큰 ${j?.usageMetadata?.totalTokenCount ?? '?'} · 참조 ${참조.length}장`);
  return 저장경로;
}

module.exports = { 키, 한컷, 기본모델 };

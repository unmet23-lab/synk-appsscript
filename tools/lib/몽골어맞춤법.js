'use strict';
/* 몽골어 맞춤법 층 — 역번역이 «원리상» 못 보는 자리를 보는 자다.
 *
 * 왜 필요한가(2026-09-01 실측 · 이 파일이 태어난 까닭):
 *   캐러셀 LAB001 몽골어를 제미나이 검문에 태우니 문법 「정상 — 오류 없고 자연스럽다」로 통과했다.
 *   같은 글을 이 층에 태우니 `бүрт` 가 틀렸다고 나왔다(→ `бүрд`). 그 낱말은 홍보 트리오 «정본»에
 *   들어 있었고 synk.im 라이브에까지 나가 있었다.
 *   🔑 **역번역은 철자를 못 잡는다.** LLM 은 깨진 철자를 «알아서 고쳐 읽고» 멀쩡한 한국어를 뱉기
 *   때문이다 — 파손이 한국어에 안 비친다. 자를 하나 더 대는 게 아니라, **아무 자도 없던 축**이다.
 *   (자 시험: `Монгул`·`байнa`(끝이 라틴 a) 를 둘 다 집었고 맞는 문장엔 0건을 냈다.)
 *
 * 자의 정체 = spellcheck.mn — 몽골 현지 맞춤법 서비스. LLM 이 아니라 사전·형태소 자다.
 *   ⚠ **문서화된 API 가 아니다.** 사이트가 제 프런트엔드에 쓰는 엔드포인트를 그대로 부른다
 *     (요청 `key` = 본문 문자 코드 합의 sha256 — 사이트 `$encrypt` 와 같은 셈). 자격증명이 아니다.
 *     서비스가 형식을 바꾸면 **조용히 0건이 아니라 크게 실패해야 한다** — 아래 실패 방향 참고.
 *   ⚠ 본문이 외부로 나간다. **공개 카피 전용** — 학생 식별 정보 금지(제미나이 층과 같은 경계).
 *   출처 = github.com/Tsagaanbayr1/mongolian-spellcheck-skill 의 방식(2026-09-01 실측·별 12).
 *     스킬을 «설치»하지 않고 방식만 들였다 — 우리 검문기 한 통로로 모으기 위해서다.
 *
 * 🔴 실패 방향: 못 물어봤으면 「0건」이 아니라 **null(미측정)** 이다.
 *   빈 배열로 물러서면 「맞춤법 위반 0건」이 되어 안 잰 것이 통과로 읽힌다
 *   — 말투 층이 voice-guard 철거 때 겪은 바로 그 함정이다(몽골어대조.js 31~34줄).
 */

const { createHash } = require('crypto');

const BASE = 'https://spellcheck.mn/cms-client/modules/spellchecker';
const MOD = 10_000_000_008n;
const 타임아웃 = 20_000;

/* 우리가 «지어낸» 이름만 넣는다 — 사전에 없는 게 당연한 것들.
 * 🚫 여기에 «몽골어 낱말인지 아닌지 우리가 모르는 것»을 넣지 않는다. 그 순간 이 자는 모래주머니가 된다.
 *    보기: `рейд`(레이드)는 일부러 안 넣었다 — 몽골 학생이 실제로 쓰는 낱말인지가 **검수자에게 물을 것**이지
 *    우리가 통과시킬 것이 아니다(맞춤법 자는 `дайралт` 를 안다).
 * ⚠ 「크루」의 몽골 철자는 저장소에서 «Кру»와 «Крю» 둘로 갈려 있다(2026-09-01 실측: Кру 계열 9 · Крю 계열 25).
 *    유호님 확정 전이라 **둘 다** 통과시킨다 — 자가 그 갈림을 판정하는 자리가 아니다. */
const 우리이름 = new Set([
  'SYNK', 'Кру', 'Крю', 'кру', 'крю', 'КРУ', 'КРЮ',
  'ТОПИК', 'TOPIK', 'AI', 'ChatGPT',
]);

/* 🔴 서수 표기 `4-р` 를 서비스 토크나이저가 «4» 와 «-р» 로 쪼개 `-р` 를 모르는 낱말로 준다
 *   (2026-09-02 실측 · 제안이 `-т`·`-д`·`ёр`… 로 나온다). 몽골어에서 `4-р түвшин`(4급)은
 *   **정상 표기**이고 라이브 문안도 그렇게 쓴다 — 안 걸러내면 우리 급수 표기가 영원히 걸린다.
 *   ⚠ 낱말이 아니라 «토큰 부스러기»만 거른다: 붙임표 + 자모 두 자 이하. */
const 서수부스러기 = /^-[А-Яа-яӨөҮү]{1,2}$/;

/** 어미가 붙어도 우리 이름이면 통과(Крюгийн · крютэйгээ · AI-ийн …).
 * 🔴 몽골어는 «외래 약어 + 붙임표 + 어미»가 정상 표기다(`AI-ийн` · `SYNK-д`).
 *   실측 09-01: 붙임표를 지우고 재면 `AIийн` 이 되어 사전에 없는 낱말이 되고,
 *   두 글자 이름(`AI`)은 접두어 규칙에도 안 걸려 **맞는 표기가 오답으로 잡혔다.**
 *   그래서 붙임표 «앞 토막»으로도 본다 — 지우지 않는다. */
function 우리것인가(w) {
  const 후보 = new Set([w, w.replace(/-/g, ''), w.split('-')[0]]);
  for (const c of 후보) {
    if (우리이름.has(c)) return true;
    for (const n of 우리이름) {
      if (n.length >= 3 && c.length > n.length && c.startsWith(n)) return true;
    }
  }
  return false;
}

/**
 * 「걸린 것이 라틴 앞자락뿐인가」 — `K-соёлын`(K-컬처의) 꼴을 가른다.
 *
 * 🔴 왜 있나(09-06): 캐러셀 LAB001 이 `K-соёлын` 한 건에 막혀 못 지나갔다. 몽골어는
 *   «라틴 약어 + 붙임표 + 몽골어 어미»가 정상 표기고(이 파일 §`우리것인가` 가 `AI-ийн` 으로
 *   이미 적어 둔 그 원리다), 사전은 라틴 앞자락을 몰라서 낱말 전체를 오타로 준다.
 * 🚫 이름 목록에 `K` 를 넣는 길은 **안 간다** — 그러면 붙임표 뒤 몽골어가 통째로 검사 밖으로
 *   나가 이 자가 모래주머니가 된다(머리말이 막으려는 바로 그것).
 * 🔑 대신 **사전이 스스로 답하게 한다**: 제안 중에 «붙임표 뒤 토막 그대로»가 있으면 사전이
 *   그 토막을 아는 것이고, 걸린 것은 앞자락뿐이다 ⇒ 통과. 뒤 토막이 틀렸으면(`K-соёлийн`)
 *   제안에 그 토막이 없어 **그대로 의심으로 남는다** — 검사가 죽지 않는다.
 * ⚠ 제안을 못 받았으면(null) 판정하지 않는다 — 「모름」은 통과가 아니다.
 */
function 라틴앞자락뿐(낱말, 제안들) {
  const m = /^([A-Za-z]{1,3})-(.+)$/.exec(String(낱말 || ''));
  if (!m) return false;
  return Array.isArray(제안들) && 제안들.some((s) => String(s) === m[2]);
}

/** 사이트가 요구하는 요청 키. 자격증명이 아니라 본문 해시다. */
function 요청키(s) {
  let n = 0n;
  for (const ch of s) { n += BigInt(ch.codePointAt(0)) + 1n; n %= MOD; }
  return createHash('sha256').update(String(n), 'utf8').digest('hex');
}

async function 부르기(엔드포인트, payload) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 타임아웃);
  try {
    const res = await fetch(`${BASE}/${엔드포인트}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://spellcheck.mn',
        referer: 'https://spellcheck.mn/',
        accept: 'application/json, text/plain, */*',
        // 🔴 ASCII 만. HTTP 헤더는 ByteString 이라 한글을 넣으면 fetch 가 «요청 전에» 던진다
        //    (실측 09-01: "SYNK 몽골어 검문" → TypeError, 그리고 이 파일의 실패 방향이 그걸
        //     「미측정」으로 옳게 냈다). 바깥으로 나가는 낱말은 ASCII — 스키마 키·CSS·Sentry 태그와 같은 병.
        'user-agent': 'Mozilla/5.0 (SYNK mn-check)',
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // 사이트가 키를 거절하면 «따옴표 낀 문자열»을 준다 — JSON 으로는 읽히므로 따로 잡는다.
    if (body.trim().replace(/^"|"$/g, '') === 'Invalid hash.') throw new Error('키 거절(Invalid hash) — 사이트 셈이 바뀌었나');
    const j = JSON.parse(body);
    return j;
  } finally { clearTimeout(timer); }
}

/**
 * @returns {Promise<null | {의심: string[], 제안: Object<string,string[]>, 허용: string[]}>}
 *          null = **미측정**(못 물어봤다). 빈 의심 배열 = 물어봤고 0건.
 */
async function 맞춤법검사(mn, { 제안받기 = true } = {}) {
  /* 🔴 줄바꿈을 그대로 보내면 서비스가 다음 낱말에 «n» 을 붙여 돌려준다 — 거짓 양성 공장이다.
   *   실측 09-01: 같은 문장이 한 줄이면 의심 0, `\n` 하나 끼면 `nГэвч` 1건.
   *   캐러셀 본문(7단락)에선 진짜 1건이 **거짓 8건에 파묻혔다**. 이 층은 여러 줄 문서가 주 용도라
   *   (`--파일` 모드) 이 정규화가 없으면 자가 아니라 모래주머니가 된다. */
  const text = String(mn || '').replace(/\s+/g, ' ').trim();
  if (text.length < 2) return { 의심: [], 제안: {}, 허용: [] };
  let 낱말;
  try {
    const r = await 부르기('check', { text, key: 요청키(text) });
    if (!Array.isArray(r)) throw new Error('check 가 배열이 아닌 것을 줬다');
    /* 🔴 붙임표를 지우지 않는다 — 지우면 `AI-ийн`(맞는 표기)이 `AIийн`(없는 낱말)이 된다.
     *   원래 참고한 스킬은 지웠는데, 그게 우리 글에선 바로 거짓 양성을 냈다(실측 09-01). */
    낱말 = r.map((w) => String(w));
  } catch (e) {
    return null; // 🔴 0건이 아니다 — 미측정이다
  }
  const 허용 = 낱말.filter((w) => 우리것인가(w) || 서수부스러기.test(w));
  let 의심 = 낱말.filter((w) => !우리것인가(w) && !서수부스러기.test(w));
  const 제안 = {};
  if (제안받기) {
    for (const w of new Set(의심)) {
      try { 제안[w] = await 부르기('suggest', { word: w, key: 요청키(w) }); }
      catch { 제안[w] = null; } // 이 낱말의 제안만 못 받았다 — 의심 자체는 유효하다
    }
    for (const w of new Set(의심)) if (라틴앞자락뿐(w, 제안[w])) 허용.push(w);
    의심 = 의심.filter((w) => !라틴앞자락뿐(w, 제안[w]));
  }
  return { 의심, 제안, 허용 };
}

module.exports = { 맞춤법검사, 요청키, 우리것인가, 우리이름, 라틴앞자락뿐 };

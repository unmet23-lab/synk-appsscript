#!/usr/bin/env node
/**
 * 브랜드폰트 — SUIT Variable 을 «지면 안»에 심는 단일 통로 (2026-09-03)
 *
 * ══ 왜 있나 — 발행하면 브랜드 서체가 조용히 사라졌다 ═══════════════════════
 *   지면들이 서체를 바깥에서 불렀다:
 *     <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/sun-typeface/SUIT/…/SUIT-Variable.css">
 *   그런데 아티팩트 뷰어의 CSP(내려받을 수 있는 곳을 못박은 규칙)는 **스타일시트를
 *   Google Fonts 에서만** 허용한다. cdn.jsdelivr.net 은 `/npm/` 아래 «스크립트»만 열려 있다.
 *   ⇒ 발행된 지면은 **에러 없이** 대체 서체로 내려앉는다. 화면은 멀쩡해 보이고,
 *      경고는 «발행 결과 한 줄»에만 뜬다 — 사람이 그 줄을 읽어야만 아는 실패였다.
 *   ⇒ 그리고 네트워크가 없으면(비행기·오프라인) 어느 통로로 열어도 같은 일이 난다.
 *
 * ══ 읽는 사람이 내려받는 양은 «늘지 않는다» (2026-09-03 실측) ═══════════════
 *   CDN 이 주는 `SUIT-Variable.css` 는 @font-face **한 벌**에 woff2 **한 파일**이고
 *   `unicode-range` 쪼개기가 없다 — 즉 브라우저는 어차피 이 610KB 를 통째로 받았다.
 *   인라인은 그 바이트를 «옮길» 뿐 «더하지» 않는다(왕복 한 번은 오히려 준다).
 *   늘어나는 것은 **저장소 크기 하나**다.
 *
 * ══ 이 파일이 쥔 것 = 자산 하나 + 지문 ═════════════════════════════════════
 *   `docs/브랜드_폰트/SUIT/SUIT-Variable.woff2` · 624,536 바이트
 *   sha256 aa894a204d5a6fbae259dac6868d350cbd373a390caee0313f92946af741df23
 *   → CDN 원본과 **바이트 동일**을 09-03 에 대조했다(`curl` 로 받아 sha256 일치).
 *   → 글리프 2,956 · cmap 2,933 · 한글 음절 2,668(SUIT 가 원래 이만큼이다).
 *     저장소 지면 123벌이 쓰는 한글 음절 1,213 중 **이 폰트 밖은 3자**(눤·떈·릳 = 깨진 조각).
 *     ⇒ 인라인이 글리프를 잃지 않는다. 같은 파일이다.
 *
 * ══ 이 장치가 틀릴 때의 모습 ═══════════════════════════════════════════════
 *   폰트 파일이 없거나 바뀌었는데 조용히 «빈 @font-face» 를 심는 것 — 그러면 지면은
 *   또 대체 서체로 내려앉고 검사는 초록이다. ⇒ 그래서 **읽는 자리에서 지문을 문다**(던진다).
 *
 * 쓰기:
 *   node tools/lib/브랜드폰트.js --심기 <파일.html…>   (손 HTML 에 심는다 · 멱등)
 *   node tools/lib/브랜드폰트.js --자   <파일.html…>   (Google Fonts 밖 외부 자원을 센다)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const 루트 = path.resolve(__dirname, '..', '..');

const 경로 = path.join(루트, 'docs', '브랜드_폰트', 'SUIT', 'SUIT-Variable.woff2');
const 바이트 = 624536;
const 지문 = 'aa894a204d5a6fbae259dac6868d350cbd373a390caee0313f92946af741df23';

/** 아티팩트 뷰어가 스타일시트·폰트를 허용하는 유일한 두 곳. 여기 밖은 조용히 막힌다. */
const 허용호스트 = ['fonts.googleapis.com', 'fonts.gstatic.com'];

/* ── 자산 ──────────────────────────────────────────────────────────────── */

let _캐시 = null;

/**
 * woff2 원본. **지문이 안 맞으면 던진다** — 조용히 다른 폰트를 심는 것이 이 자리의 유일한 실패 모드다.
 * @returns {Buffer}
 */
function woff2() {
  if (_캐시) return _캐시;
  if (!fs.existsSync(경로)) {
    throw new Error('브랜드 서체 원본이 없다: ' + path.relative(루트, 경로)
      + '\n  다시 받는다: curl -L -o "' + path.relative(루트, 경로) + '" '
      + 'https://cdn.jsdelivr.net/gh/sun-typeface/SUIT/fonts/variable/woff2/SUIT-Variable.woff2');
  }
  const buf = fs.readFileSync(경로);
  const 잰지문 = crypto.createHash('sha256').update(buf).digest('hex');
  if (buf.length !== 바이트 || 잰지문 !== 지문) {
    throw new Error('브랜드 서체 원본이 못박은 지문과 다르다 — 조용히 다른 폰트를 심을 뻔했다.'
      + '\n  못박은 것: ' + 바이트 + '바이트 · ' + 지문
      + '\n  지금 파일: ' + buf.length + '바이트 · ' + 잰지문
      + '\n  폰트를 «일부러» 바꿨다면 이 파일 머리의 바이트·지문 두 줄을 같이 고친다.');
  }
  if (buf.slice(0, 4).toString('latin1') !== 'wOF2') {
    throw new Error('woff2 가 아니다(매직 wOF2 없음): ' + path.relative(루트, 경로));
  }
  _캐시 = buf;
  return buf;
}

/** @font-face 규칙 한 벌. `<style>` 안에 그대로 넣는다(스킨이 이 모양으로 싣는다). */
function 면() {
  return "@font-face{font-family:'SUIT Variable';font-weight:100 900;font-display:swap;"
    + 'src:url(data:font/woff2;base64,' + woff2().toString('base64') + ") format('woff2-variations');}";
}

/** 머리에 그대로 꽂는 `<style>` 블록. 손 HTML 이 쓰는 모양. */
function 블록() {
  return '<style data-synk-폰트="SUIT">' + 면() + '</style>';
}

/* ── 걷기·심기 ─────────────────────────────────────────────────────────── */

/* SUIT 를 «바깥에서» 부르는 세 모양. 하나라도 남으면 CSP 가 막고 오프라인에서 죽는다. */
const CDN링크 = /[ \t]*<link\b[^>]*sun-typeface[^>]*>[ \t]*\r?\n?/gi;
const CDN임포트 = /[ \t]*@import\s+url\(\s*['"]?[^'")]*sun-typeface[^'")]*['"]?\s*\)\s*;?[ \t]*\r?\n?/gi;
const CDN면 = /@font-face\s*\{[^}]*sun-typeface[^}]*\}/gi;
/* 폰트를 심고 나면 이 예열 줄은 아무 데도 안 닿는다 — 남기면 「무엇을 부르나」가 흐려진다. */
const 죽은예열 = /[ \t]*<link\b[^>]*rel=["']?(?:preconnect|dns-prefetch)["']?[^>]*cdn\.jsdelivr\.net[^>]*>[ \t]*\r?\n?/gi;

/* 이 도구가 심은 블록. «원고»(굽기 입력)에서 도로 뺄 때 쓴다 — 원고에 832KB 를 박으면
   diff 가 죽고 재현 대조가 무거워진다. 서체는 «굽기»가 산출물에만 싣는다. */
const 심은블록 = /[ \t]*<style data-synk-폰트="SUIT">[\s\S]*?<\/style>[ \t]*\r?\n?/gi;

/** 원고로 되돌린다 — 바깥 호출도, 심은 블록도 뺀다(굽기가 다시 싣는다). 멱등. */
function 원고로(html) {
  return 걷기(html).replace(심은블록, '');
}

/** 이미 «안»에 심겼나 — data: URI 로 된 SUIT @font-face 가 있나. */
function 심겼나(html) {
  return /@font-face[^}]*SUIT[^}]*data:font\/woff2/i.test(html);
}

/** SUIT 를 바깥에서 부르는 자리를 전부 걷는다(멱등). 심는 것은 하지 않는다. */
function 걷기(html) {
  let s = html.replace(CDN링크, '').replace(CDN임포트, '').replace(CDN면, '');
  /* 예열 줄은 «다른 jsdelivr 쓰임이 하나도 안 남았을 때»만 걷는다 — 남의 자원을 끊지 않는다. */
  const 남은 = s.replace(죽은예열, '');
  if (!/cdn\.jsdelivr\.net/i.test(남은)) s = 남은;
  return s;
}

/**
 * 손 HTML 에 폰트를 심는다 — 바깥 호출을 걷고 그 «자리»에 블록을 놓는다. 멱등이다.
 * @returns {{html:string, 바뀜:boolean, 자리:string}}
 */
function 심기(원문) {
  if (심겼나(원문)) {
    const 걷힌 = 걷기(원문);
    return { html: 걷힌, 바뀜: 걷힌 !== 원문, 자리: '이미 심겼다' };
  }
  const 줄끝 = 원문.includes('\r\n') ? '\r\n' : '\n';

  /* ① CDN @font-face 가 있으면 그 자리를 그대로 물려받는다(자율기록 계열의 모양). */
  CDN면.lastIndex = 0;
  if (CDN면.test(원문)) {
    CDN면.lastIndex = 0;
    let 처음 = true;
    const s = 원문.replace(CDN면, () => (처음 ? ((처음 = false), 면()) : ''));
    return { html: 걷기(s), 바뀜: true, 자리: '옛 @font-face 자리' };
  }

  /* ② CDN <link> 가 있으면 그 줄을 블록으로 갈아 끼운다 — 서체가 서던 자리 그대로다. */
  CDN링크.lastIndex = 0;
  if (CDN링크.test(원문)) {
    CDN링크.lastIndex = 0;
    let 처음 = true;
    const s = 원문.replace(CDN링크, (m) => {
      if (!처음) return '';
      처음 = false;
      return 블록() + (m.endsWith('\n') ? 줄끝 : '');
    });
    return { html: 걷기(s), 바뀜: true, 자리: '옛 <link> 자리' };
  }

  /* ③ 부르는 자리가 아예 없던 지면 — 머리에 새로 세운다. 순서는 «폰트가 먼저»다. */
  const 걷힌 = 걷기(원문);
  for (const [정규, 뒤에] of [
    [/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/i, false],
    [/<\/title>/i, true],
    [/<meta\b[^>]*charset[^>]*>/i, true],
  ]) {
    const m = 정규.exec(걷힌);
    if (!m) continue;
    const i = 뒤에 ? m.index + m[0].length : m.index;
    const 조각 = 뒤에 ? 줄끝 + 블록() : 블록() + 줄끝;
    return { html: 걷힌.slice(0, i) + 조각 + 걷힌.slice(i), 바뀜: true, 자리: '머리 새 자리' };
  }
  throw new Error('머리를 못 찾았다 — <title>·<meta charset>·<link rel=stylesheet> 중 하나가 있어야 심을 자리가 선다');
}

/* ── 자 — 발행 전에 «바깥을 부르는 자리»를 센다 ────────────────────────── */

/* 페이지가 «실제로 받아오는» 자리만 센다. `<a href>` 는 이동이지 받아오기가 아니라서 뺀다 —
   넣으면 바깥 링크를 단 보고 지면이 전부 빨개지고, 그런 적색은 곧 꺼진다. */
const 받아오는자리 = [
  ['스타일시트', /<link\b(?=[^>]*\brel=["']?stylesheet["']?)[^>]*\bhref=["']([^"']+)["']/gi],
  ['미리받기', /<link\b(?=[^>]*\brel=["']?(?:preload|prefetch)["']?)[^>]*\bhref=["']([^"']+)["']/gi],
  ['아이콘', /<link\b(?=[^>]*\brel=["'][^"']*icon[^"']*["'])[^>]*\bhref=["']([^"']+)["']/gi],
  ['스크립트', /<script\b[^>]*\bsrc=["']([^"']+)["']/gi],
  ['그림·미디어', /<(?:img|source|video|audio|iframe|embed|track)\b[^>]*\bsrc=["']([^"']+)["']/gi],
  ['CSS 임포트', /@import\s+url\(\s*['"]?([^'")]+)['"]?\s*\)/gi],
  ['CSS url()', /url\(\s*['"]?(https?:\/\/[^'")]+)['"]?\s*\)/gi],
];

/* 「서체·스타일」 축에 드는 종류 — 발행 지면에서 브랜드 서체를 죽이는 것들이다.
   그림·미디어는 «자립성» 축이라 여기 안 든다(그쪽은 펠트문서.검사 가 따로 잰다). */
const 서체축 = ['스타일시트', '미리받기', '스크립트', 'CSS 임포트', 'CSS url()'];

const 호스트 = (u) => { try { return new URL(u).host; } catch { return null; } };

/**
 * 자 — 이 지면이 «바깥에서» 받아오는 것 중 허용 밖의 것.
 * @param {{축?:'전부'|'서체'}} [옵션] '서체' 면 스타일·폰트·스크립트만 센다(그림은 뺀다).
 * @returns {{종류:string, url:string, 사유:string}[]} 빈 배열이면 발행해도 서체가 안 사라진다.
 */
function 바깥것(html, 옵션 = {}) {
  const 흠 = [];
  const 본것 = new Set();
  for (const [종류, 정규] of 받아오는자리) {
    if (옵션.축 === '서체' && !서체축.includes(종류)) continue;
    정규.lastIndex = 0;
    for (const m of html.matchAll(정규)) {
      const u = m[1].trim();
      if (u.startsWith('data:') || u.startsWith('#')) continue;
      const 열쇠 = 종류 + '|' + u;
      if (본것.has(열쇠)) continue;
      본것.add(열쇠);
      if (/^https?:\/\//i.test(u)) {
        const h = 호스트(u);
        if (h && 허용호스트.includes(h)) continue;
        흠.push({ 종류, url: u, 사유: '아티팩트 CSP 가 막는 바깥 호스트 — 허용은 ' + 허용호스트.join(' · ') + ' 뿐' });
      } else if (옵션.축 !== '서체' && (종류 === '스타일시트' || 종류 === '그림·미디어' || 종류 === '스크립트')) {
        /* 상대 경로는 «자립성» 축이다(파일 하나로 안 간다) — CSP 가 막는 자리가 아니다.
           '서체' 축에서 같이 물면 봇 오버레이처럼 «옆 파일과 한 벌로 도는» 물건이
           「서체가 막힌다」로 잘못 읽힌다. 자립성은 펠트문서.검사() 가 축 없이 잰다. */
        흠.push({ 종류, url: u, 사유: '상대 경로 — 지면 하나만 보낼 때 같이 안 간다' });
      }
    }
  }
  return 흠;
}

/**
 * 발행 준비 판정 한 벌 — «안 부르나»(음성)와 «심겼나»(양성)를 **같이** 낸다.
 * 🔑 음성만 세면 폰트 선언이 통째로 사라진 지면도 초록이 된다(0건이 성공 얼굴).
 */
function 발행판정(html) {
  const 흠 = 바깥것(html).map((x) => x.종류 + ' ' + x.url + ' — ' + x.사유);
  if (!심겼나(html)) 흠.push('SUIT 가 지면 안에 없다 — 브랜드 서체가 통째로 대체 서체로 내려앉는다');
  /* 허용된 바깥 = Google Fonts(Inter Tight · DM Mono). 0 이 아니라 «몇 개»로 적는다 —
     분모 없는 0 은 「안 부른다」와 「안 쟀다」가 같은 얼굴이 된다. */
  const 허용된 = [...new Set([...html.matchAll(/https?:\/\/([^/"')\s]+)/g)]
    .map((m) => m[1]).filter((h) => 허용호스트.includes(h)))];
  return { 흠, 심겼나: 심겼나(html), 허용된 };
}

module.exports = { 경로, 바이트, 지문, 허용호스트, woff2, 면, 블록, 심겼나, 걷기, 원고로, 심기, 바깥것, 발행판정 };

/* ── CLI ───────────────────────────────────────────────────────────────── */

if (require.main === module) {
  const 인자 = process.argv.slice(2);
  const 모드 = 인자[0];
  const 파일들 = 인자.slice(1);
  const 상대 = (p) => path.relative(루트, path.resolve(p)).replace(/\\/g, '/');

  if (모드 === '--심기') {
    if (!파일들.length) { console.error('용법: node tools/lib/브랜드폰트.js --심기 <파일.html…>'); process.exit(2); }
    let 바뀐 = 0; let 그대로 = 0;
    for (const f of 파일들) {
      const 원문 = fs.readFileSync(f, 'utf8');
      const r = 심기(원문);
      if (r.바뀜) { fs.writeFileSync(f, r.html); 바뀐 += 1; } else 그대로 += 1;
      const kb = (s) => (Buffer.byteLength(s, 'utf8') / 1024).toFixed(0);
      console.log('  %s %s  (%s → %sKB · %s)', r.바뀜 ? '✍' : '✅', 상대(f), kb(원문), kb(r.html), r.자리);
    }
    console.log('\n  합계 %d = 심음 %d + 그대로 %d', 파일들.length, 바뀐, 그대로);
    process.exit(0);
  }

  if (모드 === '--원고로') {
    if (!파일들.length) { console.error('용법: node tools/lib/브랜드폰트.js --원고로 <원고.html…>'); process.exit(2); }
    let 바뀐 = 0;
    for (const f of 파일들) {
      const 원문 = fs.readFileSync(f, 'utf8');
      const s = 원고로(원문);
      if (s !== 원문) { fs.writeFileSync(f, s); 바뀐 += 1; }
      const kb = (x) => (Buffer.byteLength(x, 'utf8') / 1024).toFixed(0);
      console.log('  %s %s  (%s → %sKB)', s !== 원문 ? '✍' : '✅', 상대(f), kb(원문), kb(s));
    }
    console.log('\n  합계 %d = 되돌림 %d + 그대로 %d — 서체는 굽기가 산출물에만 싣는다', 파일들.length, 바뀐, 파일들.length - 바뀐);
    process.exit(0);
  }

  if (모드 === '--자') {
    if (!파일들.length) { console.error('용법: node tools/lib/브랜드폰트.js --자 <파일.html…>'); process.exit(2); }
    let 빨강 = 0;
    for (const f of 파일들) {
      const { 흠 } = 발행판정(fs.readFileSync(f, 'utf8'));
      if (!흠.length) { console.log('  ✅ ' + 상대(f)); continue; }
      빨강 += 1;
      console.log('  🔴 ' + 상대(f));
      흠.forEach((h) => console.log('       · ' + h));
    }
    console.log('\n  합계 %d = 통과 %d + 흠 %d', 파일들.length, 파일들.length - 빨강, 빨강);
    process.exit(빨강 ? 1 : 0);
  }

  console.error('용법: node tools/lib/브랜드폰트.js --심기|--원고로|--자 <파일.html…>');
  console.error('  --심기   손 HTML 에 서체를 심는다(멱등)');
  console.error('  --원고로 굽기 «입력»에서 서체를 도로 뺀다 — 원고는 가볍게 둔다');
  console.error('  --자     Google Fonts 밖 외부 자원과 「서체가 안에 있나」를 센다');
  process.exit(2);
}

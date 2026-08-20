#!/usr/bin/env node
/* 자율기록 — 자율주행 중 **내가 혼자 정한 굵직한 갈림길**을 유호님이 나중에 하나씩 열어
 * 확인·수정할 수 있게 쌓는다.
 *
 * 유호 상시 지시(2026-08-09): "니가 앱 작업하면서 자율주행하고 있잖아. 그 과정중 굵직한
 * 선택들을 기록해줬으면 좋겠어. 바탕화면 폴더 한 곳에 기록해주라. 나중에 니가 전부 다
 * 만드는 과정이 끝나면 하나씩 확인하면서 수정하자."
 *
 * 왜 새로 짓나 — 기록처는 이미 있었는데 **유호님 눈에 안 닿았다**:
 *   메모리 `autonomous-build-mode` §2 는 「갈림길은 묻는 대신 결정큐·보드에 기록」이라고
 *   적어 뒀다. 둘 다 repo 안이고, 결정큐는 **유호님이 답할 것**만 배달하며(⏳ 표식), 보드는
 *   세션 선언판이라 종료 즉시 아카이브로 빠진다. 즉 「내가 이미 정해서 물을 게 없는 것」은
 *   구조적으로 유호님께 도달할 통로가 없었다. 그 자리를 이 파일이 채운다.
 *
 * 설계 급소 넷:
 *   ① **정본은 jsonl 한 줄 = 한 사건**(append-only). 세션 7개가 동시에 도는 저장소라
 *      md 표를 고치면 그 자리에서 충돌한다(F250 의 그 자리). 판정도 덮어쓰기가 아니라
 *      새 줄로 붙이고, 읽을 때 번호별 최신이 이긴다.
 *   ② **`되돌리기` 는 필수 필드다.** 「나중에 하나씩 확인하면서 수정」의 재료는 결정 목록이
 *      아니라 **바꾸는 비용**이다. 그게 없으면 유호님은 긴 목록 앞에서 아무것도 못 정한다.
 *   ③ **`add` 가 굽기까지 한 벌로 한다.** jsonl 과 HTML 을 손으로 두 번 맞추면 반드시
 *      갈라진다(CLAUDE.md 「같은 판정을 두 곳에 적으면 갈라진다」).
 *   ④ **`--파일` 통로를 처음부터 둔다.** 본문에 백틱·따옴표·줄바꿈이 들어가는데 셸 인라인에
 *      맡기면 F297 이 그대로 재발한다(`friction.js` 에 `--파일` 이 없어서 인자 토큰이
 *      **그대로 본문이 되어 커밋까지 갔다**). `shell-inline-guard` 도 인라인을 막는다.
 *
 * 쓰기:
 *   node tools/자율기록.js add --파일 결정.json        한 건 또는 배열
 *   node tools/자율기록.js 판정 --번호 7 --결과 바꿈 --메모 "..."
 *   node tools/자율기록.js 효과 --스캔                  그 뒤 어떻게 됐나 — 후보만 뽑는다
 *   node tools/자율기록.js 효과 --번호 7 --효과 뒤집힘 --근거 "..."
 *   node tools/자율기록.js --목록                       콘솔로 훑기
 *   node tools/자율기록.js --굽기                       HTML 재생성 + 바탕화면 등재
 *
 * ⚠ **축이 둘이다 — 섞지 않는다**(2026-08-15 신설):
 *   `결과`(유지·바꿈·보류) = 유호님이 그 결정을 승인했나 — **사람 축**
 *   `효과`(섰다·뒤집힘·무효) = 그 판단이 그 뒤 어떻게 됐나 — **사실 축**
 *   둘을 한 칸에 두면 「유호님이 아직 안 봤다」와 「우리가 안 재봤다」가 같은 얼굴이 된다.
 *
 * 결정 JSON 한 건:
 *   { "영역":"앱 화면", "제목":"…", "고른것":"…", "대안":["…","…"],
 *     "근거":"…", "되돌리기":"…", "저장소":"talk", "커밋":"af750e7" }
 */
'use strict';
const fs = require('node:fs');

/* ── Loom — 이 지면이 부품을 «입는» 통로 (2026-08-18 · ④ 지면 배선) ──────────────
 * 판정(훅 게이트·얹을 자리·멱등·범위진단)은 전부 `tools/lib/loom얹기.js` 하나가 진다.
 * 여기서 고르는 것은 프리셋 하나뿐 — `부품만` = 지면이 자기 디자인을 지고 부품만 얹는 판.
 * 🔴 훅이 0 이면 통로가 «안 얹는다». 그래야 「마커만 켜진 초록」이 안 생긴다(F517②). */
const loom얹기모듈 = require('./lib/loom얹기.js');
function loom태우기(html) {
  const r = loom얹기모듈.얹기(html, { 지면: '부품만' });
  if (!r.얹힘 && r.범위흠) console.error('   ⚠ Loom 미적용 — ' + r.범위흠);
  else if (r.얹힘) console.error(`   ✅ Loom 부품 ${r.훅.length}종 — ${r.훅.join('·')}`);
  return r.html;
}

const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const 형제저장소 = require(path.join(ROOT, '.claude', 'hooks', 'lib', '형제저장소.js'));
const 정본 = path.join(ROOT, 'docs', '_ops', '자율주행_결정록.jsonl');
const 파생 = path.join(ROOT, 'docs', '자율주행_결정록.html');
const 표시이름 = '자율주행 결정 기록';

const 결과값 = ['대기', '유지', '바꿈', '보류'];
const 필수 = ['제목', '고른것', '근거', '되돌리기'];

/* ── 효과 축 (2026-08-15 신설 · 유호 확정 「먼저 이거 하자」) ─────────────
 * `결과`(유지·바꿈·보류)는 **유호님이 그 결정을 승인했나**이지 **그 판단이 옳았나**가
 * 아니다. 경험 레코드 6칸(상황·문제·판단·왜·결과·다음) 중 「결과」가 통째로 비어 있던
 * 자리가 여기다 — 이 축이 없으면 28건은 «내가 무엇을 골랐는가»의 목록에서 멈추고,
 * 「어떤 상황에서 어떤 판단이 효과적이었는가」(경험 학습)의 재료가 되지 못한다.
 *
 * ⚠ 값을 「좋았다/나빴다」로 두지 않았다 — 회사 판단은 학생 개입과 달리 수치가 안 나오고,
 *   평가어를 두면 관측이 아니라 자평이 쌓인다. 전부 **밖에서 확인 가능한 사실**이다. */
const 효과값 = ['아직', '섰다', '뒤집힘', '무효'];
const 효과뜻 = {
  아직: '관측 전 — 기본값',
  섰다: '지금도 살아 있고 그 위에 더 쌓였다',
  뒤집힘: '나중에 반대로 갔다 — 가장 값진 학습 재료',
  무효: '그 자리가 통째로 없어졌다(기능 폐기·트랙 종료)',
};

/* ── 순수 함수 (회귀가 이 여섯을 붙든다) ───────────────────────── */

/** jsonl → 레코드 배열. **못 읽은 줄은 버리지 않는다** — 조용히 사라지면 기록이 준 걸
 *  아무도 모른다. `{깨짐:줄번호}` 로 남겨 렌더가 드러낸다. */
function 파싱(텍스트) {
  const out = [];
  const 줄들 = String(텍스트 || '').split(/\r?\n/);
  for (let i = 0; i < 줄들.length; i += 1) {
    const s = 줄들[i].trim();
    if (!s) continue;
    try {
      const r = JSON.parse(s);
      if (r && typeof r === 'object') out.push(r);
      else out.push({ 깨짐: i + 1, 원문: s });
    } catch {
      out.push({ 깨짐: i + 1, 원문: s });
    }
  }
  return out;
}

/** 다음 번호 = 이미 쓴 최대 + 1. 번호 없는 줄·깨진 줄은 세지 않는다. */
function 다음번호(레코드들) {
  const 쓴것 = (레코드들 || [])
    .map((r) => Number(r && r.번호))
    .filter((n) => Number.isInteger(n) && n > 0);
  return 쓴것.length ? Math.max(...쓴것) + 1 : 1;
}

/** 필수 필드 검사 — 통과 못 하면 **쓰지 않는다**. 빈 칸으로 들어간 행은 목록만 늘리고
 *  유호님 판정 재료가 안 된다(특히 `되돌리기`). */
function 검증(결정) {
  const 문제 = [];
  if (!결정 || typeof 결정 !== 'object') return ['결정이 객체가 아니다'];
  for (const k of 필수) {
    const v = 결정[k];
    if (typeof v !== 'string' || !v.trim()) 문제.push(`「${k}」가 비었다`);
  }
  if (결정.대안 != null && !Array.isArray(결정.대안) && typeof 결정.대안 !== 'string') {
    문제.push('「대안」은 배열이거나 문자열이어야 한다');
  }
  return 문제;
}

/** 번호별로 결정 1건 + **최신 판정**을 얹는다(append-only 를 읽는 층에서 접는다).
 *  중복 번호는 조용히 덮지 않고 `중복` 으로 드러낸다 — 동시 세션 채번 충돌의 유일한 지문이다. */
function 접기(레코드들) {
  const 결정 = new Map();
  const 판정 = new Map();
  const 효과 = new Map();
  const 깨짐 = [];
  const 중복 = [];
  for (const r of 레코드들 || []) {
    if (r.깨짐) { 깨짐.push(r); continue; }
    const n = Number(r.번호);
    if (!Number.isInteger(n)) { 깨짐.push({ 깨짐: 0, 원문: JSON.stringify(r) }); continue; }
    if (r.종류 === '판정') { 판정.set(n, r); continue; }
    if (r.종류 === '효과') { 효과.set(n, r); continue; }
    if (결정.has(n)) 중복.push(n);
    else 결정.set(n, r);
  }
  const 목록 = [...결정.values()]
    .sort((a, b) => Number(a.번호) - Number(b.번호))
    .map((d) => {
      const p = 판정.get(Number(d.번호));
      const e = 효과.get(Number(d.번호));
      return {
        ...d,
        대안: Array.isArray(d.대안) ? d.대안 : d.대안 ? [String(d.대안)] : [],
        결과: (p && 결과값.includes(p.결과) && p.결과) || '대기',
        판정메모: (p && p.메모) || '',
        판정날짜: (p && p.날짜) || '',
        효과: (e && 효과값.includes(e.효과) && e.효과) || '아직',
        효과근거: (e && e.근거) || '',
        효과날짜: (e && e.날짜) || '',
      };
    });
  return { 목록, 깨짐, 중복: [...new Set(중복)] };
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 파생 HTML. 킷 = DESIGN.md §2 (Coral 은 **면으로만** — 라이트 배경 코랄 글자 금지 철칙 ②). */
function HTML(접힌것, 지금 = '') {
  const { 목록, 깨짐, 중복 } = 접힌것;
  const 셈 = (v) => 목록.filter((d) => d.결과 === v).length;
  const 셈효과 = (v) => 목록.filter((d) => d.효과 === v).length;
  const 영역들 = [...new Set(목록.map((d) => d.영역).filter(Boolean))].sort();

  const 경고 = [];
  if (깨짐.length) 경고.push(`읽지 못한 줄 ${깨짐.length}개 — <code>docs/_ops/자율주행_결정록.jsonl</code> 를 열어 확인해야 합니다`);
  if (중복.length) 경고.push(`번호가 겹칩니다: ${중복.join(', ')} — 같은 번호로 두 번 적혔습니다`);

  const 카드 = 목록
    .map((d) => {
      const 대안 = d.대안.length
        ? `<div class="row"><span class="k">안 고른 것</span><span class="v alt">${d.대안.map((a) => `<span class="chip">${esc(a)}</span>`).join('')}</span></div>`
        : '';
      const 출처 = [d.저장소 ? esc(d.저장소) : '', d.커밋 ? `<code>${esc(d.커밋)}</code>` : '']
        .filter(Boolean)
        .join(' · ');
      const 메모 = d.판정메모
        ? `<div class="verdict"><b>유호님 판정</b> ${esc(d.판정메모)}${d.판정날짜 ? ` <span class="tag">${esc(d.판정날짜)}</span>` : ''}</div>`
        : '';
      /* 효과는 「아직」이면 안 그린다 — 28건 전부에 회색 「아직」이 붙으면 그 칸이 배경이 되어
         정작 «뒤집힘» 이 안 보인다(대기 뱃지가 상시 빨강이라 아무도 안 보던 그 자리). */
      const 효과줄 = d.효과 !== '아직'
        ? `<div class="effect"><b>그 뒤</b><span class="badge e-${esc(d.효과)}">${esc(d.효과)}</span>${d.효과근거 ? `<span class="ev">${esc(d.효과근거)}</span>` : ''}${d.효과날짜 ? ` <span class="tag">${esc(d.효과날짜)}</span>` : ''}</div>`
        : '';
      return `<article class="card" data-r="${esc(d.결과)}" data-a="${esc(d.영역 || '')}" data-e="${esc(d.효과)}">
  <div class="head">
    <span class="num">#${String(d.번호).padStart(2, '0')}</span>
    <h3>${esc(d.제목)}</h3>
    <span class="badge b-${esc(d.결과)}">${esc(d.결과)}</span>
  </div>
  <div class="meta">${[d.날짜 ? esc(d.날짜) : '', d.영역 ? esc(d.영역) : '', 출처].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>
  <div class="row"><span class="k">고른 것</span><span class="v pick">${esc(d.고른것)}</span></div>
  ${대안}
  <div class="row"><span class="k">왜</span><span class="v">${esc(d.근거)}</span></div>
  <div class="undo"><span class="k">바꾸려면</span><span class="v">${esc(d.되돌리기)}</span></div>
  ${효과줄}
  ${메모}
</article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>자율주행 결정 기록 — SYNK</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;800&family=DM+Mono:wght@400;500&display=swap">
<style>
@font-face{
  font-family:'SUIT Variable'; font-style:normal; font-weight:100 900; font-display:swap;
  src:url('https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/variable/woff2/SUIT-Variable.woff2') format('woff2-variations');
}
:root{
  --paper:#FAFAF9; --ink:#1B1B1A; --navy:#262626; --navy2:#08090C; --navy3:#373737;
  --slate:#8A8A8A; --slate2:#676767; --cream:#E4E4E7; --cream2:#EAEAEA; --cream3:#D1D2D4;
  --coral:#FF6B5C; --wash:#FFE9E4; --forest:#13724A;
  --mono:'DM Mono',ui-monospace,SFMono-Regular,Consolas,monospace;
  --gut:clamp(20px,4.5vw,56px);
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);
  font-family:'Inter Tight','SUIT Variable',system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
  font-size:15px;line-height:1.65;-webkit-font-smoothing:antialiased}
.wrap{max-width:940px;margin:0 auto;padding:0 var(--gut) 96px}

header{background:var(--navy2);color:var(--cream);padding:44px var(--gut) 34px}
header .inner{max-width:940px;margin:0 auto}
header .eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.14em;color:var(--slate);text-transform:uppercase}
header h1{font-size:clamp(26px,4vw,38px);font-weight:800;letter-spacing:-.02em;margin:.35em 0 .3em;line-height:1.18}
header .sub{color:var(--slate);font-size:13.5px;max-width:70ch}
header .counts{display:flex;flex-wrap:wrap;gap:26px;margin-top:22px;padding-top:16px;border-top:1px solid var(--navy3)}
header .counts div{font-size:12px;font-weight:500;color:var(--slate)}
header .counts b{display:block;font-size:24px;color:var(--cream);font-weight:500;letter-spacing:-.01em}
header .counts .hot b{color:var(--coral)}
header .counts.second{margin-top:12px;padding-top:12px;border-top:1px dashed var(--navy3)}
header .counts .lead{color:var(--cream);letter-spacing:-.01em}
header .counts .lead b{color:var(--cream)}

.bar{position:sticky;top:0;z-index:5;background:var(--paper);border-bottom:1px solid var(--cream3);padding:12px var(--gut);margin-bottom:6px}
.bar .inner{max-width:940px;margin:0 auto;display:flex;flex-wrap:wrap;gap:7px;align-items:center}
.bar .lbl{font-size:11.5px;font-weight:500;color:var(--slate2);margin-right:2px}
button.f{font:inherit;font-size:12.5px;cursor:pointer;border:1px solid var(--cream3);background:var(--cream);
  color:var(--navy);border-radius:2px;padding:5px 12px;letter-spacing:-.01em}
button.f:hover{border-color:var(--navy3)}
button.f[aria-pressed="true"]{background:var(--navy2);border-color:var(--navy2);color:var(--cream)}
.bar .sep{width:1px;height:20px;background:var(--cream3);margin:0 6px}

.warn{margin:22px 0 0;border-left:3px solid var(--coral);background:var(--wash);padding:13px 16px;font-size:13px;color:var(--navy)}
.warn ul{margin:0;padding-left:18px}
.warn code{font-family:var(--mono);font-size:12px}

.card{border:1px solid var(--cream3);border-radius:4px;background:var(--cream);padding:18px 20px 16px;margin-top:14px}
.card .head{display:flex;align-items:baseline;gap:12px}
.card .num{font-family:var(--mono);font-size:15px;color:var(--slate2);font-weight:500;flex:0 0 auto}
.card h3{margin:0;font-size:16px;font-weight:800;letter-spacing:-.01em;line-height:1.35;flex:1 1 auto}
.card .meta{font-family:var(--mono);font-size:11px;color:var(--slate2);margin:6px 0 13px;padding-left:38px}
.card .meta code{font-size:11px}

.badge{flex:0 0 auto;font-size:11.5px;font-weight:500;padding:3px 11px;border-radius:2px;white-space:nowrap}
.b-대기{background:var(--coral);color:var(--ink)}
.b-유지{background:var(--cream3);color:var(--navy)}
.b-바꿈{background:var(--navy2);color:var(--cream)}
.b-보류{background:var(--cream2);color:var(--slate2)}
/* 효과 축 — 「그 뒤 어떻게 됐나」. 결과 뱃지와 같은 줄에 안 둔다(승인 축과 사실 축은 다른 물건). */
.e-섰다{background:var(--forest);color:var(--cream)}
.e-뒤집힘{background:var(--coral);color:var(--ink)}
.e-무효{background:var(--cream2);color:var(--slate2)}
.effect{display:flex;align-items:baseline;flex-wrap:wrap;gap:9px;margin:11px 0 0 38px;padding-top:10px;border-top:1px dashed var(--cream3);font-size:13px}
.effect b{flex:0 0 auto;font-weight:500;font-size:11.5px;color:var(--slate2)}
.effect .ev{flex:1 1 200px;color:var(--navy)}

.row,.undo{display:flex;gap:12px;padding:6px 0 6px 38px;font-size:13.5px}
/* ⚠ 라벨은 mono 로 쓰지 않는다 — DM Mono 에 한글 자형이 없어 폴백되고, 거기에 letter-spacing
   을 얹으면 「바 꾸 려 면」으로 벌어진다(첫 판 실측). 자간은 라틴 라벨에만 준다. */
.row .k,.undo .k{flex:0 0 76px;font-size:11.5px;font-weight:500;color:var(--slate2);padding-top:3px;line-height:1.5}
.row .v,.undo .v{flex:1 1 auto}
.row .v.pick{font-weight:500}
.row .v.alt{display:flex;flex-wrap:wrap;gap:6px}
.chip{font-size:12.5px;color:var(--slate2);background:var(--paper);border:1px solid var(--cream3);border-radius:2px;padding:2px 9px;text-decoration:line-through}
.undo{margin-top:9px;padding-top:11px;border-top:1px solid var(--cream3)}
.undo .v{color:var(--navy)}
.verdict{margin:11px 0 0 38px;background:var(--paper);border:1px solid var(--cream3);border-radius:2px;padding:9px 12px;font-size:13px}
.verdict b{font-weight:500;font-size:11.5px;color:var(--slate2);margin-right:8px}
.tag{font-family:var(--mono);font-size:10.5px;color:var(--slate2)}
.card code{font-family:var(--mono);font-size:12px;background:var(--paper);padding:1.5px 6px;border-radius:2px}

.empty{margin-top:40px;color:var(--slate2);font-size:13.5px}
footer{margin-top:56px;padding-top:20px;border-top:1px solid var(--cream3);font-size:12px;color:var(--slate2);line-height:1.9}
footer b{color:var(--navy);font-weight:500}
footer code{font-family:var(--mono);font-size:11.5px}
</style>
</head>
<body class="룸">
<header><div class="inner">
  <div class="eyebrow">SYNK · Autonomous Build Log</div>
  <h1>자율주행 결정 기록</h1>
  <p class="sub">앱을 짓는 동안 <b>유호님께 묻지 않고 제가 혼자 정한 굵직한 갈림길</b>입니다.
     다 만든 뒤 번호를 부르시면 그 자리에서 바꿉니다 — 「바꾸려면」 칸이 그 비용입니다.</p>
  ${/* ⚠ 숫자는 «합계 = 갈래+갈래»로 쪼갠다(유호 확정 08-14) — 「대기 26」만 크게 띄우면
        그게 좋은 0인지 안 재본 0인지 안 갈린다. 두 줄인 이유는 축이 둘이기 때문이다:
        위=유호님이 승인했나(사람 축) · 아래=그 판단이 그 뒤 어떻게 됐나(사실 축).
        ⚠ HTML 주석이 아니라 `${}` 안의 JS 주석이다 — .js 안의 줄머리 `<!--` 는 node --check 가
        Annex B 로 통과시켜 진짜 사고를 숨긴다(F307 · tests/문서그래프.test.js 가 실저장소를 막는다).
        그 검사의 처방(「감싸개 // 를 붙여라」)은 템플릿 리터럴 안에서는 못 따른다 — 감싸개가
        그대로 출력에 찍힌다. 그래서 여기선 «출력에 안 나가는 주석»으로 옮겼다(유호님 화면에서도 빠진다). */''}
  <div class="counts">
    <div class="lead">판정 <b>${목록.length}</b></div>
    <div${셈('대기') ? ' class="hot"' : ''}>대기<b>${셈('대기')}</b></div>
    <div>유지<b>${셈('유지')}</b></div>
    <div>바꿈<b>${셈('바꿈')}</b></div>
    <div>보류<b>${셈('보류')}</b></div>
  </div>
  <div class="counts second">
    <div class="lead">그 뒤 <b>${목록.length}</b></div>
    <div${셈효과('아직') === 목록.length && 목록.length ? ' class="hot"' : ''}>아직<b>${셈효과('아직')}</b></div>
    <div>섰다<b>${셈효과('섰다')}</b></div>
    <div>뒤집힘<b>${셈효과('뒤집힘')}</b></div>
    <div>무효<b>${셈효과('무효')}</b></div>
  </div>
</div></header>

<nav class="bar"><div class="inner">
  <span class="lbl">판정</span>
  <button class="f" data-k="r" data-v="" aria-pressed="true">전체</button>
  ${결과값.map((v) => `<button class="f" data-k="r" data-v="${v}" aria-pressed="false">${v}</button>`).join('\n  ')}
  <span class="sep"></span><span class="lbl">그 뒤</span>
  <button class="f" data-k="e" data-v="" aria-pressed="true">전체</button>
  ${효과값.map((v) => `<button class="f" data-k="e" data-v="${v}" aria-pressed="false" title="${esc(효과뜻[v] || '')}">${v}</button>`).join('\n  ')}
  ${영역들.length ? `<span class="sep"></span><span class="lbl">영역</span>
  <button class="f" data-k="a" data-v="" aria-pressed="true">전체</button>
  ${영역들.map((v) => `<button class="f" data-k="a" data-v="${esc(v)}" aria-pressed="false">${esc(v)}</button>`).join('\n  ')}` : ''}
</div></nav>

<div class="wrap">
${경고.length ? `<div class="warn"><ul>${경고.map((w) => `<li>${w}</li>`).join('')}</ul></div>` : ''}
${카드 || '<p class="empty">아직 기록된 결정이 없습니다.</p>'}
<footer>
  정본은 <code>docs/_ops/자율주행_결정록.jsonl</code> — 이 화면은 그걸 읽어 그린 것이라 <b>정본이 바뀌면 여기도 바뀝니다</b>.<br>
  판정 반영 = <code>node tools/자율기록.js 판정 --번호 N --결과 유지|바꿈|보류</code> · 굽기 = <code>node tools/자율기록.js --굽기</code><br>
  <b>「그 뒤」는 다른 축입니다</b> — 판정은 <b>유호님이 승인했나</b>, 그 뒤는 <b>그 판단이 실제로 어떻게 됐나</b>입니다.
  뒤집힌 결정이 가장 값진 재료라 따로 셉니다 — <code>node tools/자율기록.js 효과 --스캔</code><br>
  마지막 굽기 <b>${esc(지금)}</b>
</footer>
</div>

<script>
(function(){
  var 상태={r:'',a:'',e:''};
  function 적용(){
    document.querySelectorAll('.card').forEach(function(c){
      var ok=(!상태.r||c.dataset.r===상태.r)&&(!상태.a||c.dataset.a===상태.a)&&(!상태.e||c.dataset.e===상태.e);
      c.style.display=ok?'':'none';
    });
  }
  document.querySelectorAll('button.f').forEach(function(b){
    b.addEventListener('click',function(){
      var k=b.dataset.k;
      상태[k]=b.dataset.v;
      document.querySelectorAll('button.f[data-k="'+k+'"]').forEach(function(o){
        o.setAttribute('aria-pressed',String(o===b));
      });
      적용();
    });
  });
})();
</script>
</body>
</html>
`;
}

/* ── 여기부터 파일·환경 ────────────────────────────────────────── */

function 읽기() {
  if (!fs.existsSync(정본)) return [];
  return 파싱(fs.readFileSync(정본, 'utf8'));
}

function 오늘(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** repo 밖 환경(PowerShell·바탕화면)에 기대는 유일한 자리 — 실패는 **조용히 넘기지 않는다**. */
function 등재() {
  try {
    const out = execFileSync(
      process.execPath,
      [path.join(ROOT, 'tools', '운영자료.js'), 파생, '--이름', 표시이름],
      { encoding: 'utf8', cwd: ROOT }
    );
    const 줄 = out.trim().split(/\r?\n/).filter(Boolean).slice(0, 2).join('\n  ');
    if (줄) console.log(`  ${줄}`);
    return true;
  } catch (e) {
    console.error('⚠ 바탕화면 등재에 실패했다 — HTML 은 만들어졌지만 유호님 화면엔 안 걸렸다.');
    console.error(`  직접: node tools/운영자료.js docs/자율주행_결정록.html --이름 "${표시이름}"`);
    console.error(`  사유: ${(e && e.message) || e}`);
    return false;
  }
}

function 굽기(등재할까 = true) {
  const 접힌 = 접기(읽기());
  fs.mkdirSync(path.dirname(파생), { recursive: true });
  /* 날짜까지만 — 시:분을 넣으면 내용이 같은 재굽기에도 git diff 가 나서 노이즈가 된다. */
  fs.writeFileSync(파생, loom태우기(HTML(접힌, 오늘())), 'utf8');
  console.log(`✅ 구움  ${path.relative(ROOT, 파생)} — 결정 ${접힌.목록.length}건(대기 ${접힌.목록.filter((d) => d.결과 === '대기').length})`);
  if (접힌.중복.length) console.error(`⚠ 번호 중복: ${접힌.중복.join(', ')}`);
  if (접힌.깨짐.length) console.error(`⚠ 읽지 못한 줄 ${접힌.깨짐.length}개`);
  if (등재할까) 등재();
  return 0;
}

function 붙이기(줄들) {
  fs.mkdirSync(path.dirname(정본), { recursive: true });
  fs.appendFileSync(정본,줄들.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
}

function 인자값(인자, 이름) {
  const i = 인자.indexOf(이름);
  return i >= 0 ? 인자[i + 1] : null;
}

/** 같은 이름을 여러 번 받는다 — `--대안 A --대안 B`.
 *  ⚠ 한 인자를 파이프로 갈라 받지 않는다: `tools/` 안의 `.split('|')` 은 `tests/표칸.test.js`
 *  가 금지한다(표 칸이 백틱 안 파이프에서 밀리던 사고 · 목록을 안 두고 폴더 전체를 훑는 설계). */
function 인자값들(인자, 이름) {
  const out = [];
  for (let i = 0; i < 인자.length; i += 1) if (인자[i] === 이름 && 인자[i + 1]) out.push(인자[i + 1].trim());
  return out.filter(Boolean);
}

function add(인자) {
  const 파일 = 인자값(인자, '--파일');
  let 입력;
  if (파일) {
    if (!fs.existsSync(파일)) { console.error(`🔴 없는 파일: ${파일}`); return 1; }
    try {
      입력 = JSON.parse(fs.readFileSync(파일, 'utf8'));
    } catch (e) { console.error(`🔴 JSON 을 읽지 못했다: ${(e && e.message) || e}`); return 1; }
  } else {
    입력 = {};
    for (const k of ['영역', '제목', '고른것', '근거', '되돌리기', '저장소', '커밋']) {
      const v = 인자값(인자, `--${k}`);
      if (v) 입력[k] = v;
    }
    const a = 인자값들(인자, '--대안');
    if (a.length) 입력.대안 = a;
    if (!Object.keys(입력).length) {
      console.error('🔴 줄 내용이 없다. 긴 본문은 셸에 맡기지 말고 `--파일 결정.json` 으로 준다(F297).');
      return 1;
    }
  }

  const 목록 = Array.isArray(입력) ? 입력 : [입력];
  const 문제 = [];
  목록.forEach((d, i) => 검증(d).forEach((m) => 문제.push(`[${i + 1}번째] ${m}`)));
  if (문제.length) {
    console.error('🔴 필수 칸이 비어 안 쓴다 — 빈 칸으로 들어간 행은 유호님 판정 재료가 못 된다:');
    for (const m of 문제) console.error(`  · ${m}`);
    console.error(`  필수: ${필수.join(' · ')}  (특히 「되돌리기」= 바꾸려면 어디를 얼마나 고치나)`);
    return 1;
  }

  let n = 다음번호(읽기());
  const 새줄 = 목록.map((d) => ({
    종류: '결정',
    번호: n++,
    날짜: d.날짜 || 오늘(),
    영역: d.영역 || '',
    제목: d.제목.trim(),
    고른것: d.고른것.trim(),
    대안: Array.isArray(d.대안) ? d.대안 : d.대안 ? [String(d.대안)] : [],
    근거: d.근거.trim(),
    되돌리기: d.되돌리기.trim(),
    저장소: d.저장소 || '',
    커밋: d.커밋 || '',
  }));
  붙이기(새줄);
  for (const r of 새줄) console.log(`✅ #${String(r.번호).padStart(2, '0')}  ${r.제목}`);
  return 굽기();
}

function 판정(인자) {
  const n = Number(인자값(인자, '--번호'));
  const 결과 = 인자값(인자, '--결과');
  const 메모 = 인자값(인자, '--메모') || '';
  if (!Number.isInteger(n) || n <= 0) { console.error('🔴 --번호 가 없다'); return 1; }
  if (!결과값.includes(결과) || 결과 === '대기') {
    console.error(`🔴 --결과 는 ${결과값.filter((v) => v !== '대기').join(' | ')} 중 하나`);
    return 1;
  }
  const 있나 = 접기(읽기()).목록.some((d) => Number(d.번호) === n);
  if (!있나) { console.error(`🔴 #${n} 결정이 없다 — \`--목록\` 으로 번호를 확인한다`); return 1; }
  붙이기([{ 종류: '판정', 번호: n, 날짜: 오늘(), 결과, 메모 }]);
  console.log(`✅ #${String(n).padStart(2, '0')} → ${결과}${메모 ? ` (${메모})` : ''}`);
  return 굽기();
}

/** 저장소 이름 → 경로. 비면 이 저장소. **모르는 이름은 null** — 「없다」가 아니라
 *  「여기서는 못 본다」라서, 스캔이 그걸 「살아있음」으로 접지 않게 갈라 센다. */
function 저장소경로(이름) {
  const s = String(이름 || '').trim();
  if (!s || s === 'appsscript' || s === 'SYNK-appsscript' || s === '(루트)' || s === 'as') return ROOT;
  /* 자리는 정본 통로에서 — 워크트리에서 `ROOT/..` 는 `worktrees/` 라, 손으로 적으면 형제
   * 커밋을 물을 때 없는 폴더를 cwd 로 줘 git 이 통째로 실패한다(그 실패는 「살아있음」으로 접힌다). */
  if (s === 'talk' || s === 'SYNK-talk') return 형제저장소.형제경로(ROOT);
  return null;
}

/** 「커밋」 칸이 git 에 **물을 수 있는 값**인가.
 *  분리해 둔 이유는 회귀 때문이다 — 효과스캔 안에 인라인으로 두면 픽스처가 못 잡고,
 *  이 판정이 없던 첫 판이 정확히 그래서 샜다(2026-08-15 실측 · #16). */
function sha인가(v) {
  return /^[0-9a-f]{7,40}$/i.test(String(v == null ? '' : v).trim());
}

function 깃(인자, cwd) {
  try {
    return execFileSync('git', 인자, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
}

function 효과쓰기(인자) {
  const n = Number(인자값(인자, '--번호'));
  const v = 인자값(인자, '--효과');
  const 근거 = (인자값(인자, '--근거') || '').trim();
  if (!Number.isInteger(n) || n <= 0) { console.error('🔴 --번호 가 없다'); return 1; }
  if (!효과값.includes(v) || v === '아직') {
    console.error(`🔴 --효과 는 ${효과값.filter((x) => x !== '아직').join(' | ')} 중 하나`);
    for (const k of 효과값) if (k !== '아직') console.error(`     ${k} — ${효과뜻[k]}`);
    return 1;
  }
  /* 근거가 필수인 이유: 근거 없는 효과는 관측이 아니라 **자평**이고, 자평이 쌓인 장부는
     경험 학습의 재료가 못 된다(§10 기록 규격 「사실·관찰·추정을 섞지 않는다」와 같은 축). */
  if (!근거) { console.error('🔴 --근거 가 없다 — 무엇을 열어 보고 그렇게 판단했나(커밋·파일·문서)'); return 1; }
  const 있나 = 접기(읽기()).목록.some((d) => Number(d.번호) === n);
  if (!있나) { console.error(`🔴 #${n} 결정이 없다 — \`--목록\` 으로 번호를 확인한다`); return 1; }
  붙이기([{ 종류: '효과', 번호: n, 날짜: 오늘(), 효과: v, 근거 }]);
  console.log(`✅ #${String(n).padStart(2, '0')} 그 뒤 → ${v} (${근거})`);
  return 굽기();
}

/** 효과 후보 스캔 — **판정하지 않는다. 후보만 뽑는다.**
 *  기계가 확실히 아는 것은 둘뿐이다: ①그 커밋이 저장소에 없다 ②되돌려졌다.
 *  ⚠「커밋이 살아 있다」는 「그 결정이 살아 있다」가 아니다 — 코드는 남고 아무도 안 쓰는
 *  자리를 이 스캔은 못 본다. 그래서 **못 보는 것을 매번 인쇄**한다(가드 맹점 ④: 장치는
 *  안 도는 쪽보다 「맞는 얼굴로 틀린 값을 내는」 쪽으로 더 자주 샌다). */
function 효과스캔() {
  const { 목록 } = 접기(읽기());
  const 후보 = [];
  const 갈래 = { 이미적힘: 0, 커밋없음: 0, sha아님: 0, 저장소밖: 0, 유실: 0, 되돌림: 0, 살아있음: 0 };
  for (const d of 목록) {
    if (d.효과 !== '아직') { 갈래.이미적힘 += 1; continue; }
    if (!d.커밋) { 갈래.커밋없음 += 1; continue; }
    /* 🔴 첫 실전(2026-08-15)이 잡은 자리: `커밋` 칸에 산문이 들어 있는 행이 있다
       (#16 = "(이 기록과 같은 커밋)"). sha 꼴 검사 없이 git 에 물으면 「그 커밋이 저장소에
       없다」가 돌아와 **멀쩡한 결정이 「무효」 후보로 올라간다** — 안 도는 쪽이 아니라
       「맞는 얼굴로 틀린 값」 쪽으로 샌 것이라, 갈래를 따로 세어 드러낸다. */
    if (!sha인가(d.커밋)) { 갈래.sha아님 += 1; continue; }
    const cwd = 저장소경로(d.저장소);
    if (!cwd || !fs.existsSync(cwd)) { 갈래.저장소밖 += 1; continue; }
    if (깃(['cat-file', '-e', `${d.커밋}^{commit}`], cwd) === null) {
      갈래.유실 += 1;
      후보.push([d, '무효', `그 커밋이 ${path.basename(cwd)} 에 없다 — 사라졌는지 저장소가 다른지 손으로 가른다`]);
      continue;
    }
    const 제목 = 깃(['log', '-1', '--format=%s', d.커밋], cwd) || '';
    const 되돌림 = 제목 ? 깃(['log', '--format=%h %s', '--fixed-strings', '--grep', `Revert "${제목}"`], cwd) : '';
    if (되돌림) {
      갈래.되돌림 += 1;
      후보.push([d, '뒤집힘', `되돌림 커밋 ${되돌림.split('\n')[0]}`]);
      continue;
    }
    갈래.살아있음 += 1;
  }
  const 합 = Object.values(갈래).reduce((a, b) => a + b, 0);
  console.log(`■ 효과 스캔 — 결정 ${합}건 = 이미 적힘 ${갈래.이미적힘} + 커밋 없음 ${갈래.커밋없음} + sha 아님 ${갈래.sha아님} + 저장소 밖 ${갈래.저장소밖} + 유실 ${갈래.유실} + 되돌림 ${갈래.되돌림} + 살아있음 ${갈래.살아있음}`);
  if (후보.length) {
    console.log(`\n🔁 후보 ${후보.length}건 — 그대로 확정하려면 이 줄을 실행한다(스캔은 안 쓴다):`);
    for (const [d, v, 왜] of 후보) {
      console.log(`  #${String(d.번호).padStart(2, '0')} ${d.제목}`);
      console.log(`     node tools/자율기록.js 효과 --번호 ${d.번호} --효과 ${v} --근거 "${왜}"`);
    }
  } else {
    console.log('\n후보 0건 — 기계가 잡는 두 신호(커밋 유실·되돌림)에 걸린 결정이 없다.');
  }
  console.log('\n⚠ 이 스캔이 못 보는 것 — 그래서 「살아있음」은 「섰다」가 아니다:');
  console.log('   · 코드는 남았는데 아무도 안 쓰는 결정 — 커밋 생존 ≠ 결정 생존');
  console.log(`   · 커밋 없이 설계·문서로만 내린 결정 ${갈래.커밋없음}건 — 기계가 볼 자리가 없다`);
  console.log(`   · 「커밋」 칸이 sha 가 아닌 결정 ${갈래.sha아님}건 — 산문이 적혀 있어 git 에 못 묻는다`);
  console.log(`   · 이름을 모르는 저장소의 결정 ${갈래.저장소밖}건`);
  console.log('   · 고쳐 쓴 되돌림(Revert 제목을 안 단 재수정) — grep 이 못 잡는다');
  return 0;
}

function 목록보기() {
  const { 목록, 깨짐, 중복 } = 접기(읽기());
  if (!목록.length) { console.log('■ 자율주행 결정 기록 — 아직 0건'); return 0; }
  const 대기 = 목록.filter((d) => d.결과 === '대기').length;
  console.log(`■ 자율주행 결정 기록 — ${목록.length}건 (대기 ${대기})`);
  for (const d of 목록) {
    const 표 = { 대기: '⏳', 유지: '✅', 바꿈: '🔁', 보류: '⏸' }[d.결과];
    console.log(`  ${표} #${String(d.번호).padStart(2, '0')} [${d.영역 || '-'}] ${d.제목}`);
    console.log(`       고른것: ${d.고른것}`);
    console.log(`       바꾸려면: ${d.되돌리기}`);
  }
  if (중복.length) console.error(`⚠ 번호 중복: ${중복.join(', ')}`);
  if (깨짐.length) console.error(`⚠ 읽지 못한 줄 ${깨짐.length}개`);
  return 0;
}

function main(argv) {
  const 인자 = argv.slice(2);
  const cmd = 인자[0];
  if (cmd === 'add') return add(인자.slice(1));
  if (cmd === '판정') return 판정(인자.slice(1));
  if (cmd === '효과') return 인자.includes('--스캔') ? 효과스캔() : 효과쓰기(인자.slice(1));
  if (인자.includes('--굽기')) return 굽기(!인자.includes('--등재안함'));
  if (인자.includes('--목록') || !인자.length) return 목록보기();
  console.error('사용: add --파일 x.json | 판정 --번호 N --결과 유지|바꿈|보류');
  console.error('      효과 --스캔 | 효과 --번호 N --효과 섰다|뒤집힘|무효 --근거 "…" | --목록 | --굽기');
  return 1;
}

module.exports = {
  파싱, 다음번호, 검증, 접기, HTML, esc, 인자값들, 저장소경로, sha인가,
  결과값, 필수, 효과값, 효과뜻, 정본경로: 정본, 파생경로: 파생,
};

if (require.main === module) process.exit(main(process.argv));

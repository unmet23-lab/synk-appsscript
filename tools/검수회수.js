#!/usr/bin/env node
/* 검수 회수 — 검수자가 채운 시트를 **사람 손 없이** 코드 재료로 바꾼다.
 *
 * ■ 왜 있나 (설계 정본 `docs/몽골어_검수_꾸러미_설계.md` 벽 ⑤)
 *   지금까지 검수가 끝나면 **사람이 코드에 옮겨 적었다.** 철학 ㉡(사람 손을 늘리는 해법을 쓰지
 *   않는다) 정면이고, 게이트 ④는 「닿았나 ✗」였다 — 검수는 끝났는데 그것이 코드에 서기까지
 *   한 사람이 한 번 더 옮긴다. **사람이 누르는 칸은 검수자의 「확정」 하나뿐이어야 한다.**
 *
 * ■ 입력 두 갈래 — 기본은 자격증명이 필요 없는 쪽이다(설계 §4 반박)
 *   ㉠ 붙여넣기(지금 이것) — 검수자가 시트에서 전체 복사한 TSV 를 파일로 저장해 넘긴다. 계정 0.
 *   ㉡ API(나중) — 계정이 정해지면 **입력만** 갈아 끼운다. 파싱·검사·내보내기는 같은 코드를 쓴다.
 *
 * ■ ⚠ 이 도구는 **실물 검수 결과 없이** 지어졌다(검수자가 아직 없다 · 2026-08-12).
 *   그래서 탐지력은 `tests/검수회수.test.js` 의 **픽스처가 진다** — 실제 시트가 처음 오는 날
 *   이 도구가 무엇을 잡고 무엇을 놓치는지는 그때 다시 잰다. 지금 초록은 「픽스처에 대해 초록」이다.
 *
 * 사용: node tools/검수회수.js <채운.tsv> [...] [--내보내기]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const { 인자게이트 } = require(path.join(__dirname, 'lib', '인자게이트.js'));

const ROOT = path.join(__dirname, '..');
const 낼곳 = path.join(ROOT, 'docs', '_ops', '검수꾸러미', '회수');

const 열 = Object.freeze({ 번호: 0, 섹션: 1, 한국어: 2, 초안: 3, 확정: 4, 확신도: 5, 그대로: 6, 메모: 7 });
const 확정머리 = 'баталгаажсан';   // 생성기가 세운 열 머리의 고정 조각

/** `{…}` 자리표시자 집합. 생성기와 **같은 규칙**이라야 대조가 성립한다. */
function 자리표시자(s) {
  const m = String(s || '').match(/\{[^}\s]{1,20}\}/g);
  return m ? [...new Set(m)] : [];
}

/** 원문에만 있는 «맨숫자» — 자리표시자 안의 것은 뺀다(발주 §4-4 「없는 숫자를 만들지 않기」의 뒷면). */
function 숫자들(s) {
  const 벗김 = String(s || '').replace(/\{[^}]*\}/g, ' ');
  const m = 벗김.match(/\d+/g);
  return m ? [...new Set(m)] : [];
}

function 읽기(파일) {
  const 원 = fs.readFileSync(파일, 'utf8').replace(/^﻿/, '');
  const 줄 = 원.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (!줄.length) return { 머리: [], 행: [] };
  return { 머리: 줄[0].split('\t'), 행: 줄.slice(1).map((l) => l.split('\t')) };
}

/**
 * 채운 표 한 벌을 검사한다.
 * @returns {{총:number, 채움:number, 빈:number[], 문제:Array, 항목:Array}}
 */
function 검사(머리, 행들) {
  const 문제 = [];
  const 항목 = [];
  const 빈 = [];

  /* 열 자리를 파일명·순서로 믿지 않고 **머리에서** 확인한다 — 검수자가 열을 옮겼을 수 있다.
   * 못 찾으면 여기서 세운다(자리를 짐작해 읽으면 엉뚱한 열을 「확정」으로 회수한다). */
  const 확정자리 = 머리.findIndex((h) => String(h).includes(확정머리));
  if (확정자리 < 0) {
    return { 총: 행들.length, 채움: 0, 빈: [], 항목: [],
      문제: [{ 급: '🔴', 줄: 1, 말: `확정 열(「${확정머리}」)을 머리에서 못 찾았다 — 이 파일이 꾸러미 시트가 맞는지 본다.` }] };
  }

  행들.forEach((r, i) => {
    const 줄번호 = i + 2;                       // 머리 1줄 + 1-기반
    const 한국어 = (r[열.한국어] || '').trim();
    const 초안 = (r[열.초안] || '').trim();
    const 확정 = (r[확정자리] || '').trim();
    if (!한국어) return;

    if (!확정) { 빈.push(Number(r[열.번호]) || 줄번호); return; }

    /* ① 자리표시자 — 잃으면 모든 학부모에게 같은 이름·숫자가 나간다. 가장 비싼 실수라 🔴. */
    const 원자리 = 자리표시자(한국어);
    const 잃은 = 원자리.filter((p) => !확정.includes(p));
    if (잃은.length) 문제.push({ 급: '🔴', 줄: 줄번호, 말: `자리표시자가 빠졌다: ${잃은.join(' ')} — 실제 값을 적으면 전원에게 같은 값이 나간다` });

    /* ② 없는 숫자 — 발주 §4-4. 몽골어 표기 차이로 오탐이 날 수 있어 🟡(막지 않고 알린다). */
    const 원숫자 = 숫자들(한국어);
    const 빠진숫자 = 원숫자.filter((n) => !확정.includes(n));
    if (빠진숫자.length) 문제.push({ 급: '🟡', 줄: 줄번호, 말: `원문 숫자가 안 보인다: ${빠진숫자.join(' ')} — 몽골어 표기 차이일 수 있으니 눈으로 본다` });

    항목.push({
      번호: r[열.번호] || String(줄번호),
      섹션: r[열.섹션] || '',
      한국어,
      몽골어: 확정,
      확신도: (r[열.확신도] || '').trim(),
      메모: (r[열.메모] || '').trim(),
      초안그대로: 초안 !== '—' && 초안 !== '' && 초안 === 확정,
    });
  });

  return { 총: 항목.length + 빈.length, 채움: 항목.length, 빈, 문제, 항목 };
}

function main() {
  const args = process.argv.slice(2);
  /* 🔑 목록은 눈으로 정하지 않았다 — `CLI도구들()` 이 재고, 회귀 ④ 가 매번 다시 센다.
   * ⚠ 위치 인자(채운 .tsv 경로들)는 `--` 로 안 시작하니 애초에 안 걸린다. */
  const 아는플래그 = ['--내보내기'];
  const 플래그오류 = 인자게이트('검수회수', args, 아는플래그);
  if (플래그오류) { console.error(`\n🔴 ${플래그오류}\n`); process.exit(1); }
  const 내보내기 = args.includes('--내보내기');
  const 파일들 = args.filter((a) => !a.startsWith('--'));

  if (!파일들.length) {
    console.error('사용: node tools/검수회수.js <채운.tsv> [...] [--내보내기]');
    console.error('  검수자가 시트에서 전체 선택→복사한 것을 .tsv 로 저장해 넘긴다(계정·자격 필요 없음).');
    process.exit(2);
  }

  let 막힘 = 0;
  const 낸것 = [];

  for (const f of 파일들) {
    if (!fs.existsSync(f)) { console.error(`🔴 파일 없음: ${f}`); 막힘 += 1; continue; }
    const { 머리, 행 } = 읽기(f);
    const r = 검사(머리, 행);
    const 이름 = path.basename(f);

    /* 🔑 **분모와 함께 읽는다**(CLAUDE.md 신뢰성) — 0건 회수와 전건 회수가 같은 모양이면
     *   이 도구는 있으나 마나다. 빈 칸은 「통과」가 아니라 「미작업」이라 반드시 숫자로 낸다. */
    console.log(`\n■ ${이름} — 확정 ${r.채움}/${r.총}${r.빈.length ? ` · 빈 칸 ${r.빈.length}개(№ ${r.빈.slice(0, 12).join(',')}${r.빈.length > 12 ? '…' : ''})` : ''}`);

    const 심각 = r.문제.filter((p) => p.급 === '🔴');
    for (const p of r.문제) console.log(`  ${p.급} ${p.줄}줄 — ${p.말}`);
    if (r.채움) {
      const 그대로 = r.항목.filter((a) => a.초안그대로).length;
      const 애매 = r.항목.filter((a) => /Эргэлзээтэй|애매/i.test(a.확신도)).length;
      console.log(`  ℹ 초안과 같은 것 ${그대로} · 「애매」 표시 ${애매}`);
    }
    if (심각.length) 막힘 += 1;

    if (내보내기 && r.채움) {
      fs.mkdirSync(낼곳, { recursive: true });
      const p = path.join(낼곳, `${이름.replace(/\.tsv$/i, '')}.json`);
      fs.writeFileSync(p, `${JSON.stringify({ 원본: 이름, 총: r.총, 채움: r.채움, 빈: r.빈, 항목: r.항목 }, null, 2)}\n`, 'utf8');
      낸것.push(p);
    }
  }

  if (낸것.length) {
    console.log('\n낸 파일:');
    for (const p of 낸것) console.log(`  · ${path.relative(ROOT, p)}`);
    console.log('\n⚠ 여기까지가 **회수**다 — 코드 자리에 앉히는 것은 묶음마다 다르다(설계 §4 표).');
    console.log('   L(G1 문항팩)은 특히 `mn` 병기 + `검수확정=true` + 문항판 인상이 **한 커밋**이어야 한다(F302).');
  }

  if (막힘) { console.error(`\n🔴 그대로 코드에 넣으면 안 되는 파일이 ${막힘}개 있다 — 위 🔴 를 먼저 처리한다.`); process.exit(2); }
  if (!내보내기) console.log('\n(검사만 했다 — JSON 으로 내려면 `--내보내기`)');
}

if (require.main === module) main();

module.exports = { 검사, 자리표시자, 숫자들, 읽기, 열 };

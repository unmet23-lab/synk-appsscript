#!/usr/bin/env node
'use strict';
/**
 * master맞추기 — 여러 세션이 함께 쓰는 작업본의 로컬 master가 origin/master와 갈라졌을 때 맞춘다.
 * 로컬에만 있는 커밋(남의 미푸시 포함)·미커밋 수정·미추적 파일·남의 스테이징은 그대로 두고 origin을 합친다. push는 하지 않는다.
 *
 *   node tools/master맞추기.js                   미리 보기(origin을 fetch하고 계획과 지문만 보인다. 작업본·인덱스·가지는 그대로이고
 *                                                 .git/master맞추기/미리보기/<지문>.json에 --되풀이가 대조할 기록만 남긴다)
 *   node tools/master맞추기.js --실행 <지문>      미리 보기가 보인 지문의 계획 그대로 반영한다(fetch 없이 다시 세워 대조한다)
 *   --되풀이 <횟수>                              (--실행과) 계획이 그사이 바뀌었거나 쓰는 사이 경합으로 되돌리고 멈췄을 때, 다시 세운
 *                                                 계획이 멈출 까닭 없고 풀이·허용 경로의 로컬·origin 판과 계획에 들어갈 판이 미리 보기
 *                                                 때와 같으면 그 계획을 실행한다
 *   --풀이 <경로>=로컬|origin|<파일>             바뀐 경로를 직접 정한다(한쪽만 바꾼 경로도. <파일>은 그 경로의 합친 내용 전체)
 *   --겹친곳쓰기 <폴더>                          규칙으로 못 푼 경로마다 <폴더>/<경로>에 푼 곳은 풀고 못 푼 곳만 충돌 표시를 남긴 판을,
 *                                                 줄 검사에 걸린 경로는 합친 판을 쓴다
 *   --풀이폴더 <폴더>                            <폴더>/<경로> 파일을 그 경로의 합친 판으로 쓴다(충돌 표시가 남았으면 멈춘다)
 *   --허용 <경로>                                그 경로의 줄 문제(아래 검사)를 보고 받아들인다
 *   공통: --json · --자세히 · --저장소 <폴더> · --가지 <이름>(master) · --원격 <이름>(origin) · --받지않음(fetch 안 함)
 *   실행: -m <메시지> · -F <파일>(병합 커밋 메시지. 없으면 도구가 쓴다)
 *   git 2.43 이상(merge-file --object-id)이 필요하다.
 *
 * 방법(맞는 것 하나)
 *   빨리감기  로컬 master가 origin의 조상이면 master를 origin으로 옮긴다.
 *   빠른 길   origin에만 있는 커밋이 다시 쌓아 올린 커밋뿐이고(커밋마다 같은 작성자·제목의 로컬 커밋이 있다) 그 변경이 로컬에
 *             이미 다 있으면 병합 트리 = 로컬 트리. 경로마다 origin이 더한 줄이 로컬에 있고 지운 줄이 없어야 한다(바이너리·모드는
 *             같은 판, 빈 줄·줄끝만 다른 것은 같은 내용으로 본다 — 내커밋 올리기가 줄끝을 맞춰 다시 쌓은 커밋도 빠른 길로 간다).
 *             병합 커밋과 master CAS만 하고 작업본·공용 인덱스는 건드리지 않는다.
 *   병합      로컬 트리에 origin만 바꾼 경로를 얹고, 양쪽이 바꾼 경로는 3방향으로 합친다(git merge-tree에서 이름 바뀜을 끈 것과 같다).
 *             바탕은 갈라진 곳보다 양쪽 이력에 함께 나오는 가장 최근 판을 먼저 쓴다(다시 쌓아 올린 커밋은 같은 blob을 쓴다).
 *             겹친 곳은 안전한 규칙으로만 푼다 — 한쪽이 다른 쪽 변경을 품으면 그쪽. 문서(.md·.txt·.jsonl·.csv·.tsv)는 같은 자리에
 *             양쪽이 끼운 줄을 2방향으로 맞춰 같은 줄은 한 번, 따로 더한 줄은 둘 다 두고, 같은 머리(앞 40자)의 줄이나 같은 바탕 줄을
 *             둘 다 고친 줄은 짝지어 한 줄로 만든다(한쪽이 통째로 품으면 긴 쪽, 아니면 낱말 단위 3방향 — 「쓴 AI」 머리말처럼 줄 끝에
 *             둘 다 덧붙였으면 둘 다). .gitattributes의 merge=union 경로는 합집합. 같은 낱말을 다르게 고쳤거나 코드·바이너리가
 *             겹치면 멈추고 --풀이·--풀이폴더로 정한다. 합친 문서에 양쪽이 같은 절·행을 다른 자리에 더해(다시 쌓아 올린 항목)
 *             두 번 들어간 사본은 지운다 — 사본에 붙은 짧은 머리·꼬리 줄도 함께. 한쪽 판에 이미 그만큼 있는 절은 그대로, 머리가
 *             같은데 서로를 품지 않는 절이나 지운 자리 옆에 사본 조각이 남으면 멈춘다.
 *             --풀이 파일이 규칙이 한 줄로 이은 줄을 그대로 가졌으면 그 이음 기록을 줄 검사에 쓴다.
 * 검사 — 늘 「로컬 HEAD 대비 계획 트리에서 지워지는 줄」을 경로마다 보인다(origin이 지운 줄 · 한 줄로 이은 줄 · 로컬 줄).
 *   양쪽이 바꾼 경로(와 --풀이를 준 한쪽만 바꾼 경로)는 줄 셈으로 본다: 로컬 줄이 빠짐(origin이 지운 줄 말고) · origin 줄이 빠짐 · 지운 줄이 남음 ·
 *   같은 줄이 두 번 · 어디서도 오지 않은 줄. 하나라도 있으면 멈춘다(그 경로를 보고 받아들일 때만 --허용).
 * 작업본 — 로컬 HEAD와 계획 트리가 다른 경로마다:
 *   작업본이 로컬 HEAD 판이면 새 판(체크아웃과 같은 바이트) · 이미 새 판이면 그대로 · 이력의 옛 판 그대로면 새 판 ·
 *   남의 미커밋 수정이면 작업본과 가장 가까운 이력 판을 바탕으로 3방향(줄끝은 작업본을 따른다) ·
 *   다른 가지 판·3방향 충돌·바이너리면 손대지 않음(그 파일은 「수정됨」으로 남는다 — 커밋 전에 새 판과 다시 합친다) ·
 *   계획 트리가 지운 파일에 남의 수정이 있으면 미추적으로 남김. 그 경로의 공용 인덱스에 남의 스테이징이 있으면 멈춘다.
 * 실행 — 계획을 다시 세워 지문 대조 → index.lock 기다림 → 바이트 백업(<git 폴더>/master맞추기/<시각>-<지문>/) → 작업본 쓰기
 *   (쓰기 직전 바이트 대조) → 병합 커밋(commit-tree, 부모 로컬·origin) → master CAS(실패하면 작업본 되돌림) → 그 경로만 공용
 *   인덱스(못 맞추면 master와 작업본 되돌림) → 대조(master·작업본·공용 인덱스·다른 경로의 git status).
 *
 * 함정과 고친 기록: docs/현장노트/git_줄끝_잠금.md. 시험: node --test tests/master맞추기.test.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const 내커밋 = require('./내커밋.js');
const 잠금도구 = require('./git잠금.js');

const { 줄나누기, 줄잇기, 줄차이, 줄끝맞추기 } = 내커밋;
const {
  git도구, 저장소찾기, 경로맞추기, 잠깐, 별도인덱스, 블롭읽기, 블롭, 블롭쓰기, 글아닌경로, 조상인가, git버전확인,
  공용인덱스항목, 잠금기다리기, 공용인덱스맞추기, 줄바꿈채우기, 셈빼기, 글로, 바이트로, 보이게, 이진인가, 멈춤, 사용법오류,
} = 내커밋._도구;

const 표크기 = 31;     // 충돌 표시 길이 — 글 안의 「<<<<<<<」와 헷갈리지 않게 길게
const 긴줄 = 20;       // 겹침·남음·같은 머리는 이만큼(글자) 긴 줄만 본다. 「}」·「---」 같은 짧은 줄은 양쪽이 따로 더해도 맞다
const 머리길이 = 40;   // 같은 항목의 두 판인지 가르는 줄 머리(글자)
const 이력한도 = 60;   // 작업본과 가장 가까운 판을 찾을 때 볼 커밋 수
const 보기한도 = 8;    // 사람용 출력에서 경로마다 보일 줄 수(--자세히면 다)
const 문서꼴 = /\.(md|markdown|txt|jsonl|csv|tsv)$/i;
const 진행중 = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'BISECT_LOG'];
const 좋은결과 = new Set(['미리 보기', '맞음', '맞춤']);
const 쓰는일 = new Set(['새 판', '3방향', '지움']);
const 문제이름 = { 로컬빠짐: '로컬 줄이 빠짐', 원격빠짐: 'origin 줄이 빠짐', 남음: '지운 줄이 남음', 겹침: '같은 줄이 두 번', 넘침: '어디서도 오지 않은 줄' };

// ── 줄 ──────────────────────────────────────────────────────────────────────

const 빈줄 = (글) => /^[ \t]*$/.test(글);
const 글자수 = (글) => 보이게(글).trim().length;
const 머리 = (글) => 보이게(글).trim().slice(0, 머리길이);
const 짧게 = (sha) => (sha ? sha.slice(0, 9) : '');
const 해시 = (버퍼) => (버퍼 ? crypto.createHash('sha256').update(버퍼).digest('hex') : null);
const LF로 = (글) => 글.replace(/\r\n/g, '\n');
const 라틴 = (s) => Buffer.from(s, 'utf8').toString('latin1');   // 사람 글 → 도구가 다루는 latin1 글

/** 줄 목록의 셈(빈 줄은 뺀다, 줄끝은 보지 않는다) */
function 셈(줄들) {
  const m = new Map();
  for (const l of 줄들) if (!빈줄(l.글)) m.set(l.글, (m.get(l.글) || 0) + 1);
  return m;
}
const 버퍼셈 = (버퍼) => 셈(줄나누기(글로(버퍼)));

/**
 * 양쪽이 바꾼 경로 하나의 줄 셈 검사. b·h·o·t: 바탕·로컬·origin·계획 판의 셈.
 * 이음: [{원래: [글…], 결과: 글}] — 문서 규칙이 두 줄을 한 줄로 이은 것(원래 줄은 결과 줄 안에 있다고 본다).
 * → {로컬빠짐, 원격빠짐, 남음, 겹침, 넘침} 각각 [{글, 수}]
 */
function 줄검사(b, h, o, t, 이음 = []) {
  const 계획 = new Map(t);
  for (const x of 이음) {
    for (const 원 of x.원래) 계획.set(원, (계획.get(원) || 0) + 1);
    계획.set(x.결과, (계획.get(x.결과) || 0) - 1);
  }
  const r = { 로컬빠짐: [], 원격빠짐: [], 남음: [], 겹침: [], 넘침: [] };
  for (const l of new Set([...b.keys(), ...h.keys(), ...o.keys(), ...계획.keys()])) {
    const bb = b.get(l) || 0, hh = h.get(l) || 0, oo = o.get(l) || 0, tt = Math.max(0, 계획.get(l) || 0);
    const dh = hh - bb, dor = oo - bb;
    // 로컬 줄은 origin이 지운 만큼 말고 다 있어야 하고, origin 줄은 로컬이 지운 만큼 말고 다 있어야 한다
    const 로컬몫 = hh + Math.min(dor, 0), 원격몫 = oo + Math.min(dh, 0);
    if (tt < 로컬몫) r.로컬빠짐.push({ 글: l, 수: 로컬몫 - tt });
    if (tt < 원격몫) r.원격빠짐.push({ 글: l, 수: 원격몫 - tt });
    const 위 = bb + Math.max(dh, 0) + Math.max(dor, 0);
    if (tt > 위) { r.넘침.push({ 글: l, 수: tt - 위 }); continue; }
    if (글자수(l) < 긴줄) continue;
    if (dh > 0 && dor > 0) {
      const 기대 = bb + Math.max(dh, dor);   // 양쪽이 같은 줄을 더했으면(다시 쌓아 올린 커밋) 한 번
      if (tt > 기대) r.겹침.push({ 글: l, 수: tt - 기대 });
    } else if (dh < 0 || dor < 0) {
      const 기대 = Math.max(0, dh < 0 && dor < 0 ? bb + Math.min(dh, dor) : bb + dh + dor);
      if (tt > 기대) r.남음.push({ 글: l, 수: tt - 기대 });
    }
  }
  return r;
}
const 문제수 = (검사) => Object.values(검사).reduce((n, v) => n + v.length, 0);

/** 로컬 판 → 계획 판에서 지워지는 줄. 줄마다 origin이 지운 몫·한 줄로 이은 몫·그 밖(로컬 줄)을 가른다. */
function 지움보기(b, h, o, t, 이음 = []) {
  const 이은원래 = new Map();
  for (const x of 이음) for (const 원 of x.원래) 이은원래.set(원, (이은원래.get(원) || 0) + 1);
  const 줄 = [];
  for (const [l, hh] of h) {
    const tt = t.get(l) || 0;
    if (tt >= hh) continue;
    let 남은 = hh - tt;
    const 원격 = Math.min(남은, Math.max(0, (b.get(l) || 0) - (o.get(l) || 0)));
    남은 -= 원격;
    const 이은 = Math.min(남은, 이은원래.get(l) || 0);
    줄.push({ 글: l, 수: hh - tt, 원격, 이은, 로컬: 남은 - 이은 });
  }
  return 줄;
}

// ── 겹친 곳 풀기 ────────────────────────────────────────────────────────────

const 표 = { 앞: '<'.repeat(표크기), 바탕: '|'.repeat(표크기), 가운데: '='.repeat(표크기), 뒤: '>'.repeat(표크기) };

/** git merge-file --diff3 출력(줄 목록) → [{평: 줄[]} | {충돌: {로컬, 바탕, 원격}}] */
function 블록나누기(줄들) {
  const 결과 = [];
  let 평 = [];
  for (let i = 0; i < 줄들.length; i++) {
    if (!줄들[i].글.startsWith(표.앞)) { 평.push(줄들[i]); continue; }
    if (평.length) { 결과.push({ 평 }); 평 = []; }
    const 칸 = { 로컬: [], 바탕: [], 원격: [] };
    let 지금 = '로컬';
    for (i++; i < 줄들.length && !줄들[i].글.startsWith(표.뒤); i++) {
      const g = 줄들[i].글;
      if (g.startsWith(표.바탕)) 지금 = '바탕';
      else if (g === 표.가운데) 지금 = '원격';
      else 칸[지금].push(줄들[i]);
    }
    결과.push({ 충돌: 칸 });
  }
  if (평.length) 결과.push({ 평 });
  return 결과;
}

const 같은글 = (a, b) => a.length === b.length && a.every((l, i) => l.글 === b[i].글);

/** 바탕 B(글 배열)와 한쪽 판 위(글 배열)를 맞춘다: 바탕 k마다 위의 번호(지웠으면 -1), 틈(k: 바탕 k 앞, B.length: 끝)마다 위가 끼운 번호들 */
function 맞춤(B, 위) {
  const 짝 = new Array(B.length).fill(-1);
  const 틈 = Array.from({ length: B.length + 1 }, () => []);
  let i = 0;
  for (const op of 줄차이(B, 위)) {
    if (op[0] === '=') { 짝[op[1]] = op[2]; i = op[1] + 1; } else if (op[0] === '-') i = op[1] + 1;
    else 틈[i].push(op[1]);
  }
  return { 짝, 틈 };
}

const 낱말 = (s) => s.split(/([ \t]+)/).filter((x) => x !== '');   // latin1 글이라 ASCII 띄어쓰기로만 자른다

/**
 * 같은 자리에 양쪽이 끼운 낱말 묶음 둘: 같은 낱말은 한 번, 한쪽에만 있는 것은 그 자리에. 같은 자리에서 서로 다르면 한쪽이
 * 띄어쓰기뿐이거나 한쪽이 다른 쪽을 낱말째 품을 때(20자 이상)만 — 글자 포함으로 고르면 「공개」 ⊂ 「비공개」처럼 한쪽 낱말이 뜻째
 * 사라진다. 안 되면 null.
 */
function 덧붙임합치기(x, y) {
  const 결과 = [];
  let A = [], C = [];
  const 비우기 = () => {
    if (A.length && C.length) {
      const as = A.join(''), cs = C.join(''), 긴 = 낱말품음(as, cs);
      if (!as.trim()) 결과.push(...C); else if (!cs.trim()) 결과.push(...A);
      else if (긴 !== null) 결과.push(...(긴 === as ? A : C)); else return false;
    } else 결과.push(...A, ...C);
    A = []; C = [];
    return true;
  };
  for (const op of 줄차이(x, y)) {
    if (op[0] === '=') { if (!비우기()) return null; 결과.push(x[op[1]]); } else if (op[0] === '-') A.push(x[op[1]]);
    else C.push(y[op[1]]);
  }
  return 비우기() ? 결과 : null;
}

/**
 * 「 · 」로 나뉜 항목 목록 줄(현장 노트 「쓴 AI」 머리말·트랙 줄)을 항목 단위 3방향으로 합친다. 양쪽 다 바탕 항목을 그대로 둔 채
 * 항목을 끼우기만 했을 때만 — 같은 자리에 둘 다 끼운 항목은 두 목록의 공통 차례를 따라 잇고, 같은 항목은 어디에 끼웠든 한 번
 * (로컬 자리). 다시 쌓아 올리며 차례가 바뀌거나 다른 자리에 붙은 항목이 두 번 들어가지 않는다. 목록 줄이 아니거나 바탕 항목을
 * 지우거나 고친 쪽이 있으면 null.
 */
function 항목3방향(a, c, b) {
  const Bi = 항목나누기(b), A = 항목나누기(a), C = 항목나누기(c);
  if (Bi.length < 2 && (A.length < 2 || C.length < 2)) return null;
  if ([...A, ...C].some((v) => !v.trim())) return null;
  const ma = 맞춤(Bi, A), mc = 맞춤(Bi, C);
  if (ma.짝.some((v) => v < 0) || mc.짝.some((v) => v < 0)) return null;
  const 로컬끼움 = new Set(ma.틈.flat().map((i) => A[i]));
  const 결과 = [];
  for (let k = 0; k <= Bi.length; k++) {
    const x = ma.틈[k].map((i) => A[i]);
    const y = mc.틈[k].map((i) => C[i]).filter((v) => !로컬끼움.has(v) || x.includes(v));   // 로컬이 다른 자리에 끼운 같은 항목은 로컬 자리에만
    const 차이 = 줄차이(x, y), 로컬만 = new Map();
    for (const op of 차이) if (op[0] === '-') 로컬만.set(x[op[1]], (로컬만.get(x[op[1]]) || 0) + 1);
    for (const op of 차이) {
      if (op[0] !== '+') { 결과.push(x[op[1]]); continue; }
      const n = 로컬만.get(y[op[1]]) || 0;   // 같은 틈에서 차례만 다른 같은 항목은 한 번(로컬 차례)
      if (n) 로컬만.set(y[op[1]], n - 1); else 결과.push(y[op[1]]);
    }
    if (k < Bi.length) 결과.push(Bi[k]);
  }
  return 결과.join(항목구분);
}

const 항목구분 = 라틴(' · ');
const 목록시작 = (xs) => xs.join('').replace(/^[ \t]+/, '').startsWith(라틴('· '));   // 덧붙인 낱말 묶음이 새 「 · 」 항목으로 시작하나
const 문장끝 = (s) => /[.!?]$/.test(s);

const 가운데점 = 라틴('·');
/** 덧붙인 낱말 묶음에서 새 「 · 」 항목이 시작하는 자리(없으면 끝) */
const 새항목자리 = (ys) => { for (let i = 1; i < ys.length; i++) if (ys[i] === 가운데점 && /^[ \t]+$/.test(ys[i - 1])) return i - 1; return ys.length; };

/**
 * 「 · 」로 항목을 나눈다. 괄호·대괄호·「」·백틱 안의 「 · 」는 나누지 않는다(「옮김(10-17 A · 10-18 B)」는 한 항목). 짝이 안 맞으면
 * (문장이 다음 줄로 넘어간 꼴) 괄호를 보지 않고 나눈다 — 줄 끝까지 한 항목으로 뭉개면 항목 단위로 못 합친다.
 */
function 항목나누기(s) {
  const r = 항목훑기(s);
  return r.맞음 ? r.항목 : s.split(항목구분);
}

/** 괄호·대괄호·「」·백틱 밖의 「 · 」 자리로 나눈 항목과, 짝이 다 맞았는지 */
function 항목훑기(s) {
  const 여는 = 라틴('「'), 닫는 = 라틴('」');
  const 항목 = [];
  let 깊이 = 0, 백틱 = false, 앞 = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '`') 백틱 = !백틱;
    else if (백틱) continue;
    else if (s[i] === '(' || s[i] === '[') 깊이++;
    else if ((s[i] === ')' || s[i] === ']') && 깊이 > 0) 깊이--;
    else if (s.startsWith(여는, i)) { 깊이++; i += 여는.length - 1; }
    else if (s.startsWith(닫는, i) && 깊이 > 0) { 깊이--; i += 닫는.length - 1; }
    else if (깊이 === 0 && s.startsWith(항목구분, i)) { 항목.push(s.slice(앞, i)); 앞 = i + 항목구분.length; i = 앞 - 1; }
  }
  항목.push(s.slice(앞));
  return { 항목, 맞음: !깊이 && !백틱 };
}

/** 합친 줄을 「 · 」·「. 」·「, 」·「; 」로 나눈 조각(10자 이상)이 원래 두 줄 어느 쪽보다 많이 나오면 겹쳐 넣은 것이다 */
const 조각구분 = new RegExp(`${라틴(' · ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|\\. |, |; `);
function 조각겹침(r, a, c) {
  const 셈조각 = (s) => { const m = new Map(); for (const x of s.split(조각구분)) { const k = x.trim().replace(/[.,;]+$/, ''); if (글자수(k) >= 10) m.set(k, (m.get(k) || 0) + 1); } return m; };   // 줄 끝 문장의 마침표도 떼고 센다
  const rm = 셈조각(r), am = 셈조각(a), cm = 셈조각(c);
  for (const [k, n] of rm) if (n >= 2 && n > Math.max(am.get(k) || 0, cm.get(k) || 0)) return k;
  return null;
}

/** 짧은 글의 낱말들이 긴 글에 낱말 경계로 이어서 들어 있나 */
function 낱말로품나(짧은, 긴) {
  const S = 낱말(짧은.trim()), L = 낱말(긴);
  if (!S.length) return false;
  for (let i = 0; i + S.length <= L.length; i++) if (S.every((x, j) => L[i + j] === x)) return true;
  return false;
}

/** 짧은 줄(20자 이상)이 긴 줄에 낱말 경계로 통째로 들어 있으면 긴 줄, 아니면 null */
function 낱말품음(a, c) {
  const [짧은, 긴] = a.length <= c.length ? [a, c] : [c, a];
  return 글자수(짧은) >= 긴줄 && 낱말로품나(짧은, 긴) ? 긴 : null;
}

/**
 * 양쪽이 다르게 쓴 두 줄(로컬 a · origin c)을 한 줄로. 고친 바탕 줄 b가 있으면 3방향만 한다 — 줄 끝 공백은 따로(바탕에서 바꾼
 * 쪽, 둘 다 바꿨으면 로컬) 떼어 두고, 「 · 」 항목 목록에 항목을 끼우기만 했으면 항목3방향, 아니면 낱말 단위로: 양쪽 다 바탕
 * 낱말을 그대로 둔 채 끼우기만 했을 때, 같은 자리에 둘 다 끼운 것은 덧붙임합치기, 줄 끝에 둘 다 덧붙였으면 잇는다(아래). 바탕
 * 낱말을 지우거나 바꾼 쪽이 있거나(그 지움을 되살리거나 뜻이 꼬인다) 같은 글을 서로 다른 자리에 끼웠으면(다시 쌓으며 옮긴
 * 글이면 두 번 들어간다) null. 바탕이 없으면 한쪽이 다른 쪽을 낱말째 품을 때만 긴 쪽. 합친 줄에 같은 조각이 겹쳐 들어가도
 * null(다시 쌓아 올린 같은 문장을 양쪽이 덧붙였으면 이어 붙인 줄에 두 번 들어간다).
 */
function 한줄합치기(a, c, b) {
  if (a === c) return a;
  if (b === null || b === undefined) return 낱말품음(a, c);
  const 끝공백 = (s) => /[ \t]*$/.exec(s)[0];
  const ta = 끝공백(a), tb = 끝공백(b), tc = 끝공백(c), 꼬리 = ta === tb ? tc : ta;
  a = a.slice(0, a.length - ta.length); b = b.slice(0, b.length - tb.length); c = c.slice(0, c.length - tc.length);
  if (a === c) return a + 꼬리;
  const 맞음 = [a, b, c].map((s) => 항목훑기(s).맞음);
  if ([a, b, c].some((s) => s.includes(항목구분)) && (맞음[0] !== 맞음[1] || 맞음[1] !== 맞음[2])) return null;   // 한쪽이 괄호·백틱 짝을 바꾼 목록 줄은 어디까지가 한 항목인지 모른다
  const 목록 = 항목3방향(a, c, b);
  if (목록 !== null) return 조각겹침(목록, a, c) === null ? 목록 + 꼬리 : null;
  const B = 낱말(b), A = 낱말(a), C = 낱말(c);
  const ma = 맞춤(B, A), mc = 맞춤(B, C);
  if (ma.짝.some((v) => v < 0) || mc.짝.some((v) => v < 0)) return null;
  const 끼운글 = (m, X) => m.틈.map((g) => g.map((i) => X[i]).join(''));
  const 로컬끼운 = 끼운글(ma, A), 원격끼운 = 끼운글(mc, C);
  const 다른자리 = (P, Q) => P.some((p, k) => 글자수(p.trim()) >= 2 && Q.some((q, j) => j !== k && 낱말로품나(p, q)));
  if (다른자리(로컬끼운, 원격끼운) || 다른자리(원격끼운, 로컬끼운)) return null;
  const 결과 = [];
  for (let k = 0; k <= B.length; k++) {
    const x = ma.틈[k].map((i) => A[i]), y = mc.틈[k].map((i) => C[i]);
    if (x.length && y.length) {
      const 둘 = 덧붙임합치기(x, y);
      if (둘) 결과.push(...둘);
      else if (k < B.length) return null;
      // 줄 끝에 둘 다 덧붙였다: 한쪽만 새 「 · 」 항목으로 시작하면 다른 쪽이 끝 항목을 늘린 글 다음에 새 항목들을 로컬·origin
      // 차례로, 둘 다 새 항목이거나 바탕이 문장으로 끝났으면 로컬 다음 origin. 둘 다 마지막 낱말 뒤에 이어 썼으면(「10-19 오전」·
      // 「10-19 저녁」) 같은 자리의 다른 판일 수 있어 멈춘다.
      else if (목록시작(x) !== 목록시작(y)) {
        if (목록시작(y)) 결과.push(...x, ...y);
        else { const i = 새항목자리(y); 결과.push(...y.slice(0, i), ...x, ...y.slice(i)); }
      } else if (목록시작(x) || 문장끝(b)) 결과.push(...x, ...y);
      else return null;
    } else 결과.push(...x, ...y);
    if (k < B.length) 결과.push(B[k]);
  }
  const r = 결과.join('');
  return 조각겹침(r, a, c) === null ? r + 꼬리 : null;
}

/**
 * 같은 틈에서 2방향으로 맞춰도 서로 다른 줄 묶음(로컬 A · origin C). 같은 머리(앞 40자)끼리, 또는 둘 다 같은 바탕 줄을
 * 고친 한 줄씩이면 짝지어 한줄합치기. 짝 없는 줄은 양쪽이 따로 더한 줄로 둔다(로컬 다음 origin).
 * 둘 다 고친 바탕 줄이 있는데 짝 못 지은 줄이 양쪽에 남으면 같은 줄의 두 판을 다 두게 되니 멈춘다.
 */
const 같은앞 = (x, y) => { let i = 0; while (i < x.length && i < y.length && x[i] === y[i]) i++; return i; };
const 품음 = (x, y) => 낱말품음(x, y) !== null;

/** 둘 다 지운 바탕 줄 가운데 두 줄(a·c)의 바탕: 둘 다의 앞머리인 줄, 없으면 앞머리가 가장 많이 같은 줄(4바이트 이상) */
function 바탕고르기(고친, a, c) {
  let 가장 = null, 길이 = 0;
  for (const b of 고친) {
    if (b.글 && a.startsWith(b.글) && c.startsWith(b.글)) return b;
    const n = Math.min(같은앞(a, b.글), 같은앞(c, b.글));
    if (n > 길이) { 가장 = b; 길이 = n; }
  }
  return 길이 >= 4 ? 가장 : null;
}

function 짝합치기(A, C, 고친) {
  const 결과 = [...A], 이음 = [], 쓴 = new Set(), 남은 = [];
  for (const [j, c] of C.entries()) {
    let i = A.findIndex((a, n) => !쓴.has(n) && ((글자수(c.글) >= 긴줄 && 머리(a.글) === 머리(c.글)) || 품음(a.글, c.글)));
    // 둘 다 같은 바탕 줄들을 고쳐 같은 수의 줄을 썼으면 같은 차례끼리
    if (i < 0 && 고친.length && A.length === C.length && !쓴.has(j)) i = j;
    if (i < 0) { 남은.push(c); continue; }
    쓴.add(i);
    const 바탕 = 바탕고르기(고친, A[i].글, c.글);
    const 줄 = 한줄합치기(A[i].글, c.글, 바탕 ? 바탕.글 : null);
    if (줄 === null) {
      return {
        실패: 바탕 ? `양쪽이 같은 줄을 다르게 고쳤다: ${보이게(바탕.글).slice(0, 80)}`
          : 고친.length ? `양쪽이 같은 곳을 다르게 고쳤다: 로컬 「${보이게(A[i].글).slice(0, 60)}」 · origin 「${보이게(c.글).slice(0, 60)}」`
            : `같은 머리의 다른 줄이 양쪽에 있다(같은 항목의 두 판일 수 있다): ${보이게(c.글).slice(0, 80)}`,
      };
    }
    if (줄 !== A[i].글) 결과[i] = { 글: 줄, 끝: A[i].끝 };
    이음.push({ 원래: [A[i].글, c.글], 결과: 줄 });
  }
  if (고친.length && 남은.length && 쓴.size < A.length) {
    const 로컬남은 = A.find((_, n) => !쓴.has(n));
    return { 실패: `양쪽이 같은 곳을 다르게 고쳤다: 로컬 「${보이게(로컬남은.글).slice(0, 60)}」 · origin 「${보이게(남은[0].글).slice(0, 60)}」` };
  }
  return { 줄: [...결과, ...남은], 이음, 합침: 남은.length > 0 };
}

/** 같은 틈에 양쪽이 끼운 줄 묶음을 2방향으로 맞춘다: 같은 줄은 한 번, 한쪽에만 있는 묶음은 그 자리에, 같은 자리의 다른 줄은 짝합치기 */
function 틈합치기(로컬, 원격, 고친) {
  if (!로컬.length || !원격.length) return { 줄: [...로컬, ...원격], 이음: [], 합침: false };
  const 결과 = [], 이음 = [];
  let 합침 = false, A = [], C = [];
  const 비우기 = () => {
    if (A.length && C.length) {
      const r = 짝합치기(A, C, 고친);
      if (r.실패) return r;
      결과.push(...r.줄); 이음.push(...r.이음); 합침 = 합침 || r.합침;
    } else { 결과.push(...A, ...C); 합침 = 합침 || C.length > 0; }   // 로컬도 끼운 틈에 origin만 끼운 줄 묶음
    A = []; C = [];
    return null;
  };
  for (const op of 줄차이(로컬.map((x) => x.글), 원격.map((x) => x.글))) {
    if (op[0] === '=') { const f = 비우기(); if (f) return f; 결과.push(로컬[op[1]]); } else if (op[0] === '-') A.push(로컬[op[1]]);
    else C.push(원격[op[1]]);
  }
  const f = 비우기();
  if (f) return f;
  return { 줄: 결과, 이음, 합침 };
}

/**
 * 문서의 겹친 덩어리를 줄 단위로 합친다. 한쪽만 지운 바탕 줄은 지우고, 틈마다 양쪽이 끼운 줄을 틈합치기로 맞춘다.
 * origin이 끼운 줄이 로컬이 이 덩어리의 다른 틈에 끼운 줄과 같으면(다시 쌓아 올리며 자리가 바뀐 줄) 한 번만 둔다.
 */
function 문서합치기(L, B, T) {
  const 글 = (xs) => xs.map((x) => x.글);
  const l = 맞춤(글(B), 글(L)), t = 맞춤(글(B), 글(T));
  const 틈줄 = (m, 위, k) => m.틈[k].map((i) => 위[i]);
  const 로컬전체 = new Map(), 소비 = new Map();
  for (let k = 0; k <= B.length; k++) for (const x of 틈줄(l, L, k)) 로컬전체.set(x.글, (로컬전체.get(x.글) || 0) + 1);
  const 양쪽지움 = (j) => j >= 0 && j < B.length && l.짝[j] < 0 && t.짝[j] < 0;
  const 결과 = [], 이음 = [];
  let 합침 = false;
  for (let k = 0; k <= B.length; k++) {
    const 로컬 = 틈줄(l, L, k);
    const 이틈 = new Map();
    for (const x of 로컬) 이틈.set(x.글, (이틈.get(x.글) || 0) + 1);
    const 원격 = [];
    for (const x of 틈줄(t, T, k)) {
      const 남 = (로컬전체.get(x.글) || 0) - (이틈.get(x.글) || 0) - (소비.get(x.글) || 0);
      if (!이틈.has(x.글) && 남 > 0) { 소비.set(x.글, (소비.get(x.글) || 0) + 1); continue; }
      원격.push(x);
    }
    // 이 틈에 붙은, 양쪽이 다 지운 바탕 줄(같은 줄을 둘 다 고쳤을 수 있다)
    const 고친 = [];
    for (let j = k - 1; 양쪽지움(j); j--) 고친.unshift(B[j]);
    for (let j = k; 양쪽지움(j); j++) 고친.push(B[j]);
    const r = 틈합치기(로컬, 원격, 고친);
    if (r.실패) return r;
    결과.push(...r.줄); 이음.push(...r.이음); 합침 = 합침 || r.합침;
    if (k < B.length && l.짝[k] >= 0 && t.짝[k] >= 0) 결과.push(L[l.짝[k]]);
  }
  const 이은 = 이음.filter((x) => x.원래[0] !== x.결과 || x.원래[1] !== x.결과);
  const 방법 = [...(이은.length ? ['양쪽이 고친 줄을 한 줄로 이음'] : []), ...(합침 ? ['양쪽이 더한 줄 합침'] : [])];
  return { 줄: 결과, 방법: 방법.join(' · ') || '한쪽씩 고친 줄 합침', 이음 };
}

/** 바탕 B → 한쪽 판 X: 바탕 줄마다 남겼나, 끼운 줄마다 {틈(바탕 k번 줄 앞), 글} */
function 바뀜(B, X) {
  const 남김 = new Array(B.length).fill(false), 끼움 = [];
  let i = 0;
  for (const op of 줄차이(B.map((l) => l.글), X.map((l) => l.글))) {
    if (op[0] === '=') { 남김[op[1]] = true; i = op[1] + 1; } else if (op[0] === '-') i = op[1] + 1;
    else 끼움.push({ 틈: i, 글: X[op[1]].글 });
  }
  return { 남김, 끼움 };
}

/**
 * Y가 X의 바뀜(바탕 B 기준)을 다 품는가 — 줄 셈이 아니라 자리까지 본다. X가 지운 바탕 줄은 Y도 지웠고, X가 끼운 줄은 Y도
 * 같은 구역(양쪽이 다 남긴 바탕 줄을 닻으로 나눈 사이)에 끼웠어야 한다. 차례만 바꾼 쪽은 「바꾼 것 없음」이 아니다. 빈 줄은 보지 않는다.
 */
function 품나(B, X, Y) {
  const x = 바뀜(B, X), y = 바뀜(B, Y);
  const 구역 = [];
  let r = 0;
  for (let k = 0; k <= B.length; k++) {
    구역.push(r);
    if (k < B.length && x.남김[k] && y.남김[k]) r++;
  }
  for (let k = 0; k < B.length; k++) if (!x.남김[k] && y.남김[k] && !빈줄(B[k].글)) return false;
  const y끼움 = new Map();
  for (const e of y.끼움) { const 열쇠 = `${구역[e.틈]}\0${e.글}`; y끼움.set(열쇠, (y끼움.get(열쇠) || 0) + 1); }
  for (const e of x.끼움) {
    if (빈줄(e.글)) continue;
    const 열쇠 = `${구역[e.틈]}\0${e.글}`, n = y끼움.get(열쇠) || 0;
    if (!n) return false;
    y끼움.set(열쇠, n - 1);
  }
  return true;
}

/**
 * 겹친 덩어리 하나(로컬 L · 바탕 B · origin T). 전체: 그 파일 세 판의 줄 셈 {로컬, 바탕, 원격}(있으면 옮긴 줄을 가린다).
 * → {줄, 방법, 이음?} | {실패}
 */
function 덩어리풀기(L, B, T, 문서, 전체 = null) {
  if (같은글(L, T)) return { 줄: L, 방법: '양쪽이 같게 고침' };
  const lc = 셈(L), bc = 셈(B), tc = 셈(T);
  if (전체) {
    // 덩어리 안에서 양쪽이 다 지운 바탕 줄을 한쪽이 파일 전체에선 그대로 가졌으면 그쪽은 줄을 옮겼다 —
    // 다른 쪽의 고침을 옮긴 자리에 얹어야 하는데 그 자리는 이 덩어리 밖이라 사람이 정한다(그냥 두면 옛 판·새 판이 둘 다 남는다)
    const 양쪽지운 = [...셈빼기(bc, lc).keys()].filter((l) => 셈빼기(bc, tc).has(l));
    const 옮김 = 양쪽지운.find((l) => ['로컬', '원격'].some((k) => (전체[k].get(l) || 0) >= (전체.바탕.get(l) || 0)));
    if (옮김 !== undefined) return { 실패: `한쪽이 옮긴 줄을 다른 쪽이 고쳤거나 지웠다(옮긴 자리를 사람이 정한다): ${보이게(옮김).slice(0, 80)}` };
  }
  if (품나(B, T, L)) return { 줄: L, 방법: '로컬이 origin 변경을 품음' };
  if (품나(B, L, T)) return { 줄: T, 방법: 'origin이 로컬 변경을 품음' };
  if (!문서) return { 실패: '코드·데이터 파일의 같은 곳을 양쪽이 다르게 고쳤다' };
  return 문서합치기(L, B, T);
}

/** 사람이 고칠 충돌 표시(git 기본 7자) */
function 충돌표시(로컬, 바탕, 원격) {
  const 끝 = ([...로컬, ...원격, ...바탕].find((x) => x.끝) || { 끝: '\n' }).끝;
  const 표줄 = (s) => ({ 글: 라틴(s), 끝 });
  return [표줄('<<<<<<< 로컬'), ...로컬, 표줄('||||||| 바탕'), ...바탕, 표줄('======='), ...원격, 표줄('>>>>>>> origin')];
}

/**
 * 양쪽이 바꾼 글 파일 하나를 바탕 판 기준으로 합친다. → {버퍼, 방법, 이음} | {실패, 덩어리, 표시}
 * 표시: 규칙으로 푼 곳은 풀고 못 푼 곳만 충돌 표시를 남긴 판(--겹친곳쓰기가 쓴다).
 */
function 글합치기(git, 저장, 경로, 로컬sha, 바탕sha, 원격sha, 합집합) {
  const r = git.돌리기(['merge-file', '-p', 합집합 ? '--union' : '--diff3', '--object-id', `--marker-size=${표크기}`,
    '-L', '로컬', '-L', '바탕', '-L', 'origin', 로컬sha, 바탕sha, 원격sha], { 허용: null });
  if (r.status === 0) return { 버퍼: r.stdout, 방법: 합집합 ? '합집합(merge=union)' : '3방향', 이음: [] };
  if (!(r.status > 0 && r.status < 128)) return { 실패: `git merge-file 실패(${r.status}): ${String(r.stderr).trim()}` };
  const 문서 = 문서꼴.test(경로);
  const [로컬판, 바탕판, 원격판] = [로컬sha, 바탕sha, 원격sha].map((s) => 블롭(git, 저장, s));
  const 전체 = { 로컬: 버퍼셈(로컬판), 바탕: 버퍼셈(바탕판), 원격: 버퍼셈(원격판) };
  const 결과 = [], 표시 = [], 이음 = [], 방법 = new Set(), 못푼 = [];
  for (const 칸 of 블록나누기(줄나누기(글로(r.stdout)))) {
    if (칸.평) { 결과.push(...칸.평); 표시.push(...칸.평); continue; }
    const { 로컬, 바탕, 원격 } = 칸.충돌;
    const f = 덩어리풀기(로컬, 바탕, 원격, 문서, 전체);
    if (f.실패) {
      const 보 = (xs) => xs.map((x) => 보이게(x.글));
      못푼.push({ 이유: f.실패, 로컬: 보(로컬), 바탕: 보(바탕), 원격: 보(원격) });
      표시.push(...충돌표시(로컬, 바탕, 원격));
      continue;
    }
    결과.push(...f.줄);
    표시.push(...f.줄);
    이음.push(...(f.이음 || []));
    방법.add(f.방법);
  }
  if (못푼.length) return { 실패: 못푼[0].이유, 덩어리: 못푼, 표시: 바이트로(줄잇기(줄바꿈채우기(표시))), 이음 };
  // git merge-file은 겹친 곳 끝 줄에 줄바꿈을 붙인다. 양쪽 다 끝 줄바꿈이 없던 파일이면 결과에서도 뗀다
  let 글 = 줄잇기(줄바꿈채우기(결과));
  const 끝없음 = (b) => b.length > 0 && b[b.length - 1] !== 0x0a;
  if (끝없음(로컬판) && 끝없음(원격판)) 글 = 글.replace(/\r?\n$/, '');
  return { 버퍼: 바이트로(글), 방법: [...방법].join(' · '), 이음 };
}

// ── 겹친 사본 정리 ──────────────────────────────────────────────────────────

const 절머리꼴 = /^#{2,4} /;

/**
 * 문서에서 양쪽이 같은 절·행을 서로 다른 자리에 더해(다시 쌓아 올린 항목) 규칙 병합이 두 번 넣은 줄 — 줄 검사 「같은 줄이 두 번」 —
 * 의 뒤쪽 사본을 지운다. 절(##~#### 머리부터 다음 머리 앞까지)은 머리가 같은 절이 로컬·origin 어느 판보다 많고 겹친 줄이
 * 두 사본 넘게에 함께 있을 때만 다른 사본을 모두 품는 사본 하나를 남긴다(한쪽 판에 이미 그만큼 있는 절은 그 판의 내용이라
 * 그대로, 머리만 같은 다른 절은 그대로, 서로 품지 않으면 멈춘다).
 * 남은 겹친 줄은 앞에서부터 남길 수만큼 두고 뒤쪽 사본을 지운다 — 사이에 끼인 짧은 줄·빈 줄까지 한 묶음으로 보고, 묶음이
 * 모두 겹친 줄이거나 묶음째 앞에 있을 때만. 지운 사본 바로 앞뒤에 붙은 짧은 줄(본문 없는 부모 머리, 「- 10-19 새 항목:」 같은 머리
 * 줄·꼬리 줄)은 남긴 사본 앞뒤와 같고 셈이 로컬·origin 어느 판보다 많을 때 함께 지운다(빈 줄은 그 너머가 맞을 때만). 끝에 겹친 줄마다
 * 남길 수와 같은지 세고, 지운 자리 옆에 어느 판보다 많은 짧은 줄이 남았으면(사본 조각일 수 있다) 멈춘다.
 * 줄들: [{글, 끝}] · 겹침: 줄검사의 [{글, 수}] · 쪽셈: {로컬, 원격} 판의 줄 셈(빈 줄 빼고) → {줄, 절, 줄수} | {실패}
 */
function 겹침정리(줄들, 겹침, 쪽셈) {
  const 셈글 = (xs) => xs.reduce((m, l) => m.set(l.글, (m.get(l.글) || 0) + 1), new Map());
  const 쪽최대 = (g) => Math.max(쪽셈.로컬.get(g) || 0, 쪽셈.원격.get(g) || 0);
  // 지운 사본이 파일 끝까지였으면 그 앞 빈 줄이 파일 끝에 남지 않게 함께 지운다
  const 끝정리 = (xs, 지울) => {
    if (!xs.length || !지울[xs.length - 1]) return;
    for (let i = xs.length - 1; i >= 0; i--) {
      if (지울[i]) continue;
      if (!빈줄(xs[i].글)) break;
      지울[i] = true;
    }
  };
  // 지운 줄 덩어리 앞뒤가 다 빈 줄이면 뒤 빈 줄도 지운다(빈 줄 두 겹이 남지 않게)
  const 빈줄정리 = (xs, 지울) => {
    for (let i = 0; i < xs.length; i++) {
      if (!지울[i] || (i > 0 && 지울[i - 1])) continue;
      let j = i;
      while (j + 1 < xs.length && 지울[j + 1]) j++;
      if (i > 0 && j + 1 < xs.length && 빈줄(xs[i - 1].글) && 빈줄(xs[j + 1].글)) 지울[j + 1] = true;
    }
  };
  // 지운 사본 [s..e]의 앞뒤를 남긴 사본 [ks..ke]의 앞뒤와 맞대 넓힌다: 같은 짧은 줄이고 셈이 어느 판보다 많으면 함께 지운다.
  // 빈 줄은 그 너머의 줄까지 맞을 때만 함께. 셈판: 아직 남은 줄의 셈(넓히며 줄인다)
  const 넓히기 = (xs, 지울, 셈판, s, e, ks, ke) => {
    const 안 = (i, a, b) => i >= a && i <= b;
    for (const 쪽 of [-1, 1]) {
      let 맞음 = 0;
      for (let k = 1; ; k++) {
        const i = 쪽 < 0 ? s - k : e + k, j = 쪽 < 0 ? ks - k : ke + k;
        if (i < 0 || j < 0 || i >= xs.length || j >= xs.length || 안(i, ks, ke) || 안(j, s, e) || 지울[i] || 지울[j]) break;
        const g = xs[i].글;
        if (g !== xs[j].글) break;
        if (빈줄(g)) continue;
        if (글자수(g) >= 긴줄 || (셈판.get(g) || 0) <= 쪽최대(g)) break;
        셈판.set(g, 셈판.get(g) - 1);
        맞음 = k;
      }
      for (let k = 1; k <= 맞음; k++) 지울[쪽 < 0 ? s - k : e + k] = true;
    }
  };
  // 지운 줄 덩어리마다 걸러 낸 배열에서의 자리(그 앞에 남은 줄 수)와, 앞 단계 자리를 이번 단계에서 걸러 낸 뒤의 자리로 옮기기
  const 자리들 = (지울) => { const r = []; let n = 0; for (let i = 0; i < 지울.length; i++) { if (!지울[i]) n++; else if (i === 0 || !지울[i - 1]) r.push(n); } return r; };
  const 옮김 = (자리, 지울) => { const 앞 = [0]; for (let i = 0; i < 지울.length; i++) 앞.push(앞[i] + (지울[i] ? 0 : 1)); return 자리.map((p) => 앞[p]); };
  const 처음 = 셈글(줄들);
  const 남길수 = new Map(겹침.map((x) => [x.글, (처음.get(x.글) || 0) - x.수]));
  const 짚은 = new Set(겹침.map((x) => x.글));
  // 1) 절
  const 절 = [];
  줄들.forEach((l, i) => { if (절머리꼴.test(l.글)) 절.push({ 머리: l.글, 시작: i, 끝: i }); else if (절.length) 절[절.length - 1].끝 = i; });
  const 무리 = new Map();
  for (const s of 절) 무리.set(s.머리, [...(무리.get(s.머리) || []), s]);
  const 절지울 = new Array(줄들.length).fill(false);
  const 글줄 = (s) => 줄들.slice(s.시작, s.끝 + 1).map((l) => l.글).filter((g) => !빈줄(g));
  const 품나 = (큰, 작은) => {
    const m = new Map();
    for (const g of 글줄(큰)) m.set(g, (m.get(g) || 0) + 1);
    for (const g of 글줄(작은)) { const n = m.get(g) || 0; if (!n) return false; m.set(g, n - 1); }
    return true;
  };
  let 지운절 = 0;
  const 지운사본 = [];
  for (const [머리, 사본] of 무리) {
    if (사본.length < 2) continue;
    const 쪽수 = 쪽최대(머리);
    if (사본.length <= 쪽수) continue;
    // 겹친 줄이 두 사본 넘게에 함께 있어야 같은 절이 두 번 들어간 것이다(한 사본 안에서만 겹쳤으면 아래 줄 정리가 맡는다)
    if (![...짚은].some((g) => 사본.filter((s) => 글줄(s).includes(g)).length >= 2)) continue;
    if (쪽수 >= 2) return { 실패: `머리가 같은 절 「${보이게(머리).slice(0, 60)}」이 한쪽 판에 ${쪽수}번, 합친 판에 ${사본.length}번 있다` };
    const 남길 = 사본.find((s) => 사본.every((t) => t === s || 품나(s, t)));
    if (!남길) return { 실패: `머리가 같은 절 「${보이게(머리).slice(0, 60)}」이 두 번 들어갔는데 어느 사본도 다른 사본을 다 품지 않는다(같은 항목의 두 판)` };
    for (const t of 사본) {
      if (t === 남길) continue;
      for (let i = t.시작; i <= t.끝; i++) 절지울[i] = true;
      지운절++;
      지운사본.push([t.시작, t.끝, 남길.시작, 남길.끝]);
    }
  }
  const 셈1 = 셈글(줄들.filter((_, i) => !절지울[i]));
  for (const [s, e, ks, ke] of 지운사본) 넓히기(줄들, 절지울, 셈1, s, e, ks, ke);
  빈줄정리(줄들, 절지울);
  끝정리(줄들, 절지울);
  const 자리1 = 자리들(절지울);
  let 줄 = 줄들.filter((_, i) => !절지울[i]);
  const 지금 = 셈글(줄);
  for (const [g, n] of 남길수) if ((지금.get(g) || 0) < n) return { 실패: `절을 지우다 남길 줄까지 지웠다: 「${보이게(g).slice(0, 60)}」` };
  // 2) 남은 겹친 줄
  const 남은 = new Map([...남길수].map(([g, n]) => [g, (지금.get(g) || 0) - n]).filter(([, k]) => k > 0));
  const 지울 = new Array(줄.length).fill(false);
  const 본 = new Map();
  for (let i = 0; i < 줄.length; i++) {
    const g = 줄[i].글;
    if (!남은.has(g)) continue;
    본.set(g, (본.get(g) || 0) + 1);
    if (본.get(g) > 지금.get(g) - 남은.get(g)) 지울[i] = true;   // 앞에서부터 남길 수만큼 두고 뒤쪽 사본을 지운다
  }
  const 묶음 = [];
  for (let i = 0; i < 줄.length; i++) {
    if (!지울[i]) continue;
    let j = i;
    for (;;) {
      let k = j + 1;
      while (k < 줄.length && !지울[k] && 글자수(줄[k].글) < 긴줄 && !남은.has(줄[k].글)) k++;
      if (k < 줄.length && 지울[k]) j = k; else break;
    }
    // 사이에 겹친 줄 아닌 짧은 줄이 끼었으면 묶음째 앞에 있을 때만(겹친 줄 사이 빈 줄은 그냥 함께 지운다)
    if (!줄.slice(i, j + 1).every((l, d) => 지울[i + d] || 빈줄(l.글))) {
      const 조각 = 줄.slice(i, j + 1).map((l) => l.글).join('\n');
      if (!`\n${줄.slice(0, i).map((l) => l.글).join('\n')}\n`.includes(`\n${조각}\n`)) return { 실패: `같은 줄 묶음(「${보이게(줄[i].글).slice(0, 50)}」…)이 앞에 그대로 있지 않아 어느 사본을 지울지 모른다` };
    }
    for (let d = i; d <= j; d++) 지울[d] = true;
    묶음.push([i, j]);
    i = j;
  }
  // 남긴 사본(앞에서 같은 줄 묶음이 처음 나오는 곳)의 앞뒤와 맞대 넓힌다
  const 앞자리 = (i, j) => {
    for (let p = 0; p + (j - i) < i; p++) {
      let 같음 = true;
      for (let d = 0; d <= j - i && 같음; d++) 같음 = !지울[p + d] && 줄[p + d].글 === 줄[i + d].글;
      if (같음) return p;
    }
    return null;
  };
  const 짝 = 묶음.map(([i, j]) => [i, j, 앞자리(i, j)]);
  const 셈2 = 셈글(줄.filter((_, i) => !지울[i]));
  for (const [i, j, p] of 짝) if (p !== null) 넓히기(줄, 지울, 셈2, i, j, p, p + (j - i));
  빈줄정리(줄, 지울);
  끝정리(줄, 지울);
  const 자리 = [...옮김(자리1, 지울), ...자리들(지울)];
  줄 = 줄.filter((_, i) => !지울[i]);
  const 끝셈 = 셈글(줄);
  for (const [g, n] of 남길수) if ((끝셈.get(g) || 0) !== n) return { 실패: `정리 뒤 「${보이게(g).slice(0, 60)}」이 ${끝셈.get(g) || 0}번(남길 수 ${n})` };
  // 지운 자리 옆에 어느 판보다 많은 짧은 줄이 남았으면 남긴 사본 옆과 달라 함께 못 지운 사본 조각일 수 있다
  for (const p of 자리) {
    for (const 쪽 of [-1, 1]) {
      let i = 쪽 < 0 ? p - 1 : p;
      while (i >= 0 && i < 줄.length && 빈줄(줄[i].글)) i += 쪽;
      if (i < 0 || i >= 줄.length) continue;
      const g = 줄[i].글;
      if (글자수(g) < 긴줄 && (끝셈.get(g) || 0) > 쪽최대(g)) return { 실패: `지운 사본 옆 짧은 줄 「${보이게(g).slice(0, 60)}」이 로컬·origin 어느 판보다 많이 남는다(사본 조각일 수 있다)` };
    }
  }
  return { 줄, 절: 지운절, 줄수: 줄들.length - 줄.length };
}

/** 합친 문서 판의 줄 검사에 「같은 줄이 두 번」이 있으면 겹침정리. 정리가 다른 줄 문제를 늘리면 실패. → {} | {버퍼, 정리} | {실패} */
function 겹친사본정리(c, 저장, h, 바탕sha, o, 버퍼, 이음) {
  const [hb, bb, ob] = [h.sha, 바탕sha, o.sha].map((s) => 블롭(c.git, 저장, s));
  const 잼 = (b) => 줄검사(버퍼셈(bb), 버퍼셈(hb), 버퍼셈(ob), 버퍼셈(b), 이음);
  const 앞 = 잼(버퍼);
  if (!앞.겹침.length) return {};
  const r = 겹침정리(줄나누기(글로(버퍼)), 앞.겹침, { 로컬: 버퍼셈(hb), 원격: 버퍼셈(ob) });
  if (r.실패) return { 실패: r.실패 };
  let 글 = 줄잇기(r.줄);
  if (버퍼.length && 버퍼[버퍼.length - 1] !== 0x0a) 글 = 글.replace(/\r?\n$/, '');   // 끝 줄바꿈 없던 판은 그대로
  const 새 = 바이트로(글);
  const 뒤 = 잼(새);
  if (뒤.겹침.length) return { 실패: `정리 뒤에도 같은 줄이 두 번 남는다: 「${보이게(뒤.겹침[0].글).slice(0, 60)}」` };
  for (const k of ['로컬빠짐', '원격빠짐', '남음', '넘침']) if (뒤[k].length > 앞[k].length) return { 실패: `정리가 「${문제이름[k]}」을 만들었다` };
  return { 버퍼: 새, 정리: { 절: r.절, 줄: r.줄수 } };
}

/** 사람이 고친 풀이 파일에 남은 충돌 표시(로컬·origin 판에 없던 표시 줄) */
function 남은표시(버퍼, 판들) {
  const 있던 = new Set(판들.flatMap((b) => 줄나누기(글로(b)).map((l) => l.글)));
  return 줄나누기(글로(버퍼)).map((l) => l.글).find((g) => /^(<{7}|>{7}|\|{7})( |$)|^={7}$/.test(g) && !있던.has(g)) || null;
}

// ── git ─────────────────────────────────────────────────────────────────────

/** 트리 → Map(경로 → {모드, 종류, sha}) */
function 트리읽기(git, 트리) {
  const m = new Map();
  for (const 줄 of git(['ls-tree', '-r', '-z', 트리]).toString('utf8').split('\0')) {
    if (!줄) continue;
    const 탭 = 줄.indexOf('\t');
    const [모드, 종류, sha] = 줄.slice(0, 탭).split(' ');
    m.set(줄.slice(탭 + 1), { 모드, 종류, sha });
  }
  return m;
}

/** 두 트리에서 항목(모드·blob)이 다른 경로 */
function 바뀐경로(가, 나) {
  const s = new Set();
  for (const [p, e] of 가) { const f = 나.get(p); if (!f || f.sha !== e.sha || f.모드 !== e.모드) s.add(p); }
  for (const p of 나.keys()) if (!가.has(p)) s.add(p);
  return s;
}

/** 범위(예: 바탕..로컬)의 커밋에서 경로마다 나온 blob을 최근 것부터. 병합 커밋은 부모마다 본다(-m). */
function 이력blob(git, 범위, 경로들) {
  const 찾을 = new Set(경로들);
  const 결과 = new Map();
  if (!찾을.size) return 결과;
  const 칸 = git(['log', '-m', '--raw', '-z', '--no-abbrev', '--no-renames', '--format=%x01%H', 범위]).toString('utf8').split('\0');
  for (let i = 0; i < 칸.length; i++) {
    const s = 칸[i].replace(/^\n/, '');
    if (!s.startsWith(':')) continue;
    const 경로 = 칸[++i];
    const m = /^:\d{6} \d{6} [0-9a-f]+ ([0-9a-f]+) [A-Z]/.exec(s);
    if (!m || !찾을.has(경로) || /^0+$/.test(m[1])) continue;
    if (!결과.has(경로)) 결과.set(경로, []);
    if (!결과.get(경로).includes(m[1])) 결과.get(경로).push(m[1]);
  }
  return 결과;
}

/** origin 이력(최근 것부터)에서 로컬 이력에도 나오는 첫 blob — 양쪽이 함께 가진 가장 최근 판 */
function 공통판(로컬이력 = [], 원격이력 = []) {
  const 로컬 = new Set(로컬이력);
  return 원격이력.find((s) => 로컬.has(s)) || null;
}

/** 그 경로의 merge 속성이 union인 것 */
function 합집합경로(git, 경로들) {
  const 결과 = new Set();
  if (!경로들.length) return 결과;
  const 칸 = git(['check-attr', '--stdin', '-z', 'merge'], { input: `${경로들.join('\0')}\0` }).toString('utf8').split('\0');
  for (let i = 0; i + 2 < 칸.length; i += 3) if (칸[i + 2] === 'union') 결과.add(칸[i]);
  return 결과;
}

/** origin에만 있는 커밋 가운데 같은 작성자·제목의 로컬 커밋이 없는 것(다시 쌓아 올린 내 커밋이 아닌 것) → [{커밋, 제목}] */
function 쌍없는원격커밋(git, 로컬범위, 원격범위) {
  const 읽기 = (범위) => git(['log', '--format=%H%x00%an%x00%ae%x00%s%x01', 범위]).toString('utf8').split('\x01')
    .map((s) => s.replace(/^\n/, '')).filter(Boolean).map((s) => { const [커밋, ...칸] = s.split('\0'); return { 커밋, 열쇠: 칸.join('\0'), 제목: 칸[2] }; });
  const 로컬 = new Set(읽기(로컬범위).map((x) => x.열쇠));
  return 읽기(원격범위).filter((x) => !로컬.has(x.열쇠)).map(({ 커밋, 제목 }) => ({ 커밋, 제목 }));
}

function 체크아웃된곳(git, 가지ref) {
  try {
    for (const 묶음 of git.글(['worktree', 'list', '--porcelain']).split(/\n\n/)) {
      const 줄 = 묶음.split('\n');
      if (줄.includes(`branch ${가지ref}`)) return 줄[0].replace(/^worktree /, '');
    }
  } catch (_) {}
  return null;
}

/** 별도 인덱스에 바탕 커밋 트리를 읽고 고칠 항목(null이면 지움)을 얹어 트리를 만든다 */
function 트리만들기(git, 바탕커밋, 고칠, 영) {
  const 인덱스 = 별도인덱스(git, 바탕커밋);
  try {
    const 줄 = [...고칠].map(([p, e]) => (e ? `${e.모드} ${e.sha}\t${p}` : `0 ${영}\t${p}`));
    if (줄.length) git(['update-index', '-z', '--index-info'], { env: 인덱스.env, input: `${줄.join('\0')}\0` });
    return git.글(['write-tree'], { env: 인덱스.env });
  } finally {
    인덱스.치우기();
  }
}

/** git status(porcelain, 미추적 전부) → Map(경로 → 두 글자). 공용 인덱스를 다시 쓰지 않게 GIT_OPTIONAL_LOCKS=0 */
function 상태읽기(git) {
  const r = git.돌리기(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames'], { env: { GIT_OPTIONAL_LOCKS: '0' }, 허용: null });
  if (r.status !== 0) return null;
  const m = new Map();
  for (const s of r.stdout.toString('utf8').split('\0')) if (s.length > 3) m.set(s.slice(3), s.slice(0, 2));
  return m;
}

const 읽기또는없음 = (파일) => { try { return fs.readFileSync(파일); } catch (_) { return null; } };
// 명령 글: 경로는 슬래시로 바꾸고 띄어쓰기·따옴표가 있을 때만 큰따옴표로 감싼다(bash·PowerShell·cmd가 같은 뜻으로 읽는다)
const 따옴 = (s) => { const t = s.replace(/\\/g, '/'); return /[\s"']/.test(t) ? `"${t}"` : t; };

/** 임시 파일 → 바꾸기 */
function 바꿔쓰기(파일, 버퍼) {
  const 임시 = `${파일}.master맞추기-${process.pid}.tmp`;
  try {
    fs.writeFileSync(임시, 버퍼);
    fs.renameSync(임시, 파일);
  } catch (e) {
    fs.rmSync(임시, { force: true });
    throw e;
  }
}

// ── 경로 합치기 ─────────────────────────────────────────────────────────────

/** 양쪽이 바꾼 경로의 3방향 바탕 후보: 양쪽 이력의 공통 판(있으면 먼저) → 갈라진 곳의 판(없으면 빈 판) */
function 바탕후보(c, p, b, 이력) {
  const 바탕들 = [];
  const 공통 = 공통판(이력.로컬.get(p), 이력.원격.get(p));
  if (공통 && (!b || 공통 !== b.sha)) 바탕들.push({ sha: 공통, 이름: '양쪽 이력의 공통 판' });
  바탕들.push(b ? { sha: b.sha, 이름: '갈라진 곳의 판' } : { sha: c.빈blob, 이름: '빈 판(양쪽이 새로 만듦)' });
  return 바탕들;
}

const 이은보기 = (이음) => 이음.map((x) => ({ 로컬: 보이게(x.원래[0]), 원격: 보이게(x.원래[1]), 결과: 보이게(x.결과) }));

/**
 * 양쪽(로컬·origin)이 바꾼 경로 하나, 또는 --풀이를 준 한쪽만 바꾼 경로.
 * → {보기, 항목({모드, 종류, sha} | null=지움), 바탕?, 이음?, 풀이?} | {보기, 실패: true, 표시?(--겹친곳쓰기가 쓸 판)}
 */
function 경로합치기(c, 저장, p, h, b, o, 이력, 판정) {
  const 못 = (이유, 덧 = {}, 표시 = null) => ({ 보기: { 경로: p, 실패: 이유, ...덧 }, 실패: true, 표시 });
  const 풀이 = c.풀이.get(p);
  if (풀이) {
    if (풀이.종류 === '로컬') return { 보기: { 경로: p, 방법: '--풀이 로컬' }, 항목: h, 풀이: true };
    if (풀이.종류 === 'origin') return { 보기: { 경로: p, 방법: '--풀이 origin' }, 항목: o, 풀이: true };
    const 판들 = [h, o].filter((e) => e && e.종류 === 'blob').map((e) => 블롭(c.git, 저장, e.sha));
    const 남은 = 이진인가(풀이.버퍼) ? null : 남은표시(풀이.버퍼, 판들);
    if (남은 !== null) return 못(`풀이 파일 ${풀이.파일}에 충돌 표시가 남아 있다: ${보이게(남은)}`);
    // 풀이 파일은 편집기 줄끝(메모장 CRLF 등)으로 저장됐을 수 있다 — 줄끝은 로컬(없으면 origin) 판을 따른다
    let 버퍼 = 풀이.버퍼;
    if (판들.length && !이진인가(버퍼) && !이진인가(판들[0])) 버퍼 = 바이트로(줄끝맞추기(글로(판들[0]), 글로(버퍼)).글);
    const sha = 블롭쓰기(c.git, 저장, 버퍼);
    // 규칙이 한 줄로 이은 줄(머리말 등)을 풀이 파일이 그대로 가졌으면 그 이음 기록을 줄 검사에 쓴다 — 없으면 이은 원래 두 줄이
    // 「빠짐」, 이은 줄이 「넘침」으로 보인다(--겹친곳쓰기 판을 고쳐 넘긴 경우가 그렇다)
    let 이음 = [], 바탕 = null;
    const 양쪽판 = h && o && h.종류 === 'blob' && o.종류 === 'blob' && h.sha !== o.sha && (!b || (h.sha !== b.sha && o.sha !== b.sha));
    if (양쪽판 && !판정.글아님.has(p) && !이진인가(버퍼) && !판들.some(이진인가)) {
      const 풀이줄 = new Set(줄나누기(글로(버퍼)).map((l) => l.글));
      let 가장 = null;
      for (const 후보 of 바탕후보(c, p, b, 이력)) {
        const r = 글합치기(c.git, 저장, p, h.sha, 후보.sha, o.sha, 판정.합집합.has(p));
        // 이은 줄을 가졌고, 원래 줄을 다 따로 두지는 않았을 때만(사람이 원래 두 줄을 다 살렸으면 그 이음으로 셀 것이 없다)
        const 맞는 = (r.이음 || []).filter((x) => 풀이줄.has(x.결과) && !x.원래.every((원) => 풀이줄.has(원)));
        if (!가장 || 맞는.length > 가장.맞는.length) 가장 = { 후보, 맞는 };
      }
      if (가장 && 가장.맞는.length) { 이음 = 가장.맞는; 바탕 = 가장.후보.sha; }
    }
    return {
      보기: { 경로: p, 방법: `--풀이 파일 ${풀이.파일}`, ...(이음.length ? { 이은: 이은보기(이음) } : {}) },
      항목: { 모드: (h || o || { 모드: '100644' }).모드, 종류: 'blob', sha }, 풀이: true, 이음, 바탕,
    };
  }
  if (!h && !o) return { 보기: { 경로: p, 방법: '양쪽이 지움' }, 항목: null };
  if (h && o && h.sha === o.sha && h.모드 === o.모드) return { 보기: { 경로: p, 방법: '양쪽이 같은 판' }, 항목: h };
  if (!h || !o) return 못(!h ? '로컬은 지웠고 origin은 고쳤다' : '로컬은 고쳤고 origin은 지웠다');
  if (h.종류 !== 'blob' || o.종류 !== 'blob') return 못('하위 저장소(gitlink)를 양쪽이 다르게 바꿨다');
  let 모드 = h.모드;
  if (h.모드 !== o.모드) {
    if (b && h.모드 === b.모드) 모드 = o.모드;
    else if (!(b && o.모드 === b.모드)) return 못('파일 모드를 양쪽이 다르게 바꿨다');
  }
  if (h.sha === o.sha) return { 보기: { 경로: p, 방법: '모드만 합침' }, 항목: { ...h, 모드 } };
  const 바탕들 = 바탕후보(c, p, b, 이력);
  블롭읽기(c.git, 저장, [h.sha, o.sha, ...바탕들.map((x) => x.sha)]);
  if (판정.글아님.has(p) || [h.sha, o.sha, ...바탕들.map((x) => x.sha)].some((s) => 이진인가(블롭(c.git, 저장, s)))) {
    return 못('바이너리 파일을 양쪽이 다르게 바꿨다');
  }
  let 가장 = null;   // 못 풀었으면 겹친 곳이 가장 적은 바탕
  for (const 바탕 of 바탕들) {
    const r = 글합치기(c.git, 저장, p, h.sha, 바탕.sha, o.sha, 판정.합집합.has(p));
    if (!r.실패) {
      const 이은 = 이은보기(r.이음);
      const 바탕보기 = { 바탕: 바탕.이름, ...(바탕.이름 === '양쪽 이력의 공통 판' ? { 바탕sha: 바탕.sha } : {}) };
      let 버퍼 = r.버퍼, 방법 = r.방법, 정리 = null;
      if (문서꼴.test(p)) {
        // 양쪽이 같은 절·행을 다른 자리에 더하면(다시 쌓아 올린 항목) 규칙 병합이 두 번 넣는다 — 뒤쪽 사본을 지운다
        const 정 = 겹친사본정리(c, 저장, h, 바탕.sha, o, 버퍼, r.이음);
        if (정.실패) return 못(`같은 줄이 두 번 들어갔는데 저절로 못 지운다 — ${정.실패}`, 바탕보기, r.버퍼);
        if (정.버퍼) { 버퍼 = 정.버퍼; 정리 = 정.정리; 방법 = `${방법} · 같은 절·줄 정리`; }
      }
      return {
        보기: { 경로: p, 방법, ...바탕보기, ...(이은.length ? { 이은 } : {}), ...(정리 ? { 정리 } : {}) },
        항목: { 모드, 종류: 'blob', sha: 블롭쓰기(c.git, 저장, 버퍼) }, 바탕: 바탕.sha, 이음: r.이음,
      };
    }
    if (!가장 || (r.덩어리 || []).length < (가장.r.덩어리 || []).length) 가장 = { 바탕, r };
  }
  return 못(가장.r.실패, { 바탕: 가장.바탕.이름, 덩어리: 가장.r.덩어리 || [] }, 가장.r.표시 || null);
}

// ── 작업본 ──────────────────────────────────────────────────────────────────

/** 그 경로의 이력 판들(모든 가지): [{sha, 커밋, 병합이력: 로컬·origin 이력 안인가}] */
function 이력판들(c, p, 이력안) {
  const 커밋들 = c.git.글(['--literal-pathspecs', 'log', '--all', `-n${이력한도}`, '--format=%H', '--', p]).split('\n').filter(Boolean);
  if (!커밋들.length) return [];
  const 출력 = c.git(['cat-file', '--batch-check=%(objectname) %(objecttype)'], { input: `${커밋들.map((x) => `${x}:${p}`).join('\n')}\n` }).toString('utf8').split('\n');
  const 결과 = [];
  커밋들.forEach((x, i) => {
    const m = /^([0-9a-f]+) blob$/.exec(출력[i] || '');
    if (m) 결과.push({ sha: m[1], 커밋: x, 병합이력: 이력안(x) });
  });
  return 결과;
}

function 줄셈전부(글) {
  const m = new Map();
  for (const l of 글.split('\n')) m.set(l, (m.get(l) || 0) + 1);
  return m;
}
function 셈거리(a, b) {
  let d = 0;
  for (const [k, v] of a) d += Math.abs(v - (b.get(k) || 0));
  for (const [k, v] of b) if (!a.has(k)) d += v;
  return d;
}

/** 임시 파일로 git merge-file(작업본·바탕·새 판, 모두 LF) → {글} | {충돌} */
function 파일3방향(git, 작업본글, 바탕글, 새글) {
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-master-align-'));
  try {
    const [w, b, n] = ['w', 'b', 'n'].map((x) => path.join(폴더, x));
    fs.writeFileSync(w, 바이트로(작업본글));
    fs.writeFileSync(b, 바이트로(바탕글));
    fs.writeFileSync(n, 바이트로(새글));
    const r = git.돌리기(['merge-file', '-p', w, b, n], { 허용: null });
    if (r.status === 0) return { 글: 글로(r.stdout) };
    return { 충돌: r.status };
  } finally {
    fs.rmSync(폴더, { recursive: true, force: true });
  }
}

/**
 * 로컬 HEAD 판과 다른 작업본 파일(남의 미커밋 수정이거나 같은 이름의 미추적 파일)을 새 판 t와 어떻게 맞출지 정한다.
 * 작업본과 가장 가까운 이력 판을 바탕으로 3방향한다. 다른 가지 판에 가깝거나 부딪히면 손대지 않는다.
 */
function 작업본대조(c, 저장, p, wb, h, t, 판정) {
  const 덧 = { W바이트: 해시(wb) };
  블롭읽기(c.git, 저장, [t.sha, ...(h ? [h.sha] : [])]);
  const tb = 블롭(c.git, 저장, t.sha), hb = h ? 블롭(c.git, 저장, h.sha) : null;
  if (판정.글아님.has(p) || 이진인가(wb) || 이진인가(tb) || (hb && 이진인가(hb))) {
    return { 할일: '손대지 않음', 까닭: h ? '바이너리 파일에 남의 수정이 있다' : '같은 이름의 미추적 바이너리 파일이 있다', ...덧 };
  }
  const W글 = 글로(wb), Wn = LF로(W글);
  const 후보 = new Map();
  if (h) 후보.set(h.sha, { 이름: '로컬 HEAD 판', 병합이력: true, 순: 0 });
  후보.set(t.sha, { 이름: '새 판', 병합이력: true, 순: 1 });
  for (const x of 이력판들(c, p, 판정.이력안)) {
    if (!후보.has(x.sha)) 후보.set(x.sha, { 이름: `${x.병합이력 ? '이력' : '다른 가지'}의 판(${짧게(x.커밋)})`, 병합이력: x.병합이력, 순: x.병합이력 ? 2 : 3 });
  }
  블롭읽기(c.git, 저장, [...후보.keys()]);
  const 판글 = (sha) => LF로(글로(블롭(c.git, 저장, sha)));
  for (const [sha, x] of 후보) {
    if (이진인가(블롭(c.git, 저장, sha)) || 판글(sha) !== Wn) continue;
    if (sha === t.sha) return { 할일: '그대로', 까닭: '새 판과 줄끝만 다르다', ...덧 };
    if (h && sha === h.sha) break;   // 로컬 HEAD 판과 줄끝만 다르다 — 아래 3방향(결과 = 새 판 내용, 줄끝은 작업본)
    if (x.병합이력) return { 할일: '새 판', 까닭: `작업본이 ${x.이름} 그대로다(고유 내용 없음)`, ...덧 };
    return { 할일: '손대지 않음', 까닭: `작업본이 ${x.이름} 그대로다 — 그 가지의 내용일 수 있다`, ...덧 };
  }
  // 줄 셈 거리로 가까운 다섯과 로컬 HEAD·새 판을 추려 실제 줄 차이(차례까지 본다)로 고른다. 같으면 로컬 HEAD → 새 판 → 이력 판
  const W셈 = 줄셈전부(Wn), W줄 = Wn.split('\n');
  const 추림 = [...후보].filter(([sha]) => !이진인가(블롭(c.git, 저장, sha)))
    .map(([sha, x]) => ({ sha, ...x, 셈: 셈거리(W셈, 줄셈전부(판글(sha))) }))
    .sort((p, q) => p.셈 - q.셈 || p.순 - q.순)
    .filter((x, i) => i < 5 || x.순 <= 1);
  let 가까운 = null;
  for (const x of 추림) {
    const d = 줄차이(W줄, 판글(x.sha).split('\n')).filter((op) => op[0] !== '=').length;
    if (!가까운 || d < 가까운.거리 || (d === 가까운.거리 && x.순 < 가까운.순)) 가까운 = { ...x, 거리: d };
  }
  if (!가까운.병합이력) return { 할일: '손대지 않음', 까닭: `작업본이 ${가까운.이름}에 가장 가깝다 — 그 가지의 내용일 수 있다`, ...덧 };
  if (가까운.거리 > Math.max(10, Wn.split('\n').length / 2)) return { 할일: '손대지 않음', 까닭: '이력의 어느 판과도 많이 다르다', ...덧 };
  if (가까운.sha === t.sha) return { 할일: '그대로', 까닭: '새 판에 남의 수정을 더한 판이다', ...덧 };
  const 바탕글 = 판글(가까운.sha), 새글 = LF로(글로(tb));
  const m = 파일3방향(c.git, Wn, 바탕글, 새글);
  if (m.충돌) return { 할일: '손대지 않음', 까닭: `3방향이 부딪힌다(바탕: ${가까운.이름}) — 커밋 전에 새 판과 다시 합친다`, ...덧 };
  const 검사 = 줄검사(...[바탕글, Wn, 새글, m.글].map((x) => 셈(줄나누기(x))));
  if (문제수(검사)) {
    const 걸린 = Object.entries(검사).filter(([, v]) => v.length).map(([k, v]) => `${문제이름[k]} ${v.length}`);
    return { 할일: '손대지 않음', 까닭: `3방향 결과가 줄 검사에 걸렸다(${걸린.join(' · ')}, 바탕: ${가까운.이름})`, ...덧 };
  }
  const 버퍼 = 바이트로(줄끝맞추기(W글, m.글).글);
  if (버퍼.equals(wb)) return { 할일: '그대로', 까닭: '남의 수정 위에 새 판 변경이 이미 들어 있다', ...덧 };
  return { 할일: '3방향', 까닭: `바탕: ${가까운.이름} · 줄끝은 작업본`, 결과바이트: 해시(버퍼), _버퍼: 버퍼, ...덧 };
}

/**
 * 로컬 HEAD 트리와 계획 트리가 다른 경로마다 작업본을 어떻게 할지.
 * 작업본이 로컬 HEAD 판 그대로인지는 git status로 본다(hash-object는 CRLF가 든 blob의 「줄끝 그대로」 규칙을 따르지 않는다).
 */
function 작업본계획(c, 저장, Ht, Tt, 경로들, 판정, 상태맵) {
  const 상태 = new Map();
  for (const p of 경로들) {
    let st = null;
    try { st = fs.lstatSync(path.join(c.저장소, p)); } catch (_) {}
    상태.set(p, !st ? null : st.isFile() ? '파일' : st.isDirectory() ? '폴더' : '링크');
  }
  const 파일들 = 경로들.filter((p) => 상태.get(p) === '파일' && !p.includes('\n'));
  const W = new Map();
  if (파일들.length) {
    const 출력 = c.git(['hash-object', '--stdin-paths'], { input: `${파일들.join('\n')}\n` }).toString('utf8').trim().split('\n');
    파일들.forEach((p, i) => W.set(p, 출력[i]));
  }
  const 결과 = [], 쓸 = new Map();
  for (const p of 경로들) {
    const h = Ht.get(p) || null, t = Tt.get(p) || null, st = 상태.get(p), w = W.get(p) || null;
    const 깨끗 = st === '파일' && h && (상태맵 ? !상태맵.has(p) : w === h.sha);   // 작업본 = 공용 인덱스 = 로컬 HEAD 판
    const 칸 = { 경로: p, W: w, T: t ? t.sha : null };
    const 정 = (할일, 까닭, 덧 = {}) => 결과.push({ ...칸, 할일, ...(까닭 ? { 까닭 } : {}), ...덧 });
    if ([h, t].some((e) => e && (e.종류 !== 'blob' || e.모드 === '120000'))) { 정('손대지 않음', '하위 저장소·링크'); continue; }
    if (!t) {
      if (!st) 정('그대로', '이미 없다');
      else if (깨끗) 정('지움', null, { W바이트: 해시(fs.readFileSync(path.join(c.저장소, p))) });
      else 정('미추적으로 남김', st === '파일' ? '남의 수정이 있다' : '같은 이름의 폴더가 있다');
      continue;
    }
    if (st === '파일' && w === t.sha) { 정('그대로', '이미 새 판'); continue; }
    if (!st) {
      if (h) 정('손대지 않음', '작업본에서 지운 추적 파일 — 지운 채 둔다');
      else 정('새 판', c.풀이.has(p) ? '--풀이로 들인 파일(로컬 HEAD에 없다)' : 'origin이 더한 파일', { W바이트: null });
      continue;
    }
    if (st !== '파일') { 정('막힘', `같은 이름의 ${st}가 있어 새 판을 쓸 수 없다`); continue; }
    const wb = fs.readFileSync(path.join(c.저장소, p));
    if (깨끗) { 정('새 판', null, { W바이트: 해시(wb) }); continue; }
    const r = 작업본대조(c, 저장, p, wb, h, t, 판정);
    const { _버퍼, ...보일 } = r;
    if (_버퍼) 쓸.set(p, _버퍼);
    결과.push({ ...칸, ...보일 });
  }
  return { 작업본: 결과, 쓸 };
}

/** 계획 경로마다 공용 인덱스가 로컬 HEAD 그대로인가. 아니면 [{경로, 이유}] */
function 스테이징보기(git, Ht, 경로들) {
  const 항목 = 공용인덱스항목(git, 경로들);
  const 걸림 = [];
  for (const p of 경로들) {
    const 항 = 항목.get(p) || [];
    if (항.some((x) => x.단계 !== '0')) { 걸림.push({ 경로: p, 이유: '병합이 끝나지 않은 항목이 있다' }); continue; }
    const e = 항[0] || null, h = Ht.get(p) || null;
    if (!h && !e) continue;
    if (h && e && e.sha === h.sha && e.모드 === h.모드) continue;
    걸림.push({ 경로: p, 이유: !e ? '지움이 올라가 있다' : !h ? '새 파일이 올라가 있다' : '로컬 HEAD와 다른 판이 올라가 있다' });
  }
  return 걸림;
}

function 지문만들기(r) {
  const 칸 = [r.로컬, r.원격머리, r.바탕, r.방법, r.병합트리, [...r.허용].sort(),
    r.작업본.map((x) => [x.경로, x.할일, x.W, x.W바이트 === undefined ? null : x.W바이트, x.결과바이트 || null])];
  return crypto.createHash('sha256').update(JSON.stringify(칸)).digest('hex').slice(0, 10);
}

// ── 계획 ────────────────────────────────────────────────────────────────────

async function 계획세우기(c) {
  const { git } = c;
  for (const f of 진행중) if (fs.existsSync(path.join(c.gitdir, f))) throw new 멈춤(`진행 중인 git 작업이 있다(${f}) — 끝난 뒤 다시 한다`);
  const 가지ref = `refs/heads/${c.가지}`;
  let 머리ref = '';
  try { 머리ref = git.글(['symbolic-ref', '-q', 'HEAD']); } catch (_) {}
  if (머리ref !== 가지ref) {
    const 곳 = 체크아웃된곳(git, 가지ref);
    throw new 멈춤(`이 작업본의 HEAD가 ${c.가지}가 아니다(${머리ref ? 머리ref.replace(/^refs\/heads\//, '') : '분리된 HEAD'}) — ${c.가지}를 체크아웃한 작업본에서 돌린다${곳 ? `: ${곳}` : ''}`);
  }
  if (git(['ls-files', '-u', '-z']).length) throw new 멈춤('공용 인덱스에 병합이 끝나지 않은 항목이 있다 — 그 병합을 끝낸 뒤 다시 한다');
  if (c.받기) {
    const f = git.돌리기(['fetch', '-q', c.원격, `+refs/heads/${c.가지}:${c.추적}`], { 허용: null });
    if (f.status !== 0) throw new 멈춤(`fetch 실패 — ${String(f.stderr).trim()} (가진 ${c.추적}로 보려면 --받지않음)`);
  }
  const H = git.글(['rev-parse', '--verify', `${가지ref}^{commit}`]);
  let O;
  try { O = git.글(['rev-parse', '--verify', `${c.추적}^{commit}`]); } catch (_) { throw new 멈춤(`${c.추적}가 없다 — 원격 이름(--원격)을 확인한다`); }
  const 요약 = { 가지: c.가지, 원격: `${c.원격}/${c.가지}`, 로컬: H, 원격머리: O };
  if (조상인가(git, O, H)) return { 결과: '맞음', 이유: `${c.가지}가 이미 ${요약.원격}를 품는다 — 할 것 없음`, ...요약 };
  const 빨리 = 조상인가(git, H, O);
  const B = 빨리 ? H : git.글(['merge-base', H, O]);
  Object.assign(요약, {
    바탕: B,
    로컬만: Number(git.글(['rev-list', '--count', `${O}..${H}`])),
    원격만: Number(git.글(['rev-list', '--count', `${H}..${O}`])),
  });
  const 쌍없는 = 빨리 ? [] : 쌍없는원격커밋(git, `${O}..${H}`, `${H}..${O}`);
  if (!빨리) 요약.다시쌓은 = 요약.원격만 - 쌍없는.length;
  const 저장 = new Map();
  c.빈blob = 블롭쓰기(git, 저장, Buffer.alloc(0));
  const Ht = 트리읽기(git, H), Ot = 트리읽기(git, O), Bt = 빨리 ? Ht : 트리읽기(git, B);
  const 로컬바뀜 = 바뀐경로(Bt, Ht), 원격바뀜 = 바뀐경로(Bt, Ot);
  const 양쪽 = [...로컬바뀜].filter((p) => 원격바뀜.has(p)).sort();
  let 병합이력 = null;
  const 판정 = {
    글아님: 글아닌경로(git, [...new Set([...로컬바뀜, ...원격바뀜])]),
    합집합: 합집합경로(git, 양쪽),
    이력안: (커밋) => {
      if (!병합이력) 병합이력 = new Set(git.글(['rev-list', H, O]).split('\n'));
      return 병합이력.has(커밋);
    },
  };
  const 주의 = [];
  const 풀이밖 = [...c.풀이.keys()].filter((p) => !로컬바뀜.has(p) && !원격바뀜.has(p));
  let 방법, T, 빠른길걸림 = [];
  const 합침 = [], 바탕판 = new Map(), 이음판 = new Map(), 풀이경로 = new Set();
  if (빨리) {
    방법 = '빨리감기';
    T = git.글(['rev-parse', `${O}^{tree}`]);
  } else {
    // 빠른 길은 origin에만 있는 커밋이 다시 쌓아 올린 커밋뿐이고(같은 작성자·제목의 로컬 커밋이 있다) 그 변경이 로컬에 다 있을 때만
    빠른길걸림 = 쌍없는.length
      ? [{ 경로: '(커밋)', 이유: `origin에만 있는 커밋 가운데 같은 작성자·제목의 로컬 커밋이 없는 것 ${쌍없는.length}개(${쌍없는.slice(0, 3).map((x) => `${짧게(x.커밋)} ${x.제목}`).join(' · ')}${쌍없는.length > 3 ? ' …' : ''})` }]
      : 빠른길검사(git, 저장, Ht, Ot, Bt, 원격바뀜, 판정.글아님);
    if (!빠른길걸림.length) {
      방법 = '빠른 길';
      T = git.글(['rev-parse', `${H}^{tree}`]);
    } else {
      방법 = '병합';
      if (풀이밖.length) throw new 멈춤(`--풀이를 준 경로를 로컬도 origin도 바꾸지 않았다: ${풀이밖.join(', ')}`);
      const 이력 = { 로컬: 이력blob(git, `${B}..${H}`, 양쪽), 원격: 이력blob(git, `${B}..${O}`, 양쪽) };
      const 고칠 = new Map(), 겹친판 = new Map();
      for (const p of 원격바뀜) if (!로컬바뀜.has(p)) 고칠.set(p, Ot.get(p) || null);
      for (const p of 양쪽) {
        const r = 경로합치기(c, 저장, p, Ht.get(p) || null, Bt.get(p) || null, Ot.get(p) || null, 이력, 판정);
        합침.push(r.보기);
        if (r.실패) { if (r.표시) 겹친판.set(p, r.표시); continue; }
        고칠.set(p, r.항목);
        if (r.바탕) 바탕판.set(p, r.바탕);
        if (r.이음 && r.이음.length) 이음판.set(p, r.이음);
        if (r.풀이) 풀이경로.add(p);
      }
      // 한쪽만 바꾼 경로도 --풀이로 덮을 수 있다(예: 일부러 뺀 쪽의 짝 시험). 줄 검사는 양쪽이 바꾼 경로처럼 한다
      for (const p of [...c.풀이.keys()].filter((x) => !양쪽.includes(x)).sort()) {
        const r = 경로합치기(c, 저장, p, Ht.get(p) || null, Bt.get(p) || null, Ot.get(p) || null, 이력, 판정);
        합침.push({ ...r.보기, 한쪽만: 로컬바뀜.has(p) ? '로컬' : 'origin' });
        if (r.실패) { if (r.표시) 겹친판.set(p, r.표시); continue; }
        고칠.set(p, r.항목);
        if (r.바탕) 바탕판.set(p, r.바탕);
        풀이경로.add(p);
      }
      const 못푼 = 합침.filter((x) => x.실패);
      if (못푼.length) {
        let 겹친곳 = null;
        if (c.겹친곳폴더) {
          겹친곳 = { 폴더: c.겹친곳폴더, 파일: [], 못씀: [] };
          for (const x of 못푼) {
            const 판 = 겹친판.get(x.경로);
            if (!판) { 겹친곳.못씀.push(x.경로); continue; }
            const 파일 = path.join(c.겹친곳폴더, ...x.경로.split('/'));
            fs.mkdirSync(path.dirname(파일), { recursive: true });
            fs.writeFileSync(파일, 판);
            겹친곳.파일.push(x.경로);
          }
        }
        return {
          결과: '멈춤', ...요약, 방법, 합침, 빠른길걸림: 빠른길걸림.slice(0, 5), ...(겹친곳 ? { 겹친곳 } : {}),
          이유: `규칙으로 못 푼 경로 ${못푼.length}개(${못푼.map((x) => x.경로).join(', ')}) — 겹친 곳을 보고 --풀이 <경로>=로컬|origin|<합친 파일>로 정한다${겹친곳
            ? `. 겹친 곳을 ${겹친곳.파일.length}개 파일로 썼다(${겹친곳.폴더}) — 충돌 표시를 지워 고친 뒤 --풀이폴더 ${따옴(겹친곳.폴더)}로 다시 미리 본다`
            : '(겹친 곳을 고칠 파일로 받으려면 --겹친곳쓰기 <폴더>)'}`,
        };
      }
      T = 트리만들기(git, H, 고칠, '0'.repeat(H.length));
      // update-index --index-info는 파일↔폴더가 부딪히면 앞서 넣은 경로를 말없이 지운다 — 만든 트리를 「로컬 트리 + 고칠 것」과 대조한다
      const 기대 = new Map(Ht);
      for (const [p, e] of 고칠) { if (e) 기대.set(p, e); else 기대.delete(p); }
      const 만든 = 트리읽기(git, T);
      const 어긋남 = [...new Set([...기대.keys(), ...만든.keys()])].filter((p) => {
        const a = 기대.get(p), b = 만든.get(p);
        return !a || !b || a.sha !== b.sha || a.모드 !== b.모드;
      }).sort();
      if (어긋남.length) {
        return {
          결과: '멈춤', ...요약, 방법, 합침, 빠른길걸림: 빠른길걸림.slice(0, 5),
          이유: `같은 이름의 파일과 폴더가 부딪혀 병합 트리에서 빠지거나 생기는 경로가 있다(${어긋남.slice(0, 10).join(', ')}${어긋남.length > 10 ? ' …' : ''}) — 그 경로의 --풀이를 다시 정하거나 손으로 맞춘다`,
        };
      }
    }
  }
  if (방법 !== '병합' && c.풀이.size) 주의.push(`--풀이는 병합에서만 쓴다 — ${방법}이라 쓰지 않았다`);

  // 지워지는 줄과 줄 검사
  const Tt = 트리읽기(git, T);
  const 바뀐 = [...바뀐경로(Ht, Tt)].sort();
  const 볼 = [...new Set([...바뀐, ...(방법 === '병합' ? [...양쪽, ...풀이경로] : [])])].sort();
  const 항 = (트리, p) => 트리.get(p) || null;
  블롭읽기(git, 저장, 볼.flatMap((p) => [Ht, Ot, Bt, Tt].map((x) => 항(x, p))).filter((e) => e && e.종류 === 'blob').map((e) => e.sha)
    .concat([...바탕판.values()]));
  const 지움 = [], 줄문제 = [];
  for (const p of 볼) {
    const h = 항(Ht, p), o = 항(Ot, p), t = 항(Tt, p);
    const bsha = 바탕판.get(p) || (항(Bt, p) || {}).sha || null;
    const 판 = [h && h.sha, o && o.sha, t && t.sha, bsha];
    const 블 = (s) => (s ? 블롭(git, 저장, s) : Buffer.alloc(0));
    const 바이너리 = 판정.글아님.has(p) || [h, o, t].some((e) => e && e.종류 !== 'blob') || 판.some((s) => s && 이진인가(블(s)));
    const 양쪽인가 = 방법 === '병합' && (양쪽.includes(p) || 풀이경로.has(p));
    if (바이너리) {
      const hs = h && h.sha, os_ = o && o.sha, ts = t && t.sha;
      if (hs && hs !== ts) 지움.push({ 경로: p, 바이너리: true, 수: 1, 원격: !양쪽인가 ? 1 : 0, 이은: 0, 로컬: 양쪽인가 && hs !== bsha ? 1 : 0 });
      if (양쪽인가) {
        const 검사 = { 로컬빠짐: [], 원격빠짐: [], 남음: [], 겹침: [], 넘침: [] };
        if (hs !== bsha && ts !== hs) 검사.로컬빠짐.push({ 글: '(바이너리 로컬 판)', 수: 1 });
        if (os_ !== bsha && ts !== os_) 검사.원격빠짐.push({ 글: '(바이너리 origin 판)', 수: 1 });
        if (문제수(검사)) 줄문제.push({ 경로: p, ...검사, 허용: c.허용.has(p) });
      }
      continue;
    }
    const [hc, oc, tc, bc] = 판.map((s) => 버퍼셈(블(s)));
    const 이음 = 이음판.get(p) || [];
    const 줄 = 지움보기(bc, hc, oc, tc, 이음);
    if (줄.length) {
      const 합 = (k) => 줄.reduce((n, x) => n + x[k], 0);
      지움.push({ 경로: p, 수: 합('수'), 원격: 합('원격'), 이은: 합('이은'), 로컬: 합('로컬'), 줄: 줄.map((x) => ({ ...x, 글: 보이게(x.글) })) });
    }
    if (양쪽인가) {
      const 검사 = 줄검사(bc, hc, oc, tc, 이음);
      if (문제수(검사)) {
        const 보 = (xs) => xs.map((x) => ({ 글: 보이게(x.글), 수: x.수 }));
        줄문제.push({ 경로: p, ...Object.fromEntries(Object.entries(검사).map(([k, v]) => [k, 보(v)])), 허용: c.허용.has(p) });
      }
    }
  }

  // 작업본과 공용 인덱스
  const { 작업본, 쓸 } = 작업본계획(c, 저장, Ht, Tt, 바뀐, 판정, 바뀐.length ? 상태읽기(git) : null);
  const 스테이징 = 스테이징보기(git, Ht, 바뀐);
  const 결과 = {
    결과: '미리 보기', ...요약, 방법, 병합트리: T,
    ...(방법 === '병합' ? { 빠른길걸림: 빠른길걸림.slice(0, 5), 합침 } : {}),
    지움, 줄문제, 작업본, 스테이징, 허용: [...c.허용].sort(), 옵션글: c.옵션글,
    ...(주의.length ? { 주의: 주의.join(' / ') } : {}),
  };
  결과.지문 = 지문만들기({ ...결과, 허용: c.허용 });
  Object.defineProperty(결과, '쓸', { value: 쓸, enumerable: false });
  // --되풀이가 대조할 「사람이 정한 경로」(풀이·허용): 로컬·origin 판과 계획 트리에 들어갈 판(풀이 종류·풀이 파일 내용이 바뀌면 이것이 바뀐다)
  const 민감 = {};
  const 판 = (트리, p) => (트리.get(p) || {}).sha || null;
  for (const p of [...new Set([...c.풀이.keys(), ...c.허용])].sort()) 민감[p] = { 로컬: 판(Ht, p), 원격: 판(Ot, p), 계획: 판(Tt, p) };
  Object.defineProperty(결과, '민감', { value: 민감, enumerable: false });
  const 까닭 = [];
  const 막힌줄 = 줄문제.filter((x) => !x.허용);
  if (막힌줄.length && c.겹친곳폴더) {
    // 줄 검사에 걸린 경로도 합친 판을 고칠 파일로 쓴다(충돌 표시 없음 — 줄 문제를 보고 고쳐 --풀이폴더로 넘긴다)
    const 겹친곳 = { 폴더: c.겹친곳폴더, 파일: [], 못씀: [] };
    for (const x of 막힌줄) {
      const t = Tt.get(x.경로);
      const 판 = t && t.종류 === 'blob' && !판정.글아님.has(x.경로) ? 블롭(git, 저장, t.sha) : null;
      if (!판 || 이진인가(판)) { 겹친곳.못씀.push(x.경로); continue; }
      const 파일 = path.join(c.겹친곳폴더, ...x.경로.split('/'));
      fs.mkdirSync(path.dirname(파일), { recursive: true });
      fs.writeFileSync(파일, 판);
      겹친곳.파일.push(x.경로);
    }
    결과.겹친곳 = 겹친곳;
  }
  if (막힌줄.length) {
    까닭.push(`줄 검사에 걸린 경로 ${막힌줄.length}개(${막힌줄.map((x) => x.경로).join(', ')}) — 보고 받아들이면 --허용 <경로>, 아니면 --풀이${결과.겹친곳
      ? `. 합친 판을 ${결과.겹친곳.파일.length}개 파일로 썼다(${결과.겹친곳.폴더}) — 고친 뒤 --풀이폴더 ${따옴(결과.겹친곳.폴더)}로 다시 미리 본다`
      : '(합친 판을 고칠 파일로 받으려면 --겹친곳쓰기 <폴더>)'}`);
  }
  const 막힌작업본 = 작업본.filter((x) => x.할일 === '막힘');
  if (막힌작업본.length) 까닭.push(`작업본에 새 판을 쓸 수 없는 경로 ${막힌작업본.length}개(${막힌작업본.map((x) => x.경로).join(', ')})`);
  if (스테이징.length) 까닭.push(`공용 인덱스에 로컬 HEAD와 다른 스테이징이 있는 경로 ${스테이징.length}개 — 남이 올려 둔 것일 수 있어 손대지 않는다`);
  if (까닭.length) { 결과.결과 = '멈춤'; 결과.이유 = 까닭.join(' / '); }
  return 결과;
}

/** origin에만 있는 변경(바탕 → origin)이 로컬에 이미 다 있나. 걸린 경로 목록(비면 빠른 길). */
function 빠른길검사(git, 저장, Ht, Ot, Bt, 원격바뀜, 글아님) {
  const 걸림 = [];
  const 경로들 = [...원격바뀜].sort();
  블롭읽기(git, 저장, 경로들.flatMap((p) => [Ht.get(p), Ot.get(p), Bt.get(p)]).filter((e) => e && e.종류 === 'blob').map((e) => e.sha));
  for (const p of 경로들) {
    const h = Ht.get(p) || null, o = Ot.get(p) || null, b = Bt.get(p) || null;
    if (!h && !o) continue;
    if (h && o && h.sha === o.sha && h.모드 === o.모드) continue;
    if (!h || !o) { 걸림.push({ 경로: p, 이유: !h ? 'origin의 파일이 로컬에 없다' : 'origin이 지운 파일이 로컬에 있다' }); continue; }
    if (h.모드 !== o.모드 && (!b || b.모드 !== o.모드)) { 걸림.push({ 경로: p, 이유: 'origin이 바꾼 파일 모드가 로컬과 다르다' }); continue; }
    if ([h, o, b].some((e) => e && e.종류 !== 'blob')) { 걸림.push({ 경로: p, 이유: '하위 저장소(gitlink)가 origin 판과 다르다' }); continue; }
    const 블 = (e) => (e ? 블롭(git, 저장, e.sha) : Buffer.alloc(0));
    const hb = 블(h), ob = 블(o), bb = 블(b);
    if (h.sha === o.sha) continue;
    if (글아님.has(p) || [hb, ob, bb].some(이진인가)) { 걸림.push({ 경로: p, 이유: '바이너리 파일이 origin 판과 다르다' }); continue; }
    const hc = 버퍼셈(hb), oc = 버퍼셈(ob), bc = 버퍼셈(bb);
    for (const l of new Set([...oc.keys(), ...bc.keys()])) {
      const dor = (oc.get(l) || 0) - (bc.get(l) || 0), dh = (hc.get(l) || 0) - (bc.get(l) || 0);
      if (dor > 0 && dh < dor) { 걸림.push({ 경로: p, 이유: `origin이 더한 줄이 로컬에 없다: ${보이게(l).slice(0, 80)}` }); break; }
      if (dor < 0 && dh > dor) { 걸림.push({ 경로: p, 이유: `origin이 지운 줄이 로컬에 남아 있다: ${보이게(l).slice(0, 80)}` }); break; }
    }
  }
  return 걸림;
}

// ── 실행 ────────────────────────────────────────────────────────────────────

function 시각글() {
  const d = new Date(), n = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}${n(d.getMonth() + 1)}${n(d.getDate())}-${n(d.getHours())}${n(d.getMinutes())}${n(d.getSeconds())}`;
}

function 기본메시지(r) {
  const 수 = (...일) => r.작업본.filter((x) => 일.includes(x.할일)).length;
  const 줄 = [`Merge ${r.원격} into local ${r.가지}`, ''];
  줄.push(`tools/master맞추기.js(${r.방법}) — 로컬에만 있는 커밋 ${r.로컬만}개(남의 미푸시 포함)는 그대로 두고 origin에만 있는 커밋 ${r.원격만}개를 합쳤다.`);
  if (r.방법 === '빠른 길') 줄.push('origin에만 있는 변경이 로컬에 이미 다 있어 트리는 로컬 그대로다.');
  else 줄.push(`작업본: 새 판 ${수('새 판')} · 3방향 ${수('3방향')} · 지움 ${수('지움')} · 손대지 않음 ${수('손대지 않음', '미추적으로 남김')} · 그대로 ${수('그대로')}`);
  return `${줄.join('\n')}\n`;
}

async function 실행하기(c, 계획) {
  const { git } = c;
  const 가지ref = `refs/heads/${c.가지}`;
  const 바뀐 = 계획.작업본.map((x) => x.경로);
  const 할 = 계획.작업본.filter((x) => 쓰는일.has(x.할일));
  const 잠금 = 잠금기다리기(c, c.한도.시작);
  if (!잠금.풀림) return { ...계획, 결과: '멈춤', 이유: `공용 인덱스 잠금이 풀리지 않아 아무것도 바꾸지 않았다 — ${잠금.이유}` };
  const 기록 = path.join(c.gitdir, 'master맞추기', `${시각글()}-${계획.지문}`);
  fs.mkdirSync(path.join(기록, '백업'), { recursive: true });
  fs.writeFileSync(path.join(기록, '계획.json'), `${JSON.stringify(계획, null, 1)}\n`);
  const 전상태 = 상태읽기(git);
  const 쓴 = [];
  // 되돌리기: 도구가 쓴 그대로인 파일만 원래 바이트로. 그사이 남이 고친 파일은 덮지 않고 알린다(원래 판은 백업에 있다)
  const 되돌리기 = () => {
    const 못 = [];
    for (const x of 쓴.slice().reverse()) {
      const 파일 = path.join(c.저장소, x.경로);
      try {
        if (해시(읽기또는없음(파일)) !== 해시(x.후)) { 못.push(`${x.경로}(그사이 남이 고쳐 되돌리지 않았다)`); continue; }
        if (x.전 === null) fs.rmSync(파일, { force: true });
        else { fs.mkdirSync(path.dirname(파일), { recursive: true }); 바꿔쓰기(파일, x.전); }
      } catch (e) {
        못.push(`${x.경로}(${e.message})`);
      }
    }
    return 못;
  };
  let 새;
  try {
    for (const x of 할) {
      const 파일 = path.join(c.저장소, x.경로);
      const 지금 = 읽기또는없음(파일);
      if (해시(지금) !== x.W바이트) throw new 멈춤(`계획 뒤 작업본이 바뀌었다: ${x.경로} — 다시 미리 본다`, { 다시: true });
      if (지금) {
        const 백 = path.join(기록, '백업', x.경로);
        fs.mkdirSync(path.dirname(백), { recursive: true });
        fs.writeFileSync(백, 지금);
      }
      const 내용 = x.할일 === '지움' ? null
        : x.할일 === '3방향' ? 계획.쓸.get(x.경로)
          : git(['cat-file', '--filters', `--path=${x.경로}`, x.T]);
      if (c.고리.쓰기직전) c.고리.쓰기직전(x.경로);
      if (해시(읽기또는없음(파일)) !== x.W바이트) throw new 멈춤(`쓰기 직전에 작업본이 바뀌었다: ${x.경로} — 다시 미리 본다`, { 다시: true });
      if (내용 === null) fs.rmSync(파일);
      else { fs.mkdirSync(path.dirname(파일), { recursive: true }); 바꿔쓰기(파일, 내용); }
      쓴.push({ 경로: x.경로, 전: 지금, 후: 내용 });
    }
    새 = 계획.방법 === '빨리감기' ? 계획.원격머리
      : git.글(['commit-tree', 계획.병합트리, '-p', 계획.로컬, '-p', 계획.원격머리, '-F', '-'], { input: Buffer.from(c.메시지 || 기본메시지(계획), 'utf8') });
    if (c.고리.CAS직전) c.고리.CAS직전();
    if (git.돌리기(['update-ref', '-m', `master맞추기: ${계획.원격} 합침(${계획.방법})`, 가지ref, 새, 계획.로컬], { 허용: null }).status !== 0) {
      throw new 멈춤(`${c.가지}가 그사이 움직였다(CAS 실패) — 다시 미리 본다`, { 다시: true });
    }
  } catch (e) {
    const 못 = 되돌리기();
    const 덧 = 못.length ? `(못 되돌린 파일: ${못.join(', ')} — 백업 ${기록})` : '';
    // 다시 해도 되는 멈춤: 도구가 쓴 것을 다 되돌렸을 때만(그사이 남이 고쳐 못 되돌린 파일이 있으면 사람이 본다)
    if (e instanceof 멈춤) return { ...계획, 결과: '멈춤', 이유: `${e.이유} — 작업본을 되돌렸다${덧}`, 기록, ...(e.덧.다시 && !못.length ? { 다시: true } : {}) };
    return { ...계획, 결과: '실패', 이유: `${e.message} — 작업본을 되돌렸다${덧}`, 기록 };
  }
  if (c.고리.CAS직후) c.고리.CAS직후();
  if (계획.방법 !== '빠른 길' && 바뀐.length) {
    const 맞춤 = 공용인덱스맞추기(c, 바뀐);
    if (!맞춤.됨) {
      const 되돌림 = git.돌리기(['update-ref', '-m', 'master맞추기: 공용 인덱스를 못 맞춰 되돌림', 가지ref, 계획.로컬, 새], { 허용: null }).status === 0;
      const 못 = 되돌림 ? 되돌리기() : [];
      return {
        ...계획, 결과: '실패', 커밋: 새, 기록, 되돌림,
        이유: `공용 인덱스를 새 ${c.가지}에 맞추지 못했다(${맞춤.이유}) — ${되돌림
          ? `${c.가지}와 작업본을 되돌렸다${못.length ? `(못 되돌린 파일: ${못.join(', ')} — 백업 ${기록})` : ''}. 잠금이 풀린 뒤 다시 한다`
          : `${c.가지}를 되돌리지 못했다(그사이 움직임). 곧바로 git reset -q -- <경로>로 공용 인덱스의 그 경로를 맞춘다: ${바뀐.join(' ')}`}`,
      };
    }
  }
  // 여기부터는 반영이 끝난 뒤다. 대조에서 어긋난 것은 주의로 알린다.
  const 확인 = {};
  const 주의 = 계획.주의 ? [계획.주의] : [];
  try {
    const 지금머리 = git.글(['rev-parse', 가지ref]);
    확인.가지 = 지금머리 === 새;
    확인.origin품음 = 조상인가(git, 계획.원격머리, 지금머리);
    확인.작업본틀림 = 쓴.filter((x) => 해시(읽기또는없음(path.join(c.저장소, x.경로))) !== 해시(x.후)).map((x) => x.경로);
    const 내경로 = new Set(바뀐);
    확인.남은스테이징 = git(['diff', '--cached', '--name-only', '--no-renames', '-z']).toString('utf8').split('\0').filter((p) => 내경로.has(p));
    const 후상태 = 상태읽기(git);
    if (전상태 && 후상태) {
      const 다른 = [];
      for (const p of new Set([...전상태.keys(), ...후상태.keys()])) {
        if (내경로.has(p)) continue;
        if (전상태.get(p) !== 후상태.get(p)) 다른.push({ 경로: p, 전: 전상태.get(p) || null, 후: 후상태.get(p) || null });
      }
      확인.다른경로바뀜 = 다른;
      확인.상태수 = { 전: 전상태.size, 후: 후상태.size };
    }
    if (!확인.가지) 주의.push(`${c.가지}가 반영 직후 또 움직였다`);
    if (확인.작업본틀림.length) 주의.push(`쓴 내용과 다른 작업본 파일: ${확인.작업본틀림.join(', ')}`);
    if (확인.남은스테이징.length) 주의.push(`공용 인덱스에서 아직 HEAD와 다른 경로: ${확인.남은스테이징.join(', ')}`);
    if (확인.다른경로바뀜 && 확인.다른경로바뀜.length) 주의.push(`계획 밖 경로의 git status가 바뀌었다(다른 세션일 수 있다): ${확인.다른경로바뀜.slice(0, 5).map((x) => x.경로).join(', ')}`);
  } catch (e) {
    주의.push(`반영 뒤 대조를 끝내지 못했다 — ${e.message}`);
  }
  const 결과 = { ...계획, 결과: '맞춤', 커밋: 새, 기록, 확인, ...(주의.length ? { 주의: 주의.join(' / ') } : {}) };
  try { fs.writeFileSync(path.join(기록, '결과.json'), `${JSON.stringify(결과, null, 1)}\n`); } catch (_) {}
  return 결과;
}

// ── 되풀이 ──────────────────────────────────────────────────────────────────

const 미리보기폴더 = (c) => path.join(c.gitdir, 'master맞추기', '미리보기');

/** 미리 보기가 지문과 「사람이 정한 경로」(풀이·허용)의 양쪽 판을 적어 둔다 — --실행 --되풀이가 다시 세운 계획을 이것과 대조한다 */
function 미리보기적기(c, 계획) {
  try {
    const 폴더 = 미리보기폴더(c);
    fs.mkdirSync(폴더, { recursive: true });
    fs.writeFileSync(path.join(폴더, `${계획.지문}.json`), `${JSON.stringify({ 지문: 계획.지문, 시각: 시각글(), 로컬: 계획.로컬, 원격머리: 계획.원격머리, 민감: 계획.민감 || {} }, null, 1)}\n`);
    const 오래 = Date.now() - 7 * 864e5;   // 일주일 지난 기록은 치운다
    for (const f of fs.readdirSync(폴더)) { const p = path.join(폴더, f); try { if (fs.statSync(p).mtimeMs < 오래) fs.rmSync(p, { force: true }); } catch (_) {} }
  } catch (_) {}   // 못 적어도 미리 보기는 그대로 — 그때 --되풀이는 대조할 기록이 없어 멈춘다
}

/** 다시 세운 계획의 「사람이 정한 경로」(풀이·허용)가 미리 보기(처음 지문) 때와 같은가 → 멈출 까닭 | null */
function 되풀이대조(c, 처음지문, 계획) {
  let 적은;
  try { 적은 = JSON.parse(fs.readFileSync(path.join(미리보기폴더(c), `${처음지문}.json`), 'utf8')); } catch (_) {
    return `미리 보기(지문 ${처음지문})의 기록이 없어 다시 세운 계획을 대조할 수 없다`;
  }
  const 앞 = 적은.민감 || {}, 뒤 = 계획.민감 || {};
  const 이름 = { 로컬: '로컬 판', 원격: 'origin 판', 계획: '들어갈 판' };
  const 다른 = [];
  for (const p of [...new Set([...Object.keys(앞), ...Object.keys(뒤)])].sort()) {
    if (!앞[p] || !뒤[p]) { 다른.push(`${p} ${앞[p] ? '풀이·허용에서 뺌' : '풀이·허용에 새로 넣음'}`); continue; }
    const 칸 = Object.keys(이름).filter((k) => (앞[p][k] === undefined ? null : 앞[p][k]) !== (뒤[p][k] === undefined ? null : 뒤[p][k]));
    if (칸.length) 다른.push(`${p} ${칸.map((k) => 이름[k]).join('·')}`);
  }
  return 다른.length ? `풀이·허용 경로가 미리 보기 뒤 바뀌었다(${다른.slice(0, 5).join(', ')}${다른.length > 5 ? ' …' : ''})` : null;
}

// ── 들머리 ──────────────────────────────────────────────────────────────────

/**
 * 옵션: 저장소 · 가지 · 원격 · 받기(기본 true) · 실행(지문) · 되풀이(횟수) · 풀이([[경로, 값]]) · 풀이폴더 · 겹친곳쓰기(폴더) ·
 *       허용([경로]) · 메시지(글|글[]) · 메시지파일
 * 시험용: 잠깐(ms) · 잠금살피기() · 잠금한도ms {시작, 맞춤} · 시험고리 {쓰기직전(경로), CAS직전, CAS직후}
 */
async function 맞추기(옵션 = {}) {
  try {
    const 저장소 = 저장소찾기(옵션.저장소 || process.cwd());
    const 기준폴더 = 옵션.저장소 ? 저장소 : process.cwd();
    const git = git도구(저장소);
    git버전확인(git, [2, 43], 'merge-file --object-id');
    const [gitdir, 인덱스파일] = git.글(['rev-parse', '--path-format=absolute', '--git-dir', '--git-path', 'index']).split('\n');
    const 잠금 = `${path.resolve(인덱스파일)}.lock`;
    const 가지 = 옵션.가지 || 'master', 원격 = 옵션.원격 || 'origin';
    const 풀이 = new Map();
    for (const [p, v] of 옵션.풀이 || []) {
      const 경로 = 경로맞추기(저장소, p, 기준폴더);
      if (v === '로컬' || v === 'origin') 풀이.set(경로, { 종류: v });
      else {
        const 파일 = path.resolve(process.cwd(), v);
        let 버퍼;
        try { 버퍼 = fs.readFileSync(파일); } catch (e) { throw new 사용법오류(`--풀이 파일을 못 읽었다: ${v} (${e.code || e.message})`); }
        풀이.set(경로, { 종류: '파일', 파일, 버퍼 });
      }
    }
    // --풀이폴더: 그 아래 파일마다 같은 저장소 경로의 합친 판(--풀이가 먼저다)
    let 풀이폴더 = null;
    if (옵션.풀이폴더) {
      풀이폴더 = path.resolve(process.cwd(), 옵션.풀이폴더);
      const 걷기 = (폴더, 앞) => {
        let 칸;
        try { 칸 = fs.readdirSync(폴더, { withFileTypes: true }); } catch (e) { throw new 사용법오류(`--풀이폴더를 못 읽었다: ${옵션.풀이폴더} (${e.code || e.message})`); }
        for (const e of 칸) {
          const 상대 = 앞 ? `${앞}/${e.name}` : e.name;
          if (e.isDirectory()) 걷기(path.join(폴더, e.name), 상대);
          else if (e.isFile() && !풀이.has(상대)) 풀이.set(상대, { 종류: '파일', 파일: path.join(풀이폴더, ...상대.split('/')), 버퍼: fs.readFileSync(path.join(폴더, e.name)), 폴더: true });
        }
      };
      걷기(풀이폴더, '');
    }
    const 허용 = new Set((옵션.허용 || []).map((p) => 경로맞추기(저장소, p, 기준폴더)));
    if (옵션.겹친곳쓰기) {
      let 칸 = [];
      try { 칸 = fs.readdirSync(path.resolve(process.cwd(), 옵션.겹친곳쓰기)); } catch (_) {}
      if (칸.length) throw new 사용법오류(`--겹친곳쓰기 폴더가 비어 있지 않다(옛 겹친 파일이 섞여 --풀이폴더로 넘어갈 수 있다) — 새 폴더를 준다: ${옵션.겹친곳쓰기}`);
    }
    let 메시지 = '';
    if (옵션.메시지파일) 메시지 = fs.readFileSync(path.resolve(process.cwd(), 옵션.메시지파일), 'utf8');
    else if (Array.isArray(옵션.메시지)) 메시지 = 옵션.메시지.join('\n\n');
    else if (옵션.메시지) 메시지 = String(옵션.메시지);
    메시지 = 메시지.replace(/\r\n/g, '\n').replace(/\s+$/, '');
    const c = {
      git, 저장소, gitdir: path.resolve(gitdir), 가지, 원격, 추적: `refs/remotes/${원격}/${가지}`,
      받기: 옵션.실행 ? false : 옵션.받기 !== false, 풀이, 허용, 메시지: 메시지 ? `${메시지}\n` : '',
      겹친곳폴더: 옵션.겹친곳쓰기 ? path.resolve(process.cwd(), 옵션.겹친곳쓰기) : null,
      // 미리 보기가 찍어 주는 실행 명령: 어느 폴더에서 쳐도 같게 --저장소와 절대 경로로
      옵션글: [
        `--저장소 ${따옴(저장소)}`,
        ...[...풀이].filter(([, v]) => !v.폴더).map(([p, v]) => `--풀이 ${따옴(`${p}=${v.종류 === '파일' ? v.파일 : v.종류}`)}`),
        ...(풀이폴더 ? [`--풀이폴더 ${따옴(풀이폴더)}`] : []), ...[...허용].map((p) => `--허용 ${따옴(p)}`),
      ].join(' '),
      고리: 옵션.시험고리 || {}, 잠깐: 옵션.잠깐 || 잠깐,
      잠금살피기: 옵션.잠금살피기 || (() => 잠금도구.살피기(저장소, { 잠금 })),
      한도: { 시작: 20000, 맞춤: 30000, ...(옵션.잠금한도ms || {}) },
    };
    let 계획 = await 계획세우기(c);
    if (!옵션.실행) { if (계획.결과 === '미리 보기') 미리보기적기(c, 계획); return 계획; }
    // --되풀이 N: 계획이 미리 보기 뒤 바뀌었거나 쓰는 사이 경합으로 되돌리고 멈췄을 때, 다시 세운 계획이 멈출 까닭 없이 서고
    // 「사람이 정한 경로」(풀이·허용)의 로컬·origin 판과 계획에 들어갈 판이 미리 보기 때와 같으면 그 계획을 실행한다(최대 N번 다시 세움)
    const 되풀이 = 옵션.되풀이 || 0;
    for (let 번 = 0; ; 번++) {
      if (계획.결과 !== '미리 보기') {
        if (!번) return 계획;
        return { ...계획, 이유: 계획.결과 === '맞음' ? `다시 세워 보니 이미 맞다(${번}번째) — ${계획.이유}` : `다시 세운 계획(${번}번째)이 멈췄다 — ${계획.이유}` };
      }
      if (계획.지문 !== 옵션.실행) {
        const 앞말 = `계획이 미리 보기(지문 ${옵션.실행}) 뒤 바뀌었다(지금 ${계획.지문})`;
        if (!되풀이) return { ...계획, 결과: '멈춤', 이유: `${앞말} — 아래 새 계획을 보고 새 지문으로 실행한다` };
        const 까닭 = 되풀이대조(c, 옵션.실행, 계획);
        if (까닭) return { ...계획, 결과: '멈춤', 이유: `${앞말}. ${까닭} — 아래 새 계획을 보고 새 지문으로 실행한다` };
      }
      const r = await 실행하기(c, 계획);
      const 다시세움 = 계획.지문 !== 옵션.실행 ? { 처음지문: 옵션.실행, 지문: 계획.지문, 번 } : null;
      if (r.결과 === '맞춤' || !(r.다시 && 번 < 되풀이)) return 다시세움 ? { ...r, 다시세움 } : r;
      c.잠깐(1000);
      계획 = await 계획세우기(c);
    }
  } catch (e) {
    if (e instanceof 멈춤) return { 결과: '멈춤', 이유: e.이유, ...e.덧 };
    throw e;
  }
}

// ── 명령줄 ──────────────────────────────────────────────────────────────────

const 사용법 = `사용법
  node tools/master맞추기.js [--풀이 <경로>=로컬|origin|<파일>]… [--풀이폴더 <폴더>] [--허용 <경로>]… [--겹친곳쓰기 <폴더>] [--받지않음] [--자세히] [--json]
  node tools/master맞추기.js --실행 <지문> [미리 볼 때와 같은 --풀이·--풀이폴더·--허용] [--되풀이 <횟수>] [-m <메시지> | -F <파일>]
  기본은 미리 보기다(origin을 fetch하고 계획과 지문을 보인다). --실행 <지문>은 그 계획이 그대로일 때만 반영한다. push는 하지 않는다.
  --되풀이 <횟수>: 그사이 다른 세션 커밋으로 계획이 바뀌었거나 쓰는 사이 경합으로 멈췄을 때, 다시 세운 계획이 멈출 까닭 없고
  풀이·허용 경로의 로컬·origin 판과 계획에 들어갈 판이 미리 보기 때와 같으면 그 계획을 실행한다(최대 그 횟수만큼 다시 세움).
  규칙으로 못 푼 경로·줄 검사에 걸린 경로: --겹친곳쓰기 <폴더>로 받아 고친 뒤 --풀이폴더 <폴더>로 넘긴다.
  공통: --저장소 <폴더> · --가지 <이름>(master) · --원격 <이름>(origin)
  자세한 설명은 파일 머리.`;

function 인자읽기(argv) {
  const 옵션 = { 풀이: [], 허용: [], 메시지: [], json: false, 자세히: false, 받기: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const 값 = () => {
      if (i + 1 >= argv.length) throw new 사용법오류(`${a} 뒤에 값이 없다`);
      return argv[++i];
    };
    if (a === '--help' || a === '-h' || a === '도움말') return { 도움말: true };
    if (a === '--실행') 옵션.실행 = 값();
    else if (a === '--풀이') {
      const v = 값(), k = v.indexOf('=');
      if (k <= 0 || k === v.length - 1) throw new 사용법오류(`--풀이는 <경로>=로컬|origin|<파일> 꼴이다: ${v}`);
      옵션.풀이.push([v.slice(0, k), v.slice(k + 1)]);
    } else if (a === '--허용') 옵션.허용.push(값());
    else if (a === '--풀이폴더') 옵션.풀이폴더 = 값();
    else if (a === '--겹친곳쓰기') 옵션.겹친곳쓰기 = 값();
    else if (a === '--되풀이') {
      const v = 값();
      if (!/^[1-9]$/.test(v)) throw new 사용법오류(`--되풀이 뒤에는 다시 세울 최대 횟수(1~9)를 준다: ${v}`);
      옵션.되풀이 = Number(v);
    }
    else if (a === '-m' || a === '--메시지') 옵션.메시지.push(값());
    else if (a === '-F' || a === '--메시지파일') 옵션.메시지파일 = 값();
    else if (a === '--저장소') 옵션.저장소 = 값();
    else if (a === '--가지') 옵션.가지 = 값();
    else if (a === '--원격') 옵션.원격 = 값();
    else if (a === '--받지않음') 옵션.받기 = false;
    else if (a === '--json') 옵션.json = true;
    else if (a === '--자세히') 옵션.자세히 = true;
    else throw new 사용법오류(`모르는 인자: ${a}`);
  }
  if (옵션.실행 !== undefined && !/^[0-9a-f]{10}$/.test(옵션.실행)) throw new 사용법오류(`--실행 뒤에는 미리 보기가 보인 지문(16진수 10자리)을 준다: ${옵션.실행}`);
  if ((옵션.메시지.length || 옵션.메시지파일) && 옵션.실행 === undefined) throw new 사용법오류('-m·-F는 --실행과 함께 쓴다');
  if (옵션.되풀이 && 옵션.실행 === undefined) throw new 사용법오류('--되풀이는 --실행과 함께 쓴다');
  return 옵션;
}

function 보고글(r, { 자세히 = false } = {}) {
  const 줄 = [];
  const 한도 = (xs) => (자세히 ? xs : xs.slice(0, 보기한도));
  const 넘친 = (xs) => (!자세히 && xs.length > 보기한도 ? [`      … 외 ${xs.length - 보기한도}줄(--자세히)`] : []);
  const 줄임 = (s, n = 140) => (s.length > n ? `${s.slice(0, n)}…` : s);
  const 옵션 = r.옵션글 ? ` ${r.옵션글}` : '';
  줄.push({
    '미리 보기': `[미리 보기] 아직 아무것도 바꾸지 않았다 — 반영: node tools/master맞추기.js --실행 ${r.지문}${옵션}`,
    '맞음': `[맞음] ${r.이유}`,
    '맞춤': `[맞춤] ${r.가지} ← ${짧게(r.커밋)} (${r.방법})`,
    '멈춤': `[멈춤] ${r.이유}`,
    '실패': `[실패] ${r.이유}`,
  }[r.결과] || `[${r.결과}] ${r.이유 || ''}`);
  if (r.로컬) {
    const 갈래 = r.로컬만 === undefined ? '' : ` · 로컬에만 ${r.로컬만}커밋 · origin에만 ${r.원격만}커밋${r.다시쌓은 ? `(같은 작성자·제목의 로컬 커밋이 있는 것 ${r.다시쌓은}개)` : ''}`;
    줄.push(`로컬 ${r.가지} ${짧게(r.로컬)} · ${r.원격} ${짧게(r.원격머리)}${r.바탕 ? ` · 갈라진 곳 ${짧게(r.바탕)}` : ''}${갈래}`);
  }
  if (r.방법) {
    줄.push(`방법: ${{
      '빨리감기': `빨리감기 — ${r.가지}를 origin으로 옮긴다`,
      '빠른 길': '빠른 길 — origin에만 있는 변경이 로컬에 이미 다 있다. 트리는 로컬 그대로, 병합 커밋과 master만 옮기고 작업본·공용 인덱스는 건드리지 않는다',
      '병합': '병합 — 병합 커밋(부모 로컬·origin)을 만들고 master를 옮긴다',
    }[r.방법]}. push는 하지 않는다`);
  }
  if (r.빠른길걸림 && r.빠른길걸림.length) 줄.push(`빠른 길이 안 되는 까닭(앞 몇 개): ${r.빠른길걸림.map((x) => `${x.경로} — ${x.이유}`).join(' / ')}`);
  if (r.다시세움) {
    줄.push(`다시 세움: 계획이 미리 보기(지문 ${r.다시세움.처음지문}) 뒤 바뀌어 지문 ${r.다시세움.지문} 계획으로 ${r.결과 === '맞춤' ? '실행했다' : '실행하다 멈췄다'}`
      + `(--되풀이, 경합으로 다시 세운 횟수 ${r.다시세움.번}) — 풀이·허용 경로의 로컬·origin 판과 들어갈 판은 미리 보기 때와 같았다`);
  }
  if (r.겹친곳 && r.겹친곳.못씀.length) 줄.push(`겹친 곳을 파일로 못 쓴 경로(바이너리·지움·하위 저장소): ${r.겹친곳.못씀.join(', ')} — 못 푼 경로는 --풀이 <경로>=로컬|origin으로 정하고, 줄 검사에 걸린 경로는 보고 --허용한다`);
  if (r.합침 && r.합침.length) {
    const 한쪽 = r.합침.filter((x) => x.한쪽만).length;
    줄.push(`양쪽이 바꾼 경로 ${r.합침.length - 한쪽}개${한쪽 ? ` · 한쪽만 바꾼 경로의 --풀이 ${한쪽}개` : ''}`);
    for (const x of r.합침) {
      const 덧 = `${x.한쪽만 ? ` [${x.한쪽만}만 바꾼 경로]` : ''}${x.정리 ? ` [두 번 들어간 사본 지움: 절 ${x.정리.절} · ${x.정리.줄}줄]` : ''}`;
      줄.push(x.실패 ? `  못 풂  ${x.경로}${덧} — ${x.실패}${x.바탕 ? `(바탕: ${x.바탕})` : ''}` : `  ${x.방법}  ${x.경로}${x.바탕 ? `(바탕: ${x.바탕}${x.바탕sha ? ` ${짧게(x.바탕sha)}` : ''})` : ''}${덧}`);
      for (const 이 of 한도(x.이은 || [])) {
        const 어떻게 = 이.결과 === 이.로컬 ? '로컬 줄이 origin 줄을 품음' : 이.결과 === 이.원격 ? 'origin 줄이 로컬 줄을 품음' : '낱말 단위로 합침';
        줄.push(`    한 줄로(${어떻게}): ${줄임(이.결과)}`);
        if (자세히) { 줄.push(`      로컬  | ${줄임(이.로컬)}`); 줄.push(`      origin| ${줄임(이.원격)}`); }
      }
      줄.push(...넘친(x.이은 || []));
      for (const 덩 of (x.덩어리 || []).slice(0, 자세히 ? undefined : 3)) {
        줄.push(`    겹친 곳 — ${덩.이유}`);
        for (const [이름, 칸] of [['로컬', 덩.로컬], ['바탕', 덩.바탕], ['origin', 덩.원격]]) {
          for (const l of 한도(칸)) 줄.push(`      ${이름.padEnd(6)}| ${줄임(l)}`);
          줄.push(...넘친(칸));
        }
      }
    }
  }
  if (r.지움) {
    if (!r.지움.length) 줄.push(r.방법 === '빠른 길' ? '로컬 HEAD 대비 계획 트리에서 지워지는 줄: 없음(병합 트리 = 로컬 트리)' : '로컬 HEAD 대비 계획 트리에서 지워지는 줄: 없음');
    else {
      const 합 = (k) => r.지움.reduce((n, x) => n + x[k], 0);
      줄.push(`로컬 HEAD 대비 계획 트리에서 지워지는 줄 — ${r.지움.length}경로 ${합('수')}줄(origin이 지운 줄 ${합('원격')} · 한 줄로 이은 줄 ${합('이은')} · 로컬 줄 ${합('로컬')})`);
      for (const x of r.지움) {
        if (x.바이너리) { 줄.push(`  ${x.경로} — 바이너리 판이 바뀐다${x.로컬 ? ' ✗ 로컬 판' : ''}`); continue; }
        줄.push(`  ${x.경로} −${x.수}${x.로컬 ? ` ✗ 로컬 줄 ${x.로컬}` : ''}${x.원격 ? ` · origin이 지움 ${x.원격}` : ''}${x.이은 ? ` · 이음 ${x.이은}` : ''}`);
        const 보일 = x.줄.filter((l) => l.로컬 || 자세히);
        for (const l of 한도(보일)) 줄.push(`      ${l.로컬 ? '✗' : '✓'} ${줄임(l.글)}${l.수 > 1 ? ` (×${l.수})` : ''}`);
        줄.push(...넘친(보일));
      }
    }
  }
  for (const x of r.줄문제 || []) {
    줄.push(`줄 검사 ${x.허용 ? '(--허용으로 받아들임)' : '✗'} ${x.경로}`);
    for (const [k, 이름] of Object.entries(문제이름)) {
      if (!x[k] || !x[k].length) continue;
      줄.push(`    ${이름} ${x[k].length}`);
      for (const l of 한도(x[k])) 줄.push(`      ${줄임(l.글)}${l.수 > 1 ? ` (×${l.수})` : ''}`);
      줄.push(...넘친(x[k]));
    }
  }
  if (r.작업본) {
    const 수 = new Map();
    for (const x of r.작업본) 수.set(x.할일, (수.get(x.할일) || 0) + 1);
    줄.push(`작업본 ${r.작업본.length}경로 — ${[...수].map(([k, v]) => `${k} ${v}`).join(' · ') || '바꿀 것 없음'}`);
    for (const x of r.작업본.filter((x) => !['그대로', '새 판'].includes(x.할일) || (자세히 && x.까닭))) {
      줄.push(`  ${x.할일}  ${x.경로}${x.까닭 ? ` — ${x.까닭}` : ''}`);
    }
    const 남는 = r.작업본.filter((x) => ['손대지 않음', '미추적으로 남김'].includes(x.할일));
    if (남는.length) 줄.push(`  → 손대지 않는 ${남는.length}경로는 반영 뒤에도 「수정됨」(또는 미추적)으로 남는다. 그 파일 주인 세션이 커밋 전에 새 판과 다시 합친다`);
  }
  for (const x of r.스테이징 || []) 줄.push(`  스테이징 ✗ ${x.경로} — ${x.이유}`);
  if (r.결과 === '맞춤') {
    if (r.기록) 줄.push(`기록·백업: ${r.기록}`);
    const 확 = r.확인 || {};
    if (확.가지 !== undefined) {
      줄.push(`대조: ${r.가지} = 병합 커밋 ${확.가지 ? '✓' : '✗'} · origin 품음 ${확.origin품음 ? '✓' : '✗'} · 쓴 파일 ${확.작업본틀림 && !확.작업본틀림.length ? '✓' : '✗'} · 공용 인덱스 ${확.남은스테이징 && !확.남은스테이징.length ? '✓' : '✗'}${확.상태수 ? ` · 다른 경로 git status 바뀜 ${확.다른경로바뀜.length}(전 ${확.상태수.전} · 후 ${확.상태수.후})` : ''}`);
    }
  } else if (r.기록) 줄.push(`기록·백업: ${r.기록}`);
  if (r.주의) 줄.push(`주의: ${r.주의}`);
  return 줄.join('\n');
}

async function main(argv = process.argv.slice(2)) {
  let 옵션;
  try {
    옵션 = 인자읽기(argv);
  } catch (e) {
    if (!(e instanceof 사용법오류)) throw e;
    console.error(`${e.message}\n${사용법}`);
    return 2;
  }
  if (옵션.도움말) { console.log(사용법); return 0; }
  let r;
  try {
    r = await 맞추기(옵션);
  } catch (e) {
    if (e instanceof 사용법오류) { console.error(`${e.message}\n${사용법}`); return 2; }
    r = { 결과: '실패', 이유: e.message };
  }
  console.log(옵션.json ? JSON.stringify(r, null, 2) : 보고글(r, 옵션));
  return 좋은결과.has(r.결과) ? 0 : 1;
}

if (require.main === module) main().then((code) => { process.exitCode = code; });

module.exports = {
  맞추기, 인자읽기, main, 보고글,
  줄검사, 지움보기, 블록나누기, 덩어리풀기, 문서합치기, 한줄합치기, 공통판, 남은표시, 겹침정리,
};

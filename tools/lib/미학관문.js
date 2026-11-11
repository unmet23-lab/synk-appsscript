'use strict';

// ⑱ 미학 맹검 관문(11-08 유호님 「내 피드백도 … 검수, 검토작업에 적용해줬으면 해」) — 올리기 전 검사(tools/올리기전검사.js)와
// 예약 큐(tools/예약큐.js — 14시 「오늘 편 게시」가 이것으로 걸 편을 고른다)가 같이 쓴다. 매시 도는 예약 큐 알림이 무거운 검사 도구를
// 불러오지 않게 판정만 여기에 둔다(fs · path · 게시글규칙만 부른다). th-post.mjs(스레드 21시)의 `맹검막음`은 이 판정의 짧은 판이다.
//
// 보여 드리기 · 게시 전에 대표 프레임 · 카드(또는 핵심 순간 띠)를 tools/미학맹검.js(아르곤 그림 맹검)로 보고 그 결과를 편 폴더
// 게시/미학맹검.json에 둔다(--편 <편 폴더>). 11-08부터 모든 편에 묻는다 — 만든 날 상관없이. 맹검 뒤 영상이 바뀌었거나 「기각」이면
// 고칠 것 — 고쳐 다시 맹검하거나, 그래도 낼 까닭(빈 날 없음 등)을 준비.json 「맹검판단」에 적으면 확인할 것으로 내린다.
//
// 11-10 「LAB 하루 두 편」 설계 18(docs/마케팅/LAB_하루두편_설계_20261110/README.md): 아르곤이 막혀 답을 못 받은 화면은
// 「맹검못함」 · 「맹검판단」 글만으로 넘기지 않는다(11-09 15:34~20:00 아르곤 줄이 막힌 동안 LAB 세 편이 판정 없이 지났다).
//   ① 막힌 증거 — 미학맹검.js가 남기는 「막힘」(묶음마다 꼴 · 보낸 시각 · 거절 첫 줄 · 줄 끈 때)이 게시/미학맹검.json에 있어야 하고
//   ② 대체 눈의 결과 파일 — 게시/미학맹검_대체.json(`node tools/미학맹검.js … --편 <편> --눈 gpt|opus`)이 아르곤이 못 본 화면을 덮어야
//      확인할 것으로 내린다. 대체 순서는 아르곤 → GPT(11-08 눈가림 기각 사례로 적중을 먼저 쟀다) → Claude Opus(세션 하위 에이전트).
//      Fable은 언어 교정 몫이라 시각 대체에서 뺀다. 셋 다 막히면 예비편으로 바꾼다 — 「맹검못함」으로 통과하지 않는다.
// 11-11(Fable 5.2 P1-4): 다시 맹검할 때 이번 목록에 없는 지난 화면은 미학맹검.js가 「이번에 안 봄」으로 옛 판정 그대로 남긴다 — 낱장이라 여기서
// 그대로 기각 · 답 빠짐으로 본다. 정말 뺀 컷(「뺌」)과 같은 그림을 다시 물어 기각이 바뀐 컷(낱장 「앞판정」)은 확인할 것(aesthetic-history)으로 보인다.
// 맹검한 영상을 기록에 적은 판(「영상」 칸 — --영상으로 띠를 만든 판)은 그 영상만 바뀜을 본다: 언어판은 동결한 원본의 맹검을 따르고
// (설계 17 · 20), 언어판 조판은 글자 검사가 본다. 「영상」 칸이 없는 옛 판은 예전처럼 편의 모든 영상을 본다.
const fs = require('node:fs');
const path = require('node:path');
const { FIX, LOOK } = require('./게시글규칙.js');

const AESTHETIC_FROM = '20261108'; // 관문을 건 날(기록용 — 날짜로 거르지 않는다)
const 기록이름 = '미학맹검.json';
const 대체이름 = '미학맹검_대체.json';
// 시각 대체 눈 — 순서대로. 이 밖의 눈(Fable · 그록 …)이 쓴 대체 결과는 받지 않는다.
const 대체눈 = ['gpt', 'opus'];
const 눈이름 = { 아르곤: '카본', gpt: 'GPT', opus: 'Claude Opus' };
const 뺀눈 = {
  fable: 'Fable은 언어 교정 몫이라 시각 대체에서 뺀다(11-10 설계 18 — 11-08 눈가림 기각 3/8)',
  그록: '그록은 디자인 눈이 무르다(11-08 눈가림 기각 0/8)',
  grok: '그록은 디자인 눈이 무르다(11-08 눈가림 기각 0/8)',
};
// 막힌 증거의 꼴 — 미학맹검.js 막힘읽기()가 쓴다
const 막힘꼴 = ['거절', '답 없음', '안 보내짐', '보내기 실패', '줄 꺼짐', '계정 없음', '한도', '부르기 실패'];

const 읽기 = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const 바뀐때 = (f) => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } };
const 만든때of = (기록, 파일) => Date.parse(기록?.만든때 || '') || 바뀐때(파일);
const 배열 = (x) => (Array.isArray(x) ? x : []);
const 짧게글 = (s, n = 70) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/** 막힌 증거 한 줄이 쓸 만한가 — 꼴이 알려진 것이고, 보낸 시각 · 거절 첫 줄 · 줄 끈 때 가운데 하나가 있다. */
function 막힘됨(m) {
  if (!m || typeof m !== 'object' || !막힘꼴.includes(m.꼴)) return false;
  const 글 = (k) => typeof m[k] === 'string' && m[k].trim().length > 0;
  return 글('보낸때') || 글('첫줄') || 글('끈때');
}
const 막힘한줄 = (m) => `${m.꼴}${m.보낸때 ? ` ${String(m.보낸때).slice(5, 16)}` : m.끈때 ? ` ${String(m.끈때).slice(5, 16)}` : ''}${m.첫줄 ? ` 「${짧게글(m.첫줄, 40)}」` : ''}`;

/** 기록의 막힌 증거 — 답을 못 받은 화면마다 그 화면이 든 묶음의 증거가 있어야 ok. */
function 막힘증거(기록, 못본번호) {
  const 막힘 = 배열(기록?.막힘).filter(막힘됨);
  if (!막힘.length) return { ok: false, 글: '' };
  // 묶음마다 화면 번호를 적은 판이면 못 본 화면이 모두 덮이는지 본다(번호를 안 적은 줄은 기록 전체를 덮는 것으로 본다)
  const 전체 = 막힘.some((m) => !Array.isArray(m.화면));
  const 덮은 = new Set(막힘.flatMap((m) => 배열(m.화면).map(String)));
  const 빈 = 전체 ? [] : 못본번호.filter((n) => !덮은.has(String(n)));
  return { ok: !빈.length, 빈, 글: [...new Set(막힘.map(막힘한줄))].slice(0, 2).join(' · ') };
}

// 기록이 본 영상 가운데 기록 뒤에 바뀐 것. 「영상」 칸(맹검한 영상)이 있으면 그 영상만 — 언어판은 원본 맹검을 따른다.
// 그 영상이 편의 판 영상 가운데 하나도 없으면 다른 영상을 맹검한 것이라 바뀜으로 친다(판 영상이 없는 편은 넘긴다).
// 판본영상(11-10): 돌림 원본의 나라 판본 영상(「돌림」.판본 — 그림 · 박자는 원본과 같고 글만 다르다)도 맹검한 영상으로 받는다. 씨앗이 나간 뒤
// 원본 그림을 고쳐 판본을 다시 렌더한 편(11-10 지마 저녁 장면)은 씨앗 판 영상이 옛 그림이라, 맹검은 고친 그림의 판본 영상으로 다시 받는다.
// 「영상」 칸이 없는 옛 기록에는 판본영상을 쓰지 않는다(판본은 원본 맹검 뒤에 굽는 것이라 늘 기록보다 늦다).
function 바뀐영상(기록, 기록파일, videoFiles, 판본영상 = []) {
  const 만든 = 만든때of(기록, 기록파일);
  const 늦음 = (v) => 바뀐때(v) > 만든 + 1000;
  const 맹검영상 = 배열(기록?.영상).filter((v) => v && (v.이름 || v.파일));
  if (!맹검영상.length) return { 바뀜: videoFiles.filter(늦음), 다른영상: false };
  const 이름 = (v) => String(v.이름 || path.basename(String(v.파일 || '')));
  const 끝같음 = (full, rel) => !rel || full.split(path.sep).join('/').endsWith(String(rel).replace(/\\/g, '/'));
  const 그영상 = (f) => 맹검영상.find((v) => path.basename(f) === 이름(v) && 끝같음(path.resolve(f), v.파일));
  const 후보 = [...videoFiles, ...배열(판본영상)];
  const 짝 = 후보.filter((f) => 그영상(f));
  if (후보.length && !짝.length) return { 바뀜: [], 다른영상: true, 맹검영상: 맹검영상.map(이름) };
  const 크기다름 = (f) => { const v = 그영상(f); if (!Number.isFinite(v?.크기)) return false; try { return fs.statSync(f).size !== v.크기; } catch { return true; } };
  return { 바뀜: 짝.filter((f) => 늦음(f) || 크기다름(f)), 다른영상: false };
}

// 화면 번호 → 컷 이름(다시 렌더해도 같은 컷이면 같은 이름 — 미학맹검.js가 적는다). 옛 판은 컷 이름이 없다
const 컷맵 = (기록) => new Map(배열(기록?.화면).map((h) => [String(h.번호), h.컷 ? String(h.컷) : null]));

/** 대체 결과 판정 — 아르곤 기록(P)이 못 본 화면을 대체 눈(S)이 덮었나. */
function 대체판정(S, S파일, P, P파일, 못본번호, videoFiles, 판본영상 = []) {
  if (!S) return { 상태: '없음' };
  const 눈 = String(S.눈 || '').toLowerCase();
  if (!대체눈.includes(눈)) return { 상태: '눈아님', 눈: S.눈 || '(적지 않음)', 까닭: 뺀눈[눈] || `시각 대체는 ${대체눈.map((x) => 눈이름[x]).join(' → ')}만 받는다` };
  if (눈 === 'gpt' && !(S.적중 && typeof S.적중 === 'object')) return { 상태: '눈아님', 눈: 'GPT', 까닭: 'GPT 적중(11-08 눈가림 기각 사례)을 잰 기록이 대체 결과에 없다 — tools/미학맹검.js --적중시험으로 먼저 잰다' };
  const 바 = 바뀐영상(S, S파일, videoFiles, 판본영상);
  if (바.다른영상 || 바.바뀜.length) return { 상태: '낡음', 글: 바.다른영상 ? `대체 맹검한 영상(${바.맹검영상.join(', ')})이 이 편의 판 영상이 아니다` : `대체 맹검 뒤 영상이 바뀌었다(${바.바뀜.map((v) => path.basename(v)).join(', ')})` };
  if (만든때of(S, S파일) + 1000 < 만든때of(P, P파일)) return { 상태: '낡음', 글: '대체 맹검이 지금 아르곤 기록보다 먼저 만들어졌다 — 아르곤이 다시 막힌 판을 대체 눈으로 다시 본다' };
  const 시도 = 배열(S.시도);
  const 막힌눈 = new Set(시도.filter((t) => t && t.결과 === '막힘' && 막힘됨(t)).map((t) => String(t.눈).toLowerCase()));
  const 낱장 = 배열(S.낱장);
  if (!낱장.length) {
    if (대체눈.every((x) => 막힌눈.has(x))) return { 상태: '셋다막힘', 시도: 시도.filter((t) => t?.결과 === '막힘') };
    const 남은눈 = 대체눈.find((x) => !막힌눈.has(x));
    return { 상태: '다음눈', 다음: 남은눈, 시도: 시도.filter((t) => t?.결과 === '막힘') };
  }
  // 덮음 — 못 본 화면의 컷 이름이 대체 눈이 판정한 컷에 다 들어야 한다(컷 이름이 없는 옛 기록은 수로 견준다)
  const P컷 = 컷맵(P), S컷 = 컷맵(S);
  const 판정컷 = new Set(낱장.map((x) => S컷.get(String(x.번호))).filter(Boolean));
  const 못본컷 = 못본번호.map((n) => P컷.get(String(n)));
  const 빈 = 못본컷.every(Boolean) && 판정컷.size
    ? 못본번호.filter((n) => !판정컷.has(P컷.get(String(n))))
    : (낱장.length >= 못본번호.length ? [] : 못본번호.slice(낱장.length));
  if (빈.length || 배열(S.빠짐).length) return { 상태: '모자람', 빈: 빈.length ? 빈 : 배열(S.빠짐).map((n) => S컷.get(String(n)) || String(n)) };
  return { 상태: '받음', 눈 };
}

const 적중글 = (S) => {
  const j = S?.적중;
  if (!j || typeof j !== 'object') return S?.눈 === 'opus' ? '적중 모름(Opus는 아직 안 잼)' : '';
  return `11-08 눈가림 기각 ${j.기각 ?? '?'}${j.아르곤 ? `(아르곤 ${j.아르곤})` : ''}`;
};

// bundle = { dir: 편 폴더, prep: 준비.json }, videoFiles = 그 편의 영상 판(맹검 뒤에 바뀌었는지 본다),
// 판본영상 = 돌림 원본의 나라 판본 영상(맹검한 영상으로 받는다 — 위 바뀐영상)
function aestheticFindings(bundle, videoFiles = [], { 판본영상 = [] } = {}) {
  const findings = [];
  const add = (level, code, message) => findings.push({ level, code, where: '미학 맹검', message });
  const 글칸 = (k) => (typeof bundle.prep?.[k] === 'string' ? bundle.prep[k].trim() : '');
  const 판단 = 글칸('맹검판단'), 못함 = 글칸('맹검못함');
  const P파일 = path.join(bundle.dir, '게시', 기록이름), S파일 = path.join(bundle.dir, '게시', 대체이름);
  const P = 읽기(P파일), S = 읽기(S파일);
  const 영상들 = 배열(videoFiles);
  const 대신길 = 'node tools/미학맹검.js <같은 그림 · 같은 --영상 --순간> --편 <편 폴더> --눈 gpt(GPT도 막히면 --눈 opus로 재료를 만들어 하위 에이전트 Opus가 본다)';
  if (!P) {
    if (S) add(FIX, 'aesthetic-order', `대체 맹검(${눈이름[String(S.눈).toLowerCase()] || S.눈 || '?'})만 있고 카본 맹검 기록이 없다 — 대체 순서는 카본 → GPT → Opus. 카본으로 먼저 돌리면 막혀도 막힌 증거가 남는다: node tools/미학맹검.js … --편 <편 폴더>`);
    else if (못함) add(FIX, 'aesthetic-unverified', `「맹검못함」 글만으로는 못 넘는다(11-10 설계 18) — node tools/미학맹검.js <대표 프레임 · 카드 또는 --영상 --순간> --편 <편 폴더>로 카본을 부르면 막혀도 막힌 증거(보낸 시각 · 거절 첫 줄)가 남는다. 그다음 --눈 gpt → --눈 opus로 대신 보고, 셋 다 막히면 예비편으로 바꾼다`);
    else add(FIX, 'aesthetic-missing', '보여 드리기 · 게시 전 미학 맹검이 없다(11-08부터 모든 편, 제작 절차 3 관문) — node tools/미학맹검.js <대표 프레임 · 카드 또는 --영상 <최종.mp4> --순간 <초>…> --편 <편 폴더>');
    return findings;
  }
  const 바 = 바뀐영상(P, P파일, 영상들, 판본영상);
  if (바.다른영상) add(FIX, 'aesthetic-stale', `맹검한 영상(${바.맹검영상.join(', ')})이 이 편의 판 영상이 아니다 — 판 영상으로 다시 맹검한다`);
  else if (바.바뀜.length) add(FIX, 'aesthetic-stale', `맹검 뒤 영상이 바뀌었다(${바.바뀜.map((v) => path.basename(v)).join(', ')}) — 바뀐 판으로 다시 맹검한다(안 바뀐 컷은 지난 판정을 이어받는다). 그때도 카본이 막히면 도구가 막힌 증거를 남기고, 대체 눈으로 본다`);
  const 낱장 = 배열(P.낱장);
  const 빠짐 = 배열(P.빠짐).map(String);
  const 못본 = 빠짐.length ? 빠짐 : (낱장.length ? [] : (배열(P.화면).map((h) => String(h.번호)).filter(Boolean).length ? 배열(P.화면).map((h) => String(h.번호)) : ['?']));
  let 대 = null;
  if (못본.length && !(바.다른영상 || 바.바뀜.length)) {
    const 증거 = 막힘증거(P, 못본);
    const 덧글 = [판단 && `「맹검판단」: ${짧게글(판단, 60)}`, 못함 && `「맹검못함」: ${짧게글(못함, 60)}`].filter(Boolean).join(' · ');
    if (!증거.ok) {
      add(FIX, 'aesthetic-incomplete', `맹검 답을 못 받은 화면 ${못본.join(', ')} — 통과로 치지 않는다. 막힌 증거(보낸 시각 · 거절 첫 줄)가 기록에 없다${증거.빈?.length ? `(화면 ${증거.빈.join(', ')})` : ''}: 다시 맹검한다(11-10부터 도구가 막힘을 적는다 — 그때도 막히면 대체 눈)${덧글 ? ` · ${덧글} — 글만으로는 못 넘는다` : ''}`);
    } else {
      대 = 대체판정(S, S파일, P, P파일, 못본, 영상들, 판본영상);
      const 앞 = `카본이 화면 ${못본.join(', ')}을 못 봤다(${증거.글})`;
      if (대.상태 === '받음') add(LOOK, 'aesthetic-substitute', `${앞} — 대체 눈 ${눈이름[대.눈]}의 판정을 쓴다${적중글(S) ? `(${적중글(S)})` : ''}. 대체 눈은 약한 눈이라 지적을 프레임과 대조한다${덧글 ? ` · ${덧글}` : ''}`);
      else if (대.상태 === '셋다막힘') add(FIX, 'aesthetic-swap', `${앞} · ${대.시도.map((t) => `${눈이름[String(t.눈).toLowerCase()] || t.눈} ${막힘한줄(t)}`).join(' · ')} — 셋 다 막혔다: 예비편으로 바꿔 건다(「맹검못함」으로 통과하지 않는다, 11-10 설계 18 · 21)`);
      else if (대.상태 === '눈아님') add(FIX, 'aesthetic-eye', `${앞} — 대체 맹검 눈이 ${대.눈}이다: ${대.까닭}`);
      else if (대.상태 === '낡음') add(FIX, 'aesthetic-stale', `${앞} — ${대.글}`);
      else if (대.상태 === '모자람') add(FIX, 'aesthetic-incomplete', `${앞} — 대체 맹검이 화면 ${대.빈.join(', ')}을 못 덮었다: ${대신길}`);
      else if (대.상태 === '다음눈') add(FIX, 'aesthetic-unverified', `${앞} · ${대.시도.map((t) => `${눈이름[String(t.눈).toLowerCase()] || t.눈} ${막힘한줄(t)}`).join(' · ')} — 다음 눈 ${눈이름[대.다음]}으로 본다: node tools/미학맹검.js … --편 <편 폴더> --눈 ${대.다음}`);
      else add(FIX, 'aesthetic-unverified', `${앞} — 대체 눈으로 본 결과(게시/${대체이름})가 없다: ${대신길}. 셋 다 막히면 예비편으로 바꾼다${덧글 ? ` · ${덧글} — 글만으로는 못 넘는다` : ''}`);
    }
  }
  // 판정 — 아르곤 낱장, 그리고 대체 눈이 덮은 낱장(받음일 때만)
  const 짧게 = (x) => `${x.번호}(${x.점수 ?? '—'}점${x.이어받음 ? ' · 지난 판정' : ''}${x.안봄 ? ' · 이번에 안 봄' : ''}) ${짧게글((x.약점 || [])[0], 70)}`;
  const 판정보기 = (목록, 누구) => {
    const 기각 = 목록.filter((x) => x.판정 === '기각');
    if (기각.length) add(판단 ? LOOK : FIX, 'aesthetic-reject', `${누구} 맹검 「기각」 ${기각.length}장 — ${기각.slice(0, 3).map(짧게).join(' · ')}${판단 ? ` · 「맹검판단」: ${판단}` : ' — 지적대로 고쳐 다시 맹검하거나(고친 컷만 다시 본다), 그래도 기각이면 낼 까닭을 준비.json 「맹검판단」에 적는다'}`);
    const 고쳐 = 목록.filter((x) => x.판정 === '고쳐서 냄');
    if (고쳐.length) add(LOOK, 'aesthetic-fix', `${누구} 맹검 「고쳐서 냄」 ${고쳐.length}장 — ${고쳐.slice(0, 3).map(짧게).join(' · ')}`);
  };
  판정보기(낱장, '카본');
  내력보기(P, '카본', add);
  if (대?.상태 === '받음') { 판정보기(배열(S.낱장), `${눈이름[대.눈]} 대체`); 내력보기(S, `${눈이름[대.눈]} 대체`, add); }
  return findings;
}

// 맹검 내력(11-11 Fable 5.2 P1-4 ⓐ) — 기록에서 뺀 컷(tools/미학맹검.js --뺌 — 그대로 냄이 아니던 것)과, 같은 그림을 다시 물어(--다시모두 · 쌍 · 다른 눈)
// 「기각」이 바뀐 컷은 확인할 것으로 보인다 — 고쳐서 바뀐 것인지 다시 굴려 씻은 것인지 프레임과 대조한다. 옛 기록에는 이 칸이 없다(조용).
function 내력보기(기록, 누구, add) {
  const 컷 = 컷맵(기록);
  const 뺌 = 배열(기록?.뺌).filter((x) => x && x.판정 !== '그대로 냄');
  const 바뀜 = 배열(기록?.낱장).filter((x) => x?.앞판정?.판정 === '기각' && x.앞판정.같은그림 === true && x.판정 !== '기각');
  if (!뺌.length && !바뀜.length) return;
  const 글 = [
    뺌.length && `뺀 컷 ${뺌.length} — ${뺌.slice(0, 3).map((x) => `${x.컷 || x.번호}(옛 ${x.판정 || '답 없음'}) 「${짧게글(x.까닭, 50)}」`).join(' · ')}`,
    바뀜.length && `같은 그림을 다시 물어 「기각」이 바뀐 컷 ${바뀜.length} — ${바뀜.slice(0, 3).map((x) => `${컷.get(String(x.번호)) || x.번호}(${눈이름[x.앞판정.눈] || x.앞판정.눈 || '?'} 기각 → ${x.판정})`).join(' · ')}`,
  ].filter(Boolean).join(' · ');
  add(LOOK, 'aesthetic-history', `${누구} 맹검 내력: ${글} — 고쳐서 바뀐 것인지 다시 굴려 씻은 것인지 프레임과 대조한다`);
}

// 예약 큐 · 게시 작업이 한 줄로 보이는 까닭 — 고칠 것만, 없으면 null
const 짧은까닭 = {
  'aesthetic-missing': '미학 맹검 없음', 'aesthetic-stale': '맹검 뒤 영상 바뀜', 'aesthetic-incomplete': '맹검 답 빠짐', 'aesthetic-reject': '맹검 기각',
  'aesthetic-unverified': '맹검 막힘 · 대체 맹검 없음', 'aesthetic-swap': '맹검 눈 셋 다 막힘 — 예비편', 'aesthetic-eye': '시각 대체 눈 아님', 'aesthetic-order': '카본 맹검 기록 없음',
};
function aestheticBlock(bundle, videoFiles, opts = {}) {
  const fix = aestheticFindings(bundle, videoFiles, opts).filter((f) => f.level === FIX);
  return fix.length ? [...new Set(fix.map((f) => 짧은까닭[f.code] || f.code))].join(' · ') : null;
}

module.exports = { aestheticFindings, aestheticBlock, AESTHETIC_FROM, 막힘됨, 막힘증거, 바뀐영상, 대체판정, 대체눈, 뺀눈, 막힘꼴, 기록이름, 대체이름, 눈이름 };

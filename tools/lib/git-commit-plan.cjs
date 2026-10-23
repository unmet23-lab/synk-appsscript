'use strict';
// Build and validate a candidate commit without owning CLI dispatch or push follow-up.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const 잠금도구 = require('../git잠금.js');
const { checkRepository } = require('../git-storage-check.cjs');
const 공개검사 = require('../공개검사.js');

const { 공용문서, 맞춰붙일문서, 장부꼴, 차이한도, 겹침찾기한도, 판머리길이, 짝찾기여유, 영, 위치환경, 좋은결과, 멈춤, 사용법오류, 기본환경, 잠깐, git도구, 저장소찾기, 경로맞추기, 별도인덱스, 날차이읽기, 트리항목들, 블롭읽기, 블롭, 블롭쓰기, 글아닌경로, 조상인가, 꼬리없는공용가지, 바로올리기안내, git버전확인, 글로, 바이트로, 보이게, 이진인가, 줄나누기, 줄잇기, 줄바꿈채우기, 줄차이, 마이어스, 조각나누기, 조각만들기, 고름읽기, 고름맞추기, 조각얹기, 줄끝맞추기, 줄셈, 셈빼기, 셈더하기, 넘는줄, 줄셈검사, 뚜렷한줄, 맞닿은겹침, 더한줄자리, 고친줄걷기, 자리맞춰붙이기, 장부덧붙이기, 판머리, 다른판줄, 갈린곳, 공용문서인가, 조각보기, 메시지만들기, 공용인덱스항목, 남의스테이징, 잠금기다리기, 공용인덱스맞추기, 작업본맞추기 } = require('./git-commit-core.cjs');
function 커밋풀기(git, 입력들) {
  const 결과 = [];
  for (const 입력 of 입력들) {
    const 목록 = 입력.includes('..')
      ? git.글(['rev-list', '--reverse', 입력]).split('\n').filter(Boolean)
      : [git.글(['rev-parse', '--verify', `${입력}^{commit}`])];
    if (!목록.length) throw new 멈춤(`커밋이 없다: ${입력}`);
    for (const c of 목록) {
      const 부모 = git.글(['log', '-1', '--format=%P', c]).split(' ').filter(Boolean);
      if (부모.length !== 1) throw new 멈춤(`${c.slice(0, 9)}: 부모가 ${부모.length}개다 — 병합·뿌리 커밋은 다시 쌓지 않는다`);
      if (!결과.includes(c)) 결과.push(c);
    }
  }
  return 결과;
}

/** 옛판아님이 아니면 문서에서 같은 줄의 옛·새 판이 함께 남는 결과(다른판줄)는 멈춘다. */
function 세판합치기(git, 저장, 경로, 원sha, 부sha, 내sha, { 옛판아님 = false } = {}) {
  const O = 블롭(git, 저장, 원sha), P = 블롭(git, 저장, 부sha), C = 블롭(git, 저장, 내sha);
  if (이진인가(O) || 이진인가(P) || 이진인가(C)) return { 문제: '바이너리 파일이 원격에서도 바뀌었다 — 손으로 고른다' };
  const r = git.돌리기(['merge-file', '-p', '--object-id', 원sha, 부sha, 내sha], { 허용: null });
  const 장부 = 장부꼴.test(경로);
  const 덧 = 장부 && r.status > 0 && r.status < 128 ? 장부덧붙이기(...[P, O, C].map((b) => 줄나누기(글로(b)))) : null;
  let R, 방법, 자리;
  if (r.status === 0) { R = r.stdout; 방법 = '3방향'; }
  else if (덧) { R = 바이트로(줄잇기(덧)); 방법 = '장부 덧붙임'; }
  else if (r.status > 0 && r.status < 128) {
    if (!맞춰붙일문서.test(경로)) return { 문제: `원격 판과 ${r.status}곳이 겹친다 — 코드·데이터 파일은 손으로 합친다` };
    const a = 자리맞춰붙이기(줄나누기(글로(P)), 줄나누기(글로(O)), 줄나누기(글로(C)));
    if (a.문제) return { 문제: a.문제 };
    R = 바이트로(줄잇기(a.줄));
    방법 = '자리 맞춤';
    자리 = a.자리.map((x) => ({
      앞줄: x.앞줄 === null ? null : 보이게(x.앞줄), 내줄: x.내줄 === null ? null : 보이게(x.내줄), 줄수: x.줄수,
      ...(x.이미있음 ? { 이미있음: x.이미있음 } : {}),
    }));
  } else return { 문제: `git merge-file 실패: ${String(r.stderr).trim()}` };
  const 줄들 = [P, O, C, R].map((b) => 줄나누기(글로(b)));
  const 셈 = 줄셈검사(...줄들);
  if (셈) return { 문제: 셈 };
  // 장부 줄은 기록 하나씩이라 옛·새 판이 없다(한 회차의 여러 줄은 앞 60자가 같다)
  const 판 = 옛판아님 || 장부 || !맞춰붙일문서.test(경로) ? null : 다른판줄(...줄들);
  if (판) {
    const [내, 원] = 갈린곳(판.내줄, 판.원격줄);
    return {
      문제: `원격에 같은 머리의 다른 판 줄이 있다 — 앞 ${판머리길이}자가 같은 줄의 옛·새 판이 함께 들어간다(내 줄 「${내}」 · 원격 줄 「${원}」). `
        + '남이 이 커밋을 먼저 올렸으면 빼고 넘기고, 옛·새 판이 아니라 다른 줄이면 --옛판아님',
    };
  }
  return { 버퍼: R, 방법, ...(자리 ? { 자리 } : {}) };
}

function 같은셈(a, b) {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

/**
 * 내 경로 변화 e(P→C)와 짝의 같은 경로 변화 f(P'→C')가 같은지. 더한 줄·뺀 줄(빈 줄은 빼고 줄끝은 보지 않는다)이 같거나,
 * 내 변화를 짝의 부모 판 P'에 얹으면 C'가 된다(짝을 쌓을 때 원격에 이미 있던 내 줄을 한 번만 두었다). 더하고 뺀 줄 없이 차례·빈 줄만
 * 바꾼 변화는 얹어 본 결과로만 가린다. 지움은 둘 다 지웠을 때, 바이너리는 같은 blob일 때만 같다.
 */
function 같은변화(git, 저장, 경로, e, f) {
  if (!e.새 || !f.새) return !e.새 && !f.새;
  if (e.새모드 !== f.새모드) return false;
  if (e.새 === f.새) return true;
  const 판들 = [e.옛, e.새, f.옛, f.새].map((s) => 블롭(git, 저장, s));
  if (판들.some(이진인가)) return false;
  const [p, c, p2, c2] = 판들.map((b) => 줄셈(줄나누기(글로(b))));
  const 더한 = 셈빼기(c, p), 뺀 = 셈빼기(p, c);
  if ((더한.size || 뺀.size) && 같은셈(더한, 셈빼기(c2, p2)) && 같은셈(뺀, 셈빼기(p2, c2))) return true;
  if (!e.옛 || !f.옛) return false;
  const m = 세판합치기(git, 저장, 경로, f.옛, e.옛, e.새, { 옛판아님: true });
  const 다듬기 = (b) => 글로(b).replace(/\r\n/g, '\n');
  return !m.문제 && 다듬기(m.버퍼) === 다듬기(판들[3]);
}

/**
 * 남이 내 커밋을 먼저 origin에 다시 쌓아 올렸으면 그 짝을 찾는다. 짝은 바탕의 내력에서 작성자·작성 시각·제목이 같은 커밋이다
 * (이 도구의 다시 쌓기·rebase·cherry-pick은 셋을 그대로 둔다). 짝은 내 커밋을 쓴 뒤에 커밋되니 내 커밋 가운데 가장 이른 작성 시각
 * (짝찾기여유만큼 앞)부터 본다. 경로마다 짝이 같은 변화를 했을 때만 그 경로가 이미 올라간 것이다 — 짝이 안 건드린 경로(일부만 올라감)와
 * 다르게 바꾼 경로는 그대로 다시 쌓는다. → Map(내 커밋 → Map(경로 → 짝 커밋))
 */
function 올라간짝찾기(git, 저장, 바탕, 항목들) {
  const 형식 = '--format=%H%x1f%P%x1f%an%x1f%ae%x1f%ad%x1f%s';
  const 읽기 = (버퍼) => 버퍼.toString('utf8').split('\n').filter(Boolean).map((줄) => {
    const [sha, 부모, 이름, 메일, 날짜, 제목 = ''] = 줄.split('\x1f');
    return { sha, 부모: 부모.split(' ').filter(Boolean), 열쇠: [이름, 메일, 날짜, 제목].join('\x1f'), 초: Number(날짜.split(' ')[0]) };
  });
  const 내것 = new Map(읽기(git(['show', '-s', '--date=raw', 형식, ...항목들.map((항) => 항.커밋)])).map((x) => [x.sha, x]));
  const 가장이른 = Math.min(...[...내것.values()].map((x) => x.초));
  const 후보 = new Map();
  const 범위 = Number.isFinite(가장이른) ? [`--since=@${Math.max(0, 가장이른 - 짝찾기여유)}`] : [];
  for (const x of 읽기(git(['log', '--no-merges', '--date=raw', ...범위, 형식, 바탕]))) {
    if (x.부모.length !== 1) continue;
    if (!후보.has(x.열쇠)) 후보.set(x.열쇠, []);
    후보.get(x.열쇠).push(x);
  }
  const 결과 = new Map();
  for (const 항 of 항목들) {
    const 짝들 = 후보.get((내것.get(항.커밋) || {}).열쇠) || [];
    const 맞음 = new Map();
    for (const 짝 of 짝들) {
      const 짝바뀜 = new Map(날차이읽기(git(['diff-tree', '-r', '--no-renames', '--no-abbrev', '-z', 짝.부모[0], 짝.sha])).map((f) => [f.경로, f]));
      for (const e of 항.바뀜) {
        const f = 짝바뀜.get(e.경로);
        if (f && !맞음.has(e.경로) && 같은변화(git, 저장, e.경로, e, f)) 맞음.set(e.경로, 짝.sha);
      }
    }
    if (맞음.size) 결과.set(항.커밋, 맞음);
  }
  return 결과;
}

/**
 * 내 커밋들을 바탕 위에 다시 쌓는다. 이미 바탕 바로 위에 차례대로 이어져 있으면 그대로 쓴다(다시쌓기면 그래도 쌓는다).
 * 남이 먼저 다시 쌓아 올린 짝이 있는 경로는 「이미 올라감」으로 건너뛴다(올라간짝찾기).
 * 줄끝그대로면 원격 판 줄끝에 맞추지 않는다. 옛판아님이면 같은 줄의 옛·새 판이 함께 남아도 멈추지 않는다.
 */
function 쌓기(git, 저장, 바탕, 커밋들, { 다시쌓기 = false, 줄끝그대로 = false, 옛판아님 = false } = {}) {
  const 항목들 = 커밋들.map((c) => {
    const 부모 = git.글(['rev-parse', `${c}^`]);
    return { 커밋: c, 부모, 바뀜: 날차이읽기(git(['diff-tree', '-r', '--no-renames', '--no-abbrev', '-z', 부모, c])) };
  });
  const 하위저장소 = 항목들.flatMap((항) => 항.바뀜.filter((e) => e.옛모드 === '160000' || e.새모드 === '160000').map((e) => ({ 커밋: 항.커밋, 경로: e.경로 })));
  if (하위저장소.length) {
    return { 머리: 바탕, 그대로: false, 대응: [], 경로: [], 내변화: new Map(), 문제: 하위저장소.map((x) => ({ ...x, 이유: '하위 git 저장소(gitlink)는 이 도구로 올리지 않는다' })) };
  }
  const 내변화 = new Map();
  for (const 항 of 항목들) {
    for (const e of 항.바뀜) {
      if (!내변화.has(e.경로)) 내변화.set(e.경로, []);
      내변화.get(e.경로).push({ 옛: e.옛, 새: e.새 });
    }
  }
  const 짝 = 올라간짝찾기(git, 저장, 바탕, 항목들);
  const 마지막 = 커밋들[커밋들.length - 1];
  const 이어짐 = git.글(['rev-list', '--reverse', `${바탕}..${마지막}`]).split('\n').filter(Boolean);
  // 첫 커밋의 부모가 바탕이어야 빨리감기다(내 커밋 뒤로 바탕만 움직였으면 rev-list는 내 커밋만 내지만 그대로는 못 올린다)
  if (!다시쌓기 && !짝.size && 항목들[0].부모 === 바탕 && 이어짐.length === 커밋들.length && 이어짐.every((c, i) => c === 커밋들[i])) {
    return { 머리: 마지막, 그대로: true, 대응: 커밋들.map((c) => ({ 원래: c, 새: c })), 경로: [], 문제: [], 내변화 };
  }
  const 지금 = 트리항목들(git, 바탕, [...내변화.keys()]);
  블롭읽기(git, 저장, [...[...지금.values()].map((v) => v.sha), ...항목들.flatMap((항) => 항.바뀜.flatMap((e) => [e.옛, e.새]))]);
  const 글아님 = 글아닌경로(git, [...내변화.keys()]);
  const 인덱스 = 별도인덱스(git, 바탕);
  try {
    let 머리 = 바탕;
    const 대응 = [], 경로 = [], 문제 = [];
    for (const 항 of 항목들) {
      const 고침 = [], 올라간 = 짝.get(항.커밋) || new Map();
      const 짝표 = 올라간.size ? { 짝: [...new Set(올라간.values())] } : {};
      for (const e of 항.바뀜) {
        if (올라간.has(e.경로)) { 경로.push({ 커밋: 항.커밋, 경로: e.경로, 방법: '이미 올라감', 짝: 올라간.get(e.경로) }); continue; }
        const 현재 = 지금.get(e.경로) || null, cs = 현재 ? 현재.sha : null;
        let 자리 = null;
        const 기록 = (방법) => 경로.push({ 커밋: 항.커밋, 경로: e.경로, 방법, ...(자리 ? { 자리 } : {}) });
        const 막힘 = (이유) => 문제.push({ 커밋: 항.커밋, 경로: e.경로, 이유 });
        if (!e.새) {
          if (cs === e.옛) { 고침.push(`0 ${'0'.repeat(40)}\t${e.경로}`); 지금.delete(e.경로); 기록('지움'); }
          else if (cs === null) 기록('이미 없음');
          else 막힘('내가 지운 파일이 origin에서는 다른 판이다');
          continue;
        }
        let sha, 방법;
        if (cs === e.옛) { sha = e.새; 방법 = '내 판'; }
        else if (cs === e.새) { 기록('이미 같음'); continue; }
        else if (cs === null) { 막힘('origin에 없는 파일을 고쳤다 — 그 파일을 만든 앞 커밋이 아직 origin에 없다(내 커밋이면 같이 준다)'); continue; }
        else if (e.옛 === null) { 막힘('새로 만든 파일인데 origin에 같은 이름의 다른 파일이 있다'); continue; }
        else {
          const m = 세판합치기(git, 저장, e.경로, cs, e.옛, e.새, { 옛판아님 });
          if (m.문제) { 막힘(m.문제); continue; }
          sha = 블롭쓰기(git, 저장, m.버퍼);
          방법 = m.방법;
          자리 = m.자리 || null;
        }
        if (!줄끝그대로 && cs && /^100(644|755)$/.test(e.새모드) && !글아님.has(e.경로)) {
          const 원격판 = 블롭(git, 저장, cs), 넣을판 = 블롭(git, 저장, sha);
          if (!이진인가(원격판) && !이진인가(넣을판)) {
            const f = 줄끝맞추기(글로(원격판), 글로(넣을판));
            if (f.고친줄) { sha = 블롭쓰기(git, 저장, 바이트로(f.글)); 방법 += ` · 줄끝 ${f.고친줄}줄 맞춤`; }
          }
        }
        고침.push(`${e.새모드} ${sha}\t${e.경로}`);
        지금.set(e.경로, { 모드: e.새모드, sha });
        기록(방법);
      }
      if (문제.length) break;
      if (고침.length) git(['update-index', '-z', '--index-info'], { env: 인덱스.env, input: `${고침.join('\0')}\0` });
      const 트리 = git.글(['write-tree'], { env: 인덱스.env });
      if (트리 === git.글(['rev-parse', `${머리}^{tree}`])) { 대응.push({ 원래: 항.커밋, 새: null, ...짝표 }); continue; }
      const [이름, 메일, 날짜, ...몸] = git(['log', '-1', '--format=%an%x00%ae%x00%ad%x00%B', '--date=raw', 항.커밋]).toString('utf8').split('\0');
      const 새 = git.글(['commit-tree', 트리, '-p', 머리, '-F', '-'], {
        input: Buffer.from(`${몸.join('\0').replace(/\n+$/, '')}\n`, 'utf8'),
        env: { GIT_AUTHOR_NAME: 이름, GIT_AUTHOR_EMAIL: 메일, GIT_AUTHOR_DATE: 날짜 },
      });
      대응.push({ 원래: 항.커밋, 새, ...짝표 });
      머리 = 새;
    }
    return { 머리, 그대로: false, 대응, 경로, 문제, 내변화 };
  } finally {
    인덱스.치우기();
  }
}

/** 올릴 판(바탕..머리)을 경로마다 본다: 새는 줄·빠진 줄·줄끝(줄끝그대로면 안 본다), 그리고 저장 용량. */
async function 올릴판검사(git, 저장, 저장소, 바탕, 계획, { 줄끝그대로 = false } = {}) {
  const 문제 = [];
  const 경로들 = [...계획.내변화.keys()];
  const 바탕항 = 트리항목들(git, 바탕, 경로들), 머리항 = 트리항목들(git, 계획.머리, 경로들);
  블롭읽기(git, 저장, [...바탕항.values(), ...머리항.values()].map((v) => v.sha)
    .concat([...계획.내변화.values()].flatMap((v) => v.flatMap((x) => [x.옛, x.새]))));
  const 글아님 = 글아닌경로(git, 경로들);
  for (const p of git(['diff', '--name-only', '--no-renames', '-z', 바탕, 계획.머리]).toString('utf8').split('\0')) {
    if (p && !계획.내변화.has(p)) 문제.push({ 경로: p, 이유: '내 커밋이 바꾸지 않은 경로가 바뀐다(남의 커밋이 섞였다)' });
  }
  for (const 경로 of 경로들) {
    const b = 바탕항.get(경로), h = 머리항.get(경로);
    if ((b ? b.sha : null) === (h ? h.sha : null)) continue;
    const 변화 = 계획.내변화.get(경로);
    const bb = 블롭(git, 저장, b && b.sha), hb = 블롭(git, 저장, h && h.sha);
    if (이진인가(bb) || 이진인가(hb) || 변화.some((v) => 이진인가(블롭(git, 저장, v.옛)) || 이진인가(블롭(git, 저장, v.새)))) {
      if ((h ? h.sha : null) !== 변화[변화.length - 1].새) 문제.push({ 경로, 이유: '바이너리 파일이 내 마지막 판과 다르다' });
      continue;
    }
    let 더한 = new Map(), 뺀 = new Map();
    for (const v of 변화) {
      const p = 줄셈(줄나누기(글로(블롭(git, 저장, v.옛)))), c = 줄셈(줄나누기(글로(블롭(git, 저장, v.새))));
      더한 = 셈더하기(더한, 셈빼기(c, p));
      뺀 = 셈더하기(뺀, 셈빼기(p, c));
    }
    const 머리셈 = 줄셈(줄나누기(글로(hb))), 바탕셈 = 줄셈(줄나누기(글로(bb)));
    const 샌줄 = 넘는줄(셈빼기(머리셈, 바탕셈), 더한);
    if (샌줄 !== null) 문제.push({ 경로, 이유: `내 커밋에 없는 줄이 올라간다: ${보이게(샌줄).slice(0, 80)}` });
    const 빠진줄 = 넘는줄(셈빼기(바탕셈, 머리셈), 뺀);
    if (빠진줄 !== null) 문제.push({ 경로, 이유: `내가 지우지 않은 원격 줄이 빠진다: ${보이게(빠진줄).slice(0, 80)}` });
    if (!줄끝그대로 && b && h && !글아님.has(경로)) {
      const f = 줄끝맞추기(글로(bb), 글로(hb));
      if (f.고친줄) 문제.push({ 경로, 줄끝: true, 이유: `줄끝이 원격 판과 다른 줄이 ${f.고친줄}개다` });
    }
  }
  let 용량 = null;
  try {
    const r = await checkRepository({ base: 바탕, head: 계획.머리 }, 저장소, 기본환경());
    용량 = { 통과: r.ok, 새blob: r.newBlobs, 바이트: r.countedBytes, 위반: r.violations };
    for (const v of r.violations) 문제.push({ 경로: v.path, 이유: `저장 용량(${v.code}, ${v.bytes}바이트${v.limit ? ` · 한도 ${v.limit}` : ''})` });
  } catch (e) {
    문제.push({ 이유: `저장 용량 검사를 돌리지 못했다 — ${e.message}` });
  }
  let 공개 = null;
  try {
    공개 = await 공개검사.범위검사({ 저장소, env: 기본환경(), 바탕, 머리: 계획.머리, 공개판: 바탕 });
    if (공개.켜짐) 문제.push(...공개.걸림.map(공개문제));
  } catch (e) {
    문제.push({ 공개: true, 이유: `공개 검사를 돌리지 못했다 — ${e.message}` });
  }
  return { 문제, 용량, 공개: 공개 && 공개.켜짐 ? 공개 : null };
}

/** 공개 검사 걸림 하나 → 도구의 문제·걸림 꼴 */
function 공개문제(x) {
  return { 경로: x.줄 ? `${x.경로}:${x.줄}` : x.경로, 공개: true, 이유: `${x.설명}${x.값 ? ` ${x.값}` : ''} (공개 검사)` };
}

/** 올릴 판 검사에 걸렸을 때의 이유 — 줄끝·공개 검사면 고치는 법을 붙인다 */
function 검사멈춤이유(문제) {
  return `올릴 판 검사에 걸렸다 — 아무것도 올리지 않았다${문제.some((x) => x.줄끝) ? '(줄끝을 일부러 바꾸는 커밋이면 --줄끝그대로)' : ''}`
    + `${문제.some((x) => x.공개) ? `. 공개 검사: ${공개검사.고치는법}` : ''}`;
}

/** push한 뒤 로컬 가지에 방금 올린 머리를 「트리는 로컬 그대로」 합친다. origin의 남의 커밋이 바꾼 경로가 모두 로컬과 같을 때만. */
function 로컬합치기(git, 원격, 계획) {
  let 가지 = '';
  try { 가지 = git.글(['symbolic-ref', '-q', 'HEAD']); } catch (_) {}
  if (!가지.startsWith('refs/heads/')) return { 결과: '건너뜀', 이유: 'HEAD가 가지에 있지 않다' };
  const 머리 = git.글(['rev-parse', 'HEAD']);
  if (조상인가(git, 원격, 머리)) return { 결과: '할 것 없음', 이유: 'origin이 이미 로컬 가지 안에 있다' };
  if (!계획.대응.every((d) => 조상인가(git, d.원래, 머리))) return { 결과: '건너뜀', 이유: '올린 내 커밋이 지금 가지에 없다' };
  const 줄끝고친 = [...new Set(계획.경로.filter((x) => /줄끝/.test(x.방법)).map((x) => x.경로))];
  if (줄끝고친.length) {
    return { 결과: '건너뜀', 이유: `다시 쌓으며 줄끝을 원격 판에 맞춘 경로가 있어 로컬과 origin의 판이 다르다 — 로컬을 그대로 두고 합치면 그 줄끝이 되돌아간다`, 예: 줄끝고친.slice(0, 5) };
  }
  const 내것 = new Set(계획.대응.map((d) => d.새).filter(Boolean));
  const 남의 = git.글(['rev-list', '--first-parent', `${머리}..${원격}`]).split('\n').filter((c) => c && !내것.has(c));
  const 경로 = new Set();
  for (const c of 남의) {
    for (const p of git(['diff-tree', '-r', '--no-renames', '--name-only', '-z', `${c}^`, c]).toString('utf8').split('\0')) if (p) 경로.add(p);
  }
  const 경로들 = [...경로];
  const 로컬항 = 트리항목들(git, 머리, 경로들), 원격항 = 트리항목들(git, 원격, 경로들);
  const 다름 = 경로들.filter((p) => (로컬항.get(p) || {}).sha !== (원격항.get(p) || {}).sha);
  if (다름.length) return { 결과: '건너뜀', 이유: `origin에 있는 남의 커밋 ${남의.length}개가 바꾼 경로 가운데 ${다름.length}개가 로컬과 다르다 — 「트리는 로컬 그대로」로 합치면 그 변경이 빠진다`, 예: 다름.slice(0, 5) };
  const 트리 = git.글(['rev-parse', `${머리}^{tree}`]);
  const 글 = `Merge my pushed commits from origin (tree kept local)\n\n${계획.대응.filter((d) => d.새).map((d) => `${d.원래.slice(0, 9)} -> ${d.새.slice(0, 9)}`).join('\n')}\n`;
  const 병합 = git.글(['commit-tree', 트리, '-p', 머리, '-p', 원격, '-F', '-'], { input: Buffer.from(글, 'utf8') });
  if (git.돌리기(['update-ref', '-m', '내커밋: 올린 내 커밋을 로컬에 합침', 가지, 병합, 머리], { 허용: null }).status !== 0) {
    return { 결과: '건너뜀', 이유: '그사이 로컬 가지가 움직였다' };
  }
  return { 결과: '합침', 커밋: 병합, 가지 };
}

/**
 * 옵션: 저장소 · 커밋들[](해시·참조·a..b) · 실행 · 합치기 · 줄끝그대로 · 옛판아님 · 원격(origin) · 가지(master)
 */

module.exports = { 커밋풀기, 세판합치기, 같은셈, 같은변화, 올라간짝찾기, 쌓기, 올릴판검사, 공개문제, 검사멈춤이유, 로컬합치기 };

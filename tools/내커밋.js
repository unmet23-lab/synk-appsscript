#!/usr/bin/env node
'use strict';
/**
 * 내커밋 — 여러 세션이 함께 쓰는 작업본에서 내 파일만 커밋하고, 내 커밋만 origin에 올린다.
 *
 *   node tools/내커밋.js 커밋 <경로…> -m "<메시지>"                  미리 보기(커밋하지 않는다)
 *   node tools/내커밋.js 커밋 <경로…> -m "<메시지>" --실행            커밋
 *   node tools/내커밋.js 커밋 … --조각 docs/_ops/트랙.md=a1b2c3       그 파일은 고른 조각만 올린다
 *   node tools/내커밋.js 올리기 <커밋…>                               미리 보기(fetch만 한다)
 *   node tools/내커밋.js 올리기 <커밋…> --실행 [--합치기]              내 커밋만 origin/master에 push
 *   공통: --json · --저장소 <폴더>(기본: 지금 폴더의 저장소) · --줄끝그대로(줄끝을 일부러 바꾸는 커밋만)
 *   커밋: -F <메시지 파일> · --폴더(폴더 아래 바뀐 파일이 모두 내 것일 때만) · --자세히(바뀐 파일마다 조각을 보인다)
 *   올리기: --원격 <이름>(기본 origin) · --가지 <이름>(기본 master) · --옛판아님(앞 60자가 같은 원격 줄이 옛·새 판이 아니라 다른 줄일 때만)
 *   git 2.31 이상(커밋)·2.43 이상(올리기, merge-file --object-id)이 필요하다.
 *
 * 커밋 — 공용 인덱스(git add → git commit)를 쓰지 않는다.
 *   1. HEAD를 바탕으로 고정하고 별도 인덱스(GIT_INDEX_FILE)에 바탕을 읽는다.
 *   2. 지정한 경로만 올린다. 여러 세션이 같이 고치는 문서(아래 공용문서)는 통째로 올리지 않는다.
 *      미리 보기가 보여 주는 조각 가운데 내 것만 --조각으로 고르면 바탕 판에 그 조각만 얹는다.
 *      폴더 경로는 그 아래 남의 파일이 섞일 수 있어 --폴더 없이는 파일 목록만 보이고 멈춘다. 하위 저장소(gitlink)는 올리지 않는다.
 *   3. 줄끝은 바탕 판을 따른다. 바탕에 있던 줄은 바탕 줄끝 그대로, 새 줄은 이웃 줄을 따른다. 맞추고 나니 바탕과 같으면 커밋하지 않는다.
 *   4. 저장 용량 검사(`npm run check:storage`와 같은 tools/git-storage-check.cjs)와 공개 검사(tools/공개검사.js — 더한 줄과 메시지에
 *      개인정보·학생 명단·미공개 특허가 있으면 멈춤)를 별도 인덱스로 돌린다.
 *   5. commit-tree(훅이 돌지 않는다) → update-ref CAS. 그사이 HEAD가 움직였으면 새 HEAD로 처음부터 한다(세 번까지).
 *   6. 곧바로 공용 인덱스의 그 경로만 새 HEAD에 맞춘다(git reset -q -- 경로). 못 맞추면 가지를 되돌린다.
 *   index.lock은 tools/git잠금.js로 가려 기다리고, 주인 없는 잠금만 한 번 치운다.
 *   공용 인덱스에 내 경로의 다른 스테이징이 있으면 아무것도 하지 않는다(남이 올려 둔 것일 수 있다).
 *   꼬리 없는 공용 작업본(메인 작업본의 가지가 받아 둔 origin 같은 이름 가지의 조상)에서는 커밋하지 않고 멈춘다 — 로컬 master에
 *   커밋을 쌓으면 꼬리가 다시 생긴다. 2026-10-20 꼬리를 정리한 뒤로는 공용 작업본도 tools/바로올리기.js로 커밋·push한다(같은 경로·조각).
 *
 * 올리기 — 작업본·공용 인덱스·로컬 가지는 건드리지 않는다(--합치기만 로컬 가지에 병합 커밋 하나를 더한다).
 *   미리 보기도 fetch로 refs/remotes/origin/master를 새로 하고, 다시 쌓은 blob·커밋 객체를 저장소에 쓴다(어느 가지도 가리키지 않는다).
 *   1. origin/master를 fetch한다. 내 커밋이 origin/master 바로 위에 이어져 있으면 그대로 올리고, 아니면 별도 인덱스로
 *      origin/master 위에 내 커밋의 바뀐 경로만 다시 쌓는다(같은 메시지·작성자). 남의 미푸시 커밋은 올라가지 않는다.
 *      그대로 올릴 커밋에 줄끝만 원격 판과 다른 줄이 있으면 줄끝을 맞춰 다시 쌓는다.
 *   2. 남이 내 커밋을 먼저 다시 쌓아 올렸으면(origin에 작성자·작성 시각·제목이 같은 짝 커밋) 짝이 같은 변화를 한 경로는
 *      「이미 올라감」으로 건너뛴다. 짝이 안 건드렸거나 다르게 바꾼 경로만 다시 쌓는다(일부만 올라간 커밋).
 *   3. 경로마다: 원격 판이 내 부모 판과 같으면 내 판, 다르면 git merge-file. 문서가 겹치면 원격에도 있는 앞뒤 줄에 맞춰 붙인다.
 *      원격이 같은 자리에 이미 더한 줄을 내 커밋도 품었으면(원격에만 있던 줄을 작업본에 같이 넣은 것) 그 줄은 한 번만 둔다.
 *      문서에서 내가 새로 더한 줄과 원격만 새로 더한 줄이 앞 60자가 같은 채 함께 남으면 같은 줄의 옛·새 판으로 보고 멈춘다.
 *      덧붙이기 장부(.jsonl)는 양쪽이 바탕 끝에 줄을 더하기만 했으면 원격 줄 뒤에 원격에 아직 없는 내 줄만 붙인다(장부덧붙이기).
 *   4. 검사: 올라갈 줄은 모두 내 커밋에서 온 줄(남의 미푸시 줄이 새지 않음) · 내 줄이 빠지지 않음 · 줄끝은 원격 판을 따름 ·
 *      저장 용량(git-storage-check.cjs --base origin/master --head <올릴 머리>) · 공개 검사(tools/공개검사.js, origin 판 대비 더한 줄과 메시지).
 *   5. --실행이면 빨리감기 push(강제 없음). 그새 origin이 움직였으면 다시 fetch해 처음부터 한다(세 번까지).
 *   6. --합치기: origin에 있는 남의 커밋이 바꾼 경로가 모두 로컬과 같을 때만 로컬 가지에 「트리는 로컬 그대로」 병합 커밋을 더한다.
 *      다시 쌓으며 줄끝을 맞춘 경로가 있으면 로컬과 origin 판이 달라 합치지 않는다.
 *
 * 함정과 고친 기록: docs/현장노트/git_줄끝_잠금.md. 시험: node --test tests/내커밋.test.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const 잠금도구 = require('./git잠금.js');
const { checkRepository } = require('./git-storage-check.cjs');
const 공개검사 = require('./공개검사.js');

const { 공용문서, 맞춰붙일문서, 장부꼴, 차이한도, 겹침찾기한도, 판머리길이, 짝찾기여유, 영, 위치환경, 좋은결과, 멈춤, 사용법오류, 기본환경, 잠깐, git도구, 저장소찾기, 경로맞추기, 별도인덱스, 날차이읽기, 트리항목들, 블롭읽기, 블롭, 블롭쓰기, 글아닌경로, 조상인가, 꼬리없는공용가지, 바로올리기안내, git버전확인, 글로, 바이트로, 보이게, 이진인가, 줄나누기, 줄잇기, 줄바꿈채우기, 줄차이, 마이어스, 조각나누기, 조각만들기, 고름읽기, 고름맞추기, 조각얹기, 줄끝맞추기, 줄셈, 셈빼기, 셈더하기, 넘는줄, 줄셈검사, 뚜렷한줄, 맞닿은겹침, 더한줄자리, 고친줄걷기, 자리맞춰붙이기, 장부덧붙이기, 판머리, 다른판줄, 갈린곳, 공용문서인가, 조각보기, 메시지만들기, 공용인덱스항목, 남의스테이징, 잠금기다리기, 공용인덱스맞추기, 작업본맞추기 } = require('./lib/git-commit-core.cjs');
const { 커밋풀기, 세판합치기, 같은셈, 같은변화, 올라간짝찾기, 쌓기, 올릴판검사, 공개문제, 검사멈춤이유, 로컬합치기 } = require('./lib/git-commit-plan.cjs');

async function 커밋한번(c) {
  const { git } = c;
  for (const f of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'BISECT_LOG']) {
    if (fs.existsSync(path.join(c.gitdir, f))) throw new 멈춤(`진행 중인 git 작업이 있다(${f}) — 끝난 뒤 다시 한다`);
  }
  let 가지 = '';
  try { 가지 = git.글(['symbolic-ref', '-q', 'HEAD']); } catch (_) {}
  if (!가지.startsWith('refs/heads/')) throw new 멈춤('HEAD가 가지에 있지 않다(분리된 HEAD)');
  const 바탕 = git.글(['rev-parse', '--verify', 'HEAD^{commit}']);
  const 인덱스 = 별도인덱스(git, 바탕);
  const 저장 = new Map();
  try {
    const 통째 = c.경로들.filter((p) => !c.조각.has(p) || c.조각.get(p) === '전부');
    const 고른 = c.경로들.filter((p) => c.조각.has(p) && c.조각.get(p) !== '전부');
    const 읽은판 = new Map();
    for (const p of 통째) {
      try { const 파일 = path.join(c.저장소, p); if (fs.statSync(파일).isFile()) 읽은판.set(p, fs.readFileSync(파일)); } catch (_) {}
    }
    if (통째.length) {
      const r = git.돌리기(['--literal-pathspecs', 'add', '-A', '--pathspec-from-file=-', '--pathspec-file-nul'],
        { env: 인덱스.env, input: `${통째.join('\0')}\0`, 허용: null });
      if (r.status !== 0) throw new 멈춤(`경로를 올리지 못했다 — ${String(r.stderr).trim().split('\n').filter((l) => !/^warning:/.test(l)).join(' ')}`);
    }

    const 조각들 = [];
    const 바탕항 = 트리항목들(git, 바탕, 고른);
    for (const p of 고른) {
      const 파일 = path.join(c.저장소, p);
      if (!fs.existsSync(파일) || !fs.statSync(파일).isFile()) throw new 멈춤(`${p}: 작업본에 파일이 없다 — 조각은 있는 파일에서만 고른다`);
      const 항 = 바탕항.get(p);
      const 바탕블롭 = 항 ? 블롭(git, 저장, 항.sha) : Buffer.alloc(0);
      const 새 = fs.readFileSync(파일);
      if (이진인가(새) || 이진인가(바탕블롭)) throw new 멈춤(`${p}: 바이너리라 조각을 고를 수 없다`);
      const { B, N, 묶음 } = 조각만들기(글로(바탕블롭), 글로(새));
      const 고름 = 고름맞추기(c.조각.get(p), 묶음, p);
      let 글 = 줄잇기(조각얹기(B, N, 묶음, 고름));
      if (항 && !c.줄끝그대로) 글 = 줄끝맞추기(글로(바탕블롭), 글).글;
      const sha = 블롭쓰기(git, 저장, 바이트로(글));
      git(['update-index', '--add', '--cacheinfo', `${항 ? 항.모드 : '100644'},${sha},${p}`], { env: 인덱스.env });
      조각들.push(조각보기(p, 묶음, B, N, 고름));
    }

    const 차이 = () => 날차이읽기(git(['diff-index', '--cached', '--no-renames', '--no-abbrev', '-z', 바탕], { env: 인덱스.env }));
    let 바뀜 = 차이();
    const 밖 = 바뀜.filter((e) => !c.경로들.some((p) => e.경로 === p || e.경로.startsWith(`${p}/`)));
    if (밖.length) throw new 멈춤(`준 경로 밖이 섞였다: ${밖.map((e) => e.경로).join(', ')}`);
    if (!바뀜.length) return { 결과: '커밋할 것 없음', 이유: '준 경로가 바탕과 같다', 가지, 바탕 };
    const 하위저장소 = 바뀜.filter((e) => e.옛모드 === '160000' || e.새모드 === '160000');
    if (하위저장소.length) throw new 멈춤(`하위 git 저장소(gitlink)가 섞였다 — 이 도구로 올리지 않는다: ${하위저장소.map((e) => e.경로).join(', ')}`);
    const 정확히 = new Set(c.경로들);
    const 폴더에서 = 바뀜.filter((e) => !정확히.has(e.경로));
    if (폴더에서.length && !c.폴더) {
      return {
        결과: '멈춤', 가지, 바탕, 폴더파일: 폴더에서.map((e) => ({ 경로: e.경로, 상태: !e.옛 ? '추가' : !e.새 ? '지움' : '수정' })),
        이유: '폴더 경로는 그 아래 바뀐 파일을 모두 올린다 — 남의 미커밋 수정·새 파일이 섞일 수 있다. 아래 파일 가운데 내 것만 하나씩 주거나, 모두 내 것이면 --폴더를 붙인다',
      };
    }

    블롭읽기(git, 저장, 바뀜.flatMap((e) => [e.옛, e.새]));
    const 막힌 = [];
    for (const e of 바뀜) {
      if (!e.옛 || c.조각.has(e.경로) || !공용문서인가(e.경로)) continue;
      const 파일 = path.join(c.저장소, e.경로);
      const 새 = e.새 && fs.existsSync(파일) ? fs.readFileSync(파일) : Buffer.alloc(0);
      const { B, N, 묶음 } = 조각만들기(글로(블롭(git, 저장, e.옛)), 글로(새));
      막힌.push(조각보기(e.경로, 묶음, B, N, null));
    }
    if (막힌.length) {
      return {
        결과: '멈춤', 가지, 바탕, 조각보기: 막힌,
        이유: `여러 세션이 같이 고치는 문서는 통째로 올리지 않는다(${막힌.map((x) => x.경로).join(', ')}) — 아래 조각 가운데 내 것만 --조각 <경로>=<조각>[,<조각>…]으로 고른다. 그 파일의 바뀐 곳이 모두 내 것이면 =전부, 조각 안 일부 줄만이면 <조각>:<줄>-<줄>`,
      };
    }

    const 글아님 = 글아닌경로(git, 바뀜.filter((e) => e.옛 && e.새).map((e) => e.경로));
    const 줄끝고침 = [];
    for (const e of c.줄끝그대로 ? [] : 바뀜) {
      if (!e.옛 || !e.새 || c.조각.has(e.경로) && c.조각.get(e.경로) !== '전부') continue;
      if (!/^100(644|755)$/.test(e.새모드) || 글아님.has(e.경로)) continue;
      const 바탕블롭 = 블롭(git, 저장, e.옛), 새블롭 = 블롭(git, 저장, e.새);
      if (이진인가(바탕블롭) || 이진인가(새블롭)) continue;
      const r = 줄끝맞추기(글로(바탕블롭), 글로(새블롭));
      if (!r.고친줄) continue;
      e.새 = 블롭쓰기(git, 저장, 바이트로(r.글));
      git(['update-index', '--cacheinfo', `${e.새모드},${e.새},${e.경로}`], { env: 인덱스.env });
      줄끝고침.push({ 경로: e.경로, 줄: r.고친줄 });
    }
    if (줄끝고침.length) {
      바뀜 = 차이();
      for (const x of 줄끝고침) if (!바뀜.some((e) => e.경로 === x.경로)) x.빠짐 = true;
      if (!바뀜.length) {
        return {
          결과: '커밋할 것 없음', 가지, 바탕, 줄끝고침,
          이유: '줄끝만 바탕과 다르다 — 바탕 판의 줄끝을 따르면 바뀐 것이 없다(줄끝을 일부러 바꾸는 커밋이면 --줄끝그대로)',
        };
      }
    }

    const 수 = new Map();
    const 칸 = git(['diff', '--cached', '--numstat', '--no-renames', '-z', 바탕], { env: 인덱스.env }).toString('utf8').split('\0');
    for (const 줄 of 칸) {
      const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(줄);
      if (m) 수.set(m[3], { 더함: m[1] === '-' ? null : Number(m[1]), 뺌: m[2] === '-' ? null : Number(m[2]) });
    }
    const 파일 = 바뀜.map((e) => ({
      경로: e.경로, 상태: !e.옛 ? '추가' : !e.새 ? '지움' : '수정', ...(수.get(e.경로) || {}),
      ...(c.조각.has(e.경로) && c.조각.get(e.경로) !== '전부' ? { 조각: true } : {}),
    }));
    if (c.자세히) {
      for (const e of 바뀜) {
        if (!e.옛 || !e.새 || 조각들.some((x) => x.경로 === e.경로)) continue;
        const 바탕블롭 = 블롭(git, 저장, e.옛), 새블롭 = 블롭(git, 저장, e.새);
        if (이진인가(바탕블롭) || 이진인가(새블롭)) continue;
        const { B, N, 묶음 } = 조각만들기(글로(바탕블롭), 글로(새블롭));
        조각들.push(조각보기(e.경로, 묶음, B, N, new Map(묶음.map((_, k) => [k, true]))));
      }
    }

    let 용량, 공개;
    try {
      용량 = await checkRepository({ cached: true, base: 바탕 }, c.저장소, { ...기본환경(), GIT_INDEX_FILE: 인덱스.파일 });
    } catch (e) {
      throw new 멈춤(`저장 용량 검사를 돌리지 못했다 — ${e.message}`);
    }
    try {
      공개 = await 공개검사.범위검사({ 저장소: c.저장소, env: { ...기본환경(), GIT_INDEX_FILE: 인덱스.파일 }, 바탕, 메시지들: [c.메시지] });
    } catch (e) {
      throw new 멈춤(`공개 검사를 돌리지 못했다 — ${e.message}`);
    }
    const 요약 = {
      가지, 바탕, 파일, 줄끝고침, 조각보기: 조각들,
      용량: { 통과: 용량.ok, 새blob: 용량.newBlobs, 바이트: 용량.countedBytes, 위반: 용량.violations },
      ...(공개.켜짐 ? { 공개 } : {}),
    };
    if (!용량.ok) return { 결과: '멈춤', 이유: '저장 용량 검사에 걸렸다(tools/git-storage-policy.json, docs/_ops/github-storage/README.md)', ...요약 };
    if (공개.켜짐 && 공개.걸림.length) {
      return { 결과: '멈춤', 이유: `공개 저장소에 올리면 안 되는 내용이 있어 커밋하지 않았다 — ${공개검사.고치는법}`, 걸림: 공개.걸림.map(공개문제), ...요약 };
    }
    const 스테이징이유 = '공용 인덱스에 내 경로의 다른 스테이징이 있다 — 남이 올려 둔 것일 수 있어 손대지 않았다. 내가 전에 git add한 판이면 git reset -q -- <경로>로 내린 뒤 다시 한다';
    let 걸림 = 남의스테이징(git, 바뀜);
    if (걸림.length) return { 결과: '멈춤', 이유: 스테이징이유, 걸림, ...요약 };
    if (!c.실행) return { 결과: '미리 보기', ...요약 };
    if (!c.메시지) throw new 사용법오류('커밋 메시지가 없다(-m "…" 또는 -F 파일)');

    const 잠금 = 잠금기다리기(c, c.한도.커밋전);
    if (!잠금.풀림) return { 결과: '멈춤', 이유: `공용 인덱스 잠금이 풀리지 않아 커밋하지 않았다 — ${잠금.이유}`, ...요약 };
    걸림 = 남의스테이징(git, 바뀜);
    if (걸림.length) return { 결과: '멈춤', 이유: 스테이징이유, 걸림, ...요약 };
    if (git.글(['rev-parse', 'HEAD']) !== 바탕) return { 결과: '다시' };
    const 트리 = git.글(['write-tree'], { env: 인덱스.env });
    const 새커밋 = git.글(['commit-tree', 트리, '-p', 바탕, '-F', '-'], { input: Buffer.from(c.메시지, 'utf8') });
    if (c.고리.커밋직전) c.고리.커밋직전();
    const 제목 = c.메시지.split('\n')[0].slice(0, 80);
    if (git.돌리기(['update-ref', '-m', `내커밋: ${제목}`, 가지, 새커밋, 바탕], { 허용: null }).status !== 0) return { 결과: '다시' };
    if (c.고리.커밋직후) c.고리.커밋직후();

    const 맞춤 = 공용인덱스맞추기(c, 바뀜.map((e) => e.경로));
    if (!맞춤.됨) {
      const 되돌림 = git.돌리기(['update-ref', '-m', '내커밋: 공용 인덱스를 못 맞춰 되돌림', 가지, 바탕, 새커밋], { 허용: null }).status === 0;
      return {
        결과: '실패', 커밋: 새커밋, ...요약, 되돌림,
        이유: `공용 인덱스를 새 HEAD에 맞추지 못했다(${맞춤.이유}) — ${되돌림
          ? '가지를 원래대로 되돌렸다. 작업본은 그대로니 잠금이 풀린 뒤 다시 한다'
          : `가지를 되돌리지 못했다(그사이 다른 커밋이 올라감). 곧바로 git reset -q -- <경로>로 공용 인덱스를 맞춘다: ${바뀜.map((e) => e.경로).join(' ')}`}`,
      };
    }
    // 여기부터는 커밋과 공용 인덱스 맞추기가 끝난 뒤다. 실패해도 결과는 「커밋함」으로 두고 주의로 알린다.
    const 주의 = [];
    let 작업본 = { 다시씀: [], 못씀: [] };
    try { 작업본 = 작업본맞추기(c, 새커밋, 줄끝고침, 읽은판); } catch (e) { 주의.push(`작업본 줄끝을 맞추지 못했다 — ${e.message}`); }
    try {
      const 내경로 = new Set(바뀜.map((e) => e.경로));
      const 남은 = git(['diff', '--cached', '--name-only', '--no-renames', '-z']).toString('utf8').split('\0').filter((p) => 내경로.has(p));
      if (남은.length) 주의.push(`공용 인덱스에서 아직 HEAD와 다른 내 경로: ${남은.join(', ')}`);
    } catch (e) {
      주의.push(`공용 인덱스를 다시 확인하지 못했다 — ${e.message}`);
    }
    return { 결과: '커밋함', 커밋: 새커밋, ...요약, 작업본, ...(주의.length ? { 주의: 주의.join(' / ') } : {}) };
  } finally {
    인덱스.치우기();
  }
}

/**
 * 옵션: 저장소 · 경로들[] · 조각(Map|[[경로, 값]]) · 메시지(글|글[]) · 메시지파일 · 실행 · 자세히
 * 시험용: 잠깐(ms) · 잠금살피기() · 잠금한도ms {커밋전, 맞춤} · 시험고리 {커밋직전, 커밋직후}
 */
async function 커밋(옵션 = {}) {
  try {
    const 저장소 = 저장소찾기(옵션.저장소 || process.cwd());
    const 기준폴더 = 옵션.저장소 ? 저장소 : process.cwd();
    const git = git도구(저장소);
    const 조각 = new Map();
    for (const [p, v] of (옵션.조각 instanceof Map ? [...옵션.조각] : (옵션.조각 || []))) {
      const 경로 = 경로맞추기(저장소, p, 기준폴더);
      const 고름 = typeof v === 'string' ? 고름읽기(v) : v;
      const 있던 = 조각.get(경로);
      if (있던 === '전부' || 고름 === '전부') { 조각.set(경로, '전부'); continue; }
      if (있던) for (const [id, 줄] of 고름) 있던.set(id, 있던.get(id) === true || 줄 === true ? true : new Set([...(있던.get(id) || []), ...줄]));
      else 조각.set(경로, 고름);
    }
    const 경로들 = [...new Set([...(옵션.경로들 || []).map((p) => 경로맞추기(저장소, p, 기준폴더)), ...조각.keys()])];
    if (!경로들.length) throw new 사용법오류('커밋할 경로를 준다');
    git버전확인(git, [2, 31], '--path-format=absolute');
    const 꼬리없음 = 꼬리없는공용가지(git);
    if (꼬리없음) {
      return {
        결과: '멈춤', 가지: `refs/heads/${꼬리없음.가지}`,
        이유: `공용 작업본 ${꼬리없음.가지}가 ${꼬리없음.원격}의 조상이다(꼬리 없음, 2026-10-20 정리) — 로컬 ${꼬리없음.가지}에 커밋을 쌓으면 꼬리가 다시 생겨 커밋하지 않았다. `
          + `커밋과 push를 한 번에 한다: ${바로올리기안내(경로들, 조각, 옵션)} (미리 보기를 보고 --실행을 붙인다. 조각 id는 이 도구와 같다)`,
      };
    }
    const [gitdir, 인덱스파일] = git.글(['rev-parse', '--path-format=absolute', '--git-dir', '--git-path', 'index']).split('\n');
    const 잠금 = `${path.resolve(인덱스파일)}.lock`;
    const c = {
      git, 저장소, gitdir: path.resolve(gitdir), 경로들, 조각, 실행: Boolean(옵션.실행), 자세히: Boolean(옵션.자세히),
      폴더: Boolean(옵션.폴더), 줄끝그대로: Boolean(옵션.줄끝그대로),
      메시지: 메시지만들기({ ...옵션, 기준폴더 }), 고리: 옵션.시험고리 || {}, 잠깐: 옵션.잠깐 || 잠깐,
      잠금살피기: 옵션.잠금살피기 || (() => 잠금도구.살피기(저장소, { 잠금 })),
      한도: { 커밋전: 20000, 맞춤: 30000, ...(옵션.잠금한도ms || {}) },
    };
    if (c.실행 && !c.메시지) throw new 사용법오류('커밋 메시지가 없다(-m "…" 또는 -F 파일)');
    for (let 차례 = 1; 차례 <= 3; 차례++) {
      const r = await 커밋한번(c);
      if (r.결과 !== '다시') return 차례 > 1 ? { ...r, 다시한수: 차례 - 1 } : r;
    }
    return { 결과: '멈춤', 이유: 'HEAD가 계속 움직여 세 번 모두 커밋하지 못했다(작업본은 그대로)' };
  } catch (e) {
    if (e instanceof 멈춤) return { 결과: '멈춤', 이유: e.이유, ...e.덧 };
    throw e;
  }
}

// ── 올리기 ──────────────────────────────────────────────────────────────────

async function 올리기(옵션 = {}) {
  try {
    const 저장소 = 저장소찾기(옵션.저장소 || process.cwd());
    const git = git도구(저장소);
    git버전확인(git, [2, 43], 'merge-file --object-id');
    const 원격 = 옵션.원격 || 'origin', 원격가지 = 옵션.가지 || 'master';
    const 추적 = `refs/remotes/${원격}/${원격가지}`;
    const 원래 = 커밋풀기(git, 옵션.커밋들 || []);
    if (!원래.length) throw new 사용법오류('올릴 커밋을 준다');
    const 줄끝그대로 = Boolean(옵션.줄끝그대로), 옛판아님 = Boolean(옵션.옛판아님);
    const 저장 = new Map();
    for (let 차례 = 1; 차례 <= 3; 차례++) {
      const f = git.돌리기(['fetch', '-q', 원격, `+refs/heads/${원격가지}:${추적}`], { 허용: null });
      if (f.status !== 0) throw new 멈춤(`fetch 실패 — ${String(f.stderr).trim()}`);
      const 바탕 = git.글(['rev-parse', '--verify', `${추적}^{commit}`]);
      const 남은 = 원래.filter((c) => !조상인가(git, c, 바탕));
      if (!남은.length) return { 결과: '올릴 것 없음', 이유: '준 커밋이 모두 이미 origin에 있다', 바탕 };
      const 차례맞춘 = git.글(['rev-list', '--topo-order', '--reverse', ...남은, `^${바탕}`]).split('\n').filter((c) => 남은.includes(c));
      let 계획 = 쌓기(git, 저장, 바탕, 차례맞춘, { 줄끝그대로, 옛판아님 });
      let 검사 = 계획.문제.length || 계획.머리 === 바탕 ? null : await 올릴판검사(git, 저장, 저장소, 바탕, 계획, { 줄끝그대로 });
      if (계획.그대로 && 검사 && 검사.문제.length && 검사.문제.every((x) => x.줄끝)) {
        // origin 바로 위의 내 커밋에 줄끝만 원격 판과 다른 줄이 있다: 그대로 올리지 않고 줄끝을 맞춰 다시 쌓는다
        계획 = 쌓기(git, 저장, 바탕, 차례맞춘, { 다시쌓기: true, 옛판아님 });
        검사 = 계획.문제.length || 계획.머리 === 바탕 ? null : await 올릴판검사(git, 저장, 저장소, 바탕, 계획);
      }
      let 로컬만 = [];
      try {
        const 지금머리 = git.글(['rev-parse', 'HEAD']);
        로컬만 = git.글(['rev-list', `${바탕}..${지금머리}`]).split('\n').filter((c) => c && !원래.includes(c));
      } catch (_) {}
      const 요약 = {
        원격: `${원격}/${원격가지}`, 바탕, 머리: 계획.머리, 그대로: 계획.그대로, 대응: 계획.대응, 경로: 계획.경로,
        남의미푸시: 로컬만.length,
        ...(차례 > 1 ? { 다시한수: 차례 - 1 } : {}),
      };
      if (계획.문제.length) return { 결과: '멈춤', 이유: 'origin 위에 다시 쌓지 못한 경로가 있다 — 아무것도 올리지 않았다', 문제: 계획.문제, ...요약 };
      if (계획.머리 === 바탕) return { 결과: '올릴 것 없음', 이유: '준 커밋의 내용이 이미 origin에 다 있다', ...요약 };
      const 공개 = 검사.공개 ? { 공개: 검사.공개 } : {};
      if (검사.문제.length) return { 결과: '멈춤', 이유: 검사멈춤이유(검사.문제), 문제: 검사.문제, 용량: 검사.용량, ...공개, ...요약 };
      if (!옵션.실행) return { 결과: '미리 보기', 용량: 검사.용량, ...공개, ...요약 };
      const p = git.돌리기(['push', '--porcelain', 원격, `${계획.머리}:refs/heads/${원격가지}`], { 허용: null });
      const 출력 = `${p.stdout}\n${p.stderr}`;
      if (p.status !== 0) {
        if (/non-fast-forward|fetch first|\[rejected\]/.test(출력) && 차례 < 3) continue;
        return { 결과: '멈춤', 이유: `push가 거절됐다 — ${출력.trim().split('\n').slice(-3).join(' / ')}`, ...요약 };
      }
      // 여기부터는 push가 끝난 뒤다. 실패해도 결과는 「올림」으로 두고 주의로 알린다.
      const r = { 결과: '올림', 용량: 검사.용량, ...공개, ...요약 };
      try {
        r.원격머리 = git.글(['ls-remote', 원격, `refs/heads/${원격가지}`]).split(/\s/)[0];
        r.확인 = r.원격머리 === 계획.머리;
      } catch (e) {
        r.주의 = `push는 됐지만 ls-remote로 다시 확인하지 못했다 — ${e.message}`;
      }
      if (옵션.합치기) {
        try {
          r.합치기 = r.확인 ? 로컬합치기(git, 계획.머리, 계획)
            : { 결과: '건너뜀', 이유: r.원격머리 ? `ls-remote가 올린 머리가 아니다(${짧게(r.원격머리)}) — 그새 누가 올렸다` : 'origin 머리를 확인하지 못했다' };
        } catch (e) {
          r.합치기 = { 결과: '건너뜀', 이유: `로컬 합치기 중 오류 — ${e.message}` };
        }
      }
      return r;
    }
    return { 결과: '멈춤', 이유: 'origin이 계속 움직여 세 번 모두 올리지 못했다' };
  } catch (e) {
    if (e instanceof 멈춤) return { 결과: '멈춤', 이유: e.이유, ...e.덧 };
    throw e;
  }
}

// ── 명령줄 ──────────────────────────────────────────────────────────────────

const 사용법 = `사용법
  node tools/내커밋.js 커밋 <경로…> -m "<메시지>" [--조각 <경로>=<조각,…>] [--폴더] [--자세히] [--줄끝그대로] [--실행] [--json]
  node tools/내커밋.js 올리기 <커밋…> [--합치기] [--줄끝그대로] [--옛판아님] [--실행] [--json]
  기본은 미리 보기다. --실행을 붙여야 커밋·push한다.
  --조각: 미리 보기가 보여 준 조각 id. 조각 안 일부 줄은 <id>:<줄>-<줄>, 그 파일의 바뀐 곳이 모두 내 것이면 <경로>=전부.
  --폴더: 준 폴더 아래 바뀐 파일이 모두 내 것일 때만. 없으면 폴더 경로는 파일 목록을 보이고 멈춘다.
  --줄끝그대로: 줄끝을 일부러 바꾸는 커밋(재정규화)일 때만. 바탕·원격 판 줄끝에 맞추지 않는다.
  --옛판아님: 올리기가 「원격에 같은 머리의 다른 판 줄이 있다」로 멈췄는데 두 줄이 옛·새 판이 아니라 다른 줄일 때만.
  자세한 설명은 파일 머리.`;

function 인자읽기(argv) {
  const [명령, ...나머지] = argv;
  if (!명령 || 명령 === '--help' || 명령 === '-h' || 명령 === '도움말') return { 도움말: true };
  if (!['커밋', '올리기'].includes(명령)) throw new 사용법오류(`모르는 명령: ${명령} (커밋 · 올리기)`);
  const 옵션 = { 명령, 위치: [], 메시지: [], 조각: [], 실행: false, json: false, 자세히: false, 합치기: false, 폴더: false, 줄끝그대로: false, 옛판아님: false };
  for (let i = 0; i < 나머지.length; i++) {
    const a = 나머지[i];
    const 값 = () => {
      if (i + 1 >= 나머지.length) throw new 사용법오류(`${a} 뒤에 값이 없다`);
      return 나머지[++i];
    };
    if (a === '--') { 옵션.위치.push(...나머지.slice(i + 1)); break; }
    else if (a === '-m' || a === '--메시지') 옵션.메시지.push(값());
    else if (a === '-F' || a === '--메시지파일') 옵션.메시지파일 = 값();
    else if (a === '--조각') {
      const v = 값(), k = v.lastIndexOf('=');
      if (k <= 0) throw new 사용법오류(`--조각은 <경로>=<조각,…> 꼴이다: ${v}`);
      옵션.조각.push([v.slice(0, k), 고름읽기(v.slice(k + 1))]);
    }
    else if (a === '--실행') 옵션.실행 = true;
    else if (a === '--json') 옵션.json = true;
    else if (a === '--자세히') 옵션.자세히 = true;
    else if (a === '--합치기') 옵션.합치기 = true;
    else if (a === '--폴더') 옵션.폴더 = true;
    else if (a === '--줄끝그대로') 옵션.줄끝그대로 = true;
    else if (a === '--옛판아님') 옵션.옛판아님 = true;
    else if (a === '--저장소') 옵션.저장소 = 값();
    else if (a === '--원격') 옵션.원격 = 값();
    else if (a === '--가지') 옵션.가지 = 값();
    else if (a.startsWith('-')) throw new 사용법오류(`모르는 인자: ${a}`);
    else 옵션.위치.push(a);
  }
  if (명령 === '커밋') {
    if (옵션.합치기 || 옵션.원격 || 옵션.가지 || 옵션.옛판아님) throw new 사용법오류('--합치기·--원격·--가지·--옛판아님은 올리기에만 쓴다');
    if (!옵션.위치.length && !옵션.조각.length) throw new 사용법오류('커밋할 경로를 준다');
    옵션.경로들 = 옵션.위치;
  } else {
    if (옵션.메시지.length || 옵션.메시지파일 || 옵션.조각.length || 옵션.자세히 || 옵션.폴더) throw new 사용법오류('-m·-F·--조각·--폴더·--자세히는 커밋에만 쓴다');
    if (!옵션.위치.length) throw new 사용법오류('올릴 커밋을 준다');
    옵션.커밋들 = 옵션.위치;
  }
  return 옵션;
}

const 짧게 = (sha) => (sha ? sha.slice(0, 9) : '');

function 조각글(보기) {
  const 줄 = [`${보기.경로} — 바탕 대비 조각 ${보기.조각.length}개`];
  for (const 조 of 보기.조각) {
    줄.push(`  [${조.id}] ${조.행}행 ${조.뺀 ? `−${조.뺀} ` : ''}${조.더한 ? `+${조.더한}` : ''}`.trimEnd());
    // 조각 안 줄 번호로 고르므로 줄은 하나도 빼지 않고 다 보인다(긴 줄만 자른다)
    for (const l of 조.줄) {
      const 글 = l.글.length > 140 ? `${l.글.slice(0, 140)}…` : l.글;
      줄.push(`    ${String(l.번호).padStart(3)} ${l.표}${l.고름 ? '✓' : ' '} ${글}`);
    }
  }
  return 줄.join('\n');
}

function 커밋글(r) {
  const 머리 = {
    '미리 보기': '[미리 보기] 아직 커밋하지 않았다 — 같은 명령에 --실행을 붙이면 커밋한다',
    '커밋함': `[커밋함] ${짧게(r.커밋)}`,
    '커밋할 것 없음': `[커밋할 것 없음] ${r.이유 || ''}`,
    '멈춤': `[멈춤] ${r.이유}`,
    '실패': `[실패] ${r.이유}`,
  }[r.결과] || `[${r.결과}] ${r.이유 || ''}`;
  const 줄 = [머리];
  if (r.가지) 줄.push(`가지 ${r.가지.replace(/^refs\/heads\//, '')} · 바탕 ${짧게(r.바탕)}${r.다시한수 ? ` · HEAD가 움직여 ${r.다시한수}번 다시 함` : ''}`);
  if (r.파일 && r.파일.length) {
    줄.push(`올릴 경로 ${r.파일.length}개`);
    for (const f of r.파일) {
      const 수 = f.더함 == null ? '바이너리' : `+${f.더함} −${f.뺌}`;
      줄.push(`  ${f.상태}  ${f.경로}  ${수}${f.조각 ? '  (고른 조각만)' : ''}`);
    }
  }
  for (const x of r.폴더파일 || []) 줄.push(`  ${x.상태}  ${x.경로}`);
  for (const x of r.줄끝고침 || []) 줄.push(`줄끝을 바탕 판에 맞춤: ${x.경로} ${x.줄}줄${x.빠짐 ? ' — 맞추고 나니 바탕과 같아 커밋에서 빠짐' : ''}`);
  if (r.용량) {
    줄.push(r.용량.통과 ? `저장 용량 검사 통과 — 새 blob ${r.용량.새blob}개 · ${r.용량.바이트}바이트`
      : `저장 용량 검사 걸림: ${r.용량.위반.map((v) => `${v.path || '(합계)'} ${v.code} ${v.bytes}바이트`).join(', ')}`);
  }
  if (r.공개) 줄.push(공개검사.요약글(r.공개));
  for (const x of r.걸림 || []) 줄.push(`  ${x.경로} — ${x.이유}`);
  if (r.결과 === '커밋함') {
    줄.push('공용 인덱스의 내 경로를 새 HEAD에 맞췄다(남의 스테이징·미커밋 수정은 그대로)');
    for (const p of (r.작업본 && r.작업본.다시씀) || []) 줄.push(`작업본 줄끝도 새 판으로 맞춤: ${p}`);
    for (const x of (r.작업본 && r.작업본.못씀) || []) 줄.push(`작업본 줄끝을 못 맞춤: ${x.경로} — ${x.이유}`);
  }
  if (r.주의) 줄.push(`주의: ${r.주의}`);
  for (const 보기 of r.조각보기 || []) 줄.push(조각글(보기));
  return 줄.join('\n');
}

function 올리기글(r) {
  const 머리 = {
    '미리 보기': '[미리 보기] 아직 올리지 않았다 — 같은 명령에 --실행을 붙이면 push한다',
    '올림': `[올림] ${r.원격} ← ${짧게(r.머리)}${r.확인 ? '' : ` (주의: ls-remote가 ${짧게(r.원격머리)}다)`}`,
    '올릴 것 없음': `[올릴 것 없음] ${r.이유 || ''}`,
    '멈춤': `[멈춤] ${r.이유}`,
  }[r.결과] || `[${r.결과}] ${r.이유 || ''}`;
  const 줄 = [머리];
  if (r.바탕) 줄.push(`origin 바탕 ${짧게(r.바탕)}${r.다시한수 ? ` · origin이 움직여 ${r.다시한수}번 다시 함` : ''}`);
  if (r.대응 && r.대응.length) {
    const 올라간수 = r.대응.filter((d) => !d.새 && d.짝).length;
    줄.push(r.그대로 ? `내 커밋 ${r.대응.length}개가 origin 바로 위에 이어져 있어 그대로 올린다`
      : `origin 위에 내 커밋 ${r.대응.length}개를 다시 쌓음${올라간수 ? `(남이 먼저 올린 ${올라간수}개는 건너뜀)` : ''}`);
    for (const d of r.그대로 ? [] : r.대응) {
      const 짝 = d.짝 ? d.짝.map(짧게).join('·') : '';
      const 곳 = d.새 ? `${짧게(d.새)}${짝 ? ` (일부 경로는 origin ${짝}에 이미 올라감)` : ''}`
        : 짝 ? `(이미 올라감: origin ${짝})` : '(같은 내용이 이미 origin에 있어 건너뜀)';
      줄.push(`  ${짧게(d.원래)} → ${곳}`);
    }
    if (!r.그대로 && r.결과 === '미리 보기') 줄.push('  (새 커밋 번호는 실행 때 다시 만들어 달라진다 — 원격 CI는 실행 출력의 번호로 본다)');
  }
  const 방법수 = new Map();
  for (const x of r.경로 || []) 방법수.set(x.방법, (방법수.get(x.방법) || 0) + 1);
  if (방법수.size) 줄.push(`경로: ${[...방법수].map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  const 줄일 = (s) => (s.length > 60 ? `${s.slice(0, 60)}…` : s);
  for (const x of (r.경로 || []).filter((x) => x.방법 !== '내 판')) {
    줄.push(`  ${x.방법}: ${x.경로}${x.짝 ? ` (origin ${짧게(x.짝)})` : ''}`);
    for (const 자 of x.자리 || []) {
      const 곳 = 자.앞줄 === null ? '파일 맨 앞에' : `「${줄일(자.앞줄)}」 다음에`;
      const 이미 = 자.이미있음 ? ` (원격에 이미 있는 내 줄 ${자.이미있음}개는 한 번만)` : '';
      줄.push(자.줄수 ? `    ${곳} 「${줄일(자.내줄)}」${자.줄수 > 1 ? ` 외 ${자.줄수 - 1}줄` : ''}${이미}` : `    ${곳} 넣을 줄 없음 — 내 줄 ${자.이미있음}개가 모두 원격에 이미 있다`);
    }
  }
  for (const x of r.문제 || []) 줄.push(`  문제${x.커밋 ? ` ${짧게(x.커밋)}` : ''}${x.경로 ? ` ${x.경로}` : ''} — ${x.이유}`);
  if (r.용량) 줄.push(r.용량.통과 ? `저장 용량 검사 통과 — 새 blob ${r.용량.새blob}개 · ${r.용량.바이트}바이트` : '저장 용량 검사 걸림');
  if (r.공개) 줄.push(공개검사.요약글(r.공개));
  if (r.결과 === '미리 보기' || r.결과 === '올림') 줄.push('검사: 올라갈 줄은 모두 내 커밋의 줄 · 내 줄 빠짐 없음 · 줄끝은 원격 판을 따름');
  if (r.남의미푸시) 줄.push(`로컬 가지에만 있는 다른 커밋 ${r.남의미푸시}개는 올리지 않는다`);
  if (r.합치기) {
    줄.push(`로컬 합치기: ${r.합치기.결과}${r.합치기.커밋 ? ` ${짧게(r.합치기.커밋)}` : ''}${r.합치기.이유 ? ` — ${r.합치기.이유}` : ''}`);
    if (r.합치기.예) 줄.push(`  예: ${r.합치기.예.join(', ')}`);
  }
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
    r = 옵션.명령 === '커밋' ? await 커밋(옵션) : await 올리기(옵션);
  } catch (e) {
    if (e instanceof 사용법오류) { console.error(`${e.message}\n${사용법}`); return 2; }
    r = { 결과: '실패', 이유: e.message };
  }
  console.log(옵션.json ? JSON.stringify(r, null, 2) : 옵션.명령 === '커밋' ? 커밋글(r) : 올리기글(r));
  return 좋은결과.has(r.결과) ? 0 : 1;
}

if (require.main === module) main().then((code) => { process.exitCode = code; });

module.exports = {
  커밋, 올리기, 인자읽기, main,
  줄나누기, 줄잇기, 줄차이, 조각나누기, 조각만들기, 고름읽기, 조각얹기, 줄끝맞추기, 자리맞춰붙이기, 장부덧붙이기, 줄셈검사, 다른판줄, 공용문서인가,
  _시험: { git도구, 쌓기, 올릴판검사, 올라간짝찾기, 커밋글, 올리기글 },
  // tools/바로올리기.js(와 은퇴한 tools/master맞추기.js 옛 판)가 같이 쓰는 git·줄·잠금 도우미
  _도구: {
    git도구, 저장소찾기, 경로맞추기, 기본환경, 잠깐, 별도인덱스, 날차이읽기, 블롭읽기, 블롭, 블롭쓰기, 글아닌경로, 조상인가, git버전확인,
    공용인덱스항목, 잠금기다리기, 공용인덱스맞추기, 줄바꿈채우기, 줄셈, 뚜렷한줄, 셈빼기, 셈더하기, 넘는줄, 글로, 바이트로, 보이게, 이진인가, 멈춤, 사용법오류,
    트리항목들, 고름맞추기, 조각보기, 메시지만들기, 세판합치기, 남의스테이징, 꼬리없는공용가지, 바로올리기안내, 검사멈춤이유,
  },
};

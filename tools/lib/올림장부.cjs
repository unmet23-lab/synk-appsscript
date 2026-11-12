'use strict';
/**
 * 올림 장부(2026-11-12) — 이 작업본이 origin에 올리는 커밋을 그 작업본 git 폴더(워크트리면 .git/worktrees/<이름>)의
 * 바로올리기-올림.jsonl에 한 줄씩 적는다. git에는 어느 세션이 올렸는지 표시가 없어서, 검수 사슬 합침 고리
 * (tools/검수묶음.mjs 다시 --합침만 — 마지막 검수 고리를 만든 작업본에서만 받는다)가 앞 검수 뒤 이 작업본이 올린 커밋을 「자기 커밋」으로 가를 때 읽는다.
 *
 * origin/master에 push하는 저장소 도구 둘이 같이 쓴다 — 바로올리기(tools/lib/git-publish-core.cjs)와 내커밋 올리기(tools/내커밋.js).
 * 두 도구는 push **직전에** 올릴 커밋을 적고, 못 적으면 올리지 않는다(적지 못한 채 올라간 커밋은 합침만이 남의 커밋으로 본다 — GPT 검수 GA2).
 * push가 거절되면 안 올라간 커밋 이름이 남지만, 그 이름이 origin 범위에 나타나려면 바로 그 커밋이 올라가야 하니 가르는 방향이 옳다.
 * 덧붙이기만 한다 — 돌리거나(.1) 지우지 않는다(돌리며 옛 기록을 덮으면 자기 커밋이 조용히 빠진다 — GPT 검수 GA1). 한 줄 150바이트 남짓이라 수천 번 올려도 몇 MB.
 * 덧붙이기 전에 파일 끝이 줄바꿈이 아니면(앞 기록이 쓰다 잘림) 줄바꿈부터 넣어, 잘린 줄이 다음 기록을 삼키지 않게 하고 디스크까지 써 둔다(Fable v3 설계 검토).
 * 읽기는 파일이 없으면 빈 것, 못 읽거나 깨진 줄이 있으면 못읽음에 적는다(「올린 것 없음」으로 넘기지 않는다 — 잘린 줄은 손으로 지울 때까지 합침만을 막는다).
 */
const fs = require('fs');
const path = require('path');

const 파일이름 = '바로올리기-올림.jsonl';
const 커밋꼴 = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

/** 커밋들을 한 번에 덧붙인다. 커밋 이름 꼴이 아니거나 못 쓰면 던진다 — 부르는 쪽은 그때 올리지 않는다. */
function 적기(gitdir, 커밋들, { 바탕 = null, 원격 = null, 가지 = null } = {}) {
  if (!커밋들.length) return;
  for (const 커밋 of 커밋들) if (!커밋꼴.test(String(커밋))) throw new Error(`커밋 이름 꼴이 아니다: ${String(커밋).slice(0, 80)}`);
  const 때 = new Date().toISOString();
  const 글 = 커밋들.map((커밋) => `${JSON.stringify({ 때, 커밋, 바탕, 원격, 가지 })}\n`).join('');
  const fd = fs.openSync(path.join(gitdir, 파일이름), 'a+');
  try {
    const 크기 = fs.fstatSync(fd).size;
    let 앞에 = '';
    if (크기 > 0) {
      const 끝 = Buffer.alloc(1);
      fs.readSync(fd, 끝, 0, 1, 크기 - 1);
      if (끝[0] !== 0x0a) 앞에 = '\n';
    }
    // 쓴 바이트 수를 끝까지 센다 — 디스크 · 파일 크기 한도에서 일부만 쓰고 돌아오면 남은 것을 이어 쓰고, 더 못 쓰면 던져 push를 막는다(GPT 장부 검수 GA1).
    // 잘려 남은 줄은 다음 적기가 줄바꿈으로 떼고, 읽기는 깨진 줄로 보아 합침만을 막는다.
    const 바이트 = Buffer.from(앞에 + 글, 'utf8');
    for (let 쓴 = 0; 쓴 < 바이트.length;) {
      const n = fs.writeSync(fd, 바이트, 쓴, 바이트.length - 쓴);
      if (!(n > 0)) throw new Error(`올림 장부를 끝까지 쓰지 못했다(${쓴}/${바이트.length}바이트)`);
      쓴 += n;
    }
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
}

/** gitdir 하나의 장부. 빈 줄은 넘기고, 못 읽은 파일 · 깨진 줄은 못읽음에 적는다. */
function 읽기(gitdir) {
  const 커밋들 = [], 못읽음 = [];
  let 글;
  try { 글 = fs.readFileSync(path.join(gitdir, 파일이름), 'utf8'); } catch (e) {
    if (e.code !== 'ENOENT') 못읽음.push(`${파일이름} ${e.code || e.message}`);
    return { 커밋들, 못읽음 };
  }
  for (const 줄 of 글.split(/\r?\n/)) {
    if (!줄.trim()) continue;
    let x = null;
    try { x = JSON.parse(줄); } catch (_) { /* 아래에서 못읽음 */ }
    if (typeof x?.커밋 !== 'string' || !커밋꼴.test(x.커밋)) { 못읽음.push(`${파일이름} 깨진 줄`); break; }
    커밋들.push(x.커밋);
  }
  return { 커밋들, 못읽음 };
}

module.exports = { 파일이름, 적기, 읽기 };

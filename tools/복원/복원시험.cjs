#!/usr/bin/env node
'use strict';
/**
 * 복원 시험 — 드라이브에 올라간 암호문을 유호님 암호로 실제로 풀어, 원본과 해시로 대조하고 푼 평문을 바로 지운다. 터미널에서 암호를 한 번 묻는다.
 *   node tools/복원/복원시험.cjs [--폴더 <시험 폴더>] [--묶음 열쇠,비공개문서,창고장부] [--암호파일 <파일>]
 * 결과는 상태/복원꾸러미/복원시험.json에 남는다(값 · 경로 내용 없이 수만). 비밀 값은 화면과 기록에 내지 않는다.
 * 받기는 77yuhbs에서 하고, 열쇠 묶음은 unmet23 G: 판도 함께 푼 것과 같은지 본다. 시험 뒤 시험 폴더는 무엇이 있든 통째로 지운다.
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const 풀기 = require('./복원풀기.cjs');

function 인자(argv) {
  const 값 = { 폴더: 'D:\\복원시험\\암호시험', 묶음: ['열쇠', '비공개문서', '창고장부'], 암호파일: null, 집: process.env.SYNK_복원_집 || os.homedir() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--폴더') 값.폴더 = argv[++i];
    else if (a === '--묶음') 값.묶음 = argv[++i].split(',').filter(Boolean);
    else if (a === '--암호파일') 값.암호파일 = argv[++i];
    else if (a === '--집') 값.집 = argv[++i];
    else throw new Error(`모르는 인자: ${a}`);
  }
  return 값;
}

function 해시(f) { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); }

/** 풀린 집과 진짜 집을 대조한다. 그사이 바뀐 파일은 「바뀜」으로 세고, 같은 크기 · 시각인데 내용이 다르면 「다름」이다. */
function 대조(풀린곳, 집) {
  const 결과 = { 파일: 0, 같음: 0, 바뀜: 0, 없음: 0, 다름: 0, 다른파일: [] };
  const 더미 = [''];
  while (더미.length) {
    const 상대 = 더미.pop();
    for (const e of fs.readdirSync(path.join(풀린곳, 상대), { withFileTypes: true })) {
      const rel = path.join(상대, e.name);
      if (e.isDirectory()) { if (rel !== '.synk-복원') 더미.push(rel); continue; }
      결과.파일++;
      const 원 = path.join(집, rel), 풀림 = path.join(풀린곳, rel);
      let st;
      try { st = fs.statSync(원); } catch { 결과.없음++; continue; }
      const 풀린st = fs.statSync(풀림);
      if (st.size === 풀린st.size && 해시(원) === 해시(풀림)) { 결과.같음++; continue; }
      if (Math.abs(st.mtimeMs - 풀린st.mtimeMs) > 1500) { 결과.바뀜++; continue; }
      결과.다름++;
      if (결과.다른파일.length < 20) 결과.다른파일.push(rel);
    }
  }
  return 결과;
}

function 비우기(곳) {
  if (!곳 || path.parse(곳).root === path.resolve(곳)) throw new Error('시험 폴더가 이상하다');
  fs.rmSync(곳, { recursive: true, force: true });
}

async function main() {
  const 값 = 인자(process.argv.slice(2));
  const 시작 = Date.now();
  비우기(값.폴더);
  const 풀린곳 = path.join(값.폴더, '집');
  const 받는곳 = path.join(값.폴더, '받음');
  fs.mkdirSync(풀린곳, { recursive: true });
  const 표 = { 때: new Date().toISOString(), 묶음: 값.묶음 };
  try {
    console.log(`드라이브에서 받는 중: ${값.묶음.join(' · ')}`);
    const r = spawnSync(process.env.SYNK_복원_파이썬 || 'python', ['-X', 'utf8', '-B', path.join(__dirname, '암호묶음.py'), '받기', ...값.묶음, '--폴더', 받는곳],
      { encoding: 'utf8', windowsHide: true });
    if (r.status !== 0) throw new Error('드라이브 받기 실패');
    표.받음 = JSON.parse(String(r.stdout).trim().split('\n').pop());
    const 합 = await 풀기.돌리기({ 집: 풀린곳, 폴더: 값.묶음.map((n) => path.join(받는곳, n)), 받기: [], 임시: path.join(값.폴더, '임시'), 암호파일: 값.암호파일,
      비밀키: path.join(값.집, '.synk-backup-key', '비밀키_잠금.json') });
    표.풀기 = 합;
    console.log('원본과 해시 대조 중');
    표.대조 = 대조(풀린곳, 값.집);
    표.걸린초 = Math.round((Date.now() - 시작) / 1000);
    표.성공 = 표.대조.다름 === 0 && 합.손상 === 0 && 합.실패 === 0 && 합.거절 === 0 && 합.풀림 > 0;
  } finally {
    // 푼 평문은 어떤 경우에도 남기지 않는다
    비우기(값.폴더);
    표.평문지움 = !fs.existsSync(값.폴더);
    const 상태 = path.join(값.집, 'Documents', 'SYNK_원본창고', '상태', '복원꾸러미', '복원시험.json');
    fs.mkdirSync(path.dirname(상태), { recursive: true });
    fs.writeFileSync(상태, JSON.stringify(표, null, 1));
    console.log(JSON.stringify(표, null, 1));
  }
  console.log(표.성공 ? '\n복원 시험 통과 — 이 창을 닫으셔도 됩니다.' : '\n복원 시험에서 문제가 나왔습니다. 위 결과를 Claude에게 보여 주세요.');
  process.exitCode = 표.성공 ? 0 : 1;
}

if (require.main === module) main().catch((e) => { console.error(`실패: ${e.message}`); process.exitCode = 1; });

module.exports = { 대조 };

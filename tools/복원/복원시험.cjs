#!/usr/bin/env node
'use strict';
/**
 * 복원 시험 — 드라이브에 올라간 암호문을 유호님 암호로 실제로 풀어, 원본과 해시로 대조하고 푼 평문을 바로 지운다. 터미널에서 암호를 한 번 묻는다.
 *   node tools/복원/복원시험.cjs [--폴더 <시험 폴더>] [--묶음 열쇠,비공개문서,창고장부] [--암호파일 <파일>] [--받은곳 <이미 받은 폴더>] [--비밀키 <비밀키_잠금.json>]
 * 결과는 상태/복원꾸러미/복원시험.json에 남는다(값 · 경로 내용 없이 수만). 비밀 값은 화면과 기록에 내지 않는다.
 * 받기는 77yuhbs에서 한다. 시험 폴더는 이 도구가 표지를 넣어 만든 곳만 쓰고 지운다(표지 없는 폴더를 주면 손대지 않고 멈춘다). 푼 평문은 끝나면 바로 지운다.
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const 풀기 = require('./복원풀기.cjs');

function 인자(argv) {
  const 값 = { 폴더: 'D:\\복원시험\\암호시험', 묶음: ['열쇠', '비공개문서', '창고장부'], 암호파일: null, 받은곳: null, 비밀키: null, 집: process.env.SYNK_복원_집 || os.homedir() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--폴더') 값.폴더 = argv[++i];
    else if (a === '--묶음') 값.묶음 = argv[++i].split(',').filter(Boolean);
    else if (a === '--암호파일') 값.암호파일 = argv[++i];
    else if (a === '--집') 값.집 = argv[++i];
    else if (a === '--받은곳') 값.받은곳 = argv[++i];
    else if (a === '--비밀키') 값.비밀키 = argv[++i];
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
      // 복원할 때 자리를 옮긴 OneDrive 사본(암호묶음.py RESTORE_REMAP)은 원래 자리와 견준다
      const 재배치 = `SYNK복원_작업기록${path.sep}`;
      const 원 = path.join(집, rel.startsWith(재배치) ? path.join('OneDrive', rel.slice(재배치.length)) : rel), 풀림 = path.join(풀린곳, rel);
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

/** 묶음 장부(파일상태.json)에 적힌 파일이 풀린 곳에 다 있는지 센다. */
function 장부대조(풀린곳, 집, 묶음들) {
  const 결과 = {};
  for (const 묶음 of 묶음들) {
    let 장부;
    try { 장부 = JSON.parse(fs.readFileSync(path.join(집, 'Documents', 'SYNK_원본창고', '상태', '복원꾸러미', 묶음, '파일상태.json'), 'utf8')); } catch { continue; }
    const 이름들 = Object.keys(장부);
    const 없음 = 이름들.filter((n) => !fs.existsSync(path.join(풀린곳, ...n.replace(/^OneDrive\//, 'SYNK복원_작업기록/').split('/'))));
    결과[묶음] = { 장부: 이름들.length, 없음: 없음.length, 표본: 없음.slice(0, 5) };
  }
  return 결과;
}

const 표지 = '.복원시험-폴더';

/** 시험 폴더를 새로 만든다. 이미 있으면 이 도구가 만든 곳(표지가 있는 곳)만 비운다. */
function 폴더준비(곳) {
  const 전체 = path.resolve(곳);
  if (path.parse(전체).root === 전체) throw new Error('드라이브 맨 위는 시험 폴더로 쓰지 않습니다');
  if (fs.existsSync(전체)) {
    if (!fs.existsSync(path.join(전체, 표지))) throw new Error(`복원 시험이 만든 폴더가 아니라 손대지 않습니다: ${전체}`);
    fs.rmSync(전체, { recursive: true, force: true });
  }
  fs.mkdirSync(전체, { recursive: true });
  fs.writeFileSync(path.join(전체, 표지), '복원시험.cjs가 만든 임시 폴더입니다. 끝나면 통째로 지웁니다.\n');
}

function 비우기(곳) {
  if (fs.existsSync(path.join(곳, 표지))) fs.rmSync(곳, { recursive: true, force: true });
}

async function main() {
  const 값 = 인자(process.argv.slice(2));
  const 시작 = Date.now();
  폴더준비(값.폴더);
  const 풀린곳 = path.join(값.폴더, '집');
  const 받는곳 = 값.받은곳 || path.join(값.폴더, '받음');
  fs.mkdirSync(풀린곳, { recursive: true });
  const 표 = { 때: new Date().toISOString(), 묶음: 값.묶음 };
  try {
    if (!값.받은곳) {
      console.log(`드라이브에서 받는 중: ${값.묶음.join(' · ')}`);
      const r = spawnSync(process.env.SYNK_복원_파이썬 || 'python', ['-X', 'utf8', '-B', path.join(__dirname, '암호묶음.py'), '받기', ...값.묶음, '--폴더', 받는곳, '--집', 값.집],
        { encoding: 'utf8', windowsHide: true });
      if (r.status !== 0) throw new Error('드라이브 받기 실패');
      표.받음 = JSON.parse(String(r.stdout).trim().split('\n').pop());
    }
    const 합 = await 풀기.돌리기({ 집: 풀린곳, 폴더: 값.묶음.map((n) => path.join(받는곳, n)), 받기: [], 임시: path.join(값.폴더, '임시'), 암호파일: 값.암호파일,
      비밀키: 값.비밀키 || path.join(값.집, '.synk-backup-key', '비밀키_잠금.json') });
    표.풀기 = 합;
    console.log('원본과 해시 대조 중');
    표.대조 = 대조(풀린곳, 값.집);
    표.장부누락 = 장부대조(풀린곳, 값.집, 값.묶음); // 장부에는 올렸다고 적혔는데 안 풀린 파일. 시험 중에 올라간 조각이면 생길 수 있어 숫자만 알린다
    표.걸린초 = Math.round((Date.now() - 시작) / 1000);
    표.성공 = 표.대조.다름 === 0 && 합.손상 === 0 && 합.실패 === 0 && 합.거절 === 0 && 합.조각실패 === 0 && 합.풀림 > 0;
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

module.exports = { 대조, 장부대조 };

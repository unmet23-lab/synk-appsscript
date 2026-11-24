'use strict';
// 플로우영상(tools/플로우영상.js) 점검 — LAB 편 전체 영상의 샷 계획 · 지시문 · 시작 그림을 굽기 전에 본다(브라우저 · 크레딧 없음).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 점검, jpg크기 } = require('../tools/플로우영상.js');

const TOOL = path.join(__dirname, '..', 'tools', '플로우영상.js');
const 공통 = 'Mongle has NO mouth, NO arms, NO legs, ever.';

/** 가로 · 세로만 맞춘 최소 JPEG(SOI + SOF0 + EOI) */
function jpeg(w, h) {
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof, Buffer.from([0xff, 0xd9])]);
}

function 편(계획, 지시, 그림 = { s1: [1080, 1920] }) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), '플로우영상-'));
  const 편폴더 = path.join(base, 'LAB_가_mn_20261126');
  fs.mkdirSync(path.join(편폴더, 'remotion'), { recursive: true });
  fs.mkdirSync(path.join(편폴더, '영상칸', '시작'), { recursive: true });
  for (const [이름, [w, h]] of Object.entries(그림)) fs.writeFileSync(path.join(편폴더, '영상칸', '시작', `${이름}.jpg`), jpeg(w, h));
  if (계획) fs.writeFileSync(path.join(편폴더, '영상칸', '계획.json'), JSON.stringify(계획));
  if (지시) fs.writeFileSync(path.join(편폴더, '영상칸', '지시문.json'), JSON.stringify(지시));
  return { base, 편폴더 };
}
const 칸 = (over = {}) => ({ model: 'Omni 1.2 Flash', n: 1, cost: '12', dur: '4초', proj: 'omni', start: 's1', key: 'jumps up in shock', ...over });
const 글 = (id = 'S1', prompt = 'Mongle jumps up in shock.') => ({ 공통, 클립: [{ id, prompt }] });

test('맞는 계획은 걸림 없이 지나가고 합과 예산(기본 180)을 센다', () => {
  const { base, 편폴더 } = 편({ S1: 칸() }, 글());
  try {
    const r = 점검(편폴더);
    assert.deepEqual(r.문제, []);
    assert.deepEqual(r.칸, ['S1']);
    assert.equal(r.합, 12);
    assert.equal(r.예산, 180);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('Omni가 아닌 모델 · 길이와 맞지 않는 값 · 예산 넘침은 걸린다', () => {
  const { base, 편폴더 } = 편({ _예산: 20, S1: 칸({ model: 'Veo 3.1 - Quality', cost: '100' }), S2: 칸({ dur: '8초', cost: '12', key: 'second shot' }) },
    { 공통, 클립: [{ id: 'S1', prompt: 'Mongle jumps up in shock.' }, { id: 'S2', prompt: 'Mongle waits, second shot.' }] });
  try {
    const r = 점검(편폴더).문제.join('\n');
    assert.match(r, /S1: 모델이 Omni 1\.2 Flash가 아님/);
    assert.match(r, /S1: cost가 12이어야 함/);
    assert.match(r, /S2: cost가 24이어야 함/);
    assert.match(r, /계획 합 112이 편 예산 20을 넘음/);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('시작 · 끝 그림이 없거나 9:16이 아니면 걸린다', () => {
  const { base, 편폴더 } = 편({ S1: 칸({ start: 's1', end: 'e1' }), S2: 칸({ start: 'wide', key: 'wide shot' }) },
    { 공통, 클립: [{ id: 'S1', prompt: 'Mongle jumps up in shock.' }, { id: 'S2', prompt: 'A wide shot.' }] }, { s1: [1080, 1920], wide: [1920, 1080] });
  try {
    const r = 점검(편폴더).문제.join('\n');
    assert.match(r, /S1: 끝 그림 영상칸\/시작\/e1\.jpg가 없음/);
    assert.match(r, /S2: 시작 그림이 9:16이 아님\(1920x1080\)/);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('key는 제 글에 한 번만, 다른 칸 글에는 없어야 하고, 몽글 「NO mouth」 공통 글이 있어야 한다', () => {
  const { base, 편폴더 } = 편({ S1: 칸({ key: 'shock' }), S2: 칸({ key: 'missing phrase' }) },
    { 공통: 'No text.', 클립: [{ id: 'S1', prompt: 'Mongle jumps up in shock.' }, { id: 'S2', prompt: 'Friends laugh in shock.' }] });
  try {
    const r = 점검(편폴더).문제.join('\n');
    assert.match(r, /S1: key가 S2 글에도 있음/);
    assert.match(r, /S2: key가 이 칸 글에 한 번이 아님/);
    assert.match(r, /S1: 지시문에 몽글의 「NO mouth」가 없음/);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('계획 · 지시문이 없으면 읽기 걸림만 내고, 명령줄 「점검」은 종료 1 · 맞으면 0', () => {
  const { base, 편폴더 } = 편(null, null);
  try {
    assert.match(점검(편폴더).문제.join('\n'), /계획\.json을 못 읽음/);
    assert.equal(spawnSync(process.execPath, [TOOL, '점검', 편폴더], { encoding: 'utf8' }).status, 1);
    fs.writeFileSync(path.join(편폴더, '영상칸', '계획.json'), JSON.stringify({ S1: 칸() }));
    fs.writeFileSync(path.join(편폴더, '영상칸', '지시문.json'), JSON.stringify(글()));
    const ok = spawnSync(process.execPath, [TOOL, '점검', 편폴더], { encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.equal(spawnSync(process.execPath, [TOOL, '모르는명령', 편폴더], { encoding: 'utf8' }).status, 2);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('jpg크기는 SOF 머리에서 가로 · 세로를 읽는다', () => {
  const f = path.join(os.tmpdir(), `플로우영상-${process.pid}.jpg`);
  try {
    fs.writeFileSync(f, jpeg(1080, 1920));
    assert.deepEqual(jpg크기(f), { w: 1080, h: 1920 });
    fs.writeFileSync(f, Buffer.from('not a jpeg'));
    assert.equal(jpg크기(f), null);
  } finally { fs.rmSync(f, { force: true }); }
});

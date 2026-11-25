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
const 공통 = fs.readFileSync(path.join(__dirname, '..', 'docs', '마케팅', 'LAB_하루두편_설계_20261110', '영상_공통글.txt'), 'utf8').trim();

/** 가로 · 세로만 맞춘 최소 JPEG(SOI + SOF0 + EOI) */
function jpeg(w, h) {
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof, Buffer.from([0xff, 0xd9])]);
}

function 편(계획, 지시, 그림 = { s1: [1080, 1920] }, 날짜 = '20261125') {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), '플로우영상-'));
  const 편폴더 = path.join(base, `LAB_가_mn_${날짜}`);
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

test('key는 제 글에 한 번만, 다른 칸 글에는 없어야 하고, 몽글 기본 얼굴(코 · 입 없음) 글이 있어야 한다', () => {
  const { base, 편폴더 } = 편({ S1: 칸({ key: 'shock' }), S2: 칸({ key: 'missing phrase' }) },
    { 공통: 'No text.', 클립: [{ id: 'S1', prompt: 'Mongle jumps up in shock.' }, { id: 'S2', prompt: 'Friends laugh in shock.' }] });
  try {
    const r = 점검(편폴더).문제.join('\n');
    assert.match(r, /S1: key가 S2 글에도 있음/);
    assert.match(r, /S2: key가 이 칸 글에 한 번이 아님/);
    assert.match(r, /S1: 지시문에 몽글의 기본 얼굴\(코 · 입 없음\) 글이 없음/);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('영상 공통 글은 표정을 막지 않고, 「NO mouth … ever」가 든 글은 멈추지 않고 알린다(11-25 유호님)', () => {
  const { base, 편폴더 } = 편({ S1: 칸() }, 글());
  const 옛 = 편({ S1: 칸() }, { 공통: 'Mongle has NO mouth, NO arms, NO legs, NO hands and NO neck, ever.', 클립: 글().클립 });
  try {
    assert.deepEqual(점검(편폴더).알림, []);
    const r = 점검(옛.편폴더);
    assert.deepEqual(r.문제, []);
    assert.match(r.알림.join('\n'), /S1: 「NO mouth … ever」가 표정을 막는다/);
  } finally { fs.rmSync(base, { recursive: true, force: true }); fs.rmSync(옛.base, { recursive: true, force: true }); }
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

// 배우는 말 칸은 천천히(11-26 유호님 「너무 빨라서 조금만 천천히」 → 「넣어 줘」)
const 말 = (over = {}) => ({ 말: '얼어 죽겠다', 한글: '얼어 죽겠다!', 읽기: 'өрө жуккэтта!', 뜻: 'Хөлдөж үхлээ!', 초: 3.5, 칸: ['S1'], 음성: ['f5', 'f5b'], ...over });
const 배움편 = (말들, 날짜 = '20261126') => 편({ ...(말들 === undefined ? {} : { _배우는말: 말들 }), S1: 칸() }, 글(), undefined, 날짜);

test('11-26 편부터 _배우는말이 없으면 걸리고, 그 앞 편은 지나간다', () => {
  const 새 = 배움편(undefined); const 옛 = 배움편(undefined, '20261125'); const 빈 = 배움편([]);
  try {
    assert.match(점검(새.편폴더).문제.join('\n'), /_배우는말이 없음/);
    assert.deepEqual(점검(옛.편폴더).문제, []);
    assert.match(점검(빈.편폴더).문제.join('\n'), /_배우는말이 빈 목록/);
  } finally { for (const x of [새, 옛, 빈]) fs.rmSync(x.base, { recursive: true, force: true }); }
});

test('규칙에 맞는 배우는 말 칸은 걸림 없이 지나가고, 아직 못 잰 목소리는 알리기만 한다', () => {
  const { base, 편폴더 } = 배움편([말()]);
  try {
    const r = 점검(편폴더);
    assert.deepEqual(r.문제, []);
    assert.deepEqual(r.칸, ['S1']);
    assert.match(r.알림.join('\n'), /목소리 f5를 아직 못 잼/);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('「추울 때」 옛 칸(2.8초 · 뜻 두 줄 · 초당 25자)은 걸리고 필요한 길이를 알려 준다', () => {
  const { base, 편폴더 } = 배움편([
    말({ 초: 2.8, 뜻: 'Хөлдөж үхлээ!\n(= аймаар хүйтэн — хэтрүүлж хэлдэг үг)' }),
    말({ 말: '이불 밖은', 한글: '이불 밖은 위험해…', 읽기: 'ибул баккын вихөмхэ…', 뜻: 'Хөнжлөөс гарвал аюултай…', 초: 3.5 }),
  ]);
  try {
    const r = 점검(편폴더).문제.join('\n');
    assert.match(r, /「얼어 죽겠다」: 칸이 3\.5초 넘어야 함\(지금 2\.8\)/);
    assert.match(r, /「얼어 죽겠다」: 글 72자가 초당 25\.71자/);
    assert.match(r, /「얼어 죽겠다」: 뜻은 한 줄만/);
    assert.match(r, /「이불 밖은」: 글 54자가 초당 15\.43자 — 13자 안이 되게 글을 줄이거나 4\.2초로 늘림/);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('칸은 계획의 샷이어야 하고 샷 합보다 길 수 없으며, 목소리는 두 줄을 적는다', () => {
  const { base, 편폴더 } = 배움편([말({ 칸: ['S9'] }), 말({ 말: '손', 초: 4.5 }), 말({ 말: '발', 음성: 'f5' })]);
  try {
    const r = 점검(편폴더).문제.join('\n');
    assert.match(r, /「얼어 죽겠다」: 칸에 계획의 샷 이름을 적음\(없는 샷: S9\)/);
    assert.match(r, /「손」: 4\.5초인데 샷\(S1\)은 4초/);
    assert.match(r, /「발」: 음성에 첫째와 천천히 한 번 더/);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('편 코드의 at · to와 목소리 빠르기까지 본다 — 같은 말이 다시 나오면 긴 칸으로 본다', () => {
  const { base, 편폴더 } = 배움편([말(), 말({ 말: '깜짝이야', 한글: '깜짝이야!', 음성: ['m1', 's1'] }), 말({ 말: '엄마야', 한글: '엄마야!', 음성: ['m3', 'm3b'] })]);
  try {
    const src = path.join(편폴더, 'remotion', 'src', 'film');
    const vo = path.join(편폴더, 'remotion', 'public', 'vo');
    fs.mkdirSync(src, { recursive: true });
    fs.mkdirSync(vo, { recursive: true });
    fs.writeFileSync(path.join(src, 'data.ts'), [
      "export const P = [",
      "  { at: 14.4, to: 17.2, ko: ['얼어 죽겠다!'], key: '얼어 죽겠다', x: 650, y: 618 },",
      "  { n: 1, at: 1.1, to: 4.7, ko: '깜짝이야!', key: '깜짝이야', tip: [815, 1110] },",
      "];",
      "export const STAFF = { at: 17.15, to: 19.05, key: '깜짝이야' };",
    ].join('\n'));
    fs.writeFileSync(path.join(vo, 'vo.json'), JSON.stringify({ lines: [
      { id: 'f5', text: '[shivering] 얼어 죽겠다!', dur: 1.5 }, { id: 'f5b', text: '얼어… 죽겠다!', dur: 1.0 },
      { id: 'm1', text: '깜짝이야!', dur: 0.915, syllablesPerSec: 4.37 }, { id: 's1', text: '깜짝이야!', dur: 1.3, syllablesPerSec: 3.08 },
      { id: 'm3', text: '엄마야!', dur: 1.2, syllablesPerSec: 2.5 }, { id: 'm3b', text: '엄마야!', dur: 0.9, syllablesPerSec: 3.33 },
    ] }));
    const r = 점검(편폴더);
    const 글 = r.문제.join('\n');
    assert.match(글, /「얼어 죽겠다」: 편 코드의 칸이 2\.8초 — 3\.5초 넘게/);
    assert.match(글, /「얼어 죽겠다」: 목소리 f5b가 초당 5음절/);
    assert.match(글, /「깜짝이야」: 목소리 m1가 초당 4\.37음절/);
    assert.doesNotMatch(글, /「깜짝이야」: 편 코드/);
    assert.match(글, /「엄마야」: 둘째 목소리가 첫째보다 빠름\(3\.33 > 2\.5음절\)/);
    assert.match(r.알림.join('\n'), /「엄마야」: 편 코드에서 key가 이 말인 칸의 at · to\(숫자\)를 못 찾음/);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

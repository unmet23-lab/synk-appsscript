'use strict';
// ㉑ LAB 몽골 편 고르기(tools/lib/몽골고르기관문.js) — 21:00 칸 편의 기획 칸만 본다. 영상 · 서버 없이 돈다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 관문 = require('../tools/lib/몽골고르기관문.js');

function 저장소(편들) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), '몽골고르기-'));
  for (const [name, { 시각, 기획 = '', 상태 = '올릴 준비' }] of Object.entries(편들)) {
    const dir = path.join(repo, 'docs', '마케팅', name);
    fs.mkdirSync(path.join(dir, '게시'), { recursive: true });
    fs.writeFileSync(path.join(dir, '게시', '준비.json'), JSON.stringify({ 브랜드: 'LAB', 상태, 판: [{ 계정: 'lab-instagram', 시각 }, { 계정: 'lab-tiktok', 시각 }] }));
    fs.writeFileSync(path.join(dir, '기획.md'), 기획);
  }
  return repo;
}
const 묶음 = (repo, name) => {
  const dir = path.join(repo, 'docs', '마케팅', name);
  const prep = JSON.parse(fs.readFileSync(path.join(dir, '게시', '준비.json'), 'utf8'));
  return { bundle: { dir, name, repo, prep }, plates: prep.판.map((p, index) => ({ index, account: p.계정, time: p.시각, raw: p })) };
};
const 기획 = (줄) => ['기획 · LAB', '', '| 칸 | 내용 |', '|---|---|', ...줄, ''].join('\n');
const 좋은줄 = [
  '| 꼴 | 쓸 말 여러 개(4마디) |',
  '| 누구에게 | 몽골 유학생. 보낼 사람: 같이 알바하는 친구 — 사장님 앞에서 쓸 말이라. 저장할 까닭: 다음 알바 전에 다시 본다 |',
  '| 근거 | 지난 세 편 공유 1.7% · 저장 2.9%, 0.2% · 1.4% |',
  '| 첫 2초 | 0초 끓는 몽글 + «Уурласан үедээ хэлэх 4 хэллэг» |',
];
const 코드 = (fs_) => fs_.map((f) => `${f.level}:${f.code}`).sort();

test('칸을 다 채운 쓸 말 여러 개 21:00 편은 아무것도 안 낸다', () => {
  const repo = 저장소({ LAB_화날때2_mn_20261119: { 시각: '2026-11-24T21:00:00+09:00', 기획: 기획(좋은줄) } });
  try {
    const { bundle, plates } = 묶음(repo, 'LAB_화날때2_mn_20261119');
    assert.deepEqual(관문.mnPickFindings(bundle, plates), []);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test('꼴 칸 · 보낼 사람 · 저장할 까닭이 없으면 고칠 것, 숫자 없는 첫 2초와 비율 없는 근거는 확인할 것', () => {
  const repo = 저장소({
    LAB_빈칸_mn_20261120: { 시각: '2026-11-25T21:00:00+09:00', 기획: 기획(['| 누구에게 | 몽골 유학생 |', '| 근거 | 화날 때 136배 |', '| 첫 2초 | 끓는 몽글 |']) },
    LAB_꼴만_mn_20261120: { 시각: '2026-11-26T21:00:00+09:00', 기획: 기획(['| **꼴** | 쓸 말 여러 개(2마디) |', '| 누구에게 | 보낼 사람: 친구 |', '| 근거 | 공유 1% · 저장 2% |', '| 첫 2초 | 끓는 몽글 |']) },
  });
  try {
    const a = 묶음(repo, 'LAB_빈칸_mn_20261120');
    assert.deepEqual(코드(관문.mnPickFindings(a.bundle, a.plates)), ['고칠 것:mn-pick-kind', '고칠 것:mn-pick-who', '확인할 것:mn-pick-rate']);
    const b = 묶음(repo, 'LAB_꼴만_mn_20261120');
    const fb = 관문.mnPickFindings(b.bundle, b.plates);
    assert.deepEqual(코드(fb), ['고칠 것:mn-pick-who', '확인할 것:mn-pick-count', '확인할 것:mn-pick-hook']);
    assert.match(fb.find((f) => f.code === 'mn-pick-who').message, /저장할 까닭/);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test('한 가지 편을 21:00에 두면 그 주(월~일) 21:00 칸의 꼴별 수를 보인다', () => {
  const 한가지 = 기획(['| 꼴 | 한 가지 |', ...좋은줄.slice(1)]);
  const repo = 저장소({
    LAB_가_mn_20261119: { 시각: '2026-11-23T21:00:00+09:00', 기획: 기획(좋은줄) }, // 11-23은 월요일
    LAB_나_mn_20261119: { 시각: '2026-11-24T21:00:00+09:00', 기획: 한가지 },
    LAB_옛편_mn_20261117: { 시각: '2026-11-25T21:00:00+09:00', 기획: 기획(['| 누구에게 | 몽골 유학생 |']) },
    LAB_낮편_mn_20261119: { 시각: '2026-11-25T13:00:00+09:00', 기획: 한가지 },
    LAB_일요일_mn_20261119: { 시각: '2026-11-29T21:00:00+09:00', 기획: 기획(좋은줄) }, // 11-29 일요일 = 같은 주
    LAB_다음주_mn_20261119: { 시각: '2026-11-30T21:00:00+09:00', 기획: 기획(좋은줄) }, // 11-30 월요일 = 다음 주
    LAB_버린편_mn_20261119: { 시각: '2026-11-27T21:00:00+09:00', 기획: 기획(좋은줄), 상태: '버림(사실 오류)' },
  });
  try {
    assert.equal(관문.weekStart('2026-11-29'), '2026-11-23');
    assert.equal(관문.weekStart('2026-11-30'), '2026-11-30');
    const { bundle, plates } = 묶음(repo, 'LAB_나_mn_20261119');
    const f = 관문.mnPickFindings(bundle, plates);
    assert.deepEqual(코드(f), ['확인할 것:mn-pick-week']);
    // 같은 주: 가(월 · 여러 개) · 나(화 · 한 가지, 이 편) · 옛편(수 · 꼴 칸 없음) · 일요일(여러 개). 낮편 · 다음 주 · 버린 편은 빠진다.
    assert.match(f[0].message, /2026-11-23 주 21:00 칸: 쓸 말 여러 개 2편 · 한 가지 1편 · 꼴 모름 1편/);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test('11-18 이전에 시작한 편 · 13:00 칸 · 나라 판본 판 · LAB 밖 편은 보지 않는다', () => {
  const repo = 저장소({
    LAB_이모_mn_20261118: { 시각: '2026-11-23T21:00:00+09:00', 기획: '' },
    LAB_낮_mn_20261119: { 시각: '2026-11-23T13:00:00+09:00', 기획: '' },
  });
  try {
    for (const name of ['LAB_이모_mn_20261118', 'LAB_낮_mn_20261119']) {
      const { bundle, plates } = 묶음(repo, name);
      assert.deepEqual(관문.mnPickFindings(bundle, plates), [], name);
    }
    const { bundle, plates } = 묶음(repo, 'LAB_낮_mn_20261119');
    const 돌림 = [{ index: 0, account: 'lab-instagram', time: '2026-11-23T21:00:00+09:00', raw: { 돌림: { 원본: 'x' } } }];
    assert.deepEqual(관문.mnPickFindings(bundle, 돌림), []);
    assert.deepEqual(관문.mnPickFindings({ ...bundle, prep: { 브랜드: 'synkbrief' } }, [{ index: 0, account: 'lab-instagram', time: '2026-11-23T21:00:00+09:00', raw: {} }]), []);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test('칸표 읽기 — 굵은 이름 · 머리 줄 · 칸막이를 가르고, 꼴 값의 마디 수를 읽는다', () => {
  const rows = 관문.rowsOf('| 칸 | 내용 |\n|---|---|\n| **한 문장** | 화날 때 넷 |\n| 꼴 | **쓸 말 여러 개(5마디)** |\n| 꼴 | 한 가지 |\n');
  assert.equal(rows.get('한 문장'), '화날 때 넷');
  assert.equal(rows.has('칸'), false);
  assert.deepEqual(관문.kindOf(rows.get('꼴')), { kind: '쓸 말 여러 개', count: 5 });
  assert.deepEqual(관문.kindOf('한 가지(높임 한 낱말)'), { kind: '한 가지', count: null });
  assert.deepEqual(관문.kindOf('이야기'), { kind: null, count: null });
});

/**
 * 사운드킷 회귀 — 실음원 WAV 3종이 토큰 정본에서 파생된 상태를 유지하는지
 *
 * 지키는 것:
 *   ① 파일 실존·형식(RIFF/mono/16bit/44100) — 앱 반입 전제
 *   ② 유호님 확정 규칙 1 「한 소리 400ms 이하」를 파일 실측으로 기계 강제
 *   ③ 토큰과의 신선도(--check) — 토큰만 고치고 재생성 안 한 상태를 잡는다
 *   ④ 빌더 결정성 — 렌더가 비결정적이면(랜덤·시각) 정본 재생성이 불가능해진다
 *   ⑤ 주파수 실측 — 알림 첫 세그먼트는 순수 784Hz. 영교차로 재서 옥타브·파형 실수를 잡는다
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const KIT = path.join(ROOT, 'docs', '브랜드_사운드킷');
const 토큰 = require('../docs/디자인_토큰.json');
const { buildAll, SR } = require('../tools/사운드킷빌드.js');

const 이벤트들 = Object.values(토큰.사운드.이벤트);

test('① WAV 3종 실존 + RIFF·mono·16bit·44100 형식', () => {
  assert.equal(이벤트들.length, 3);
  for (const ev of 이벤트들) {
    const p = path.join(KIT, ev.렌더.파일);
    assert.ok(fs.existsSync(p), `${ev.렌더.파일} 없음 — node tools/사운드킷빌드.js`);
    const b = fs.readFileSync(p);
    assert.equal(b.toString('ascii', 0, 4), 'RIFF');
    assert.equal(b.toString('ascii', 8, 12), 'WAVE');
    assert.equal(b.readUInt16LE(22), 1, `${ev.렌더.파일} mono 아님`);
    assert.equal(b.readUInt32LE(24), 44100, `${ev.렌더.파일} 샘플레이트`);
    assert.equal(b.readUInt16LE(34), 16, `${ev.렌더.파일} 16bit 아님`);
  }
});

test('② 규칙 1 기계 강제 — 파일 길이(꼬리 포함)도 400ms 이하', () => {
  for (const ev of 이벤트들) {
    const b = fs.readFileSync(path.join(KIT, ev.렌더.파일));
    const ms = (b.readUInt32LE(40) / 2 / SR) * 1000;
    assert.ok(ms <= 400, `${ev.렌더.파일} ${ms.toFixed(0)}ms — 유호님 확정 규칙 1(400ms) 위반`);
    assert.ok(ms >= ev.길이ms, `${ev.렌더.파일} ${ms.toFixed(0)}ms — 토큰 길이(${ev.길이ms}ms)보다 짧다`);
  }
});

test('③ 커밋본이 토큰보다 낡지 않았다(빌드 --check)', () => {
  const r = spawnSync('node', [path.join(ROOT, 'tools', '사운드킷빌드.js'), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, `사운드킷 --check 실패:\n${r.stderr || r.stdout}`);
});

test('④ 렌더는 결정적이다 — 두 번 빌드가 동일 PCM', () => {
  const a = buildAll(), b = buildAll();
  for (let i = 0; i < a.length; i++) {
    assert.equal(Buffer.compare(Buffer.from(a[i].pcm.buffer), Buffer.from(b[i].pcm.buffer)), 0,
      `${a[i].파일} 렌더가 실행마다 다르다 — 정본 재생성이 불가능해진다`);
  }
});

test('⑤ 알림 첫 세그먼트 주파수 실측 ≈ 784Hz(영교차)', () => {
  const 알림 = 토큰.사운드.이벤트.알림;
  const b = fs.readFileSync(path.join(KIT, 알림.렌더.파일));
  // 첫 80ms(둘째 음 시작 110ms 이전 — 순수 단일 톤 구간)
  const n = Math.round(0.08 * SR);
  let crossings = 0;
  let prev = b.readInt16LE(44);
  for (let i = 1; i < n; i++) {
    const v = b.readInt16LE(44 + i * 2);
    if ((prev < 0 && v >= 0) || (prev >= 0 && v < 0)) crossings++;
    prev = v;
  }
  const hz = (crossings / 2) / 0.08;
  assert.ok(Math.abs(hz - 784) < 5, `알림 첫 톤 실측 ${hz.toFixed(1)}Hz — 토큰은 784Hz(옥타브·파형 실수 의심)`);
});

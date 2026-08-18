#!/usr/bin/env node
// 사운드킷빌드 — 토큰 정본(디자인_토큰.json 「사운드」)에서 실음원 WAV 3종을 파생 생성한다.
//
// 왜 있나: 사운드는 유호님이 시청 페이지(docs/tools/사운드_후보.html)에서 귀로 골랐다.
//   파일을 손으로 만들면 「들은 것」과 「배포된 것」이 갈라질 수 있다 — 그래서 시청과
//   동일한 수식(Web Audio 램프 재현)으로 토큰 값에서 기계 생성한다. 토큰이 바뀌면 재생성.
//   · 게인: g에서 지수 감쇠 → 0.0008(-62dB), 소리 끝 뒤 꼬리 20ms 유지 (시청 코드와 동일)
//   · 스윕: 주파수 지수 램프 f→스윕f (위상 연속 누적)
//   · 세트 공통 노멀라이즈: 3파일 최대 피크를 -3dBFS(0.708)로 — 상대 밸런스는 시청 그대로
//
// 사용법:
//   node tools/사운드킷빌드.js            # docs/브랜드_사운드킷/*.wav 생성
//   node tools/사운드킷빌드.js --check    # 커밋본과 재렌더가 어긋나면 exit 1 (샘플 ±1 LSB 허용)
'use strict';
const fs = require('fs');
const path = require('path');

const { 인자게이트 } = require(path.join(__dirname, 'lib', '인자게이트.js'));

const ROOT = path.resolve(__dirname, '..');
const 토큰 = require(path.join(ROOT, 'docs', '디자인_토큰.json'));
const OUT_DIR = path.join(ROOT, 'docs', '브랜드_사운드킷');

const SR = 44100;          // 표준 샘플레이트
const TAIL = 0.02;         // 시청 코드의 o.stop(t+dur+.02) 재현
const FLOOR = 0.0008;      // 시청 코드의 감쇠 바닥
const PEAK_TARGET = Math.pow(10, -3 / 20); // -3dBFS ≈ 0.708

/* 한 이벤트를 float 버퍼로 렌더 — 시청 페이지 tone()과 같은 수식 */
function renderEvent(ev) {
  const 음들 = ev.렌더.음;
  // 렌더 필드와 사람용 요약(주파수Hz)이 갈라지지 않게 기계로 강제
  const fs요약 = new Set(ev.주파수Hz);
  for (const n of 음들) {
    if (!fs요약.has(n.f) && !(n.스윕f && fs요약.has(n.스윕f)))
      throw new Error(`${ev.id}: 렌더 주파수 ${n.f}가 요약(주파수Hz)에 없다 — 두 필드가 갈라졌다`);
  }
  const totalSec = Math.max(...음들.map((n) => n.시작ms + n.길이ms)) / 1000 + TAIL;
  const buf = new Float64Array(Math.round(totalSec * SR));
  for (const n of 음들) {
    const t0 = Math.round((n.시작ms / 1000) * SR);
    const durS = n.길이ms / 1000;
    const durN = Math.round(durS * SR);
    const endN = Math.min(buf.length, t0 + durN + Math.round(TAIL * SR));
    const fRatio = n.스윕f ? n.스윕f / n.f : 1;
    const gRatio = FLOOR / n.g;
    let phase = 0;
    for (let i = t0; i < endN; i++) {
      const u = Math.min(1, (i - t0) / durN); // 램프 진행도(꼬리 구간은 끝값 유지)
      const f = n.f * Math.pow(fRatio, u);
      const g = n.g * Math.pow(gRatio, u);
      phase += (2 * Math.PI * f) / SR;
      buf[i] += g * Math.sin(phase);
    }
  }
  return buf;
}

function buildAll() {
  const rendered = Object.entries(토큰.사운드.이벤트).map(([이름, ev]) => ({
    이름, 파일: ev.렌더.파일, buf: renderEvent(ev),
  }));
  const peak = Math.max(...rendered.map((r) => r.buf.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));
  const k = PEAK_TARGET / peak; // 세트 공통 계수 — 상대 밸런스 보존
  return rendered.map((r) => ({ ...r, pcm: toPcm16(r.buf, k) }));
}

function toPcm16(buf, k) {
  const pcm = new Int16Array(buf.length);
  for (let i = 0; i < buf.length; i++) pcm[i] = Math.round(Math.max(-1, Math.min(1, buf[i] * k)) * 32767);
  return pcm;
}

function wavBytes(pcm) {
  const dataLen = pcm.length * 2;
  const b = Buffer.alloc(44 + dataLen);
  b.write('RIFF', 0); b.writeUInt32LE(36 + dataLen, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < pcm.length; i++) b.writeInt16LE(pcm[i], 44 + i * 2);
  return b;
}

if (require.main === module) {
  /* 🔑 목록은 눈으로 정하지 않았다 — `CLI도구들()` 이 재고, 회귀 ④ 가 매번 다시 센다.
   * ⚠ **`buildAll()` 보다 먼저** 판정한다 — 뒤에 두면 오타를 친 실행이 파일을 다 쓰고 나서
   *   죽어, 「모르는 낱말인데 부작용은 났다」가 된다. */
  const 아는플래그 = ['--check'];
  const 플래그오류 = 인자게이트('사운드킷빌드', process.argv.slice(2), 아는플래그);
  if (플래그오류) { console.error(`\n🔴 ${플래그오류}\n`); process.exit(1); }
  const files = buildAll();
  if (process.argv.includes('--check')) {
    for (const f of files) {
      const p = path.join(OUT_DIR, f.파일);
      if (!fs.existsSync(p)) { console.error(`[사운드킷] ${f.파일} 없음 — node tools/사운드킷빌드.js 로 생성하라`); process.exit(1); }
      const disk = fs.readFileSync(p);
      const fresh = wavBytes(f.pcm);
      if (disk.length !== fresh.length) { console.error(`[사운드킷] ${f.파일} 길이 불일치 — 토큰이 바뀌었는데 재생성 안 됨`); process.exit(1); }
      // 샘플 ±1 LSB 허용 — 부동소수 마지막 자리 플랫폼 차가 양자화 경계에서 1 뒤집힐 수 있다
      for (let i = 44; i < disk.length; i += 2) {
        if (Math.abs(disk.readInt16LE(i) - fresh.readInt16LE(i)) > 1) {
          console.error(`[사운드킷] ${f.파일} 샘플 ${(i - 44) / 2} 불일치 — 재생성하라`); process.exit(1);
        }
      }
    }
    console.log('[사운드킷] 정합 OK (3파일 · 샘플 ±1 LSB)');
  } else {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    for (const f of files) {
      const bytes = wavBytes(f.pcm);
      fs.writeFileSync(path.join(OUT_DIR, f.파일), bytes);
      console.log(`[사운드킷] ${f.파일} — ${(bytes.length / 1024).toFixed(1)}KB · ${(f.pcm.length / SR * 1000).toFixed(0)}ms`);
    }
  }
}

module.exports = { renderEvent, buildAll, wavBytes, SR };

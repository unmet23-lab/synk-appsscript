#!/usr/bin/env node
// 사운드킷빌드 — 토큰 정본(디자인_토큰.json 「사운드」)에서 실음원 WAV 3종을 파생 생성한다.
//
// 왜 있나: 사운드는 유호님이 시청 페이지(docs/tools/사운드_후보.html)에서 귀로 골랐다.
//   파일을 손으로 만들면 「들은 것」과 「배포된 것」이 갈라질 수 있다 — 그래서 시청과
//   동일한 수식(Web Audio 램프 재현)으로 토큰 값에서 기계 생성한다. 토큰이 바뀌면 재생성.
//   · 게인: g에서 지수 감쇠 → 0.0008(-62dB), 소리 끝 뒤 꼬리 20ms 유지 (시청 코드와 동일)
//   · 스윕: 주파수 지수 램프 f→스윕f (위상 연속 누적)
//   · 노멀라이즈 = 닻 고정: k = -3dBFS ÷ 닻피크(아래 상수) — 상대 밸런스는 시청 그대로.
//     구판은 「세트 최대 피크」로 k를 만들었다 — 소리 하나가 닻보다 커지는 순간 몽글 정본까지
//     전 파일이 다시 구워지는 구조라(08-28 마린 T 골렘에서 실측), 그날 값으로 동결했다.
//
// 사용법:
//   node tools/사운드킷빌드.js            # docs/브랜드_사운드킷/*.wav 생성
//   node tools/사운드킷빌드.js --check    # 커밋본과 재렌더가 어긋나면 exit 1 (샘플 ±1 LSB 허용)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const 토큰 = require(path.join(ROOT, 'docs', '디자인_토큰.json'));
const OUT_DIR = path.join(ROOT, 'docs', '브랜드_사운드킷');

const SR = 44100;          // 표준 샘플레이트
const TAIL = 0.02;         // 시청 코드의 o.stop(t+dur+.02) 재현
const FLOOR = 0.0008;      // 시청 코드의 감쇠 바닥
const PEAK_TARGET = Math.pow(10, -3 / 20); // -3dBFS ≈ 0.708
/* 볼륨 닻 — 「성취」 이벤트의 08-28 실측 피크(그날 세트 최대). 이후 이벤트가 늘거나 바뀌어도
 * 이 값은 안 움직인다: 움직이면 k 가 변해 손 안 댄 파일(몽글 정본 포함)까지 전부 다시 구워진다.
 * 새 소리는 이보다 커도 된다(진짜 한계 = 클리핑 · buildAll 의 가드가 지킨다 · 여유 상한 ≈ 0.2098). */
const 닻피크 = 0.1485159849830116;

/* 목소리 음절 — «맑은판» 어휘 (유호 확정 2026-08-25).
 *
 * ■ 왜 두 번째 경로인가 — UI 음과 목소리는 문법이 다르다
 *   위 `단음()`(감쇠 봉투 · 순사인 · 직선 스윕)은 «삑»의 문법이다. 그 수식으로 만든 몽글
 *   목소리는 유호님께 **「시스템 음」으로 읽혔다**(08-25 실측 — 듣고도 캐릭터 소리인 줄 모르셨다).
 *   생명체의 문법 셋을 더해야 목소리가 된다:
 *     ① **떨림**(비브라토 5~5.5Hz) — 고른 음고가 곧 기계다. smoothstep 으로 «스며들게» 넣는다
 *        (툭 켜지면 기울기가 꺾여 «깨짐»으로 들린다 — 08-25 그 자리다).
 *     ② **숨**(음절 봉우리 sin^지수) — 차오르고 진다. 즉시 최대인 감쇠 봉투와 반대다.
 *     ③ **둥근 배음** — 사인 부분음의 합(규칙 ③ 안). 🚫 서브 옥타브(0.5x)는 기본으로 쓰지
 *        않는다: 165~196Hz 까지 내려가 작은 스피커가 왜곡한다(그게 유호님이 들으신 「깨짐」).
 *
 * ■ 🔴 기존 3종은 이 경로를 **안 지난다** — `봉우리` 필드가 있는 음만 여기로 온다.
 *   그래서 획득·성취·알림 바이트는 이 확장으로 한 톨도 안 흔들린다(`--check` 가 지킨다).
 */
function 음절(buf, n) {
  const 배음 = n.배음 || [[1, 1], [2, 0.28], [3, 0.08]];
  const 지수 = n.봉우리;
  const t0 = Math.round((n.시작ms / 1000) * SR);
  const N = Math.round((n.길이ms / 1000) * SR);
  const 합계 = 배음.reduce((a, x) => a + x[1], 0);
  const 위상 = 배음.map(() => 0);
  const 비율 = n.스윕f ? n.스윕f / n.f : 1;
  for (let i = 0; i < N && t0 + i < buf.length; i++) {
    const u = i / N;
    const 미끄럼 = 1 - (1 - u) * (1 - u);              // ease-out — 앞이 빠르고 끝이 살랑
    let f = n.f * Math.pow(비율, 미끄럼);
    if (n.떨림 && u > n.떨림.부터) {
      let v = (u - n.떨림.부터) / (1 - n.떨림.부터);
      v = v * v * (3 - 2 * v);                          // smoothstep — 떨림이 스며든다
      f *= 1 + n.떨림.깊이 * v * Math.sin(2 * Math.PI * n.떨림.속도 * (i / SR));
    }
    const 창 = Math.pow(Math.sin(Math.PI * u), 지수);
    let 합 = 0;
    for (let k = 0; k < 배음.length; k++) {
      위상[k] += (2 * Math.PI * f * 배음[k][0]) / SR;
      합 += 배음[k][1] * Math.sin(위상[k]);
    }
    buf[t0 + i] += n.g * 창 * 합 / 합계;
  }
}

/* 가이드 «악기» 음절 — 까몽·마린 목소리 (상황 6종 = 08-28 첫 픽 「까몽 2·5·9, 마린 1·2·5」 ·
 * 악기 = 3~7차 귀검수 재작업 끝 유호 확정 08-28 「이제 목소리는 좋아」).
 *
 * ■ 왜 세 번째 경로인가 — 「목소리를 가르는 것은 값이 아니라 악기다」
 *   1차(위 음절()의 파라미터 변주)는 유호님께 「몽글이 성대모사한 느낌」으로 반려됐다(08-27).
 *   같은 수식에서 음높이·속도·배음만 바꾸면 원리상 «같은 목소리의 흉내»가 된다. 악기 현행:
 *     까몽 = 생동감 아기 용 — 도톰 배음 4층 + 각 그로울(그르렁) · 247~554Hz
 *       (곤충 재료 금지: 고음 버즈·지터·디튠 맥놀이 = 「모기·벌레 소리」 반려 08-28)
 *     마린 = T 골렘 — 홀로우 1.5배음 8층 + 링모드 22Hz(금속통) · 평평 억양·메트로놈·낮은 마침표
 *   🔴 가이드 목소리에 밴드패스 노이즈 금지 — 유호님 귀에 전부 «무전 잡음»(08-28 반려).
 *     노이즈 경로 자체는 산다(UI·효과음 몫) — 목소리 이벤트에 안 쓸 뿐이다.
 *   판정 지면(판정장 아티팩트)과 «같은 수식»이라 들은 것과 배포된 것이 갈라질 수 없다.
 *   ⚠ g 에는 판정장의 RMS 균형 배율(몽글×0.9 · 0.5~3 클램프)이 이미 접혀 있다 —
 *     여기서 다시 균형을 잡지 않는다(잡으면 유호님이 들은 밸런스가 깨진다).
 * ■ 🔴 기존 경로 둘(단음·음절)은 이 확장으로 한 톨도 안 흔들린다 — 새 필드(파형·게이트·그로울·
 *   링모드·지터·숨노이즈·디튠·드라이브)가 있는 음만 여기로 온다. 난수(지터·노이즈)는 음의
 *   (f·시작ms·길이ms)에서 씨앗을 파생해 언제 구워도 바이트 동일(--check 가 그대로 지킨다).
 */
function 씨앗난수(씨) { let a = 씨 >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function 악기배음(n) {
  if (n.배음) return n.배음;
  if (n.파형 === '버즈') { const 수 = n.배음수 || 10, 표 = []; for (let k = 1; k <= 수; k++) 표.push([k, Math.pow(k, -.8)]); return 표; }
  if (n.파형 === '사각') { const 수 = n.배음수 || 6, 표 = []; for (let k = 0; k < 수; k++) { const h = 2 * k + 1; 표.push([h, 1 / h]); } return 표; }
  return [[1, 1], [2, .28], [3, .08]];
}
function 악기봉투(u, n, N) {
  if (n.게이트) { const att = Math.round(.004 * SR), rel = Math.round(.010 * SR), i = u * N; return Math.min(1, i / att, (N - i) / rel); }
  return Math.pow(Math.sin(Math.PI * u), n.봉우리 ?? 1);
}
function 악기음(buf, n) {
  const t0 = Math.round((n.시작ms / 1000) * SR), N = Math.round((n.길이ms / 1000) * SR);
  if (n.파형 === '노이즈') {
    const 난수 = 씨앗난수((n.f * 7919 + n.시작ms * 31 + n.길이ms) | 0);
    const w0 = 2 * Math.PI * n.f / SR, alpha = Math.sin(w0) / (2 * (n.Q || 1));
    const a0 = 1 + alpha, b0 = alpha / a0, b2 = -alpha / a0, a1 = -2 * Math.cos(w0) / a0, a2 = (1 - alpha) / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < N && t0 + i < buf.length; i++) {
      const x = 난수() * 2 - 1;
      const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      buf[t0 + i] += n.g * 악기봉투(i / N, n, N) * y * 2.5;
    }
    return;
  }
  const 배음 = 악기배음(n);
  const 합계 = 배음.reduce((a, x) => a + x[1], 0);
  const 위상 = 배음.map(() => 0);
  const 위상B = n.디튠 ? 배음.map(() => 0) : null;   // 디튠 겹 — 맥놀이로 지저분해진다
  const 비율 = n.스윕f ? n.스윕f / n.f : 1;
  let 노즈 = null;                                    // 숨 노이즈 — 허스키한 목
  if (n.숨노이즈) {
    const 난수 = 씨앗난수((n.f * 7919 + n.시작ms * 31 + n.길이ms * 7) | 0);
    const w0 = 2 * Math.PI * n.숨노이즈.f / SR, alpha = Math.sin(w0) / (2 * (n.숨노이즈.Q || 1));
    const a0 = 1 + alpha;
    노즈 = { 난수, b0: alpha / a0, b2: -alpha / a0, a1: -2 * Math.cos(w0) / a0, a2: (1 - alpha) / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
  }
  let 짓 = null;                                      // 피치 지터 — 매끈한 떨림 대신 긁힘
  if (n.지터) {
    짓 = { 난수: 씨앗난수((n.f * 104729 + n.길이ms * 13) | 0), N: Math.max(1, Math.round(n.지터.주기ms / 1000 * SR)), i: 0, 이전: 0, 다음: 0 };
    짓.다음 = (짓.난수() * 2 - 1) * n.지터.폭;
  }
  for (let i = 0; i < N && t0 + i < buf.length; i++) {
    const u = i / N, t = i / SR;
    const 미끄럼 = 1 - (1 - u) * (1 - u);
    let f = n.f * Math.pow(비율, 미끄럼);
    if (n.떨림 && u > n.떨림.부터) {
      let v = (u - n.떨림.부터) / (1 - n.떨림.부터); v = v * v * (3 - 2 * v);
      f *= 1 + n.떨림.깊이 * v * Math.sin(2 * Math.PI * n.떨림.속도 * t);
    }
    if (짓) {
      if (짓.i <= 0) { 짓.이전 = 짓.다음; 짓.다음 = (짓.난수() * 2 - 1) * n.지터.폭; 짓.i = 짓.N; }
      짓.i--; const w = 1 - 짓.i / 짓.N;
      f *= 1 + (짓.이전 + (짓.다음 - 짓.이전) * w);
    }
    let 합 = 0;
    for (let k = 0; k < 배음.length; k++) { 위상[k] += (2 * Math.PI * f * 배음[k][0]) / SR; 합 += 배음[k][1] * Math.sin(위상[k]); }
    if (위상B) {
      let 합B = 0; const fB = f * n.디튠.비율;
      for (let k = 0; k < 배음.length; k++) { 위상B[k] += (2 * Math.PI * fB * 배음[k][0]) / SR; 합B += 배음[k][1] * Math.sin(위상B[k]); }
      합 = (합 + n.디튠.양 * 합B) / (1 + n.디튠.양);
    }
    let x = 합 / 합계;
    if (노즈) {
      const xr = 노즈.난수() * 2 - 1;
      const y = 노즈.b0 * xr + 노즈.b2 * 노즈.x2 - 노즈.a1 * 노즈.y1 - 노즈.a2 * 노즈.y2;
      노즈.x2 = 노즈.x1; 노즈.x1 = xr; 노즈.y2 = 노즈.y1; 노즈.y1 = y;
      x += n.숨노이즈.비율 * y * 2.5;
    }
    if (n.그로울) {
      const m = Math.sin(2 * Math.PI * n.그로울.속도 * t);
      const 모 = n.그로울.모양 === '각' ? Math.tanh(3 * m) : m;   // 각 = 스퍼터
      x *= 1 - n.그로울.깊이 * (0.5 + 0.5 * 모);
    }
    if (n.드라이브) x = Math.tanh(n.드라이브 * x) / Math.tanh(n.드라이브);  // 찌그러뜨림
    let s = n.g * 악기봉투(u, n, N) * x;
    if (n.링모드) s *= (1 - n.링모드.깊이) + n.링모드.깊이 * Math.sin(2 * Math.PI * n.링모드.f * t);
    buf[t0 + i] += s;
  }
}

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
    if (n.파형 || n.게이트 || n.그로울 || n.링모드 || n.지터 || n.숨노이즈 || n.디튠 || n.드라이브) { 악기음(buf, n); continue; }   // 가이드 악기 — 위 머리말
    if (n.봉우리) { 음절(buf, n); continue; }   // 목소리 음절 — 위 머리말
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
  const k = PEAK_TARGET / 닻피크; // 닻 고정 — 이벤트가 늘거나 바뀌어도 남의 파일은 안 움직인다
  for (const r of rendered) {
    const peak = r.buf.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    if (peak * k > 1) throw new Error(`[사운드킷] ${r.이름} 피크 ${peak.toFixed(4)} × k = ${(peak * k).toFixed(3)} > 1.0 — 클리핑. g(접은 배율)를 낮춰라`);
  }
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
    /* 🔴 개수를 «세어서» 말한다 — 옛 판은 `3파일`이 문구로 박혀 있어, 킷이 4종이 된 뒤에도
       「3파일 정합 OK」를 냈다(08-25 실측). 검사는 다 돌고 보고만 틀린 형태라 증상이 없다:
       숫자를 지어 말하는 자리는 언젠가 「안 잰 것을 잰 것처럼」 보고한다. */
    console.log(`[사운드킷] 정합 OK (${files.length}파일 · 샘플 ±1 LSB)`);
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

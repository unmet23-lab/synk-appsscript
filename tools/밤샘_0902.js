#!/usr/bin/env node
/**
 * 밤샘 0902 — 오늘 밤의 사슬: ①까몽 몸판 넷 → ②화면 열넷 재굽기 → ③요소 라이브러리 이어굽기 → ④엔진 히어로 7장
 *   (유호 지시 09-01 「화면 10벌은 전량 재굽기랑 부품 형태를 필요한것들을 전부 밤 굽기 일감작업에
 *    등록해줘」 — 결정.md 09-01 4건 · 전량 재굽기 ⏸(08-25 「일단 시작하지말고」)는 그 지시로 해제)
 *
 * ■ 순서와 까닭
 *   ① 까몽 몸판 넷(윙크·졸림·으쓱·민망 · 700→1024) — 기존 유호 큐(08-31 「랜더도 5/5」 + 09-01
 *      「이따 잘때 다시 굽기 시작할게」)가 새 일감보다 앞선다. 통로 = 밤샘_0831.js 그대로
 *      (폭 판정 재개 · CPU · 자체 도장) — 사본을 만들지 않는다. ≈125분/장 ⇒ ≈8.3시간.
 *   ② 화면 열넷 — `명품재굽기.js --화면만` 한 벌(그릇→덧씌움→판정 지면→검사 · 화면자 = AgX 맨판
 *      · GPU). 유호 판정 대기 10벌이 08-23 판이라, 판정 재료를 현행 자(색·털)로 다시 세운다.
 *      ≈1.5~2시간(미실측 — 요소 평균×화소 1.9배 추정).
 *   ③ 요소 라이브러리 이어 — `밤굽기.js`(남은 수는 그 자리에서 센다 · 단계마다 자체 문지기 · 검사 동반).
 *   ④ 엔진 히어로 7장 — 소개서 표지 얼굴을 «사진»으로 새로 굽는다(유호 교정 09-01 「요소가 부족해 ·
 *      저정도 요소나 재질을 쓰는 것도 탈락 · 훨씬 더 명품화」 → 「전부 대기열로 · 지금 바로 굽지 마」).
 *      통로 = `엔진히어로굽기.js`(레시피 근거는 그 머리말) · 1800px/320샘플 ≈7장.
 *      🔴 낮에 안 건 까닭 = 09-01 18시 여유 램 0.87GB(문지기 바닥 6,000MB) — 걸면 08-30 의
 *         「38분에 0장」을 다시 산다.
 *   ⚠ 부품 형태 시안(«구» 탈피 후보)은 이 밤에 없다 — 장면 코드(형태 후보 설계)가 선행이라
 *      다음 밤 몫이다. 일감 원장 = 트랙.md §2-Loom 「밤 굽기 일감」.
 *
 * ■ 실패해도 다음 단계로 간다 — ①(CPU)과 ②③(GPU)은 독립이라, 하나가 죽어 밤을 통째로
 *   버리는 쪽이 더 비싸다. 성패는 각 도구가 파일로 남기고, 아침 세션이 갈래별로 읽는다.
 *
 * ■ 도장 규약 — 이 파일이 「돌는중」을 단계마다 다시 찍는다. ①의 밤샘_0831 이 자기 완주 도장을
 *   찍지만(자식이라 못 막고, 막지 않는다) 그 직후 이 파일이 ② 진입 도장으로 덮는다 —
 *   아침에 도장이 「밤샘_0831 완주」로 남아 있으면 ② 진입 «직전»에 죽은 것이다.
 *
 * 띄우는 법(PowerShell · 콘솔에서 완전히 뗀다 — 밤샘_0901 과 같은 규약 · CreateFlags=520):
 *   $si = ([WMIClass]'Win32_ProcessStartup').CreateInstance()
 *   $si.CreateFlags = 520; $si.ShowWindow = 0
 *   ([WMIClass]'Win32_Process').Create('"C:\Program Files\nodejs\node.exe" "C:\Users\q1212\Documents\SYNK-appsscript\tools\밤샘_0902.js"', 'C:\Users\q1212\Documents\SYNK-appsscript', $si)
 * 🔑 판정은 로그가 아니라 파일이다 — 아침에 볼 것: ①docs/캐릭터/친구공방_0825/ + docs/까몽_시안.html
 *   ②docs/캐릭터/{학부모,강사,원장}공방_0823/ + docs/화면_시안.html ③명품재굽기 --검사 의 ✅
 *   ④docs/Loom_자산/구움/히어로_*.png 7장(`node tools/엔진히어로굽기.js --분모` 가 이름째 센다).
 */
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/* 램문지기가 읽는 자리 — require 보다 먼저(모듈은 로드 때 한 번 읽는다). 밤 상한 = 10시간. */
process.env.RAM_WAIT_MIN = process.env.RAM_WAIT_MIN || '600';

/* stdout·stderr 을 파일로 직접 돌린다(밤샘_0901 규약 — 떼어낸 프로세스는 리디렉션이 안 닿는다). */
const 로그경로 = process.env.RAM_LOG_PATH
  || path.join(process.env.TEMP || process.env.TMP || os.tmpdir(), '밤샘0902.log');
const 로그fd = fs.openSync(로그경로, 'a');
const 쓰기 = (s) => { try { fs.writeSync(로그fd, s); } catch (_) { /* 로그가 굽기를 막지 않는다 */ } return true; };
process.stdout.write = 쓰기;
process.stderr.write = 쓰기;

const 루트 = path.resolve(__dirname, '..');
const 노드 = process.execPath;
const 문지기 = require('./lib/램문지기');
const 시각 = () => new Date().toLocaleTimeString('ko-KR');
const 말 = (s) => { console.log(s); };

/* 완주 도장 — 밤굽기.js 규약 그대로(새 원장을 안 만든다). 완주 ≠ 합격(미학은 유호님 눈 몫). */
const 도장길 = path.join(루트, 'docs', '_ops', '밤굽기도장.json');
let 도장끝 = false;
const 단계기록 = [];
function 도장(상태, 사유) {
  try {
    const 임시 = `${도장길}.${process.pid}.tmp`;
    fs.mkdirSync(path.dirname(도장길), { recursive: true });
    const 벌 = { 시각: new Date().toISOString(), 무엇: '밤샘_0902.js', 상태, 완주: 상태 === '완주', 사유 };
    fs.writeFileSync(임시, `${JSON.stringify(벌, null, 2)}\n`, 'utf8');
    fs.renameSync(임시, 도장길);
  } catch (_) { /* 도장 실패로 굽기를 멈추지 않는다 */ }
}
process.on('exit', (코드) => { if (!도장끝) 도장('멈춤', `끝까지 못 갔다 — 종료코드 ${코드} · 지나온 단계: ${단계기록.join(' · ') || '없음'} · 되살리기 = tools/밤샘_0902.js 를 WMI CreateFlags=520 으로(각 단계가 남은 것만 굽는다)`); });
for (const 신호 of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  process.on(신호, () => { 도장('멈춤', `신호 ${신호} 로 끊겼다 · 지나온 단계: ${단계기록.join(' · ') || '없음'} · 되살리기 = tools/밤샘_0902.js`); 도장끝 = true; process.exit(130); });
}
process.on('uncaughtException', (e) => { 도장('멈춤', `예외로 죽었다 — ${(e && e.message) || e} · 지나온 단계: ${단계기록.join(' · ') || '없음'} · 되살리기 = tools/밤샘_0902.js`); 도장끝 = true; process.exit(1); });

function 단계(이름, 인자들) {
  if (!문지기.자리비었나(이름, 말)) { 단계기록.push(`${이름.split(' ')[0]}=건너뜀`); return; }
  도장('돌는중', `${이름} 진입 · 지나온 단계: ${단계기록.join(' · ') || '없음'}`);
  const 시작 = Date.now();
  const r = spawnSync(노드, 인자들, { cwd: 루트, stdio: 'inherit' });
  말(`■ ${이름} 끝 — 종료코드 ${r.status} · ${Math.round((Date.now() - 시작) / 60000)}분 · ${시각()}`);
  단계기록.push(`${이름.split(' ')[0]}=${r.status}`);
}

말(`\n■■ 밤샘 0902 시작 — ${new Date().toLocaleString('ko-KR')} · pid ${process.pid} · 로그 ${로그경로}`);
말(`   ${문지기.상태줄()}`);
말('   사슬 = ①까몽 몸판 넷(밤샘_0831 승계) → ②화면 열넷(--화면만 한 벌) → ③요소 이어(밤굽기) → ④엔진 히어로 7장');
도장('돌는중', '돌고 있다 — 사슬 ①까몽 → ②화면 → ③요소 → ④히어로 (이 도장이 그대로면 ① 도중에 죽은 것이다)');

/* ① 까몽 몸판 넷 — 밤샘_0831 이 폭(≠1024)으로 남은 것만 굽는다. 다 서 있으면 몇 분에 끝난다. */
단계('① 까몽 몸판(밤샘_0831 사슬 — 폭 판정 재개)', [path.join(루트, 'tools', '밤샘_0831.js')]);

/* ② 화면 열넷 — 그릇→덧씌움→판정 지면→검사 한 벌 · 화면자(AgX 맨판)는 명품재굽기가 안다. */
단계('② 화면 열넷 재굽기(명품재굽기 --화면만)', [path.join(루트, 'tools', '명품재굽기.js'), '--화면만']);

/* ③ 요소 라이브러리 이어 — 남은 수는 밤굽기가 그 자리에서 센다(NPC 는 기본 건너뜀 · 검사 동반). */
단계('③ 요소 라이브러리 이어굽기(밤굽기 사슬)', [path.join(루트, 'tools', '밤굽기.js')]);

/* ④ 엔진 히어로 7장 — 소개서 표지 얼굴을 «부품»이 아니라 «사진»으로(유호 교정 09-01 「명품화」).
 *   무대 살림 + 결 조명 + 얕은 심도 + PBR 중립 · 1800px/320샘플. ≈7장.
 *   🔑 ①②③ 뒤에 두는 까닭: 앞 셋은 유호님이 «이미 기다리시는» 큐이고, 이것은 오늘 새로 든 일감이다.
 *      그리고 실패해도 지면은 지금 부품 얼굴로 이미 서 있다(퇴로가 있는 단계를 뒤에 둔다).
 *   ⚠ 굽고 나면 아침 세션이 `python tools/룸자산화.py` → `node tools/펠트문서.js --전량` 으로
 *      지면에 들인다 — 굽기만으로는 지면이 안 바뀐다(「구웠다」 ≠ 「지면이 입었다」). */
단계('④ 엔진 히어로 7장(표지 얼굴 — 사진 급)', [path.join(루트, 'tools', '엔진히어로굽기.js')]);

도장('완주', `끝까지 갔다 · 단계별 종료코드: ${단계기록.join(' · ')} · 로그 ${로그경로} — 그림이 «좋은가»는 여기서 안 잰다(사람 몫) · 아침 몫 = ④ 히어로를 지면에 들이기(룸자산화 → 펠트문서 --전량) · 다음 밤 일감 = 부품 형태 시안(트랙 §2-Loom)`);
도장끝 = true;
말(`\n■■ 밤샘 0902 끝 — ${new Date().toLocaleString('ko-KR')} · 단계: ${단계기록.join(' · ')}`);

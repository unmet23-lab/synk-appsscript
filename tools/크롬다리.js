#!/usr/bin/env node
'use strict';
/**
 * 크롬이 왜 안 붙나 — **한 명령으로 답과 처방을 낸다** (2026-09-07 · 유호님 「원천적으로 해결하는 방법 없어?」)
 *
 * ■ 왜 있나
 *   09-07 하루에만 크롬이 두 번 안 붙었고, 두 번 다 「계정이 안 맞는다」로 읽었다가 헛돌았다.
 *   아침엔 그것으로 아홉 번, 저녁엔 세 번. 그런데 저녁 실측에서 계정은 **맞았다**
 *   (`~/.claude.json` 의 `oauthAccount.emailAddress` = 대화창 계정). 진짜 원인은 다른 층이었다.
 *
 * ■ 붙는 통로는 셋이 겹쳐야 산다 — 하나라도 빠지면 «빈 목록» 하나로 똑같이 보인다
 *   ① 크롬 확장이 살아서 **다리(chrome-native-host.exe)를 띄운다** — 이 다리는 크롬이 실행한다
 *   ② 다리가 **이름 있는 관(named pipe)** 을 연다 · 이름은 사용자당 **하나**다
 *   ③ **대화 세션이 그 관에 붙는다** — 붙는 시점은 세션이 열릴 때다
 *   🔴 그래서 ③ 뒤에 ①②가 다시 서면(확장을 껐다 켜거나 크롬을 다시 열면) **그 대화는 영영 안 붙는다.**
 *      다리도 관도 멀쩡한데 목록만 비어서, 겉모습이 「계정 불일치」와 구별되지 않는다.
 *
 * ■ 쓰기
 *   node tools/크롬다리.js
 *   종료 0 = 셋 다 섰다(그래도 목록이 비면 세션이 늦은 것) · 1 = 어딘가 끊겼다(처방을 찍는다)
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const 홈 = process.env.USERPROFILE || process.env.HOME || '';
const 사용자 = path.basename(홈) || 'unknown';
const 관이름 = `claude-mcp-browser-bridge-${사용자}`;
const 로그 = path.join(홈, 'AppData', 'Local', 'Claude', 'Logs', 'chrome-native-host.log');

const 줄 = [];
const 적기 = (s) => { 줄.push(s); console.log(s); };

/* ① 계정 — 🔴 **`~/.claude.json` 으로 재면 거짓 초록이 난다**(09-07 저녁 실측).
 *   그 파일은 «터미널 CLI가 마지막에 로그인한» 계정이라, 데스크톱 앱이 그 뒤 다른 계정으로
 *   갈아타도 **안 따라온다.** 실제로 09-07 19:34 에 앱이 한도 때문에 계정을 바꿨는데
 *   그 파일은 그대로 unmet27 이어서, 이 도구의 첫 판이 「계정은 맞다」고 거짓말을 했다.
 *   ⇒ 도구 호출이 나가는 방은 **앱이 «지금» 로그인한 계정**이다. 그건 앱 로그가 안다. */
function 앱계정uuid() {
  try {
    const L = path.join(홈, 'AppData', 'Local', 'Claude', 'Logs', 'main.log');
    const 크기 = fs.statSync(L).size;
    const 시작 = Math.max(0, 크기 - 4 * 1024 * 1024);        // 끝 4MB 만 — 로그가 수십 MB 다
    const fd = fs.openSync(L, 'r');
    const buf = Buffer.alloc(크기 - 시작);
    fs.readSync(fd, buf, 0, buf.length, 시작);
    fs.closeSync(fd);
    const m = String(buf).match(/acct:([0-9a-f-]{36})/g);
    return m && m.length ? m[m.length - 1].slice(5) : null;
  } catch { return null; }
}

/* CLI 쪽 계정 — «대조용»이지 판정용이 아니다 */
function cli계정() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(홈, '.claude.json'), 'utf8'));
    const a = j.oauthAccount || {};
    return { uuid: a.accountUuid || null, 메일: a.emailAddress || null };
  } catch { return { uuid: null, 메일: null }; }
}

/* ② 관이 실제로 서 있나 — 파일 목록으로 잰다(윈도우는 파이프가 가상 폴더에 보인다) */
function 관섰나() {
  try { return fs.readdirSync('\\\\.\\pipe\\').some((n) => n === 관이름); } catch { return null; }
}

/* ③ 다리가 몇 벌 도나 — 둘 이상이면 서로 관을 뺏는다 */
function 다리수() {
  try {
    const out = execFileSync('powershell', ['-NoProfile', '-Command',
      "@(Get-Process chrome-native-host -ErrorAction SilentlyContinue).Count"], { encoding: 'utf8', windowsHide: true });
    return Number(String(out).trim());
  } catch { return null; }
}

/* ④ 다리가 «언제» 마지막으로 섰나 — 이 시각이 세션 시작보다 뒤면 그 세션은 못 붙는다 */
function 다리선때() {
  try {
    const s = fs.readFileSync(로그, 'utf8');
    const 줄들 = s.split(/\r?\n/).filter((l) => l.includes('Named pipe created successfully'));
    const 끝 = 줄들[줄들.length - 1] || '';
    const m = 끝.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
    return m ? m[1] : null;
  } catch { return null; }
}

/* ⑤ 최근에 몇 번 끊겼나 — 잦으면 크롬 창·프로필이 여럿이라는 신호다 */
function 최근끊김() {
  try {
    const s = fs.readFileSync(로그, 'utf8');
    const 오늘 = new Date().toISOString().slice(0, 10);
    return s.split(/\r?\n/).filter((l) => l.includes(오늘) && l.includes('Chrome disconnected')).length;
  } catch { return null; }
}

const 앱u = 앱계정uuid();
const cli = cli계정();
const 갈렸나 = !!(앱u && cli.uuid && 앱u !== cli.uuid);
const 관 = 관섰나();
const 다리 = 다리수();
const 선때 = 다리선때();
const 끊김 = 최근끊김();

적기('■ 크롬이 붙는 통로 셋 — 어디가 끊겼나');
적기(`  ① 앱이 지금 쓰는 계정  ${앱u || '(못 읽었다)'}   ← 도구 호출이 나가는 방은 «이것»이다`);
적기(`     터미널 CLI 쪽 파일  ${cli.uuid || '(못 읽었다)'} ${cli.메일 ? '(' + cli.메일 + ')' : ''}`);
if (갈렸나) {
  적기('     🔴 **둘이 다르다 — 계정이 갈렸다.** 앱이 도중에 다른 계정으로 갈아탔다는 뜻이고,');
  적기('        확장은 옛 계정 방에 남아 있다. 🚫 `~/.claude.json` 의 메일 주소를 믿지 마라(안 따라온다).');
} else if (앱u) {
  적기('     ✅ 둘이 같다 — 앱 계정은 흔들리지 않았다.');
}
적기(`  ② 이름 있는 관     ${관 === null ? '(못 쟀다)' : 관 ? `섰다 (${관이름})` : '🔴 없다'}`);
적기(`  ③ 다리 프로세스    ${다리 === null ? '(못 쟀다)' : 다리 === 1 ? '1벌 (정상)' : 다리 === 0 ? '🔴 0벌' : `🔴 ${다리}벌 — 서로 관을 뺏는다`}`);
적기(`  ④ 다리가 선 때     ${선때 || '(기록 없음)'}`);
적기(`  ⑤ 오늘 끊긴 횟수   ${끊김 === null ? '(못 쟀다)' : 끊김}`);
적기('');

let 코드 = 0;
if (갈렸나) {
  적기('🔴 **까닭은 계정이 갈린 것이다** — 다리·관이 멀쩡해도 방이 달라서 목록이 빈다.');
  적기(`   처방: 크롬 옆 Claude 패널을 **앱이 지금 쓰는 계정**(위 ①의 ${앱u.slice(0, 8)}…)으로 로그인한다.`);
  적기('        그 계정의 메일 주소는 앱 설정 화면이 안다 — `~/.claude.json` 의 주소가 아니다.');
  적기('   ⚠ 로그인 뒤에도 안 붙으면 **확장을 다시 띄운다**(chrome://extensions 에서 껐다 켜기).');
  적기('     확장의 배경 일꾼이 옛 계정 방에 든 채로 새 로그인을 못 따라오는 자국이 09-07 에 있었다.');
  코드 = 1;
} else if (다리 === 0 || 관 === false) {
  적기('🔴 **다리가 안 섰다** — 크롬 쪽이 원인이다.');
  적기('   처방: 크롬에서 Claude 옆 패널을 한 번 연다(패널을 열어야 확장이 다리를 띄운다).');
  코드 = 1;
} else if (다리 > 1) {
  적기('🔴 **다리가 여러 벌이다** — 관 이름은 사용자당 하나뿐이라 서로 뺏는다.');
  적기('   처방: 크롬 창을 하나만 남기고 닫는다(프로필이 여럿이면 쓰던 것 하나만).');
  코드 = 1;
} else {
  적기('✅ 다리·관은 **섰다.** 그런데도 `list_connected_browsers` 가 빈 목록이면 원인은 하나다:');
  적기('   🔑 **이 대화가 다리보다 «먼저» 열렸다.** 세션은 열릴 때 관에 붙어서, 그 뒤에 다리가');
  적기('      다시 서면 영영 안 붙는다(확장을 껐다 켜거나 크롬을 다시 열면 다리가 다시 선다).');
  적기(`      → 처방: **새 대화를 연다.** (다리가 선 때 = ${선때 || '기록 없음'} · 이보다 늦게 연 대화라야 붙는다)`);
  적기('   🚫 계정을 다시 맞추지 마라 — 위 ①이 대화창 계정이고, 이 값이 맞으면 계정은 원인이 아니다.');
}

if (끊김 !== null && 끊김 >= 3) {
  적기('');
  적기(`⚠ 오늘 ${끊김}번 끊겼다 — 크롬 창·프로필이 여럿이거나 확장을 자주 껐다 켠 자국이다.`);
  적기('   끊길 때마다 «그때 열려 있던 대화»가 전부 떨어진다. 붙여 쓸 일이 있으면 크롬을 먼저 안정시키고 대화를 연다.');
}

process.exit(코드);

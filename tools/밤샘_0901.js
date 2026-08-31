#!/usr/bin/env node
/**
 * 밤샘 0901 — 까몽 확정 세트 남은 6장(좌34 + 몸 다섯)을 «밤 길이만큼 기다리며» 굽는다
 *   (유호 지시 09-01 「나 이제 자러갈테니까 지금 남은거 다 구워줘」)
 *
 * ■ 이 파일이 하는 일은 둘뿐이다 — ①기다림 상한을 밤 길이로 올리고 ②로그를 «스스로» 파일에 쓴다.
 *   과녁·순서·재개 안전은 전부 밤샘_0831 이 쥔다(사본을 만들지 않는다 — 두 벌이 되면 반드시 갈린다).
 *
 * ■ 🔴 왜 ①이 필요했나 — 08-31 아침의 실패를 그대로 다시 살 뻔했다
 *   그날 ①단계는 램이 «없어서»가 아니라 **램이 나는 시각이 상한보다 늦어서** 건너뛰었다
 *   (07:52 착수 → 10:22 에 150분 소진 → 스킵). 여유 램을 쥔 것은 유호님 창이고
 *   (09-01 실측: claude 24개 2,247MB · ChatGPT 1,198MB · 크롬 1,054MB = 4,499MB),
 *   그 창이 «언제» 닫히는지는 굽기가 못 정한다. 150분은 «낮에» 거는 판의 값이다.
 *   ⇒ 밤새 걸어 두는 판에서는 상한이 «밤 길이»여야 한다 — 10시간.
 *   ⚠ 무한은 안 만든다. 아침에 「기다리다 끝났다」가 로그에 남아야 다음 밤을 고칠 수 있다.
 *
 * ■ 🔴 왜 ②가 필요했나 — 09-01 02:34 실측, 그리고 그 처방이 다시 데인 자리
 *   ⓐ WMI 로 띄운 드라이버가 **`^C` 를 맞고 죽었다**(로그 마지막 글자가 그것이다).
 *      WMI `Win32_Process.Create` 만으로는 콘솔 신호 그룹에서 «안» 벗어난다 —
 *      떼어냈다고 읽히지만 부른 쪽 콘솔이 Ctrl+C 를 받으면 같이 죽는다.
 *      ⇒ `Win32_ProcessStartup.CreateFlags = 520`
 *        (DETACHED_PROCESS 8 | CREATE_NEW_PROCESS_GROUP 512) 로 띄운다.
 *   ⓑ 그런데 그렇게 띄우자 이번엔 **로그가 0바이트**가 됐다 — 콘솔에서 떼면 `cmd … > 파일` 의
 *      표준출력 핸들이 자식에게 안 닿는다. 「돌고는 있는데 눈이 없다」는 상태다.
 *      ⇒ 리디렉션에 기대지 않고 이 파일이 stdout 을 **직접 파일로** 돌린다.
 *        그러면 띄우개에서 `cmd.exe /c` 와 `>` 가 통째로 필요 없어진다(프로세스도 하나 준다).
 *   🔑 두 실패가 같은 것을 말한다: **「떼어냈다」와 「보인다」는 각각 재야 한다.**
 *      살아 있는지는 프로세스로, 진행하는지는 로그로 — 하나로 둘을 못 잰다.
 *
 * ■ 바닥은 정본 6,000 그대로다 — 한시 3,600 은 규약이 «스래싱 감시 필수»인데
 *   밤새 감시할 세션이 없다(유호님이 창을 닫고 주무신다). 감시 없는 낮은 바닥은
 *   08-30 04:51 의 「38분에 0장」을 다시 사는 길이다.
 *
 * 띄우는 법(PowerShell · 콘솔에서 완전히 뗀다):
 *   $si = ([WMIClass]'Win32_ProcessStartup').CreateInstance()
 *   $si.CreateFlags = 520; $si.ShowWindow = 0
 *   ([WMIClass]'Win32_Process').Create('"C:\Program Files\nodejs\node.exe" "…\tools\밤샘_0901.js"', '…\SYNK-appsscript', $si)
 * 🔑 판정은 로그가 아니라 파일이다 — 아침에 볼 것은 `docs/캐릭터/친구공방_0825/` 와 `docs/까몽_시안.html`.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

/* ① 램문지기가 읽는 자리 — require 보다 «먼저» 서야 한다(모듈은 로드 때 한 번 읽는다). */
process.env.RAM_WAIT_MIN = process.env.RAM_WAIT_MIN || '600';

/* ② stdout·stderr 을 파일로 직접 돌린다. 이어쓰기('a')라 재기동해도 앞 밤이 안 지워진다. */
const 로그경로 = process.env.RAM_LOG_PATH
  || path.join(process.env.TEMP || process.env.TMP || '.', '밤샘0901.log');
const 로그 = fs.openSync(로그경로, 'a');
const 쓰기 = (s) => { try { fs.writeSync(로그, s); } catch (_) { /* 로그가 굽기를 막지 않는다 */ } return true; };
process.stdout.write = 쓰기;
process.stderr.write = 쓰기;

쓰기(`\n───── 밤샘 0901 런처 — 상한 ${process.env.RAM_WAIT_MIN}분 · pid ${process.pid} · 로그 ${로그경로}\n`);

require('./밤샘_0831.js');

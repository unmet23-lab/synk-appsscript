'use strict';
/**
 * 백업 되살리기 — 하루 한 번 도는 백업 예약이 실패하거나 끊겼으면 그 예약을 한 번 다시 돌린다. AI를 부르지 않는다(2026-11-26).
 * 유호님 11-25 「고치기까지 맡기기」 가운데 기계가 할 수 있는 몫이다. 하루 한 번짜리는 한 번 실패하면 다음 날까지 비어 있었다 —
 * 11-23 05:36 PC 재시작으로 끊긴 매일 백업과 복원 묶음, 11-18 13:58에 실패한 미디어 백업이 모두 24시간 뒤에야 돌았다.
 * Windows 예약의 「실패하면 다시 시작」은 종료 코드가 0이 아닌 실행을 다시 돌리지 않았다(11-18 미디어, 예약에 2번 · 30분이 걸려 있었다).
 *
 * 새로 하는 일은 「그 예약을 지금 한 번 시작」뿐이다. 예약의 명령 · 설정 · 백업 코드는 건드리지 않고, 겹쳐 돌지 않는 것은 예약(IgnoreNew)과
 * 백업의 잠금이 지킨다. 그 밖의 알림(30분 · 2시간마다 도는 백업, 운영 사본, SNS, 조사)은 저절로 다시 돌거나 여기서 풀 수 없다.
 *
 * 「SYNK 알림 해결」(15분)의 사전 확인이 부른다. 한 번에 하나만, 셋 가운데 도는 것이 없을 때만 시작한다.
 *   - 백업 상태(backup-health.json)를 40분 안에 확인했고, 그 칸이 실패 · 일부 실패 · 중단 · 지연 · 예약 실패이고, 사유 코드가 모두 아래 목록에 있다.
 *     열쇠 없음 · 의도적 중지 · 자료 불일치처럼 다시 돌려도 같은 사유는 목록에 없다.
 *   - 마지막 실행이 20분 넘게 지났고 다음 예약까지 3시간 넘게 남았다.
 *   - 같은 실패에는 한 번만이다. 한 번 시작했으면 다음 정기 회차가 돌 때까지 그 예약을 다시 시작하지 않는다. 사흘에 두 번까지다.
 *   - 시작 직전에 Windows 예약 셋을 다시 읽는다. 하나라도 돌거나, 그사이 새로 돌았거나, 사람이 작업 스케줄러에서 끝낸 회차면 시작하지 않는다.
 * 끄기: 기록 방에 「되살리기_꺼둠」 파일을 둔다. 백업을 일부러 멈춘 동안(원본창고 upload.stop)에도 시작하지 않는다.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const 다시돌릴예약 = [
  { 예약: 'SYNK 매일 백업', 칸: ['server', 'workspace'] },
  { 예약: 'SYNK 복원 묶음 백업', 칸: ['restorebundle'] },
  { 예약: 'SYNK 미디어 원본 백업', 칸: ['media'] },
];
// attention은 예약이 새 영수증을 쓰기 전에 실패한 경우다(앞 영수증은 성공이고 사유가 SCHEDULE_LAST_RUN_FAILED). 예약이 꺼진 attention은 사유가 목록에 없다.
const 다시돌릴상태 = new Set(['failed', 'partial_failure', 'interrupted', 'missed', 'attention']);
const 다시돌릴코드 = new Set(['PROCESS_OR_HEARTBEAT_MISSING', 'RUN_OVERRUN', 'BACKUP_INTERRUPTED', 'BACKUP_PARTIAL_FAILURE', 'BACKUP_RUNNER_FAILED',
  'BACKUP_STALE', 'DAILY_RUN_MISSED', 'SCHEDULE_LAST_RUN_FAILED', 'MEDIA_RUNNER_FAILED', 'MEDIA_STAGE_FAILED']);
const 분 = 60_000, 시간 = 60 * 분;
const 장부이름 = '되살리기.json', 끔이름 = '되살리기_꺼둠';
// 0x41306. 작업 스케줄러의 「끝내기」나 실행 시간 제한으로 멈춘 회차다. PC를 다시 켜서 끊긴 회차는 0x40010004라 걸리지 않는다(docs/현장노트/백업_업로드.md).
const 끝낸회차 = 267014;

function JSON읽기(파일) { try { return JSON.parse(fs.readFileSync(파일, 'utf8').replace(/^﻿/, '')); } catch { return null; } }
function JSON쓰기(파일, 값) {
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  const 임시 = `${파일}.${process.pid}.tmp`;
  fs.writeFileSync(임시, JSON.stringify(값, null, 1) + '\n');
  fs.renameSync(임시, 파일);
}
const 시각 = (값) => { const t = Date.parse(값); return Number.isFinite(t) ? t : null; };
const 기본상태파일 = () => process.env.SYNK_BACKUP_HEALTH || path.join(os.homedir(), 'Documents', 'SYNK_원본창고', 'backup-health.json');

/** 고른 예약을 지금 상태로 다시 거른다. 시작하면 안 되는 까닭, 없으면 null. */
function 막는까닭(줄들, 고른, 지금) {
  if (!Array.isArray(줄들)) return '예약 상태를 읽지 못함';
  if (줄들.some((r) => r?.state === 'Running' || r?.state === 'Queued')) return '백업이 도는 중';
  const 줄 = 줄들.find((r) => r?.name === 고른.예약);
  if (!줄 || 줄.enabled !== true || 줄.state !== 'Ready') return '예약이 없거나 꺼짐';
  if (줄.result === 끝낸회차) return '사람이 끝낸 회차';
  // 감시(backup-task-status.ps1)와 같은 값을 같은 꼴로 읽는다. 조금이라도 다르면 그사이 새로 돈 것이다.
  const 앞 = 시각(줄.last), 다음 = 시각(줄.next);
  if (앞 === null || 앞 !== 시각(고른.앞실행)) return '그사이 새로 돎';
  if (다음 === null || 다음 - 지금 < 3 * 시간) return '다음 예약이 가까움';
  return null;
}

/** 지금 시작할 예약 하나와 까닭. 없으면 { 이유 }. 줄들(예약 셋의 지금 상태)을 주면 그것으로도 거른다. 파일도 예약도 건드리지 않는다. */
function 고르기(상태, 회차들, 지금, 줄들) {
  const 확인 = 시각(상태?.checkedAt);
  if (상태?.schemaVersion !== 1 || !Array.isArray(상태.components) || 확인 === null) return { 이유: '백업 상태를 읽지 못함' };
  if (지금 - 확인 > 40 * 분 || 확인 - 지금 > 5 * 분) return { 이유: '백업 상태가 오래됨' };
  const 칸들 = new Map(상태.components.map((c) => [c?.id, c]));
  const 대상 = 다시돌릴예약.map((x) => ({ ...x, 줄: x.칸.map((id) => 칸들.get(id)).filter(Boolean) }));
  if (대상.some((x) => x.줄.some((c) => c.task?.state === 'Running' || c.status === 'running'))) return { 이유: '백업이 도는 중' };
  let 막힘 = '';
  for (const x of 대상) {
    const 걸린 = x.줄.filter((c) => 다시돌릴상태.has(c.status));
    if (!걸린.length) continue;
    const 코드 = [...new Set(걸린.flatMap((c) => (Array.isArray(c.codes) ? c.codes : [])))].sort();
    if (!코드.length || 코드.some((값) => !다시돌릴코드.has(값))) continue;
    const 예약 = 걸린[0].task;
    const 앞 = 시각(예약?.lastRunAt), 다음 = 시각(예약?.nextRunAt);
    if (!예약?.exists || !예약.enabled || 예약.state !== 'Ready' || 앞 === null || 다음 === null) continue;
    if (지금 - 앞 < 20 * 분 || 다음 - 지금 < 3 * 시간) continue;
    const 같은 = 회차들.filter((r) => r?.예약 === x.예약);
    // 시작이 안 됐거나 되살린 회차가 또 실패했으면 마지막 실행이 아직 그때의 다음 정기 시각보다 앞이다 — 같은 실패다.
    if (같은.some((r) => 앞 < (시각(r.다음정기) ?? (시각(r.시각) ?? 지금) + 24 * 시간))) continue;
    if (같은.filter((r) => 지금 - (시각(r.시각) ?? 지금) < 72 * 시간).length >= 2) continue;
    const 고른 = { 예약: x.예약, 칸: 걸린.map((c) => c.id), 코드, 앞실행: 예약.lastRunAt, 다음정기: 예약.nextRunAt };
    if (줄들 === undefined) return 고른;
    const 까닭 = 막는까닭(줄들, 고른, 지금);
    if (!까닭) return { ...고른, 다음정기: 줄들.find((r) => r.name === x.예약).next };
    막힘 ||= `${x.예약}: ${까닭}`;
  }
  return { 이유: 막힘 || '다시 돌릴 백업 없음' };
}

/** PowerShell 인자. 한글이 명령줄에서 깨지지 않게 UTF-16LE base64로 넘긴다. 예약 이름은 위 목록의 글 그대로라 바깥 글이 섞이지 않는다. */
const 인자 = (글) => ['-NoProfile', '-NonInteractive', '-EncodedCommand',
  Buffer.from(['[Console]::OutputEncoding=[Text.Encoding]::UTF8;', ...글].join(' '), 'utf16le').toString('base64')];

/** 예약 셋의 지금 상태(시각은 UTC). 상태 파일은 40분까지 묵을 수 있다. */
const 조회명령 = () => 인자([`$ErrorActionPreference = 'Stop'; $names = @(${다시돌릴예약.map((x) => `'${x.예약}'`).join(', ')});`,
  // 이름으로 하나씩 찾으면 조회 오류와 미등록이 같아 보인다. 모두 읽고 거른다 — 못 읽으면 명령이 실패로 끝난다.
  '$rows = foreach ($t in @(Get-ScheduledTask | Where-Object { $names -contains $_.TaskName })) {',
  '$i = $t | Get-ScheduledTaskInfo;',
  '@{ name = $t.TaskName; state = $t.State.ToString(); enabled = [bool]$t.Settings.Enabled; result = [long]$i.LastTaskResult;',
  "last = $(if ($i.LastRunTime.Year -gt 2000) { ([DateTimeOffset]$i.LastRunTime).ToUniversalTime().ToString('o') });",
  "next = $(if ($i.NextRunTime.Year -gt 2000) { ([DateTimeOffset]$i.NextRunTime).ToUniversalTime().ToString('o') }) } };",
  'ConvertTo-Json -InputObject @($rows) -Depth 3 -Compress']);

/** 예약 하나를 시작하고 도는지 본다. */
const 시작명령 = (예약) => 인자([`$n = '${예약}';`, 'Start-ScheduledTask -TaskName $n -ErrorAction Stop;', 'Start-Sleep -Seconds 5;', '(Get-ScheduledTask -TaskName $n).State']);

/** 한 번 본다. 시작했으면 그 회차를, 아니면 { 이유 }를 준다. 시작하기 전에 적어, 도중에 끊겨도 같은 예약을 되풀이해 시작하지 않는다.
 *  다시 시작하면 백업이 영수증을 새 회차 것으로 덮는다. 증거(칸)가 주는 앞 회차의 실패 단계를 회차에 함께 남긴다. */
function 되살리기({ 방, 실행, 지금 = new Date(), 상태파일 = 기본상태파일(), 증거 = () => '' }) {
  const 멈춤 = () => (fs.existsSync(path.join(방, 끔이름)) ? '꺼 둠' : fs.existsSync(path.join(path.dirname(상태파일), 'upload.stop')) ? '백업을 일부러 멈춘 동안' : '');
  if (멈춤()) return { 이유: 멈춤() };
  const 파일 = path.join(방, 장부이름);
  const 있음 = fs.existsSync(파일), 장부 = JSON읽기(파일);
  // 장부를 못 읽으면 몇 번 돌렸는지 모른다. 시작하지 않는다.
  if (있음 && !Array.isArray(장부?.회차)) return { 이유: '되살리기 기록을 읽지 못함' };
  const 회차들 = 장부?.회차 || [];
  const 상태 = JSON읽기(상태파일), 먼저 = 고르기(상태, 회차들, +지금);
  if (!먼저.예약) return 먼저;
  const 조회 = 실행('powershell', 조회명령());
  let 줄들 = null;
  try { 줄들 = 조회?.code === 0 ? JSON.parse(String(조회.stdout).replace(/^\uFEFF/, '')) : null; } catch {}
  const 고른 = 고르기(상태, 회차들, +지금, 줄들);
  if (!고른.예약) return 고른;
  let 앞영수증 = '';
  try { 앞영수증 = String(증거(고른.칸) || '').slice(0, 2400); } catch {}
  const 회차 = { ...고른, ...(앞영수증 ? { 앞영수증 } : {}), 시각: new Date(+지금).toISOString(), 결과: '시작하는 중' };
  const 적기 = () => JSON쓰기(파일, { 회차: [...회차들.slice(-99), 회차] });
  // 조회하는 동안 껐을 수 있다. 시작 직전에 다시 본다.
  if (멈춤()) return { 이유: 멈춤() };
  적기();
  const r = 실행('powershell', 시작명령(고른.예약));
  const 본것 = String(r?.stdout || '').trim().split(/\s+/).pop() || '';
  회차.결과 = r?.code === 0 && /^(Running|Queued|Ready)$/.test(본것) ? (본것 === 'Ready' ? '시작했으나 도는 것을 못 봄' : '시작함') : '시작하지 못함';
  적기();
  return 회차;
}

/** 진단 지시문에 넣을 최근 이틀의 되살리기. */
function 최근기록(방, 지금 = new Date()) {
  const 회차들 = JSON읽기(path.join(방, 장부이름))?.회차;
  if (!Array.isArray(회차들)) return [];
  return 회차들.filter((r) => { const t = 시각(r?.시각); return t !== null && +지금 - t < 48 * 시간; }).slice(-6);
}

module.exports = { 되살리기, 고르기, 막는까닭, 조회명령, 시작명령, 최근기록, 다시돌릴예약, 다시돌릴코드 };

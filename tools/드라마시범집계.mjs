#!/usr/bin/env node
// 드라마 말하기 몽골 학습자 시범의 읽기 전용 집계(2026-11-03, docs/드라마말하기_몽골시범_20261103.md §1 분모 줄 · §7 ⑤).
// 참가 계정 목록(참가 번호 · SYNK ID 이메일 — 비공개 보관함, 저장소 밖)을 받아 그 계정의 드라마 학습 기록만 읽고 §1의 숫자만 낸다.
//
//   node tools/드라마시범집계.mjs --참가 <목록 파일> [--기준 <ISO 시각>] [--json]        운영 DB 읽기(유호님 승인 뒤에만 — 설계 §8 ⑦)
//   node tools/드라마시범집계.mjs --참가 <목록 파일> --관리 [--기준 …] [--json]            운영 읽기를 관리 API의 read_only 질의로(11-04 유호님 승인 · 접속 주소 불필요)
//     --관리는 늘 운영 프로젝트를 읽는다(11-11). talk `.env`의 SUPABASE_PROJECT_REF는 리허설 기본값이라 쓰지 않는다 — 그 값을 따라가
//     실제 계정을 「없음」으로 낸 적이 있다. 다른 프로젝트는 환경 변수 DRAMA_PILOT_PROJECT_REF(또는 SUPABASE_PROJECT_REF)를 직접 줄 때만.
//   node tools/드라마시범집계.mjs --참가 <목록 파일> --사건 <사건 JSON> [--기준 …] [--json]  내려받은 사건 · 합성 자료로(DB 없음)
//
// · 목록 파일: CSV(`참가번호,이메일`, 머리줄은 있어도 없어도) 또는 JSON 배열 [{"번호": "M01", "이메일": "…"}].
// · DB: 환경 변수 DRAMA_PILOT_READ_DATABASE_URL(읽기 전용 역할 권장). 한 연결 · `begin read only` 거래 · 문장 시간 제한 안에서
//   auth.users(이메일 → id) → engine.synk_auth_links → engine.synk_accounts(learning_enabled · status) → engine.synk_learning_events(payload)만
//   SELECT한다. 쓰기 · 지우기 문장은 없다.
// · 출력: 숫자와 참가 번호뿐이다. 이메일 · 계정 id · 받아 적은 글은 찍지 않는다(사건에도 받아 적은 글은 없다 — 처리방침).
// · 셈의 정의는 아래 aggregate 머리 주석. 제출본 보고 규칙(설계 §1): 「N명 중 n명」, %를 쓰지 않는다, 판정 있음과 맞음을 나눈다,
//   인식 불명 · 판정 보류도 숨기지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import PILOT from '../experiences/drama/pilot/content.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME = 'drama-s1';
const SCENE_LINES = PILOT.scene.filter((x) => x.type === 'student').map((x) => x.id);
const B_ID = PILOT.transfer.id, C_ID = PILOT.delayed.id;
const DAY = 86400000;
// Atlas 지연 관측 d7 창(설계 §17): 기준 시도 + 7일 ~ + 10일.
const C_OPEN = 7 * DAY, C_CLOSE = 10 * DAY;
const JUDGED = new Set(['pass', 'note-ending', 'note-length', 'note-missing']);
const TYPES = ['practice.presented', 'practice.attempted', 'practice.helped', 'record.excluded'];

// 목록 파일 → [{no, email}]. 이메일은 비교에만 쓰고 결과에 내지 않는다.
export function readParticipants(text) {
  const t = String(text).replace(/^﻿/, '').trim();
  const rows = t.startsWith('[') ? JSON.parse(t).map((r) => [r.번호 ?? r.no, r.이메일 ?? r.email])
    : t.split(/\r?\n/).map((l) => l.split(',').map((x) => x.trim())).filter((r) => r.length >= 2 && r[1].includes('@'));
  const out = rows.map(([no, email]) => ({ no: String(no ?? '').trim(), email: String(email ?? '').trim().toLowerCase() }));
  if (!out.length) throw new Error('참가 목록이 비었다');
  const bad = out.filter((r) => !/^[A-Za-z0-9_-]{1,20}$/.test(r.no) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email));
  if (bad.length) throw new Error(`참가 목록 줄 ${bad.length}개가 「번호,이메일」 꼴이 아니다`);
  for (const key of ['no', 'email']) if (new Set(out.map((r) => r[key])).size !== out.length) throw new Error(`참가 목록에 같은 ${key === 'no' ? '번호' : '이메일'}가 두 번 있다`);
  return out;
}

const time = (e) => Date.parse(e.at);
const phaseOf = (p) => { const m = /^drama-s1\.(scene|retake|transfer)\.(.+)$/.exec(p.taskId || ''); return m ? { phase: m[1], line: m[2] } : null; };

// 한 계정의 드라마 사건 → 그 사람의 줄. 사건은 서버 순서(server_seq)로 온다.
export function personOf(events = []) {
  const presented = [], byId = new Map(), attempts = new Map(), helps = new Map(), excluded = new Set();
  for (const e of events) {
    if (e?.type === 'practice.presented') { const ph = phaseOf(e); if (!ph) continue; const p = { ...ph, id: e.id, at: time(e) }; presented.push(p); byId.set(e.id, p); attempts.set(e.id, []); helps.set(e.id, []); }
    else if (e?.type === 'record.excluded' && e.targetId) excluded.add(e.targetId);
  }
  for (const e of events) {
    if (e?.type === 'practice.attempted' && attempts.has(e.presentationId)) attempts.get(e.presentationId).push({ id: e.id, no: e.attemptNo, verdict: e.verdict, reason: e.reason ?? null, choice: e.choice?.selectedId ?? null, at: time(e) });
    else if (e?.type === 'practice.helped' && helps.has(e.presentationId)) helps.get(e.presentationId).push({ level: e.level, at: time(e) });
  }
  for (const list of attempts.values()) list.sort((a, b) => a.no - b.no);
  const live = (pid) => attempts.get(pid).filter((a) => !excluded.has(a.id));
  const of = (phase, line) => presented.filter((p) => p.phase === phase && (!line || p.line === line)).sort((a, b) => a.at - b.at);
  const all = [...attempts.values()].flat();
  const person = { events: events.length, dramaPresented: presented.length, sceneDone: false, note: null, take2: null, b: null, c: null,
    unheard: all.filter((a) => a.reason === 'unanswered').length, unclear: all.filter((a) => a.choice === 'unclear').length, hold: all.filter((a) => a.choice === 'hold').length,
    firstTakeSeconds: null };
  // 장면을 끝냄: 장면 학생 줄마다 뺀 것을 뺀 시도가 하나 이상 있는 보임이 있다.
  person.sceneDone = SCENE_LINES.every((line) => of('scene', line).some((p) => live(p.id).length > 0));
  // 장면 시작 → 첫 테이크: 첫 장면 보임 시각 → 장면 보임의 첫 시도 시각.
  const scenes = of('scene');
  if (scenes.length) { const first = all.filter((a) => scenes.some((p) => attempts.get(p.id).includes(a))).sort((a, b) => a.at - b.at)[0]; if (first) person.firstTakeSeconds = Math.round((first.at - scenes[0].at) / 1000); }
  // 노트: 장면 보임에 남은 첫 explanation 도움. 종류는 그 도움 전 마지막 판정 시도(pass · note-… · hold)의 갈래.
  const noted = scenes.map((p) => ({ p, help: helps.get(p.id).filter((h) => h.level === 'explanation').sort((a, b) => a.at - b.at)[0] })).filter((x) => x.help).sort((a, b) => a.help.at - b.help.at)[0];
  if (noted) {
    const before = attempts.get(noted.p.id).filter((a) => a.at <= noted.help.at && (JUDGED.has(a.choice) || a.choice === 'hold'));
    const kind = before.at(-1)?.choice?.startsWith('note-') ? before.at(-1).choice.slice(5) : 'unknown';
    person.note = { line: noted.p.line, kind };
    // 테이크 2: 그 줄의 테이크 2 보임(노트 뒤 첫 보임). 첫 판정 시도(pass · note-…)가 받은 노트 종류가 아니면 고침.
    const retake = of('retake', noted.p.line).find((p) => p.at >= noted.help.at);
    if (!retake) person.take2 = { status: 'none' };
    else {
      const judged = live(retake.id).find((a) => JUDGED.has(a.choice));
      person.take2 = !judged ? { status: 'unjudged' } : { status: judged.choice === `note-${kind}` ? 'same' : 'fixed', result: judged.choice };
    }
  }
  // B · C: 새 상황 보임. 판정 있음(혼자 해 봄) = 뺀 것을 뺀 시도 가운데 correct · incorrect(Trail이 첫 시도 · 모범 전 · 검수 통과 · 규칙 확신일 때만 매긴다).
  const transferRow = (line) => {
    const ps = of('transfer', line); if (!ps.length) return null;
    const p = ps[0], firstAttempt = attempts.get(p.id)[0];
    // 모범을 먼저 봤으면 판정이 매겨졌어도 혼자 해 봄이 아니다(화면은 그때 판정을 매기지 않지만, 셈이 그것에 기대지 않게).
    const hintFirst = helps.get(p.id).some((h) => h.level === 'answer' && (!firstAttempt || h.at <= firstAttempt.at));
    const list = live(p.id), judged = hintFirst ? null : list.find((a) => a.verdict === 'correct' || a.verdict === 'incorrect');
    return { presented: true, judged: !!judged, correct: judged?.verdict === 'correct', at: judged?.at ?? null, hintFirst, attempts: list.length,
      excludedJudged: attempts.get(p.id).some((a) => excluded.has(a.id) && (a.verdict === 'correct' || a.verdict === 'incorrect')) };
  };
  person.b = transferRow(B_ID);
  person.c = transferRow(C_ID);
  return person;
}

// §1 분모 줄. people: [{no, account:{found, learningEnabled, status} | null, events: [...]}], asOf: 집계 시각(ms).
//  (가) 장면을 끝낸 사람 / 노트 없이 끝난 사람 / 노트를 받은 사람 / 고친 사람(테이크 2 첫 판정 시도에 그 노트 종류가 없음)
//      + 같은 노트 다시 · 테이크 2 판정 없음 · 테이크 2 안 함, 노트 종류별
//  (나) 장면을 끝낸 사람 / B를 본 사람 / B 판정 있음(혼자 해 봄) / 맞음 + 모범 먼저 · 판정 없이 지나감 · 「제가 한 말과 달라요」로 뺀 판정
//  (다) C 자격(B 판정 있음) / 창 전 · 창 안 미시도 · 창 놓침 / C를 본 사람 / C 판정 있음 / 맞음
//  인식: 안 들림 · 인식 불명(unclear) · 판정 보류(hold) 테이크 수와 사람 수
export function aggregate(people, asOf = Date.now()) {
  const rows = people.map((x) => ({ no: x.no, account: x.account, ...personOf(x.events || []) }));
  const n = (f) => rows.filter(f).length;
  const scene = rows.filter((r) => r.sceneDone);
  const noted = rows.filter((r) => r.note);
  const kinds = {}; for (const r of noted) kinds[r.note.kind] = (kinds[r.note.kind] || 0) + 1;
  const bEligible = rows.filter((r) => r.b?.judged);
  const cWindow = (r) => { const t = r.b.at; return asOf < t + C_OPEN ? 'before' : asOf <= t + C_CLOSE ? 'open' : 'after'; };
  const times = rows.map((r) => r.firstTakeSeconds).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  return {
    asOf: new Date(asOf).toISOString(),
    participants: rows.length,
    accounts: { found: n((r) => r.account?.found), learningEnabled: n((r) => r.account?.learningEnabled), withDramaRecord: n((r) => r.dramaPresented > 0) },
    ga: { sceneDone: scene.length, noNote: n((r) => r.sceneDone && !r.note), noted: noted.length, fixed: n((r) => r.take2?.status === 'fixed'),
      sameAgain: n((r) => r.take2?.status === 'same'), take2Unjudged: n((r) => r.take2?.status === 'unjudged'), take2None: n((r) => r.take2?.status === 'none'), kinds },
    na: { sceneDone: scene.length, bSeen: n((r) => r.b), bJudged: bEligible.length, bCorrect: n((r) => r.b?.correct), bHintFirst: n((r) => r.b?.hintFirst && !r.b.judged),
      bUnjudged: n((r) => r.b && !r.b.judged && !r.b.hintFirst && !r.b.excludedJudged), bExcluded: n((r) => r.b?.excludedJudged && !r.b.judged), sceneDoneNoB: n((r) => r.sceneDone && !r.b) },
    da: { eligible: bEligible.length, beforeWindow: bEligible.filter((r) => !r.c && cWindow(r) === 'before').length, openNotTried: bEligible.filter((r) => !r.c && cWindow(r) === 'open').length,
      missed: bEligible.filter((r) => !r.c && cWindow(r) === 'after').length, cSeen: n((r) => r.c), cJudged: n((r) => r.c?.judged), cCorrect: n((r) => r.c?.correct),
      cHintFirst: n((r) => r.c?.hintFirst && !r.c.judged), cUnjudged: n((r) => r.c && !r.c.judged && !r.c.hintFirst && !r.c.excludedJudged), cExcluded: n((r) => r.c?.excludedJudged && !r.c.judged) },
    recognition: { unheardTakes: rows.reduce((s, r) => s + r.unheard, 0), unclearTakes: rows.reduce((s, r) => s + r.unclear, 0), holdTakes: rows.reduce((s, r) => s + r.hold, 0),
      people: n((r) => r.unheard + r.unclear + r.hold > 0) },
    firstTakeSeconds: { people: times.length, median: times.length ? times[Math.floor((times.length - 1) / 2)] : null, values: times },
    rows: rows.map((r) => ({ no: r.no, account: !r.account?.found ? 'none' : r.account.learningEnabled ? 'on' : 'off', events: r.events, sceneDone: r.sceneDone,
      note: r.note?.kind ?? null, take2: r.take2?.status ?? null, b: !r.b ? null : r.b.judged ? (r.b.correct ? 'correct' : 'incorrect') : r.b.hintFirst ? 'hint' : 'unjudged',
      c: !r.c ? (r.b?.judged ? cWindow(r) : null) : r.c.judged ? (r.c.correct ? 'correct' : 'incorrect') : r.c.hintFirst ? 'hint' : 'unjudged',
      unheard: r.unheard, unclear: r.unclear, hold: r.hold, firstTakeSeconds: r.firstTakeSeconds })),
  };
}

const of = (n, m) => `${m}명 중 ${n}명`;
export function report(a) {
  const K = { ending: '끝맺음', length: '길이', missing: '빠진 말', unknown: '종류 모름' };
  const lines = [
    `드라마 말하기 몽골 시범 집계 · 기준 ${a.asOf}`,
    `참가 ${a.participants}명 · 계정 찾음 ${a.accounts.found} · 학습 기록 동의 ${a.accounts.learningEnabled} · 드라마 기록 있음 ${a.accounts.withDramaRecord}`,
    '',
    '(가) 노트로 고친다',
    `  장면을 끝낸 사람 ${of(a.ga.sceneDone, a.participants)}`,
    `  노트 없이 끝난 사람 ${of(a.ga.noNote, a.ga.sceneDone)}`,
    `  노트를 받은 사람 ${of(a.ga.noted, a.ga.sceneDone)}${Object.keys(a.ga.kinds).length ? ` (${Object.entries(a.ga.kinds).map(([k, v]) => `${K[k] || k} ${v}`).join(' · ')})` : ''}`,
    `  고친 사람 ${of(a.ga.fixed, a.ga.noted)} — 같은 노트 다시 ${a.ga.sameAgain} · 테이크 2 판정 없음 ${a.ga.take2Unjudged} · 테이크 2 안 함 ${a.ga.take2None}`,
    '',
    '(나) 다른 상황에서 말한다(B)',
    `  장면을 끝낸 사람 ${a.na.sceneDone}명 · B를 본 사람 ${a.na.bSeen}명(장면 뒤 B 없음 ${a.na.sceneDoneNoB})`,
    `  B 첫 판정 테이크가 있는 사람 ${of(a.na.bJudged, a.na.sceneDone)}`,
    `  맞은 사람 ${of(a.na.bCorrect, a.na.bJudged)}`,
    `  판정 없음: 모범 먼저 ${a.na.bHintFirst} · 판정 없이 지나감 ${a.na.bUnjudged} · 「제가 한 말과 달라요」로 뺀 판정 ${a.na.bExcluded}`,
    '',
    '(다) 8일 뒤에도(C, 7~10일 창)',
    `  C 자격(B 판정 있음) ${a.da.eligible}명 — 창 전 ${a.da.beforeWindow} · 창 안 아직 ${a.da.openNotTried} · 창 놓침 ${a.da.missed}`,
    `  C를 시도한 사람 ${of(a.da.cSeen, a.da.eligible)}`,
    `  맞은 사람 ${of(a.da.cCorrect, a.da.cSeen)} (판정 있음 ${a.da.cJudged} · 모범 먼저 ${a.da.cHintFirst} · 판정 없음 ${a.da.cUnjudged} · 뺀 판정 ${a.da.cExcluded})`,
    '',
    `인식: 안 들림 ${a.recognition.unheardTakes}테이크 · 인식 불명 ${a.recognition.unclearTakes} · 판정 보류 ${a.recognition.holdTakes} (사람 ${a.recognition.people}명)`,
    `장면 시작 → 첫 테이크: ${a.firstTakeSeconds.people}명 · 가운데값 ${a.firstTakeSeconds.median ?? '-'}초`,
    '',
    '참가 번호별(이메일 없음): 번호 · 계정(on 동의 · off 동의 꺼짐 · none 없음) · 사건 · 장면 · 노트 · 테이크2 · B · C',
    ...a.rows.map((r) => `  ${r.no} · ${r.account} · ${r.events} · ${r.sceneDone ? '끝' : '-'} · ${r.note ?? '-'} · ${r.take2 ?? '-'} · ${r.b ?? '-'} · ${r.c ?? '-'}`),
  ];
  return lines.join('\n');
}

// 운영 DB 읽기. sql은 postgres.js 꼴(tagged template, begin) — 시험은 가짜를 넣는다.
export async function readDatabase(sql, participants) {
  const emails = participants.map((p) => p.email);
  return sql.begin('read only', async (tx) => {
    await tx`set local statement_timeout = '20s'`;
    const accounts = await tx`select lower(u.email) as email, a.synk_user_id::text as id, a.learning_enabled, a.status
      from auth.users u join engine.synk_auth_links l on l.auth_user_id = u.id join engine.synk_accounts a on a.synk_user_id = l.synk_user_id
      where lower(u.email) = any(${emails})`;
    const ids = accounts.map((a) => a.id);
    const events = ids.length ? await tx`select synk_user_id::text as id, payload from engine.synk_learning_events
      where synk_user_id = any(${ids}::uuid[]) and payload->>'type' = any(${TYPES}) order by synk_user_id, server_seq` : [];
    return assemble(participants, accounts, events);
  });
}
function assemble(participants, accounts, events) {
  const byAccount = new Map(accounts.map((a) => [a.id, []]));
  for (const row of events) byAccount.get(row.id)?.push(typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload);
  return participants.map((p) => {
    const a = accounts.find((x) => x.email === p.email);
    return { no: p.no, account: a ? { found: true, learningEnabled: a.learning_enabled === true, status: a.status } : { found: false }, events: a ? dramaOnly(byAccount.get(a.id)) : [] };
  });
}
// 관리 API로 읽기(접속 주소 없이, 저장소 도구들과 같은 SUPABASE_ACCESS_TOKEN). query는 SELECT 한 문장을 받아 줄 배열을 돌려준다 — 시험은 가짜를 넣는다.
export async function readManagement(query, participants) {
  const text = (v) => `'${String(v).replace(/'/g, "''")}'`;
  const accounts = await query(`select lower(u.email) as email, a.synk_user_id::text as id, a.learning_enabled, a.status
    from auth.users u join engine.synk_auth_links l on l.auth_user_id = u.id join engine.synk_accounts a on a.synk_user_id = l.synk_user_id
    where lower(u.email) in (${participants.map((p) => text(p.email)).join(',')})`);
  const ids = accounts.map((a) => a.id);
  const events = ids.length ? await query(`select synk_user_id::text as id, payload from engine.synk_learning_events
    where synk_user_id in (${ids.map((id) => `${text(id)}::uuid`).join(',')}) and payload->>'type' in (${TYPES.map(text).join(',')}) order by synk_user_id, server_seq`) : [];
  return assemble(participants, accounts, events);
}
// 운영 프로젝트(SYNK ID 로그인 · 학습 기록). `tools/me2-face-worker/설치.mjs`의 live 과녁과 같은 값이다.
export const LIVE_PROJECT_REF = 'qiwxeddwwnzkwalpsuty';
// 관리 API 과녁: 토큰은 환경 변수 → talk `.env`, 프로젝트는 환경 변수로 직접 준 값 → 운영. talk `.env`의 REF(리허설 기본값)는 읽지 않는다.
export function managementTarget(env = process.env, talkEnvText = '') {
  const fromFile = (name) => (String(talkEnvText).match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1] || '').trim().replace(/^["']|["']$/g, '');
  const token = env.SUPABASE_ACCESS_TOKEN || fromFile('SUPABASE_ACCESS_TOKEN');
  const ref = env.DRAMA_PILOT_PROJECT_REF || env.SUPABASE_PROJECT_REF || LIVE_PROJECT_REF;
  return { token, ref, live: ref === LIVE_PROJECT_REF };
}
function managementQuery() {
  let talkEnv = ''; try { talkEnv = fs.readFileSync(path.join(ROOT, '..', 'SYNK-talk', '.env'), 'utf8'); } catch {}
  const { token, ref, live } = managementTarget(process.env, talkEnv);
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN이 없다');
  console.error(live ? '읽는 곳: 운영 프로젝트(관리 API · 읽기 전용)' : `읽는 곳: 운영이 아닌 프로젝트 ${ref} — 환경 변수로 준 값이다(관리 API · 읽기 전용)`);
  return async (sqlText) => {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ query: sqlText, read_only: true }) });
    if (!res.ok) throw new Error(`관리 API 읽기 실패 ${res.status}`);
    return res.json();
  };
}
// 이 게임의 사건만(다른 WORLD 게임 사건은 셈에 넣지 않는다).
export function dramaOnly(events = []) {
  const pids = new Set(events.filter((e) => e.type === 'practice.presented' && String(e.taskId || '').startsWith(`${GAME}.`)).map((e) => e.id));
  const attemptIds = new Set(events.filter((e) => e.type === 'practice.attempted' && pids.has(e.presentationId)).map((e) => e.id));
  return events.filter((e) => (e.type === 'practice.presented' && pids.has(e.id)) || (['practice.attempted', 'practice.helped'].includes(e.type) && pids.has(e.presentationId))
    || (e.type === 'record.excluded' && attemptIds.has(e.targetId)));
}

async function main(argv) {
  const known = ['--참가', '--사건', '--기준', '--json', '--관리'];
  const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
  const unknown = argv.filter((a) => a.startsWith('--') && !known.includes(a));
  if (unknown.length || !opt('--참가')) throw new Error(`쓰기: node tools/드라마시범집계.mjs --참가 <목록> [--사건 <JSON>] [--기준 <ISO>] [--json]${unknown.length ? ` — 모르는 인자 ${unknown.join(' ')}` : ''}`);
  const participants = readParticipants(fs.readFileSync(opt('--참가'), 'utf8'));
  const asOf = opt('--기준') ? Date.parse(opt('--기준')) : Date.now();
  if (!Number.isFinite(asOf)) throw new Error('--기준 시각을 읽지 못했다');
  let people;
  if (opt('--사건')) {
    // 사건 파일: { "<참가 번호>": { "learningEnabled": true, "events": [...] } } — 계정이 없으면 그 번호를 빼거나 null.
    const data = JSON.parse(fs.readFileSync(opt('--사건'), 'utf8'));
    people = participants.map((p) => { const d = data[p.no]; return { no: p.no, account: d ? { found: true, learningEnabled: d.learningEnabled !== false } : { found: false }, events: d ? dramaOnly(d.events) : [] }; });
  } else if (argv.includes('--관리')) {
    people = await readManagement(managementQuery(), participants);
  } else {
    const url = process.env.DRAMA_PILOT_READ_DATABASE_URL;
    if (!url) throw new Error('DRAMA_PILOT_READ_DATABASE_URL이 없다(운영 DB 읽기는 유호님 승인 뒤에만 — 설계 §8 ⑦)');
    const require = createRequire(path.join(ROOT, 'package.json'));
    const postgres = require(require.resolve('postgres', { paths: [ROOT, path.join(ROOT, '..', 'SYNK-talk')] }));
    const sql = postgres(url, { max: 1, connect_timeout: 10, idle_timeout: 5, onnotice: () => {}, debug: false });
    try { people = await readDatabase(sql, participants); } finally { await sql.end({ timeout: 5 }); }
  }
  const result = aggregate(people, asOf);
  // 목록에 사람이 있는데 계정을 하나도 못 찾으면 숫자가 아니라 읽기가 틀렸을 수 있다(11-11: 리허설을 읽어 전원 none).
  if (!opt('--사건') && result.participants > 0 && result.accounts.found === 0) console.error('주의: 참가 목록의 계정을 하나도 찾지 못했다 — 이메일 표기와 읽는 프로젝트부터 확인한다(신청만 하고 아직 가입 전이면 정상).');
  console.log(argv.includes('--json') ? JSON.stringify(result, null, 1) : report(result));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => { console.error(String(error.message || error).replace(/postgres(ql)?:\/\/\S+/g, '<DB 주소>')); process.exitCode = 1; });
}

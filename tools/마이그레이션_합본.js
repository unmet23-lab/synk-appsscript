'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { 인자게이트 } = require('../lib/플래그.js');   // 모르는 낱말 거절(공용 판정 · F435)
const { BASE_FILE: CHECK_BASE_FILE, extendCheckQuery } = require('./lib/연동사후상태');

/* 🎯 조준 축은 **없다** — 파일을 합쳐 굽기만 한다(자격증명·네트워크 0). `--운영` 을 안 받는다. */
const 아는플래그 = ['--check'];

const ROOT = path.join(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const OUTPUT = path.join(ROOT, 'supabase', 'L0_스키마.sql');
const CHECK_FILE = path.join(ROOT, 'supabase', '확인_적용후상태.sql');
const FILE_NAME = /^\d{14}_.+_c\d+\.sql$/u;
const CHECKSUM_SLOT = /'([0-9a-f]{64})'([;]?\s*--\s*migration-checksum\b)/g;
const ZERO_CHECKSUM = '0'.repeat(64);

function migrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`마이그레이션 디렉터리가 없다: ${path.relative(ROOT, MIGRATIONS_DIR)}`);
  }

  const names = fs.readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  if (names.length === 0) throw new Error('합칠 마이그레이션 SQL이 0개다');

  const 잘못된이름 = names.filter((name) => !FILE_NAME.test(name));
  if (잘못된이름.length > 0) {
    throw new Error(
      `마이그레이션 파일명은 YYYYMMDDHHMMSS_<영역>_<계약버전>.sql 이어야 한다: ${잘못된이름.join(', ')}`,
    );
  }

  return names.map((name) => path.join(MIGRATIONS_DIR, name));
}

function checksumInfo(buffer, label = 'migration') {
  const source = buffer.toString('utf8');
  if (!Buffer.from(source, 'utf8').equals(buffer)) {
    throw new Error(`${label}: UTF-8 SQL만 허용한다`);
  }

  const declared = [];
  const normalized = source.replace(CHECKSUM_SLOT, (_all, checksum, suffix) => {
    declared.push(checksum);
    return `'${ZERO_CHECKSUM}'${suffix}`;
  });

  if (declared.length < 2) {
    throw new Error(`${label}: migration-checksum 슬롯이 2개보다 적다`);
  }
  if (new Set(declared).size !== 1) {
    throw new Error(`${label}: migration-checksum 슬롯끼리 값이 갈렸다`);
  }

  const calculated = crypto.createHash('sha256').update(Buffer.from(normalized, 'utf8')).digest('hex');
  return { declared: declared[0], calculated, slots: declared.length };
}

function validateChecksum(buffer, label = 'migration') {
  const info = checksumInfo(buffer, label);
  if (info.declared !== info.calculated) {
    throw new Error(
      `${label}: checksum 불일치 (적힘 ${info.declared}, 계산 ${info.calculated}). `
      + '같은 버전을 고쳐 쓰지 말고 새 migration을 만들라.',
    );
  }
  return info;
}

function concatenate(files = migrationFiles()) {
  const buffers = files.map((file) => {
    const buffer = fs.readFileSync(file);
    validateChecksum(buffer, path.relative(ROOT, file));
    return buffer;
  });
  return Buffer.concat(buffers);
}

function firstDifference(left, right) {
  const limit = Math.min(left.length, right.length);
  for (let i = 0; i < limit; i += 1) {
    if (left[i] !== right[i]) return i;
  }
  return left.length === right.length ? -1 : limit;
}

function assertByteIdentical(actual, expected, label = '합본') {
  if (actual.equals(expected)) return;
  const offset = firstDifference(actual, expected);
  throw new Error(
    `${label}이 마이그레이션 조각 이음과 바이트 단위로 다르다 `
    + `(첫 차이 offset=${offset}, 실제=${actual.length}B, 기대=${expected.length}B)`,
  );
}

/* 개별 조각 확인은 해당 꼬리에서 파생한다. 전체 사후 확인은 마지막 전체 검사에
 * 연동 표 보호를 더하며, 최신 조각의 version/checksum을 별도로 대조한다.
 * 조각을 하나 올릴 때마다 사람이 손으로 옮겨 왔는데, 2026-08-06~07 에만 **네 번** 반복했고
 * 한 번은 옮기는 걸 잊어 **정상 DB 가 ❌ 로 보고**됐다(기대 checksum 이 낡아서). 손으로 옮기는
 * 자리는 다음번에 빠뜨리는 자리라, 합본을 만드는 그 자리에서 함께 파생시킨다.
 * `tests/L0스키마.test.js`의 파생 대조와 연동사후상태의 보호 변이 검사를 함께 유지한다. */
function deriveCheckQuery(마지막 = migrationFiles().at(-1)) {
  // 기본 사후 검사는 마지막 전체 검사에 명시된 연동 표 보호를 더한다.
  // 최신 조각의 좁은 기능 검사로 기존 lifecycle/권한 검사를 대체하지 않는다.
  // 파일을 명시한 호출은 해당 migration의 원래 확인 블록을 그대로 파생한다.
  if (arguments.length === 0) {
    const latest = migrationFiles().at(-1);
    const { declared: checksum } = validateChecksum(fs.readFileSync(latest), path.basename(latest));
    return extendCheckQuery(deriveCheckQuery(path.join(MIGRATIONS_DIR, CHECK_BASE_FILE)), {
      version: path.basename(latest).slice(0, 14), checksum,
    });
  }
  /* 🔴 **「마지막 조각에서」라고 말하면서 합본 «전체»를 뒤지고 있었다**(08-26 실측 · 다섯 번째 재발).
   *   `bundle.lastIndexOf('with 기대열')` 은 마지막 조각에 그 블록이 «없으면» 조용히 **앞 조각의
   *   블록**으로 후퇴한다 — 그러면 `확인_적용후상태.sql` 의 체인 끝이 낡은 채로 파생되고,
   *   증상은 「정상 DB 가 ❌ 로 보고」다(08-25 이후 talk CI 가 43커밋 내내 빨갰던 그 자리).
   *   위 머리말이 「손으로 옮기는 자리는 다음번에 빠뜨리는 자리」라 적어 두고, 그 파생 자체가
   *   같은 병에 걸려 있었다.
   * 🔑 그래서 **마지막 «조각 파일»에서 찾고, 없으면 죽는다.** 후퇴가 없으면 다음 사람은 조각에
   *   블록을 안 단 그 순간 알게 된다(조용한 오답 → 시끄러운 실패). */
  const 조각원문 = fs.readFileSync(마지막, 'utf8');
  validateChecksum(Buffer.from(조각원문, 'utf8'), path.basename(마지막));
  /* 🔴 **닻에 여는 괄호를 붙인다** — 이게 「설명이 자기 검사를 깨뜨리는」 자리를 구조로 없앤다.
   *   [08-26 · 80 세션 지적] 조각 머리말이 이 코드를 인용하면(`lastIndexOf('with 기대열') 로 …`)
   *   그 인용이 «두 번째 후보»가 된다. 지금은 `lastIndexOf` 라 뒤엣것(진짜 블록)을 집어 옳게 돌지만,
   *   누군가 `indexOf` 로 바꾸는 순간 **머리말 인용을 집어 조용히 깨진다**.
   * 🔑 `with 기대열(` 로 찾으면 산문 인용은 `'` 가 뒤따라 원리상 안 맞는다 — 그래서 앞뒤 어느
   *   쪽으로 찾아도 같은 답이 나온다. 프로즈로 「lastIndexOf 여야 한다」고 못 박는 대신 닻을 고쳤다. */
  const 시작 = 조각원문.indexOf('with 기대열(');
  const 끝 = 조각원문.indexOf('*/', 시작);
  if (시작 === -1 || 끝 === -1) {
    const 안내 = [
      `마지막 조각에 확인 쿼리 블록이 없다: ${path.relative(ROOT, 마지막)}`,
      '  → 그 조각 꼬리에 `with 기대열 … */` 확인 블록을 단다(앞 조각 것을 베끼지 말고 그 판의 값으로).',
      '  ⚠ 예전엔 여기서 조용히 «앞 조각»으로 후퇴해 낡은 체인 끝이 파생됐다 — 그래서 이제 죽는다.',
    ];
    throw new Error(안내.join(String.fromCharCode(10)));
  }
  // 적용된 조각은 고치지 않는다. 09-07 조각의 주석에는 앞 판번호가 남아 있어
  // 정상 DB도 거절했다. 판번호만 파일명에서 파생하고 구조·checksum 조건은 그대로 둔다.
  const 버전조건 = /(\(select version from 현재이력\)\s*=\s*)'\d{14}'/g;
  const 쿼리 = 조각원문.slice(시작, 끝);
  if ([...쿼리.matchAll(버전조건)].length !== 1) {
    throw new Error(`마지막 조각의 확인 버전 조건은 정확히 1개여야 한다: ${path.basename(마지막)}`);
  }
  return 쿼리.replace(버전조건, (_조건, 앞) => `${앞}'${path.basename(마지막).slice(0, 14)}'`);
}

function syncCheckFile() {
  const 머리 = fs.readFileSync(CHECK_FILE, 'utf8').split('with 기대열(')[0];
  const 새것 = 머리 + deriveCheckQuery();
  fs.writeFileSync(CHECK_FILE, 새것);
  return 새것;
}

/* 🩹 합본은 조각 이음에 딱 한 가지 변형만 얹는다 — «제약 갈아끼우기 사슬의 재실행 멱등화».
 * 2026-08-24 실측(push 복원 첫 CI · run 32714974980): c13 조각의
 * `drop constraint if exists X_c12, add constraint X_c13` 65벌이 자기 이름(X_c13)을 안 지워
 * 재실행 시험 ②가 `already exists` 로 죽었다. c12 조각이 같은 모양으로도 살아남은 것은
 * alter 가 조건 가드 do-블록 «안»이라서다(재실행이면 통째로 건너뜀) — c13 은 밖이었다.
 * 조각을 고치는 길은 둘 다 막혀 있다: 파일 수정은 위 checksum 가드가 거절하고(운영 이력 소급),
 * 새 조각 덧붙이기는 안 통한다(합본은 그 앞줄에서 죽는다). 그래서 «굽는 자리»에서 고친다:
 * 규칙은 둘이다(둘 다 같은 병 — c13 조각은 몸이 머리 가드 «밖»이라 재실행에도 돈다.
 * 가드의 return 은 do-블록만 빠져나가지, 그 뒤의 평문 SQL 은 못 막는다):
 *   ① 제약 사슬 — drop 이 하나라도 있는 alter 사슬의 add 앞에, 자기 이름 drop 이 없으면 끼운다.
 *   ② 이력 기록 — 리터럴 판번호로 schema_migrations 에 넣는 insert 가 「이미 적혔나」 가드 없이
 *      서 있으면 `if not exists (…) then … end if;` 로 감싼다(20260824020000 조각이 쓰는 그 모양).
 *      ②-b(checksum 불일치 중단)는 안 깎인다 — 그 중단은 조각 «머리» 가드의 raise 가 쥐고 있고,
 *      여기서 감싸는 것은 «꼬리»의 중복 insert 뿐이다.
 *   ③ 걷은 표(2026-10-03 · 처음으로 표를 지우는 조각이 섰다) — 뒤 조각이 지운 표에 기대는 앞 조각의
 *      최상위 문장을 「그 표가 있을 때만」 돌게 감싼다. 상세는 아래 `걷은표가드` 머리말.
 * 빈 DB 첫 적용엔 no-op(NOTICE 한 줄) · 가드 안 사슬에 들어가도 무해 · checksum 슬롯은
 * 안 건드리므로 DB 이력 대조(②-b)도 그대로다. 조각 파일은 1바이트도 안 바뀐다. */
const ALTER_시작 = /^\s*alter table\b/;
const 문장끝 = /;\s*\r?$/;
const 제약드롭 = /^\s*drop constraint if exists ([A-Za-z0-9_]+),\s*\r?$/;
const 제약추가 = /^(\s*)add constraint ([A-Za-z0-9_]+)\b/;
const 이력기록 = /^(\s*)insert into engine\.schema_migrations\(version, name, checksum\)\s*\r?$/;
const 이력값줄 = /^\s*values \('(\d{14})'.*;\s*\r?$/;
const 이력가드 = /if not exists .*schema_migrations where version = '(\d{14})'/;

function 멱등화(bundle) {
  const lines = bundle.toString('utf8').split('\n');
  const out = [];
  let 사슬 = null;   // 여러 줄 alter 문이 열려 있는 동안만 Set(그 문이 지운 이름들)
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (사슬 === null) {
      if (ALTER_시작.test(line) && !문장끝.test(line)) { 사슬 = new Set(); out.push(line); continue; }

      /* 규칙 ② — 리터럴 판번호의 이력 insert 를 「이미 적혔나」로 감싼다(머리말 참조). */
      const 기록 = 이력기록.exec(line);
      const 값 = 기록 && i + 1 < lines.length ? 이력값줄.exec(lines[i + 1]) : null;
      if (기록 && 값) {
        const 직전 = out.filter((l) => l.trim() !== '').at(-1) || '';
        if (!이력가드.test(직전)) {
          const [, indent] = 기록;
          const cr = line.endsWith('\r') ? '\r' : '';
          out.push(`${indent}if not exists (select 1 from engine.schema_migrations where version = '${값[1]}') then${cr}`);
          out.push(`  ${line}`);
          out.push(`  ${lines[i + 1]}`);
          out.push(`${indent}end if;${cr}`);
          i += 1;
          continue;
        }
      }
      out.push(line);
      continue;
    }
    const 드롭 = 제약드롭.exec(line);
    if (드롭) 사슬.add(드롭[1]);
    const 추가 = 제약추가.exec(line);
    if (추가 && 사슬.size > 0 && !사슬.has(추가[2])) {
      const cr = line.endsWith('\r') ? '\r' : '';
      out.push(`${추가[1]}drop constraint if exists ${추가[2]},${cr}`);
      사슬.add(추가[2]);
    }
    if (문장끝.test(line)) 사슬 = null;
    out.push(line);
  }
  return 걷은표가드(Buffer.from(out.join('\n'), 'utf8'));
}

/* 🩹 규칙 ③ — 뒤 조각이 «걷은 표»의 재실행 가드(2026-10-03 · 20261003007000 생성 트랙 걷기에서 처음 섰다).
 * 재실행(같은 DB 에 합본을 다시 붓는 검증 ②)은 앞 조각의 «머리 가드 밖» 문장을 매번 다시 돈다. 그 문장이
 * 기대는 표를 뒤 조각이 지우면, 재실행에서 그 문장은 «없는 표»를 만나 죽거나(create trigger·alter table)
 * 지운 함수를 되살린다(create or replace function — 구조 지문이 바뀐다). 조각 파일은 checksum 이 봉인해
 * 못 고치므로 규칙 ①② 와 같이 «굽는 자리»에서 고친다:
 *   뒤 조각의 `drop table 스키마.X`(do 블록 안이어도 센다 · 2026-10-05 부터 engine 밖 스키마도)가 지우는 표 묶음마다,
 *   그 앞의 «최상위» 문장 중 그 표나 같은 조각이 `drop function` 으로 지우는 같은 스키마의 함수를 가리키는 것을
 *   `do … if 그 표들이 다 있으면 then execute <원문> … end` 로 감싼다.
 * · 지운 표를 «최상위에서» 만드는 문장(do 블록 밖 `create table if not exists` · 20260907200000 일요일 묶음)은
 *   「지우는 조각이 아직 안 섰을 때만」(schema_migrations 에 그 판번호가 없을 때만) 돌게 감싼다 — 안 감싸면 재실행이 표를 되살린다.
 * · 스키마째 지우면(`drop schema`) 그 스키마를 가리키는데 감쌀 근거가 없는 최상위 문장이 남을 때 죽는다.
 * · 빈 DB 첫 적용: 그 문장들이 도는 때엔 표가 서 있어(만든 do 블록이 앞이다) 원문이 그대로 돈다.
 * · 재실행: 표가 없어 건너뛴다 — 지운 것을 되살리지도, 없는 표에 걸려 죽지도 않는다.
 * · do 블록·begin/commit 은 안 감싼다(do 블록은 조각 머리 가드가 이미 지킨다). 표를 만드는 문장보다 앞에서
 *   걸리는 문장이 있으면 감싸지 않고 죽는다 — 첫 적용의 뜻이 바뀌는 자리를 조용히 넘기지 않는다.
 * · 두 번 돌려도 같다(감싼 문장은 do 블록이라 다시 안 걸린다) · 조각 파일은 1바이트도 안 바뀐다. */
const 재실행태그 = '$synk_rerun$';
const 재실행본문태그 = '$synk_rerun_body$';
const 달러머리 = /^\$(?:[A-Za-z_\u0080-￿][A-Za-z0-9_\u0080-￿]*)?\$/u;

/** 최상위 문장 가르기 — Postgres 렉서가 하는 만큼만 안다: 작은따옴표(''·E'\n')·큰따옴표 식별자·달러 인용·
 *  줄 주석·블록 주석(중첩). 각 문장 = { 시작, 머리(주석·공백 뒤 첫 글자 · 없으면 -1), 끝(';' 다음) }. */
function 최상위문장들(text) {
  const 문장 = [];
  const n = text.length;
  let i = 0;
  let 시작 = 0;
  let 머리 = -1;
  while (i < n) {
    const c = text[i];
    if (c === '-' && text[i + 1] === '-') {
      const j = text.indexOf('\n', i);
      i = j < 0 ? n : j + 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      let 깊이 = 1;
      i += 2;
      while (i < n && 깊이 > 0) {
        if (text[i] === '/' && text[i + 1] === '*') { 깊이 += 1; i += 2; } else if (text[i] === '*' && text[i + 1] === '/') { 깊이 -= 1; i += 2; } else i += 1;
      }
      continue;
    }
    if (머리 < 0 && !/\s/.test(c)) 머리 = i;
    if (c === "'" || c === '"') {
      i += 1;
      while (i < n) {
        if (text[i] === c) {
          if (text[i + 1] === c) { i += 2; continue; }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (c === '$') {
      const m = 달러머리.exec(text.slice(i, i + 80));
      if (m) {
        const 닫음 = text.indexOf(m[0], i + m[0].length);
        if (닫음 < 0) throw new Error(`닫히지 않은 달러 인용 ${m[0]} (offset=${i})`);
        i = 닫음 + m[0].length;
        continue;
      }
    }
    if (c === ';') {
      문장.push({ 시작, 머리, 끝: i + 1 });
      i += 1;
      시작 = i;
      머리 = -1;
      continue;
    }
    i += 1;
  }
  return { 문장, 꼬리: 시작 };
}

/** 판정용 글 — 주석을 문자열 안팎 가리지 않고 벗긴다(do 몸 안의 주석에 적힌 «drop table» 을 세지 않게). */
function 주석벗김(s) {
  let 결과 = '';
  let i = 0;
  while (i < s.length) {
    if (s[i] === '-' && s[i + 1] === '-') {
      const j = s.indexOf('\n', i);
      i = j < 0 ? s.length : j;
      continue;
    }
    if (s[i] === '/' && s[i + 1] === '*') {
      let 깊이 = 1;
      i += 2;
      while (i < s.length && 깊이 > 0) {
        if (s[i] === '/' && s[i + 1] === '*') { 깊이 += 1; i += 2; } else if (s[i] === '*' && s[i + 1] === '/') { 깊이 -= 1; i += 2; } else i += 1;
      }
      결과 += ' ';
      continue;
    }
    결과 += s[i];
    i += 1;
  }
  return 결과;
}

/* 지우는 문장은 스키마째 읽는다(2026-10-05 · 20261005020000 이 radio 스키마의 표 여섯과 engine.sunday_bundles 를 지우며
 * engine 밖 스키마가 처음 들어왔다). `drop table` 한 문장이 한 무리다 — 한 조각(do 블록)이 표 무리 여럿을 지우면 무리마다
 * 생성 자리와 감쌀 조건을 따로 본다(한데 묶으면 늦게 선 표의 생성 자리가 앞 무리의 문장까지 「만들기 전」으로 만든다). */
const 이름꼴 = '[A-Za-z_][A-Za-z0-9_]*';
const 지운표식 = new RegExp(`\\bdrop\\s+table\\s+(?:if\\s+exists\\s+)?((?:${이름꼴}\\.\\w+\\s*,\\s*)*${이름꼴}\\.\\w+)`, 'giu');
const 지운함수식 = new RegExp(`\\bdrop\\s+function\\s+(?:if\\s+exists\\s+)?(${이름꼴})\\.(\\w+)\\s*\\(`, 'giu');
const 지운스키마식 = new RegExp(`\\bdrop\\s+schema\\s+(?:if\\s+exists\\s+)?(${이름꼴})\\b`, 'giu');
const 판번호식 = /\bmigration_version\s+constant\s+text\s*:=\s*'(\d{14})'/u;
const 감싸지않는문장 = /^(?:do|begin|commit)\b/iu;
const 점풀기 = (이름) => 이름.replace(/\./g, '\\.');
const 생성식 = (표) => new RegExp(`\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${점풀기(표)}\\b`, 'iu');

function 걷은표가드(bundle) {
  const text = bundle.toString('utf8');
  const { 문장 } = 최상위문장들(text);
  const 글 = 문장.map((m) => 주석벗김(text.slice(m.머리 < 0 ? m.끝 : m.머리, m.끝)).trim());
  const 무리들 = [];
  글.forEach((g, k) => {
    const 표무리 = [...g.matchAll(지운표식)].map((m) => [...new Set(m[1].split(',').map((t) => t.trim().toLowerCase()))]);
    if (!표무리.length) return;
    const 함수 = [...new Set([...g.matchAll(지운함수식)].map((m) => `${m[1]}.${m[2]}`.toLowerCase()))];
    const 스키마 = [...new Set([...g.matchAll(지운스키마식)].map((m) => m[1].toLowerCase()))];
    const 판번호 = (판번호식.exec(g) || [])[1] || null;
    for (const 표 of 표무리) {
      const 스키마들 = new Set(표.map((t) => t.split('.')[0]));
      무리들.push({
        자리: k, 표, 판번호,
        함수: 함수.filter((f) => 스키마들.has(f.split('.')[0])),
        스키마: 스키마.filter((s) => 스키마들.has(s)),
      });
    }
  });
  if (!무리들.length) return bundle;

  const 감쌀것 = new Map();   // 문장 자리 → { 표: 「있을 때만」 조건의 표들, 판: 「그 조각이 아직 안 섰을 때만」 조건의 판번호들 }
  const 감쌈더하기 = (k, { 표 = [], 판 = [] }) => {
    const 앞 = 감쌀것.get(k) || { 표: [], 판: [] };
    감쌀것.set(k, { 표: [...new Set([...앞.표, ...표])], 판: [...new Set([...앞.판, ...판])] });
  };
  for (const 무리 of 무리들) {
    const 이름식 = new RegExp(`\\b(?:${[...무리.표, ...무리.함수].map(점풀기).join('|')})\\b`, 'iu');
    const 생성자리 = 무리.표.map((t) => 글.findIndex((g) => 생성식(t).test(g)));
    if (생성자리.some((k) => k < 0 || k > 무리.자리)) {
      throw new Error(`규칙 ③: ${무리.표.join(', ')} 를 만드는 문장을 지우는 문장 앞에서 못 찾았다 — 감쌀 범위를 정할 수 없다`);
    }
    const 마지막생성 = Math.max(...생성자리);
    for (let k = 0; k < 무리.자리; k += 1) {
      if (감싸지않는문장.test(글[k]) || !이름식.test(글[k])) continue;
      /* 지운 표를 «최상위에서» 만드는 문장(do 블록 밖 `create table if not exists`) — 재실행에서 표가 없으니 다시 만들고,
       * 그 뒤 지우는 조각은 머리 가드에서 돌아가 버려 표가 되살아난다. 「지우는 조각이 아직 안 섰을 때만」 돌게 감싼다.
       * 첫 적용에서는 그 조각이 뒤에 오므로 그대로 돈다. */
      if (무리.표.some((t) => 생성식(t).test(글[k]))) {
        if (!무리.판번호) {
          throw new Error(`규칙 ③: 최상위에서 만드는 표(${무리.표.join(', ')})를 지우는 조각의 판번호(migration_version)를 못 읽었다(offset=${문장[k].시작})`);
        }
        감쌈더하기(k, { 판: [무리.판번호] });
        continue;
      }
      if (k <= 마지막생성) {
        throw new Error(`규칙 ③: 표를 만들기 전에 걸리는 최상위 문장이 있다(offset=${문장[k].시작}) — 첫 적용의 뜻이 바뀌므로 감싸지 않는다`);
      }
      감쌈더하기(k, { 표: 무리.표 });
    }
    /* 스키마째 지우면 그 스키마를 가리키는 최상위 문장은 전부 재실행에서 죽는다. 위에서 감싸지 못한 것이 남으면
     * (지운 표·함수의 이름으로 안 잡히는 시퀀스·권한·기본 권한 같은 것) 조용히 넘기지 않고 죽는다. */
    for (const 스키마 of 무리.스키마) {
      const 스키마식 = new RegExp(`\\b(?:${점풀기(스키마)}\\.|schema\\s+${점풀기(스키마)}\\b)`, 'iu');
      for (let k = 0; k < 무리.자리; k += 1) {
        if (감싸지않는문장.test(글[k]) || 감쌀것.has(k) || !스키마식.test(글[k])) continue;
        throw new Error(`규칙 ③: 지우는 스키마 ${스키마} 를 가리키는데 감쌀 근거가 없는 최상위 문장이 있다(offset=${문장[k].시작})`);
      }
    }
  }

  let 결과 = text;
  for (const k of [...감쌀것.keys()].sort((a, b) => b - a)) {
    const { 머리, 끝 } = 문장[k];
    const 원문 = text.slice(머리, 끝);
    if (원문.includes('$synk_rerun')) throw new Error(`규칙 ③: 감쌀 문장 안에 재실행 태그가 이미 있다(offset=${머리})`);
    const { 표, 판 } = 감쌀것.get(k);
    const 조건 = [
      ...표.map((t) => `to_regclass('${t}') is not null`),
      ...판.map((v) => `not exists (select 1 from engine.schema_migrations where version = '${v}')`),
    ].join(' and ');
    const 감쌈 = `do ${재실행태그} begin if ${조건} then execute ${재실행본문태그}\n${원문}\n${재실행본문태그}; end if; end ${재실행태그};`;
    결과 = 결과.slice(0, 머리) + 감쌈 + 결과.slice(끝);
  }
  return Buffer.from(결과, 'utf8');
}

function generate({ check = false } = {}) {
  const bundle = 멱등화(concatenate());
  if (check) {
    if (!fs.existsSync(OUTPUT)) throw new Error('생성된 supabase/L0_스키마.sql이 없다');
    assertByteIdentical(fs.readFileSync(OUTPUT), bundle, 'supabase/L0_스키마.sql');
    const 사후 = fs.readFileSync(CHECK_FILE, 'utf8');
    const 머리 = 사후.split('with 기대열(')[0];
    assertByteIdentical(Buffer.from(사후), Buffer.from(머리 + deriveCheckQuery()), 'supabase/확인_적용후상태.sql');
    return bundle;
  }

  fs.writeFileSync(OUTPUT, bundle);
  syncCheckFile(bundle);
  return bundle;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  /* 🔴 옛 판정은 «손 사본»이었다: `args.some((arg) => arg !== '--check')`. 공용 통로로 옮기되
   *   그 엄격함을 안 잃는다 — 그 한 줄은 위치 인자까지 거절했고, 이 도구는 위치 인자를 하나도
   *   안 읽는다(경로는 전부 상수다). 그래서 두 칸으로 나눈다: ①모르는 `--` 낱말은 공용 판정이
   *   ②위치 인자는 이 도구만의 엄격함이 진다. 합치면 사유가 뭉개져 어느 쪽인지 모른다. */
  const 플래그오류 = 인자게이트('마이그레이션_합본', args, 아는플래그);
  const 위치인자 = args.filter((a) => !a.startsWith('--'));
  if (플래그오류 || 위치인자.length) {
    console.error(플래그오류 || `위치 인자를 안 받는다: ${위치인자.join(' ')}`);
    console.error('사용법: node tools/마이그레이션_합본.js [--check]');
    process.exitCode = 2;
  } else {
    try {
      const bundle = generate({ check: args.includes('--check') });
      const action = args.includes('--check') ? '확인' : '생성';
      console.log(`L0 합본 ${action}: ${bundle.length} bytes`);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}

module.exports = {
  CHECK_FILE,
  FILE_NAME,
  MIGRATIONS_DIR,
  OUTPUT,
  syncCheckFile,
  deriveCheckQuery,
  assertByteIdentical,
  checksumInfo,
  concatenate,
  firstDifference,
  generate,
  migrationFiles,
  멱등화,
  걷은표가드,
  최상위문장들,
  validateChecksum,
};

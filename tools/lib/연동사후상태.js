'use strict';

// 적용된 migration은 바꾸지 않는다. 마지막 전체 검사(가용성 사건)의 52개 표에
// 별도 교실/WORLD/Town 조각이 만든 14개 표와 개인 제품 저장 표 6개(2026-10-14)를 이름으로 더해 읽기 전용으로 검증한다.
const BASE_FILE = '20261007030000_synk_account_availability_c16.sql';
const TABLES = Object.freeze([
  'synk_classroom_state', 'synk_classroom_sharing', 'synk_classroom_event_links',
  'synk_world_v1_state', 'synk_world_v1_runs', 'synk_world_v1_requests',
  'synk_academy_towns', 'synk_academy_town_memberships', 'synk_academy_town_activity', 'synk_teacher_care',
  'synk_world_v1_learning_scores', 'synk_modern_town_state', 'synk_modern_town_commands', 'synk_classroom_invites',
  // 2026-10-14 master에 옮긴 개인 제품 저장 표(플레저·운세·개인 기록·플레저 알림).
  'synk_care_state', 'synk_fortune_state', 'synk_personal_state', 'synk_personal_assets', 'synk_personal_media_cleanup', 'synk_care_push_subscriptions',
]);

const TABLE_CHECK = `연동표(t) as (values
  ${TABLES.map(name => `('${name}')`).join(',\n  ')}
), 연동검사 as (select
  (select count(*) from 연동표 e join pg_tables t on t.schemaname='engine' and t.tablename=e.t) as 연동표수,
  (select count(*) from 연동표 e join pg_tables t on t.schemaname='engine' and t.tablename=e.t where t.rowsecurity) as 연동RLS수,
  (select count(*) from 연동표 e join pg_policies p on p.schemaname='engine' and p.tablename=e.t) as 연동정책수,
  (select count(*) from 연동표 e cross join (values ('anon'),('authenticated'),('service_role')) r(name)
    cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(name)
    where has_table_privilege(r.name,to_regclass(format('%I.%I','engine',e.t)),p.name)) as 연동새는권한,
  (select string_agg(e.t, ', ' order by e.t) from 연동표 e where not exists
    (select 1 from pg_tables t where t.schemaname='engine' and t.tablename=e.t)) as 빠진연동표
)`;
const TABLE_CONDITION = '연동표수=20 and 연동RLS수=20 and 연동정책수=0 and 연동새는권한=0 and 빠진연동표 is null';

function replaceOnce(text, pattern, replacement, label) {
  const matches = typeof pattern === 'string' ? text.split(pattern).length - 1 : [...text.matchAll(pattern)].length;
  if (matches !== 1) throw new Error(`사후 검사 기준 위치는 정확히 하나여야 한다: ${label}`);
  return text.replace(pattern, replacement);
}

function extendCheckQuery(baseQuery, {version, checksum}) {
  if (!/^\d{14}$/.test(version) || version < '20261010003000' || !/^[a-f0-9]{64}$/.test(checksum)) {
    throw new Error('연동 사후 검사의 최신 version/checksum이 잘못됐다');
  }
  let query = replaceOnce(baseQuery, '테이블수=52 and RLS켜짐=52', '테이블수=72 and RLS켜짐=72', '기존 표/RLS 수');
  query = replaceOnce(query, '기대: 52·52·7', '기대: 72·72·7', '실패 안내');
  query = replaceOnce(query, ', 셈 as (select', `, ${TABLE_CHECK}\n, 셈 as (select`, '연동 검사 CTE');
  query = replaceOnce(query, 'and 공통서버새는권한=0', `and ${TABLE_CONDITION}\n              and 공통서버새는권한=0`, '연동 보호 판정');
  query = replaceOnce(query, 'from 셈;', 'from 셈 cross join 연동검사;', '연동 진단 출력');
  query = replaceOnce(query, /(\(select version from 현재이력\)\s*=\s*)'\d{14}'/g, `$1'${version}'`, '최신 버전');
  query = replaceOnce(query, /(\(select checksum from 현재이력\)\s*=\s*)'[a-f0-9]{64}'/g, `$1'${checksum}'`, '최신 checksum');
  return query;
}

module.exports = {BASE_FILE, TABLES, TABLE_CHECK, TABLE_CONDITION, extendCheckQuery};

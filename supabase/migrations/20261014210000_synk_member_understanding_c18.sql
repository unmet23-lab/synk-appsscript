-- Explicit member confirmations/corrections share the private owner/CAS table.
-- Existing member-insight v1 documents and all grants/triggers remain unchanged.
-- Keep the existing resource constraint name and current c18 contract marker.
begin;

do $migration$
declare
  migration_version constant text := '20261014210000';
  expected_checksum constant text := 'db39e9de3efd169e03a306bbb53dc64f6d74f34ea30ba0bc122e273aebe0cc7c'; -- migration-checksum
  recorded_checksum text;
  recorded_name text;
begin
  if to_regclass('engine.schema_migrations') is null then raise exception 'Member understanding history missing'; end if;
  select checksum,name into recorded_checksum,recorded_name from engine.schema_migrations where version=migration_version;
  if found then
    if recorded_checksum is distinct from expected_checksum or recorded_name is distinct from '20261014210000_synk_member_understanding_c18.sql' then raise exception 'Member understanding checksum or contract name mismatch'; end if;
    return;
  end if;
  if not exists(select 1 from engine.schema_migrations where version='20261014200000'
    and name='20261014200000_synk_member_insight_c18.sql'
    and checksum='42004e57edbfacac84602b6f3120beded51eea572a0211acf187223c9ad1dbda') then
    raise exception 'Member understanding member-insight predecessor missing or mismatched';
  end if;
  if not exists(select 1 from pg_constraint where conrelid=to_regclass('engine.synk_personal_state')
    and conname='synk_personal_resource_c16' and contype='c' and convalidated
    and pg_get_constraintdef(oid)='CHECK ((resource = ANY (ARRAY[''path''::text, ''rehearsal''::text, ''family-album''::text, ''platform-library''::text, ''path-travel''::text, ''member-insight''::text])))') then
    raise exception 'Member understanding resource baseline missing or changed';
  end if;
  alter table engine.synk_personal_state drop constraint synk_personal_resource_c16;
  alter table engine.synk_personal_state add constraint synk_personal_resource_c16
    check(resource in ('path','rehearsal','family-album','platform-library','path-travel','member-insight','member-understanding'));
  insert into engine.schema_migrations(version,name,checksum)
    values(migration_version,'20261014210000_synk_member_understanding_c18.sql',expected_checksum);
end $migration$;
commit;

-- This additive increment verifies its own receipt without depending on newer releases.
/*
with 기대열(t,c) as(values
  ('synk_personal_state','synk_user_id'),('synk_personal_state','resource'),
  ('synk_personal_state','payload'),('synk_personal_state','revision'),('synk_personal_state','updated_at')
), 현재이력 as(select version,name,checksum from engine.schema_migrations where version='20261014210000'), 검사 as (
  select not exists(select 1 from 기대열 e where not exists(select 1 from information_schema.columns c
    where c.table_schema='engine' and c.table_name=e.t and c.column_name=e.c)) as columns_ok,
  exists(select 1 from pg_constraint where conrelid=to_regclass('engine.synk_personal_state')
    and conname='synk_personal_resource_c16' and contype='c' and convalidated
    and pg_get_constraintdef(oid)='CHECK ((resource = ANY (ARRAY[''path''::text, ''rehearsal''::text, ''family-album''::text, ''platform-library''::text, ''path-travel''::text, ''member-insight''::text, ''member-understanding''::text])))') as resource_ok,
  exists(select 1 from pg_class where oid=to_regclass('engine.synk_personal_state') and relrowsecurity) as rls_ok,
  not exists(select 1 from (values('anon'),('authenticated'),('service_role')) roles(name)
    cross join (values('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) privileges(permission)
    where has_table_privilege(name,'engine.synk_personal_state',permission)) as private_ok,
  exists(select 1 from pg_trigger where tgrelid=to_regclass('engine.synk_accounts') and tgname='synk_personal_account_deleted' and tgenabled='O') as deletion_ok
)
select case when columns_ok and resource_ok and rls_ok and private_ok and deletion_ok
  and (select version from 현재이력)='20261014210000'
  and (select name from 현재이력)='20261014210000_synk_member_understanding_c18.sql'
  and (select checksum from 현재이력)='db39e9de3efd169e03a306bbb53dc64f6d74f34ea30ba0bc122e273aebe0cc7c' -- migration-checksum
  then '✅ 전부 통과' else '❌ 성향 확인·수정 개인자료 계약 확인 필요' end as 판정,* from 검사;
*/

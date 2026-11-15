import { WORKSPACE_KINDS } from './pulse-workspaces.mjs';
import { WORKSPACE_COMPANIES, workspaceProfileState } from './workspace-access.mjs';

const pageSize = 25;
const companies = WORKSPACE_COMPANIES.map(row => row.id);
const invalid = () => Object.assign(new Error('회원 검색 조건을 확인해 주세요.'), {status:400});

export function directoryQuery(input, central = false) {
  const allowed = central ? ['q','page','status'] : ['q','page','type','company','status'];
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !allowed.includes(key))) throw invalid();
  const {q='', page=1, status='all', type='all', company='all'} = input;
  const statuses = central ? ['all','active','disabled','deletion-requested'] : ['all','active','disabled'];
  if (typeof q !== 'string' || q.length > 160 || /[\x00-\x1f\x7f]/.test(q) ||
      !Number.isSafeInteger(page) || page < 1 || page > 1000000 || !statuses.includes(status) ||
      !['all','staff','customer'].includes(type) || !['all',...companies].includes(company)) throw invalid();
  return {q:q.trim(),page,status,...(central ? {} : {type,company})};
}

// Match both kinds of membership through the confirmed SYNK ID link. Staff without
// that link keep a local identity of their own, even if names or emails coincide.
// Materializing these projections lets SQLite index the member IDs once per search.
export function createWorkspaceDirectory(store) {
  const read = store.db.prepare(`
    WITH staff AS MATERIALIZED (
      SELECT coalesce(lower(l.synk_user_id), 'staff:' || d.id) AS person, d.id AS staffId,
        json_extract(d.body,'$.name') AS name, json_extract(d.body,'$.email') AS email,
        json_extract(d.body,'$.active') AS active, json_extract(d.body,'$.role') AS role,
        CASE WHEN json_type(d.body,'$.workspaceProfile')='object' THEN json_extract(d.body,'$.workspaceProfile') END AS profile
      FROM documents d LEFT JOIN synk_identity_links l ON l.company_user_id=d.id WHERE d.kind='users'
    ), brands AS MATERIALIZED (
      SELECT lower(m.value->>'$.synkUserId') AS person, m.value->>'$.displayName' AS name,
        w.id, w.body->>'$.name' AS brand, w.body->>'$.status' AS status, m.value->>'$.role' AS role
      FROM documents w, json_each(w.body,'$.members') m
      WHERE w.kind=$brands AND m.type='object' AND length(m.value->>'$.synkUserId')=36
        AND (m.value->>'$.synkUserId') GLOB '????????-????-[1-5]???-[89aAbB]???-????????????'
        AND length(replace(m.value->>'$.synkUserId','-',''))=32
        AND replace(m.value->>'$.synkUserId','-','') NOT GLOB '*[^0-9A-Fa-f]*'
    ), people AS (SELECT person FROM staff UNION SELECT person FROM brands),
    scoped AS MATERIALIZED (
      SELECT p.person,s.staffId,s.name AS staffName,s.email,s.profile,s.role,s.active AS staffActive,
        ($type IN ('all','staff') AND s.staffId IS NOT NULL AND ($company='all' OR EXISTS
          (SELECT 1 FROM json_each(s.profile,'$.memberships') m WHERE m.type='object' AND m.value->>'$.company'=$company))) AS includeStaff,
        CASE WHEN $type IN ('all','customer') AND $company IN ('all','PULSE') THEN
          (SELECT max(coalesce(b.status='active',0)) FROM brands b WHERE b.person=p.person) END AS customerActive
      FROM people p LEFT JOIN staff s ON p.person=s.person
    ), matched AS MATERIALIZED (
      SELECT s.*, coalesce(nullif(s.staffName,''),(SELECT min(nullif(b.name,'')) FROM brands b WHERE b.person=s.person),'') AS name,
        coalesce(s.email,'') AS loginId, (s.includeStaff AND coalesce(s.staffActive,0) OR coalesce(s.customerActive,0)) AS active
      FROM scoped s
      WHERE (s.includeStaff OR s.customerActive IS NOT NULL)
        AND ($status='all' OR ($status='active')=active)
        AND ($q='' OR instr(lower(s.staffName),lower($q)) OR instr(lower(s.email),lower($q)) OR instr(lower(coalesce(s.staffId,'')),lower($q)) OR s.person=lower($q) OR (substr(s.person,1,6)<>'staff:' AND instr(lower(s.person),lower($q)))
          OR EXISTS (SELECT 1 FROM brands b WHERE b.person=s.person AND (instr(lower(b.name),lower($q)) OR instr(lower(b.brand),lower($q)))))
    ), page AS (SELECT * FROM matched ORDER BY nullif(name,'') IS NULL, name COLLATE NOCASE,person LIMIT $limit OFFSET $offset)
    SELECT (SELECT count(*) FROM matched) AS total,
      (SELECT json_group_array(json_object('id',p.person,'staffId',p.staffId,'name',p.name,'loginId',p.loginId,'role',p.role,'profile',p.profile,'staffActive',p.staffActive,'active',p.active,
        'brands',(SELECT json_group_array(json_object('name',b.brand,'role',b.role,'status',b.status) ORDER BY b.brand,b.id) FROM brands b WHERE b.person=p.person)))
       FROM page p) AS items`);
  return input => {
    const {q,page,status,type,company} = directoryQuery(input);
    const result = read.get({q,type,company,status,brands:WORKSPACE_KINDS.workspaces,limit:pageSize,offset:(page-1)*pageSize});
    const rows = JSON.parse(result.items).map(({profile,staffActive,active,...row}) => {
      const {memberships} = workspaceProfileState(profile ? {workspaceProfile:JSON.parse(profile)} : null);
      return {...row, id:row.id.startsWith('staff:') ? row.staffId : row.id, memberships, staffActive:row.staffId ? Boolean(staffActive) : null,
        status:active ? 'active' : 'disabled'};
    });
    return {total:result.total, page, pageSize, rows};
  };
}

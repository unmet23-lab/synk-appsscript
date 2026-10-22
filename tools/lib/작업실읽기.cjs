'use strict';
/**
 * 작업실읽기 — 회사 서버의 SNS 예약 작업과 채널 수집기가 본 실제 공개 게시물을 읽기만 해서 가져온다(2026-10-21, tools/예약큐.js가 쓴다).
 *
 * tools/lib/게시성과읽기.cjs·헤르메스 overview.cjs와 같은 길이다: 고정 서버 신원(Compute 메타데이터·호스트 키 고정)으로 회사 주 노드에 SSH로
 * 들어가 회사 DB(company.sqlite)를 mode=ro·query_only로 열고 허용한 칸만 JSON으로 돌려받는다. 운영 쓰기·SNS API 호출 0, 인증값은 읽지 않는다.
 * 자동 모드의 Claude 세션은 운영 읽기가 막힐 수 있어(현장 노트 배포_공개 「운영 DB 읽기 전용 점검도 권한 판단에 막힌다」) AI 없는 정기 작업이
 * --서버읽기로 부르고 결과를 캐시에 둔다. 세션은 캐시만 읽는다.
 *
 * 돌려주는 것
 *   channels  SNS 채널(youtube·instagram·facebook·tiktok): id·platform·이름·핸들·외부 ID·주소
 *   jobs      SNS 예약 작업(socialPublishJobs) 가운데 최근 14일~앞으로 40일 것: 상태·예약 시각·검토 대기·게시 주소
 *   posts     채널 수집기가 모은 채널별 최근 공개 게시물(14일): 주소·게시 시각
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');

const PROJECT = 'synk-bake-unmet27';

const SOURCE = String.raw`import json,sqlite3,subprocess,datetime,urllib.request
def meta(p):
 return urllib.request.urlopen(urllib.request.Request('http://metadata.google.internal/computeMetadata/v1/'+p,headers={'Metadata-Flavor':'Google'}),timeout=3).read(200).decode()
def code(v,n=80):
 return v if isinstance(v,str) and 0<len(v)<=n and all(c.isalnum() or c in '_.:-' for c in v) else None
def when(v):
 try:
  d=datetime.datetime.fromisoformat(str(v).replace('Z','+00:00'))
  return d.astimezone(datetime.timezone.utc).isoformat().replace('+00:00','Z') if d.tzinfo else None
 except Exception:return None
def text(v,n):
 return str(v)[:n] if isinstance(v,str) else None
now=datetime.datetime.now(datetime.timezone.utc)
lo=(now-datetime.timedelta(days=14)).isoformat().replace('+00:00','Z');hi=(now+datetime.timedelta(days=40)).isoformat().replace('+00:00','Z')
out={'checkedAt':now.isoformat().replace('+00:00','Z'),'instanceId':meta('instance/id'),'project':meta('project/project-id'),'appRunning':False}
try:
 info=json.loads(subprocess.run(['docker','inspect','synk-company-company-1'],capture_output=True,text=True,timeout=15).stdout or '[]')
except Exception:info=[]
app=info[0] if info else None
mount=next((m.get('Source') for m in (app or {}).get('Mounts',[]) if m.get('Destination')=='/data'),None)
if app and app.get('State',{}).get('Running') is True and mount:
 db=sqlite3.connect('file:'+mount+'/company.sqlite?mode=ro',uri=True,timeout=5)
 try:
  db.execute('PRAGMA query_only=ON');db.execute('BEGIN')
  def rows(kind):return [dict(json.loads(body),_id=key) for key,body in db.execute('SELECT id,body FROM documents WHERE kind=?',(kind,))]
  chans=[c for c in rows('channels') if c.get('active') is not False and not c.get('hidden') and c.get('platform') in ('youtube','instagram','facebook','tiktok')]
  ids={c['_id'] for c in chans}
  out['channels']=[{'id':c['_id'],'platform':c['platform'],'name':text(c.get('displayName') or c.get('name'),80),'handle':text(c.get('handle'),80),'externalId':code(c.get('externalId'),80),'url':text(c.get('canonicalUrl') or c.get('url'),200)} for c in chans]
  jobs=[]
  for j in rows('socialPublishJobs'):
   at=when(j.get('scheduledAt'))
   if j.get('channelId') not in ids or not at or at<lo or at>hi:continue
   jobs.append({'id':j['_id'],'postId':text(j.get('postId'),80),'channelId':j['channelId'],'status':code(j.get('status')),'scheduledAt':at,'reviewWaiting':j.get('reviewWaiting') is True,'publicationUrl':text(j.get('publicationUrl'),300),'publishedAt':when(j.get('publishedAt')),'errorCode':code(j.get('errorCode')),'updatedAt':when(j.get('updatedAt'))})
  out['jobs']=jobs
  posts=[]
  for p in rows('posts'):
   at=when(p.get('publishedAt'))
   if p.get('channelId') not in ids or p.get('unavailableAt') or not at or at<lo:continue
   posts.append({'channelId':p['channelId'],'url':text(p.get('url'),300),'publishedAt':at,'publicationFormat':code(p.get('publicationFormat'))})
  out['posts']=posts
  out['appRunning']=True
 finally:
  db.rollback();db.close()
print(json.dumps(out))
`;

async function 읽기({ 시간제한ms = 90_000 } = {}) {
  const { NODES } = require('../server-backup/read-status.cjs');
  const policy = require('../모델정책.js');
  const node = NODES.find((row) => row.role === 'company');
  if (!node || policy.벌텍스프로젝트() !== PROJECT) throw new Error('WORKSPACE_IDENTITY');
  const response = await fetch(`https://compute.googleapis.com/compute/v1/projects/${PROJECT}/zones/${node.zone}/instances/${node.name}`, {
    headers: { authorization: 'Bearer ' + await policy.벌텍스토큰() }, redirect: 'error', signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('WORKSPACE_METADATA');
  const instance = await response.json();
  const nic = instance.networkInterfaces?.find((row) => row.name === 'nic0');
  const address = nic?.accessConfigs?.[0]?.natIP;
  if (instance.id !== node.id || instance.name !== node.name || instance.status !== 'RUNNING' || nic?.networkIP !== node.privateIp
    || nic.accessConfigs?.length !== 1 || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address || '')) throw new Error('WORKSPACE_IDENTITY');
  const known = path.join(os.tmpdir(), 'synk-workspace-read-' + randomUUID());
  try {
    fs.writeFileSync(known, node.alias + ' ' + node.hostKey + '\n', { flag: 'wx', mode: 0o600 });
    const stdout = await new Promise((resolve, reject) => {
      const child = execFile('ssh', ['-i', path.join(os.homedir(), '.ssh', node.key), '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
        '-o', 'UserKnownHostsFile=' + known.replaceAll('\\', '/'), '-o', 'HostKeyAlias=' + node.alias, '-o', 'CheckHostIP=no', '-o', 'ConnectTimeout=10',
        'synk@' + address, 'sudo -n python3 -'], { shell: false, windowsHide: true, timeout: 시간제한ms, maxBuffer: 16_000_000, encoding: 'utf8' },
      (error, out) => (error ? reject(new Error('WORKSPACE_SSH')) : resolve(out)));
      child.stdin.end(SOURCE);
    });
    const payload = JSON.parse(stdout);
    if (payload.instanceId !== node.id || payload.project !== PROJECT) throw new Error('WORKSPACE_IDENTITY');
    if (payload.appRunning !== true) throw new Error('WORKSPACE_APP_NOT_RUNNING');
    return 다듬기(payload);
  } finally { try { fs.unlinkSync(known); } catch { /* 이미 없음 */ } }
}

const iso = (v) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null);

/** 서버가 준 모양을 한 번 더 거른다(캐시를 다시 읽거나 시험에서 고정 응답을 넣을 때도 같은 길). */
function 다듬기(payload) {
  if (!payload || !Array.isArray(payload.channels) || !Array.isArray(payload.jobs) || !Array.isArray(payload.posts)) throw new Error('WORKSPACE_SHAPE');
  const channels = payload.channels.filter((c) => c && typeof c.id === 'string' && ['youtube', 'instagram', 'facebook', 'tiktok'].includes(c.platform));
  const known = new Set(channels.map((c) => c.id));
  return {
    checkedAt: iso(payload.checkedAt),
    channels,
    jobs: payload.jobs.filter((j) => j && typeof j.id === 'string' && known.has(j.channelId) && iso(j.scheduledAt)).map((j) => ({ ...j, scheduledAt: iso(j.scheduledAt), publishedAt: iso(j.publishedAt) })),
    posts: payload.posts.filter((p) => p && known.has(p.channelId) && iso(p.publishedAt)).map((p) => ({ ...p, publishedAt: iso(p.publishedAt) })),
  };
}

module.exports = { 읽기, 다듬기, SOURCE };

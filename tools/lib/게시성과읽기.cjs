'use strict';
/**
 * 게시성과읽기 — 회사 서버의 게시 성과 기록을 읽기만 해서 가져온다(2026-10-21, tools/게시성과.js가 쓴다).
 *
 * 헤르메스 overview.cjs의 refreshSns와 같은 길이다: 고정 서버 신원(Compute 메타데이터·호스트 키 고정)으로 회사 주 노드에 SSH로 들어가
 * 회사 DB(company.sqlite)를 mode=ro·query_only로 열고 허용한 칸만 JSON으로 돌려받는다. 운영 쓰기·서비스 조작·SNS API 호출 0,
 * 인증값(credentials 표)은 읽지 않는다.
 *
 * 돌려주는 것
 *   channels   연결된 SNS 채널(youtube·instagram·facebook·tiktok): id·platform·이름·핸들·주소·수집 상태
 *   entries    게시 성과 등록(postPerformanceEntries) 전부 — 24·72시간 체크포인트, 지표, 지표별 출처(metricProvenance), 창 지표
 *   posts      채널 수집기가 모은 채널별 최근 게시물(채널마다 최신 perChannel편) — 평소 대비 배수의 기준과 7일 값을 찾는 데 쓴다
 *   snapshots  그 게시물의 하루 한 벌 숫자(최근 days일) — [postId, checkedAt(ms), views, likes, comments, shares, saves, reach]
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');

const PROJECT = 'synk-bake-unmet27';

function 파이썬(매개) {
  // 매개는 숫자만 받아 문자열에 넣는다(주입 막기).
  const days = Math.max(1, Math.min(120, Math.floor(Number(매개.days) || 21)));
  const perChannel = Math.max(1, Math.min(200, Math.floor(Number(매개.perChannel) || 40)));
  return String.raw`import json,sqlite3,subprocess,datetime,urllib.request
DAYS=${days};PER=${perChannel}
def meta(p):
 return urllib.request.urlopen(urllib.request.Request('http://metadata.google.internal/computeMetadata/v1/'+p,headers={'Metadata-Flavor':'Google'}),timeout=3).read(200).decode()
def code(v,n=80):
 return v if isinstance(v,str) and 0<len(v)<=n and all(c.isalnum() or c in '_.:-' for c in v) else None
def when(v):
 try:
  d=datetime.datetime.fromisoformat(str(v).replace('Z','+00:00'))
  return d.astimezone(datetime.timezone.utc).isoformat().replace('+00:00','Z') if d.tzinfo else None
 except Exception:return None
def ms(v):
 w=when(v)
 return int(datetime.datetime.fromisoformat(w.replace('Z','+00:00')).timestamp()*1000) if w else None
def num(v):
 return v if isinstance(v,(int,float)) and not isinstance(v,bool) and v==v and v>=0 else None
def text(v,n):
 return str(v)[:n] if isinstance(v,str) else None
def plain(d):
 return {k:v for k,v in d.items() if isinstance(k,str) and len(k)<=40 and (v is None or isinstance(v,(bool,int,float)) or (isinstance(v,str) and len(v)<=120))} if isinstance(d,dict) else None
now=datetime.datetime.now(datetime.timezone.utc)
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
  out['channels']=[{'id':c['_id'],'platform':c['platform'],'name':text(c.get('displayName'),80),'handle':text(c.get('handle'),80),'url':text(c.get('canonicalUrl'),200),'externalId':code(c.get('externalId'),80),'status':code(c.get('status')),'lastSuccessAt':when(c.get('lastSuccessAt')),'ownerAuthorized':(c.get('coverage') or {}).get('ownerAuthorized') is True,'warnings':[w[:200] for w in (c.get('warnings') or []) if isinstance(w,str)][:6]} for c in chans]
  entries=[]
  for e in rows('postPerformanceEntries'):
   if e.get('channelId') not in ids or e.get('active') is False or not when(e.get('publishedAt')):continue
   points=[]
   for p in (e.get('checkpoints') or [])[:6]:
    if not isinstance(p,dict):continue
    point={k:p.get(k) for k in ('hours','status','dueAt','closesAt','observedAt','recordedAt','source','timing','measurementWindowMissed')}
    point['metrics']={k:num(v) for k,v in (p.get('metrics') or {}).items() if code(k,40)}
    point['metricProvenance']={k:plain(v) for k,v in (p.get('metricProvenance') or {}).items() if code(k,40) and isinstance(v,dict)}
    if isinstance(p.get('window'),dict):point['window']={k:p['window'].get(k) for k in ('status','dueAt','fetchedAt','lastErrorCode')}
    points.append(point)
   entries.append({'id':e['_id'],'channelId':e['channelId'],'platform':code(e.get('platform')),'url':text(e.get('url'),300),'postIdentity':text(e.get('postIdentity'),200),'publishedAt':when(e['publishedAt']),'publicationFormat':code(e.get('publicationFormat')),'origin':code(e.get('origin')),'createdAt':when(e.get('createdAt')),'title':text(e.get('title'),160),'checkpoints':points})
  out['entries']=entries
  posts=[p for p in rows('posts') if p.get('channelId') in ids and not p.get('unavailableAt') and when(p.get('publishedAt'))]
  posts.sort(key=lambda p:ms(p['publishedAt']),reverse=True)
  kept,count=[],{}
  for p in posts:
   n=count.get(p['channelId'],0)
   if n>=PER:continue
   count[p['channelId']]=n+1
   kept.append({'id':p['_id'],'channelId':p['channelId'],'externalId':text(p.get('externalId'),120),'url':text(p.get('url'),300),'publishedAt':when(p['publishedAt']),'publicationFormat':code(p.get('publicationFormat'))})
  out['posts']=kept
  postIds={p['id'] for p in kept}
  since=(now-datetime.timedelta(days=DAYS)).isoformat().replace('+00:00','Z')
  snaps=[]
  for key,body in db.execute("SELECT id,body FROM documents WHERE kind='snapshots' AND julianday(json_extract(body,'$.checkedAt'))>=julianday(?)",(since,)):
   s=json.loads(body)
   if s.get('postId') not in postIds:continue
   t=ms(s.get('checkedAt'))
   if t is None:continue
   snaps.append([s['postId'],t]+[num(s.get(k)) for k in ('views','likes','comments','shares','saves','reach')])
  out['snapshots']=snaps
  out['appRunning']=True
 finally:
  db.rollback();db.close()
print(json.dumps(out))
`;
}

/**
 * 회사 주 노드에서 읽는다. → { checkedAt, channels, entries, posts, snapshots }
 * 실패하면 던진다(오류 코드 문자열만 — 주소·키는 싣지 않는다).
 */
async function 읽기({ days = 21, perChannel = 40, 시간제한ms = 90_000 } = {}) {
  const { NODES } = require('../server-backup/read-status.cjs');
  const policy = require('../모델정책.js');
  const node = NODES.find(row => row.role === 'company');
  if (!node || policy.벌텍스프로젝트() !== PROJECT) throw new Error('PERFORMANCE_IDENTITY');
  const response = await fetch(`https://compute.googleapis.com/compute/v1/projects/${PROJECT}/zones/${node.zone}/instances/${node.name}`, {
    headers: { authorization: 'Bearer ' + await policy.벌텍스토큰() }, redirect: 'error', signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('PERFORMANCE_METADATA');
  const instance = await response.json();
  const nic = instance.networkInterfaces?.find(row => row.name === 'nic0');
  const address = nic?.accessConfigs?.[0]?.natIP;
  if (instance.id !== node.id || instance.name !== node.name || instance.status !== 'RUNNING' || nic?.networkIP !== node.privateIp
    || nic.accessConfigs?.length !== 1 || !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address || '')) throw new Error('PERFORMANCE_IDENTITY');
  const known = path.join(os.tmpdir(), 'synk-performance-read-' + randomUUID());
  try {
    fs.writeFileSync(known, node.alias + ' ' + node.hostKey + '\n', { flag: 'wx', mode: 0o600 });
    const stdout = await new Promise((resolve, reject) => {
      const child = execFile('ssh', ['-i', path.join(os.homedir(), '.ssh', node.key), '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
        '-o', 'UserKnownHostsFile=' + known.replaceAll('\\', '/'), '-o', 'HostKeyAlias=' + node.alias, '-o', 'CheckHostIP=no', '-o', 'ConnectTimeout=10',
        'synk@' + address, 'sudo -n python3 -'], { shell: false, windowsHide: true, timeout: 시간제한ms, maxBuffer: 16_000_000, encoding: 'utf8' },
      (error, out) => error ? reject(new Error('PERFORMANCE_SSH')) : resolve(out));
      child.stdin.end(파이썬({ days, perChannel }));
    });
    const payload = JSON.parse(stdout);
    if (payload.instanceId !== node.id || payload.project !== PROJECT) throw new Error('PERFORMANCE_IDENTITY');
    if (payload.appRunning !== true) throw new Error('PERFORMANCE_APP_NOT_RUNNING');
    return 다듬기(payload);
  } finally { try { fs.unlinkSync(known); } catch {} }
}

const iso = v => typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;

/** 서버가 준 모양을 한 번 더 거른다(시험에서 고정 응답을 넣을 때도 같은 길). */
function 다듬기(payload) {
  if (!payload || !Array.isArray(payload.channels) || !Array.isArray(payload.entries) || !Array.isArray(payload.posts) || !Array.isArray(payload.snapshots)) {
    throw new Error('PERFORMANCE_SHAPE');
  }
  const channels = payload.channels.filter(c => c && typeof c.id === 'string' && ['youtube', 'instagram', 'facebook', 'tiktok'].includes(c.platform));
  const known = new Set(channels.map(c => c.id));
  const entries = payload.entries.filter(e => e && typeof e.id === 'string' && known.has(e.channelId) && iso(e.publishedAt) && typeof e.url === 'string')
    .map(e => ({ ...e, publishedAt: iso(e.publishedAt), checkpoints: Array.isArray(e.checkpoints) ? e.checkpoints.filter(p => p && Number.isInteger(p.hours)) : [] }));
  const posts = payload.posts.filter(p => p && typeof p.id === 'string' && known.has(p.channelId) && iso(p.publishedAt))
    .map(p => ({ ...p, publishedAt: iso(p.publishedAt) }));
  const postIds = new Set(posts.map(p => p.id));
  const snapshots = payload.snapshots.filter(s => Array.isArray(s) && postIds.has(s[0]) && Number.isFinite(s[1]));
  return { checkedAt: iso(payload.checkedAt) || new Date().toISOString(), channels, entries, posts, snapshots };
}

module.exports = { 읽기, 다듬기, 파이썬 };

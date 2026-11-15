import { createHash, randomUUID } from 'node:crypto';
import { accountCatalog, MANAGED_ACCOUNT_STATUSES, matchAccount, platformKey } from './account-catalog.mjs';
import { canWriteChannel } from './organization.mjs';
import { EXTERNAL_OBSERVATION_KIND } from './external-observations.mjs';

const JOBS = 'metricCollectionProgress';
const WORKER = 'metricCollectionWorker';
const KEYS = ['views', 'likes', 'shares'];
const EXTERNAL = ['public-page', 'creator-screen', 'official-export'];
const LEASE_MS = 4 * 60_000;
const MAX_ATTEMPTS = 3;
const active = row => row && ['queued', 'running'].includes(row.status);
const fail = (message, status = 409) => Object.assign(new Error(message), { status });
const counted = value => Number.isSafeInteger(value) && value >= 0;
const iso = ms => new Date(ms).toISOString();
const reasons = {
  done: '이번 요청에서 확인한 수치를 저장했어요.',
  limited: '화면과 파일에서 제공하는 수치까지 확인했어요.',
  no_metrics: '이 화면에서 요청한 지표를 확인할 수 없었어요.',
  no_posts: '공개 프로필에 게시물이 없다고 표시돼요.',
  contact: '개인 연락처라 방송 채널 통계가 없어요.',
  need_owner: '이 계정의 통계 화면에서 소유자를 확인해야 해요.',
  user_control: '브라우저가 사용자 확인을 기다리고 있어요.',
  format: '화면이나 파일의 형식이 달라 수치를 확인하지 못했어요.',
  retry: '플랫폼 응답을 받지 못했어요. 다음 수집에서 다시 확인할 수 있어요.',
  changed: '계정 또는 담당 권한이 바뀌어 이 요청을 종료했어요.',
  unmapped: '통계 화면을 열려면 운영 원장의 계정과 연결해야 해요.',
  disabled: '이 채널은 수집이 꺼져 있어요.',
  interrupted: 'PC 실행이 반복해서 중단됐어요. 새 요청으로 다시 시도할 수 있어요.'
};

function catalogAccount(channel) {
  if (!channel.catalogAccountId) return matchAccount(channel);
  return accountCatalog.accounts.find(a => a.id === channel.catalogAccountId &&
    MANAGED_ACCOUNT_STATUSES.includes(a.accountStatus) && platformKey(a.platform) === platformKey(channel.platform));
}

function binding(c) {
  return createHash('sha256').update(JSON.stringify([
    c.platform, c.catalogAccountId, c.handle, c.externalId, c.canonicalUrl, c.teamId,
    [...(c.ownerIds || [])].sort(), c.connectionVersion || 0
  ])).digest('hex');
}

export function measuredApiMetrics(result) {
  // Only report metrics which saveCollection actually puts in its channel/post snapshots.
  const metrics=new Set();
  if(counted(result.channel?.views))metrics.add('views');
  if(counted(result.channel?.followers))metrics.add('followers');
  if(counted(result.channel?.metrics?.posts))metrics.add('posts');
  for(const post of result.posts || []) {
    for(const key of ['views','likes','shares','comments','saves','reach']) {
      if(counted(post.metrics?.[key]))metrics.add(key);
    }
  }
  return [...metrics];
}

export function createCollectionProgress({ store, clock, connected, enqueue, currentRun, record }) {
  const now = () => Date.parse(clock());
  const put = row => { store.put(JOBS, row.channelId, row); return row; };
  function finish(row, code, at) {
    const count = KEYS.filter(k => row.sources[k]).length;
    const hasOtherMetrics = Object.keys(row.otherSources || {}).length > 0;
    const status = count === KEYS.length && !row.apiPartial ? 'complete' : count || hasOtherMetrics ? 'partial' :
      ['retry', 'interrupted', 'changed'].includes(code) ? 'failed' : 'unavailable';
    const reason = code === 'done' && status !== 'complete' ? (count || hasOtherMetrics ? 'limited' : 'no_metrics') : code;
    return { ...row, status, stage:'finished', reason, message:reasons[reason], updatedAt:at, lease:null };
  }
  function permitted(row, channel) {
    const requester = store.get('users', row.requestedBy);
    return channel?.active && !channel.collectionDisabled && binding(channel) === row.binding &&
      (!row.accountId || catalogAccount(channel)?.id===row.accountId) &&
      requester && requester.active !== false && canWriteChannel(requester, channel);
  }
  function reconcile(row, channel) {
    if (!active(row)) return row;
    const at = clock();
    if (!permitted(row, channel)) return finish(row, 'changed', at);
    if (row.stage === 'api') {
      const run = store.get('runs', row.apiId);
      if (run && ['queued','running'].includes(run.status)) {
        return { ...row, status:run.status, message:run.status === 'queued' ? 'API 수집을 기다리고 있어요.' : '공식 API에서 확인하고 있어요.' };
      }
      const sources = { ...row.sources }, otherSources={...row.otherSources};
      for (const k of run?.measuredMetrics || []) (KEYS.includes(k)?sources:otherSources)[k]='api';
      row = { ...row, sources, otherSources, apiPartial:run?.status === 'partial', updatedAt:run?.finishedAt || at,
        apiStatus:run?.status || 'interrupted', status:'queued', stage:'pc', message:'수집 PC가 보완할 지표를 기다리고 있어요.' };
      if (KEYS.every(k => sources[k])) return finish(row,'done',row.updatedAt);
      if (!row.accountId) return finish(row,'unmapped',row.updatedAt);
    }
    if (row.lease && Date.parse(row.lease.until) <= now()) {
      if (row.attempts >= MAX_ATTEMPTS) return finish(row,'interrupted',at);
      return { ...row, lease:null, stage:'pc', status:'queued', updatedAt:at, message:'수집 PC가 다시 이어서 확인할 차례예요.' };
    }
    return row;
  }
  function view(row) {
    if (!row) return null;
    const { channelId, accountId, status, stage, sources, requestedAt, updatedAt, message } = row;
    return { channelId, accountId, status, stage, sources, metrics:KEYS.filter(k=>sources[k]),
      otherSources:row.otherSources || {}, reason:row.reason || null, apiStatus:row.apiStatus || null, requestedAt, updatedAt, message };
  }
  function item(c) {
    let row=store.get(JOBS,c.id);
    if(active(row) && !permitted(row,c)) row=put(finish(row,'changed',clock()));
    return row && row.binding===binding(c) ? view(reconcile(row,c)) : null;
  }
  function list(channels) {
    const seen = store.get(WORKER,'pc')?.lastSeenAt || null;
    return { items:channels.map(item).filter(Boolean), worker:{lastSeenAt:seen,online:!!seen && now()-Date.parse(seen) < LEASE_MS} };
  }
  function start(user, channels) {
    const allowed = channels.filter(c=>c.active && canWriteChannel(user,c));
    const group = createHash('sha256').update(JSON.stringify([user.id,allowed.map(c=>c.id).sort()])).digest('hex');
    const prior = allowed.map(c=>reconcile(store.get(JOBS,c.id),c));
    const continuing = prior.find(r=>active(r) && r.group===group)?.batch;
    const batch = continuing || randomUUID(), at = clock(), runs = [];
    for (const [i,c] of allowed.entries()) {
      const previous = prior[i];
      if (active(previous) || (continuing && previous?.batch === continuing && previous.binding === binding(c))) {
        if (previous.apiId) runs.push({id:previous.apiId,channelId:c.id,status:'already-running'});
        continue;
      }
      const account = catalogAccount(c);
      let row = {channelId:c.id,accountId:account?.id || null,requestedBy:user.id,requestId:randomUUID(),binding:binding(c),
        requestedAt:at,updatedAt:at,group,batch,attempts:0,lease:null,sources:{},status:'queued',stage:'pc',message:'수집 PC가 공개 화면을 확인할 차례예요.'};
      if (c.collectionDisabled) row=finish(row,'disabled',at);
      else if (connected(c)) {
        const run = enqueue(user,c);
        runs.push(run);
        row.apiId=run.id || currentRun(c.id)?.id;
        row.stage='api'; row.message='공식 API 수집을 기다리고 있어요.';
      } else if (!account) row=finish(row,'unmapped',at);
      else if (account.accountStatus==='operating-contact' && platformKey(c.platform)==='telegram') row=finish(row,'contact',at);
      put(row);
    }
    return {runs,progress:list(allowed)};
  }
  // The same provider run can resolve a public URL to its permanent account ID.
  function identifyAfterApi(before, after, runId) {
    if (before.externalId === after.externalId) return;
    const row = store.get(JOBS, before.id);
    if (row?.stage === 'api' && row.apiId === runId && row.binding === binding(before)) {
      put({...row, binding:binding(after)});
    }
  }
  function afterRecent(channelId, runId) {
    const c=store.get('channels',channelId), row=store.get(JOBS,channelId);
    if (row?.stage !== 'api' || row.apiId !== runId || !permitted(row,c) || !connected(c)) return;
    const run=enqueue(store.get('users',row.requestedBy),c);
    if (run.id) put({...row, apiId:run.id, updatedAt:clock()});
  }
  function heartbeat(at) {
    const last = store.get(WORKER,'pc');
    if (!last || Date.parse(at)-Date.parse(last.lastSeenAt)>=30_000) store.put(WORKER,'pc',{lastSeenAt:at});
  }
  function claim(input) {
    const {workerId,accountIds}=input || {};
    if(typeof workerId!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(workerId)||
        !Array.isArray(accountIds)||accountIds.length>1000||accountIds.some(id=>typeof id!=='string'||id.length>160)) {
      throw fail('수집 PC와 이 PC가 확인할 수 있는 계정 목록을 확인해 주세요.',400);
    }
    const supported=new Set(accountIds);
    return store.transaction(()=>{
      const at=clock(); heartbeat(at);
      for(const saved of store.all(JOBS).filter(active).sort((a,b)=>a.requestedAt.localeCompare(b.requestedAt)||a.attempts-b.attempts)) {
        const c=store.get('channels',saved.channelId);
        const row=reconcile(saved,c);
        if (row.stage==='api') continue;
        if (!active(row) || row.lease) { if (row!==saved) put(row); continue; }
        if (!row.accountId) {put(finish(row,'unmapped',at));continue;}
        if (!supported.has(row.accountId)) continue;
        const token=randomUUID(), until=iso(now()+LEASE_MS);
        put({...row,status:'running',stage:'public-page',attempts:row.attempts+1,updatedAt:at,
          message:'공개 프로필과 게시물을 확인하고 있어요.',lease:{token,until,workerId}});
        return {job:{channelId:row.channelId,accountId:row.accountId,requestId:row.requestId,token,until,workerId,
          missing:KEYS.filter(k=>!row.sources[k]),requestedAt:row.requestedAt}};
      }
      return {job:null};
    });
  }
  function owned(input) {
    const id=typeof input?.channelId==='string'?input.channelId:null;
    const c=id && store.get('channels',id), saved=id && store.get(JOBS,id);
    const row=reconcile(saved,c);
    if (row && row!==saved && (!active(row) || (saved?.lease && !row.lease))) put(row);
    if (!active(row) || !row.lease || row.lease.token!==input.token || row.requestId!==input.requestId)
      throw fail('이 수집 요청의 실행 시간이 끝났거나 계정이 바뀌었어요.');
    return {c,row};
  }
  function update(input) {
    const {row}=owned(input),at=clock(); heartbeat(at);
    if (input.reason) {
      if (!Object.hasOwn(reasons,input.reason)) throw fail('수집 결과 종류를 확인해 주세요.',400);
      return {item:view(put(finish(row,input.reason,at)))};
    }
    if (!EXTERNAL.includes(input.stage)) throw fail('수집 단계를 확인해 주세요.',400);
    const messages={'public-page':'공개 프로필과 게시물을 확인하고 있어요.','creator-screen':'계정의 통계 화면을 읽고 있어요.','official-export':'공식 파일을 확인하고 있어요.'};
    return {item:view(put({...row,stage:input.stage,message:messages[input.stage],updatedAt:at,lease:{...row.lease,until:iso(now()+LEASE_MS)}}))};
  }
  function observe(user,input) {
    const {c,row}=owned(input),e=input.envelope;
    const captured=Date.parse(e?.observedAt);
    if (!Number.isFinite(captured) || captured < Date.parse(row.requestedAt) || !EXTERNAL.includes(e?.sourceType))
      throw fail('이번 요청에서 확인한 원본만 기록할 수 있어요.',400);
    if(e.sourceType==='official-export'){
      const proof=input.capture,downloaded=Date.parse(proof?.downloadedAt);
      if(!Number.isFinite(downloaded)||downloaded<Date.parse(row.requestedAt)||downloaded>now()+60_000||
          proof.requestId!==row.requestId||proof.token!==row.lease.token||proof.evidenceSha256!==e.evidenceSha256) {
        throw fail('이 요청에서 다시 내려받은 공식 파일의 확인 기록이 필요해요.',400);
      }
    }
    // 공식 파일은 다시 내려받아도 바이트가 같을 수 있다. 첫 관측 시각을 보존하고 같은 자료인지 기존 기록기가 다시 검증한다.
    let original;
    if (e.sourceType==='official-export') original=store.all(EXTERNAL_OBSERVATION_KIND)
      .find(o=>o.channelId===c.id && o.evidenceSha256===e.evidenceSha256 && o.sourceType==='official-export');
    const result=record(user,c,original ? {...e,observedAt:original.observedAt} : e);
    const sources={...row.sources},otherSources={...row.otherSources};
    for (const observation of result.records) {
      for (const [key,value] of Object.entries(observation.metrics || {})) {
        if (!counted(value)) continue;
        const destination=KEYS.includes(key)?sources:otherSources;
        if (!destination[key]) destination[key]=e.sourceType;
      }
    }
    const at=clock();
    put({...row,stage:e.sourceType,sources,otherSources,updatedAt:at,lease:{...row.lease,until:iso(now()+LEASE_MS)}});
    return {created:result.created.length,existing:result.existing.length,metrics:KEYS.filter(k=>sources[k])};
  }
  return {start,item,list,claim,update,observe,identifyAfterApi,afterRecent};
}


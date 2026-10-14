'use strict';
// Read-only, digest-guarded plan. It never registers a client or writes a secret.
const crypto = require('node:crypto');
const fs = require('node:fs');
const { CLIENTS, SERVICES, LEGACY_CLIENT_IDS } = require('./registry.cjs');
const digest = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const canonicalMap = environment => Object.fromEntries(Object.entries(LEGACY_CLIENT_IDS[environment] || {}).map(([service,id])=>[id,service==='world'?'world':'platform']));
const clientName = (registration, environment) => `SYNK ${registration} (${environment})`;
const validateOnly = only => { if (only !== undefined && (typeof only !== 'string' || !CLIENTS.some(row => row.id === only && row.connection !== 'pending-adapter'))) throw Error('--only에는 준비된 등록 이름 하나를 정확히 지정해 주세요.'); return only; };
const safeCallback = (uri, wanted) => {
  try {
    const url = new URL(uri);
    return typeof uri === 'string' && !url.username && !url.password && !url.hash
      && (wanted.redirectUris.includes(uri) || url.protocol === 'https:')
      && [...url.searchParams.keys()].every(key => url.searchParams.getAll(key).length === 1)
      && !['code','state','error','error_description','access_token','refresh_token'].some(key => url.searchParams.has(key));
  } catch { return false; }
};
const matchesClient = (wanted, client) => client?.client_type === 'public' && !client.client_secret && !client.deleted_at && client.revoked !== true && (!client.token_endpoint_auth_method || client.token_endpoint_auth_method === 'none')
  && Array.isArray(client.redirect_uris) && new Set(client.redirect_uris).size === client.redirect_uris.length
  && wanted.redirectUris.every(uri => client.redirect_uris.includes(uri)) && client.redirect_uris.every(uri => safeCallback(uri, wanted));
function buildProvisionPlan({environment,clients,secretDigest,existingMapping,bindings={},only}) {
  validateOnly(only);
  if (!['production','rehearsal'].includes(environment) || !Array.isArray(clients)) throw Error('검증 가능한 환경과 원격 클라이언트 목록이 필요합니다.');
  const source = existingMapping === undefined ? canonicalMap(environment) : existingMapping;
  if (!source || Array.isArray(source) || typeof source!=='object' || Object.entries(source).some(([id,p])=>!id||!['world','platform','messenger'].includes(p))) throw Error('기존 제품 매핑 형식이 잘못되었습니다.');
  if (digest(source)!==secretDigest) throw Error('원격 제품 매핑 지문이 원본과 다릅니다. 기존값을 확인하기 전에는 변경할 수 없습니다.');
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings) || Object.entries(bindings).some(([id, value]) => !CLIENTS.some(client => client.id === id) || typeof value !== 'string' || !value)) throw Error('등록 연결 이름과 실제 client ID를 확인해 주세요.');
  if (new Set(clients.map(client => client.client_id)).size !== clients.length || clients.some(client => typeof client.client_id !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(client.client_id))) throw Error('원격 클라이언트 목록이 중복되거나 잘못됐습니다.');
  const assigned = new Set();
  const mergedMapping={...source},actions=[],registrations=[];
  for(const wanted of CLIENTS){
    if(wanted.connection==='pending-adapter') {registrations.push({id:wanted.id,service:wanted.service,status:'pending-adapter'});continue;}
    const known=bindings[wanted.id]||wanted.knownIds?.[environment];
    const found=known ? clients.find(c=>c.client_id===known) : null;
    const exact=c=>matchesClient(wanted,c);
    if(found&&!exact(found))throw Error(`등록된 ${wanted.id}의 공개 유형 또는 반환 주소가 다릅니다.`);
    if(known&&!found)throw Error(`등록 근거 ${wanted.id}가 현재 원격 목록에 없습니다.`);
    if(!found){
      const candidates=clients.filter(exact);
      if(candidates.length) {registrations.push({id:wanted.id,service:wanted.service,status:'binding-required'});continue;}
      if(wanted.runtime==='legacy'&&!wanted.knownIds?.[environment]){registrations.push({id:wanted.id,service:wanted.service,status:'not-targeted'});continue;}
      registrations.push({id:wanted.id,service:wanted.service,status:'registration-needed'});
      if (!only || wanted.id === only) actions.push({action:'register-public-client',registration:wanted.id,product:wanted.product,body:{client_name:clientName(wanted.id,environment),client_type:'public',token_endpoint_auth_method:'none',redirect_uris:[...wanted.redirectUris]}});
      continue;
    }
    if(Object.hasOwn(source,known)&&source[known]!==wanted.product)throw Error(`기존 ${wanted.id} 제품 매핑을 덮어쓸 수 없습니다.`);
    if(assigned.has(known))throw Error('실행 환경 사이에서 동일 OAuth client ID를 공유할 수 없습니다.');assigned.add(known);
    if (!only || wanted.id === only) mergedMapping[known]=wanted.product;
    registrations.push({id:wanted.id,service:wanted.service,status:Object.hasOwn(source,known)?'registered-and-mapped':'mapping-needed',clientId:known});
  }
  if(JSON.stringify(mergedMapping)!==JSON.stringify(source))actions.push({action:'merge-product-mapping',expectedDigest:secretDigest,value:mergedMapping});
  return {version:1,environment,readOnly:true,registeredCount:clients.length,mapping:{verified:true,existingCount:Object.keys(source).length,preservedCount:Object.keys(source).length,mergedCount:Object.keys(mergedMapping).length,expectedDigest:secretDigest},registrations,services:SERVICES.map(s=>({id:s.id,name:s.name,connection:s.connection,registered:registrations.filter(r=>r.service===s.id&&r.status==='registered-and-mapped').length,required:registrations.filter(r=>r.service===s.id&&!['pending-adapter','not-targeted'].includes(r.status)).length})),actions};
}
async function main(){
  const allowed=new Set(['--운영','--mapping','--bindings','--only']);const args=process.argv.slice(2);
  if(args.filter(arg=>arg==='--only').length>1)throw Error('--only는 한 번만 지정해 주세요.');
  for(let i=0;i<args.length;i++){if(!allowed.has(args[i]))throw Error('지원하지 않는 인자입니다. 이 도구는 읽기 계획만 만듭니다.');if(args[i]!=='--운영'){if(!args[++i])throw Error('파일 경로가 필요합니다.');}}
  const only=validateOnly(args.includes('--only')?args[args.indexOf('--only')+1]:undefined);
  const {createProvider}=require('./provision-apply.cjs'); const environment=args.includes('--운영')?'production':'rehearsal';
  const provider=await createProvider({environment});
  const readArg=flag=>args.includes(flag)?JSON.parse(fs.readFileSync(args[args.indexOf(flag)+1],'utf8')):undefined;
  const secretDigest=await provider.readDigest(),clients=await provider.listClients();
  const plan=buildProvisionPlan({environment,clients,secretDigest,existingMapping:readArg('--mapping'),bindings:readArg('--bindings'),only});
  console.log(JSON.stringify({...plan,mapping:{...plan.mapping,expectedDigest:'verified; not printed'},actions:plan.actions.map(a=>a.action==='merge-product-mapping'?{action:a.action,entries:Object.keys(a.value).length,requiresFreshDigestCheck:true}:a)},null,2));
}
module.exports={buildProvisionPlan,canonicalMap,digest,clientName,matchesClient,validateOnly};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});

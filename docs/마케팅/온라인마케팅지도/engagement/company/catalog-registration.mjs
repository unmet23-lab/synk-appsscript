// 원장(account-catalog.json)의 관리 계정을 서버 채널로 등록한다(2026-11-14).
// · 운영(operating)·운영 연락(operating-contact)·확정 확장(confirmed-expansion)만 받는다. 계획·보류·제외 계정과 원장에 없는 ID는 거절한다.
// · 주소를 지어내지 않는다. 원장 주소가 기존 정규화 규칙(normalizeChannelUrl)으로 같은 플랫폼에 읽힐 때만 canonicalUrl을 두고,
//   그 밖에는 원장 주소를 publicUrl에 그대로 남긴다. 원장에 주소가 없으면 둘 다 null이다(다른 사이트 주소로 바꾸지 않는다).
// · 같은 원장 ID 묶음(catalogAccountId·legacyId), 지금 matchAccount 결과, 확실한 플랫폼+주소·번호가 같은 채널이 있으면
//   새로 만들지 않고 그 채널을 돌려준다. 대응이 둘 이상이거나 다른 원장 계정에 묶인 채널이면 아무것도 쓰지 않고 409다.
// · 기존 채널·연결 정보·담당자·이력은 읽기만 한다. 새 채널은 연결 없음(not-connected)·자격증명 없음으로만 만든다.
import {randomUUID} from 'node:crypto';
import {accountCatalog,matchAccount,platformKey,accountAddressKey,MANAGED_ACCOUNT_STATUSES} from './account-catalog.mjs';
import {normalizeChannelUrl} from './collectors.mjs';
import {seedOwnership} from './organization.mjs';

export const CATALOG_REGISTRATION_LIMIT=100;
const MANAGED=new Set(MANAGED_ACCOUNT_STATUSES);
const ACCOUNT_ID=/^[a-z0-9][a-z0-9-]{0,79}$/;
const fail=(message,status=400,code='SYNK_CATALOG_INPUT',details)=>Object.assign(new Error(message),{status,code,...(details?{details}:{})});
const trimmed=value=>typeof value==='string'&&value.trim()?value.trim():null;
const ledgerUrl=value=>{const raw=trimmed(value);if(!raw||raw.length>2048)return null;try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password?raw:null;}catch{return null;}};

// 원장 한 줄 → 새 채널의 계정 칸. 원장 값과, 원장 주소를 기존 규칙으로 읽은 값만 쓴다.
export function catalogChannelDraft(account){
  const platform=platformKey(account?.platform);
  if(!platform)return {error:'missing-platform'};
  const publicUrl=ledgerUrl(account.publicUrl);
  let parsed=null;
  if(publicUrl){try{const read=normalizeChannelUrl(publicUrl);if(read.platform===platform)parsed=read;}catch{parsed=null;}}
  const ledgerId=trimmed(account.externalId);
  // Facebook 프로필 주소(profile.php?id=)의 번호는 공개 프로필 번호라서, 원장 externalId(Graph·Business Suite 페이지 번호)와 원래 다르다. 두 번호를 비교하거나 섞지 않는다.
  if(ledgerId&&parsed?.externalId&&parsed.externalId!==ledgerId&&platform!=='facebook')return {error:'ledger-url-id-mismatch'};
  const handle=trimmed(account.handle)?.replace(/^@/,'')||parsed?.handle||null;
  const externalId=ledgerId||parsed?.externalId||null;
  return {draft:{platform,canonicalUrl:parsed?.canonicalUrl||null,publicUrl,externalId,handle,label:handle||externalId||platform}};
}

function accountIdsOf(value){
  if(!Array.isArray(value)||!value.length||value.length>CATALOG_REGISTRATION_LIMIT)throw fail(`원장 계정 ID(accountIds)를 한 번에 1~${CATALOG_REGISTRATION_LIMIT}개 넣어 주세요.`);
  if(value.some(id=>typeof id!=='string'||!ACCOUNT_ID.test(id)))throw fail('원장 계정 ID 형식을 확인해 주세요.');
  if(new Set(value).size!==value.length)throw fail('같은 원장 계정 ID가 두 번 들어 있어요.',400,'SYNK_CATALOG_DUPLICATE_ID');
  return value;
}

// 순수 계획: 새로 만들 것과 이미 있는 채널. 모호하면 쓰기 전에 던진다.
export function planCatalogRegistration({accountIds,channels=[],catalog=accountCatalog}){
  const ids=accountIdsOf(accountIds),byId=new Map(catalog.accounts.map(account=>[account.id,account]));
  const unknown=ids.filter(id=>!byId.has(id));
  if(unknown.length)throw fail('원장 계정 목록에 없는 ID예요. 계획표(plans) 항목은 등록할 수 없어요.',400,'SYNK_CATALOG_UNKNOWN_ACCOUNT',{unknown});
  const notManaged=ids.map(id=>byId.get(id)).filter(account=>!MANAGED.has(account.accountStatus)).map(account=>({accountId:account.id,accountStatus:account.accountStatus||null}));
  if(notManaged.length)throw fail('운영·확정 계정만 등록할 수 있어요. 계획·보류·제외 계정은 등록하지 않아요.',400,'SYNK_CATALOG_NOT_MANAGED',{notManaged});
  const matched=new Map(channels.map(channel=>[channel.id,matchAccount(channel,catalog)?.id||null]));
  const conflicts=[],existing=[],create=[];
  for(const id of ids){
    const account=byId.get(id),{draft,error}=catalogChannelDraft(account);
    if(error){conflicts.push({accountId:id,reason:error,channelIds:[]});continue;}
    const address=accountAddressKey(account.publicUrl);
    const candidates=channels.filter(channel=>{
      if(channel.catalogAccountId===id||channel.legacyId===id||matched.get(channel.id)===id)return true;
      if(platformKey(channel.platform)!==draft.platform)return false;
      return !!(address&&accountAddressKey(channel.canonicalUrl||channel.publicUrl)===address)||!!(draft.canonicalUrl&&channel.canonicalUrl===draft.canonicalUrl)||!!(draft.externalId&&channel.externalId===draft.externalId);
    });
    if(candidates.length>1){conflicts.push({accountId:id,reason:'multiple-channels',channelIds:candidates.map(channel=>channel.id)});continue;}
    if(candidates.length===1){
      const channel=candidates[0],bound=matched.get(channel.id);
      if((bound&&bound!==id)||(channel.catalogAccountId&&channel.catalogAccountId!==id)||(channel.legacyId&&channel.legacyId!==id&&byId.has(channel.legacyId))){conflicts.push({accountId:id,reason:'channel-matches-other-account',channelIds:[channel.id]});continue;}
      if(bound!==id&&channel.catalogAccountId!==id){conflicts.push({accountId:id,reason:'unconfirmed-match',channelIds:[channel.id]});continue;}
      existing.push({accountId:id,channel});continue;
    }
    if(matchAccount({...draft,id:'catalog-probe',legacyId:id,catalogAccountId:id},catalog)?.id!==id){conflicts.push({accountId:id,reason:'catalog-match-unconfirmed',channelIds:[]});continue;}
    create.push({account,draft,address});
  }
  // 한 요청 안에서 같은 플랫폼의 같은 주소·번호를 두 원장 계정이 만들려 하면 요청 전체를 멈춘다.
  const claimed=new Map();
  for(const row of create){
    const keys=[row.address&&`a|${row.draft.platform}|${row.address}`,row.draft.canonicalUrl&&`c|${row.draft.canonicalUrl}`,row.draft.externalId&&`e|${row.draft.platform}|${row.draft.externalId}`].filter(Boolean);
    for(const key of keys){const owner=claimed.get(key);if(owner&&owner!==row.account.id)conflicts.push({accountId:row.account.id,reason:'same-address-in-request',channelIds:[],with:owner});else claimed.set(key,row.account.id);}
  }
  if(conflicts.length)throw fail('기존 채널과의 대응이 하나로 정해지지 않은 계정이 있어요. 아무것도 등록하지 않았어요.',409,'SYNK_CATALOG_AMBIGUOUS',{conflicts});
  return {existing,create};
}

const displayName=(account,draft)=>[account.business,account.country,draft.platform,draft.handle||draft.externalId].filter(value=>typeof value==='string'&&value.trim()).join(' · ').slice(0,160)||draft.platform;

export function createCatalogRegistration({store,clock=()=>new Date().toISOString(),catalog=accountCatalog,audit=()=>{}}){
  function register(user,input,{teamId=null}={}){
    if(user?.role!=='admin')throw fail('관리자만 원장 계정을 등록할 수 있어요.',403,'SYNK_CATALOG_FORBIDDEN');
    if(!input||typeof input!=='object'||Array.isArray(input))throw fail('등록 요청을 확인해 주세요.');
    const extra=Object.keys(input).filter(key=>!['accountIds','teamId'].includes(key));
    if(extra.length)throw fail(`알 수 없는 칸이 있어요: ${extra.slice(0,5).join(', ')}`);
    return store.transaction(()=>{
      const plan=planCatalogRegistration({accountIds:input.accountIds,channels:store.all('channels'),catalog}),at=clock(),added=[];
      for(const {account,draft} of plan.create){
        const channel={...draft,id:randomUUID(),displayName:displayName(account,draft),ownerIds:[user.id],teamId:teamId||null,active:true,status:'not-connected',createdAt:at,
          legacyId:account.id,catalogAccountId:account.id,
          registration:{source:'account-catalog',accountStatus:account.accountStatus,catalogSourceAt:catalog.sourceAt||null,catalogGeneratedAt:catalog.generatedAt||null,registeredBy:user.id,registeredAt:at}};
        store.put('channels',channel.id,channel);
        seedOwnership(store,channel,at);
        audit(user,'channel-from-catalog',channel.id,{accountId:account.id});
        added.push({accountId:account.id,channel});
      }
      return {added,existing:plan.existing};
    });
  }
  return {register};
}

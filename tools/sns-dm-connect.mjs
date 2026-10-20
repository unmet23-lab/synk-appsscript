import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {Store} from '../docs/마케팅/온라인마케팅지도/engagement/company/store.mjs';
const require=createRequire(import.meta.url);
const need=(value,code)=>{if(!value)throw Error(code);};
async function readJson(response){
  need(response.ok,'connection_read_failed');const text=await response.text();need(text.length<=262144,'connection_response_invalid');return JSON.parse(text);
}
export async function verifyTalkConnection(config,{fetchImpl=fetch}={}){
  need(/^[a-z0-9]{20}$/.test(config?.projectRef||'')&&typeof config.serviceRoleKey==='string'&&config.serviceRoleKey.length>=20,'connection_invalid');
  // Empty input fails validation after authentication and before folder access.
  // This proves the existing function credential without creating a campaign.
  const response=await fetchImpl(`https://${config.projectRef}.supabase.co/functions/v1/synkbrief-dm?task=drive-register`,{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+config.serviceRoleKey,'Content-Type':'application/json'},body:'{}'});
  const body=await response.json().catch(()=>null);
  need(response.status===400&&body?.ok===false&&body.error==='invalid_folder','connection_not_verified');
  return {verified:true};
}
export async function resolveTalkConnection({talkRoot,production=false,fetchImpl=fetch}={}){
  need(path.isAbsolute(talkRoot||''),'absolute_talk_root_required');
  const credentials=require(path.join(talkRoot,'lib','자격증명.js'));
  const priorRef=process.env.SUPABASE_PROJECT_REF;
  let env;
  try{
    if(production)process.env.SUPABASE_PROJECT_REF=credentials.운영REF;
    env=credentials.읽기('sns-dm-connect',{args:[],읽기:true});
  }finally{if(priorRef===undefined)delete process.env.SUPABASE_PROJECT_REF;else process.env.SUPABASE_PROJECT_REF=priorRef;}
  const projectRef=env.SUPABASE_PROJECT_REF;
  need(/^[a-z0-9]{20}$/.test(projectRef||''),'project_not_configured');
  let serviceRoleKey=env.SUPABASE_SERVICE_ROLE_KEY;
  if(!serviceRoleKey){
    need(typeof env.SUPABASE_ACCESS_TOKEN==='string'&&env.SUPABASE_ACCESS_TOKEN,'management_credential_missing');
    // Same fixed Vault read as the existing Talk publication CLI. The API-key
    // list can return a legacy key that the deployed function no longer accepts.
    const rows=await readJson(await fetchImpl('https://api.supabase.com/v1/projects/'+projectRef+'/database/query',{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},
      body:JSON.stringify({query:"select decrypted_secret from vault.decrypted_secrets where name='service_role_key'"})}));
    need(Array.isArray(rows)&&rows.length===1&&typeof rows[0].decrypted_secret==='string','service_credential_missing');serviceRoleKey=rows[0].decrypted_secret;
  }
  const config={projectRef,serviceRoleKey};
  await verifyTalkConnection(config,{fetchImpl});
  return config; // Internal only; callers must never log or serialize to stdout.
}
export async function installTalkConnection(config,{dataDir,fetchImpl=fetch,storeFactory=directory=>new Store(directory)}={}){
  need(path.isAbsolute(dataDir||''),'absolute_company_data_required');
  await verifyTalkConnection(config,{fetchImpl});
  const store=storeFactory(dataDir);
  try{store.setSecret('social-dm-talk',{projectRef:config.projectRef,serviceRoleKey:config.serviceRoleKey});
    const saved=store.secret('social-dm-talk');need(saved?.projectRef===config.projectRef&&saved?.serviceRoleKey===config.serviceRoleKey,'encrypted_storage_unverified');
  }finally{store.close();}
  return {ok:true,configured:true,verified:true,registered:false};
}
async function main(args){
  const options={};for(let i=0;i<args.length;i++){
    const key=args[i];need(['--talk-root','--data-dir','--production','--apply','--install-stdin'].includes(key)&&!Object.hasOwn(options,key),'usage');
    options[key]=['--production','--apply','--install-stdin'].includes(key)?true:args[++i];
  }
  need(!options['--install-stdin']||options['--apply'],'stdin_install_requires_apply');
  let config;
  if(options['--install-stdin']){
    let text='';for await(const chunk of process.stdin){text+=chunk.toString('utf8');need(Buffer.byteLength(text)<=16384,'input_too_large');}
    config=JSON.parse(text);need(Object.keys(config).every(key=>['projectRef','serviceRoleKey'].includes(key)),'connection_invalid');
  }else config=await resolveTalkConnection({talkRoot:options['--talk-root']||path.join(os.homedir(),'Documents','SYNK-talk'),production:options['--production']===true});
  const result=options['--apply']?await installTalkConnection(config,{dataDir:options['--data-dir']}):{ok:true,verified:true,configured:false,dryRun:true,registered:false};
  console.log(JSON.stringify(result));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  main(process.argv.slice(2)).catch(()=>{console.error(JSON.stringify({ok:false,error:'dm_connection_unverified'}));process.exitCode=1;});
}

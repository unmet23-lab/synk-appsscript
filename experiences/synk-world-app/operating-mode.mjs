import {readConfig} from '../synk-account/src/core.mjs';
export function publicWorldConfig(value,base){
 if(!value||!['rehearsal','account'].includes(value.mode))throw new TypeError('WORLD connection mode is required');
 const basePath=value.basePath||'/';
 if(!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(basePath))throw new TypeError('Invalid WORLD base path');
 if(value.mode==='rehearsal')return {mode:'rehearsal',basePath};
 const account=readConfig(value.account,base);
 if(!account.configured||!account.clients.world.clientId||!account.clients.world.redirectUri)throw new TypeError('Configured public WORLD account is required');
 // readConfig rejects secret/service-role keys and private client fields.
 const {configured,...publicAccount}=account;
 return {mode:'account',basePath,account:publicAccount};
}
export async function loadWorldConfig({value=globalThis.__SYNK_WORLD_CONFIG__,base=globalThis.location.href,fetcher=(...args)=>globalThis.fetch(...args)}={}){
 if(value)return publicWorldConfig(value,base);
 const response=await fetcher(new URL('./world-config.json',base).href,{credentials:'omit',cache:'no-store'});
 if(!response.ok)throw new Error('WORLD 계정 연결 설정을 불러오지 못했어요.');
 return publicWorldConfig(await response.json(),base);
}

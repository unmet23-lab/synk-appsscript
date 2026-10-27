import assert from 'node:assert/strict';
export async function handleWorldProfileRead(route,accountApiUrl,accountId){
 const r=route.request(),u=new URL(r.url());if(u.origin!==new URL(accountApiUrl).origin)return false;
 let status=200,data;
 if(u.pathname.endsWith('/synk-personal')){assert.equal(r.method(),'GET');assert.equal(u.searchParams.get('resource'),'member-understanding');assert.equal(r.postDataJSON(),null);status=403;data={ok:false,error:{code:'PRODUCT_FORBIDDEN'}};}
 else if(u.pathname.endsWith('/functions/v1/classroom')){assert.equal(r.method(),'GET');assert.equal(u.search,'');assert.equal(r.headers()['x-contract-ver'],'c16');status=401;data={contract_ver:'c16',ok:false,error:{code:'AUTH_REQUIRED',message:'다시 로그인해 주세요',retryable:false}};}
 else if(u.pathname.endsWith('/synk-classroom/api/world/homework')){assert.equal(r.method(),'GET');assert.equal(u.search,'');assert.equal(r.headers()['x-synk-contract'],'1');assert.equal(r.headers()['x-synk-product'],'world');data={ok:true,mode:'account-linked',accountId,classes:[],emptyReason:'NO_CLASS',serverTime:new Date().toISOString()};}
 else return false;
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data),headers:{'Access-Control-Allow-Origin':'*'}});return true;
}
export function assetFailure(response,accountApiUrl){
 if(response.status()<400)return false;const u=new URL(response.url());if(u.origin!==new URL(accountApiUrl).origin||response.request().method()!=='GET')return true;
 return !((response.status()===403&&u.pathname.endsWith('/synk-personal')&&u.searchParams.get('resource')==='member-understanding')||(response.status()===401&&u.pathname.endsWith('/functions/v1/classroom')));
}

// The current navigation exposes learning directly; older frozen releases put it under Play.
export async function openWorldLibrary(page){
 const learning=page.locator('.world-nav [data-view=packs]');
 if(await learning.count())await learning.click();
 else{await page.locator('.world-nav [data-view=play]').click();await page.locator('#world-panel [data-view=packs]').click();}
}

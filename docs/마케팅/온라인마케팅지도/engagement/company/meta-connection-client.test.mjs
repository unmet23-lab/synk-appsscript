import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('./public/app.js',import.meta.url),'utf8');
const modalSource=source.slice(source.indexOf('function connectModal('),source.indexOf('function providerModal('));
function render(platform,{admin=true,configured=true}={}){
  let html='';
  const context=vm.createContext({state:{data:{channels:[{id:'test-channel',platform,displayName:'회사 계정'}]}},autoSupported:()=>true,providerFor:()=>({configured}),capabilityFor:()=>({}),requirementText:()=>[],platformKey:v=>v,platformLabel:v=>v,channelName:v=>v.displayName,escape:String,statusBadge:()=>'',icon:()=>'',button:()=>'',isAdmin:()=>admin,canEditChannel:()=>true,modal:(_title,_description,body)=>{html=body;}});
  vm.runInContext(modalSource+'\nconnectModal("test-channel");',context);
  return html;
}
test('Meta connection offers comments as a separate OAuth consent and accepts a token type, never asserted grants',()=>{
  for(const platform of ['instagram','facebook']){
    const html=render(platform);
    assert.match(html,new RegExp(`/api/oauth/${platform}/start\\?channelId=test-channel"`));
    assert.match(html,/channelId=test-channel&amp;comments=1/);
    assert.match(html,/<select name="authType" required>/);
    assert.match(html,/name="accessToken" type="password"/);
    assert.doesNotMatch(html,/name="(?:scope|expiresAt)"/);
  }
  assert.match(render('instagram'),/value="instagram-login"/);
  assert.match(render('facebook'),/value="facebook-page"/);
});
test('manual tokens stay admin-only and an unconfigured app has no OAuth comment link',()=>{
  assert.doesNotMatch(render('instagram',{admin:false}),/name="accessToken"/);
  assert.doesNotMatch(render('instagram',{configured:false}),/comments=1/);
  assert.doesNotMatch(render('youtube'),/comments=1|name="authType"/);
});

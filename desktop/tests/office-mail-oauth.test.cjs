'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {authorize,refreshGrant}=require('../src/office-mail-oauth.cjs');
const scope='openid email https://www.googleapis.com/auth/gmail.readonly';
const client={id:'333333-fixture.apps.googleusercontent.com',secret:'fixture-desktop-value'};
const json=value=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
test('공식 브라우저에서 직접 동의한 연결만 PKCE로 교환하고 사서함을 확인한다',async()=>{
  let auth,requests=[];
  const open=async raw=>{
    auth=new URL(raw);const uri=new URL(auth.searchParams.get('redirect_uri'));
    assert.equal(auth.origin,'https://accounts.google.com');assert.equal(auth.searchParams.get('scope'),scope);
    assert.equal(uri.hostname,'127.0.0.1');
    const wrong=new URL(uri);wrong.searchParams.set('state','wrong');wrong.searchParams.set('code','unrelated');
    assert.equal((await fetch(wrong)).status,400);
    uri.searchParams.set('code','test-code');uri.searchParams.set('state',auth.searchParams.get('state'));
    uri.searchParams.set('session_state','extra');assert.equal((await fetch(uri)).status,200);
  };
  const net=async(url,init)=>{
    requests.push(String(url)); assert.equal(init.redirect,'error');
    if(requests.length===1){
      const form=new URLSearchParams(init.body);assert.equal(form.get('code'),'test-code');
      assert.equal(createHash('sha256').update(form.get('code_verifier')).digest('base64url'),auth.searchParams.get('code_challenge'));
      return json({access_token:'a',refresh_token:'r',scope,expires_in:3600,token_type:'Bearer'});
    }
    return requests.length===2?json({emailAddress:'office@example.test'}):json({email_verified:true,email:'office@example.test',sub:'fixed-google-subject'});
  };
  const linked=await authorize({provider:'gmail',client,open,fetch:net});
  assert.equal(linked.address,'office@example.test');assert.equal(linked.subject,'fixed-google-subject');assert.equal(linked.refreshToken,'r');assert.equal(requests.length,3);
});
test('거절한 동의는 토큰을 요청하지 않는다',async()=>{
  const open=async raw=>{const url=new URL(raw),back=new URL(url.searchParams.get('redirect_uri'));back.searchParams.set('state',url.searchParams.get('state'));back.searchParams.set('error','access_denied');await fetch(back);};
  await assert.rejects(authorize({provider:'gmail',client,open,fetch:()=>assert.fail('token request')}),{code:'MAIL_CANCELLED'});
});
test('토큰이 만료됐거나 읽기 외의 범위를 반환하면 연결을 다시 요청한다',async()=>{
  const grant={provider:'gmail',refreshToken:'r',address:'office@example.test',subject:'office@example.test'};
  await assert.rejects(refreshGrant({provider:'gmail',client,grant,fetch:async()=>new Response(JSON.stringify({error:'invalid_grant'}),{status:400})}),{code:'MAIL_RECONNECT'});
  await assert.rejects(refreshGrant({provider:'gmail',client,grant,fetch:async()=>json({access_token:'x',scope:scope+' https://www.googleapis.com/auth/gmail.modify',token_type:'Bearer'})}),{code:'MAIL_SCOPE'});
});

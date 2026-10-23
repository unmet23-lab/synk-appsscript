import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createCompanyApp } from './server.mjs';
import { hash } from './store.mjs';

// 2026-10-23 로그인 되찾기: 관리자가 만든 1회 재설정 링크, 지금 세션을 남기는 비밀번호 변경, 운영 명령 링크.
const password='recovery-fixture-password',fresh='recovery-new-password';
const run=promisify(execFile),admin=fileURLToPath(new URL('./admin.mjs',import.meta.url));

async function fixture(t,options={}){
  const dir=await mkdtemp(join(tmpdir(),'synk-password-recovery-'));
  const app=createCompanyApp({dataDir:dir,port:0,allowTestHost:true,schedule:false,trustedProxyIps:'127.0.0.1',...options});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep));await rm(dir,{recursive:true,force:true});});
  const people={
    admin:app.store.createUser({name:'관리자',email:'admin@example.test',password,role:'admin'}),
    other:app.store.createUser({name:'다른 관리자',email:'other-admin@example.test',password,role:'admin'}),
    member:app.store.createUser({name:'크루',email:'member@example.test',password,role:'member'}),
    viewer:app.store.createUser({name:'보기 크루',email:'viewer@example.test',password,role:'viewer'}),
  };
  function client(){
    const c={cookie:'',csrf:'',async request(path,{body,origin=app.origin,csrf=c.csrf,ip='198.51.100.20'}={}){
      const headers={Cookie:c.cookie,'X-Forwarded-For':ip};
      if(body!==undefined){Object.assign(headers,{Origin:origin,'Content-Type':'application/json'});if(csrf)headers['X-CSRF-Token']=csrf;}
      const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers,...(body===undefined?{}:{body:JSON.stringify(body)})});
      const set=response.headers.getSetCookie().find(value=>value.startsWith('synk_company_session='));if(set)c.cookie=set.split(';')[0];
      const data=await response.json().catch(()=>null);if(data?.csrfToken)c.csrf=data.csrfToken;
      return {status:response.status,data,setCookie:Boolean(set)};
    },async login(person,secret=password){return c.request('/api/login',{body:{email:person.email,password:secret}});}};
    return c;
  }
  const resetToken=url=>new URL(url).hash.replace(/^#reset=/,'');
  const sessions=userId=>app.store.db.prepare("SELECT COUNT(*) AS count FROM tokens WHERE userId=? AND purpose='session'").get(userId).count;
  const links=userId=>app.store.db.prepare("SELECT COUNT(*) AS count FROM tokens WHERE userId=? AND purpose='password-reset'").get(userId).count;
  return {app,base,dir,people,client,resetToken,sessions,links};
}

test('an administrator makes a 60-minute reset link for a crew without ending anyone\'s session',async t=>{
  const f=await fixture(t),a=f.client(),m=f.client();
  assert.equal((await a.login(f.people.admin)).status,200);assert.equal((await m.login(f.people.member)).status,200);
  const before=Date.now(),made=await a.request(`/api/members/${f.people.member.id}/password-reset`,{body:{}});
  assert.equal(made.status,201);assert.equal(made.data.delivery,'copy-link');assert.equal(made.data.loginId,'member@example.test');assert.equal(made.data.name,'크루');
  assert.equal(new URL(made.data.resetUrl).origin,f.app.origin);assert.match(made.data.resetUrl,/\/#reset=[A-Za-z0-9_-]{43}$/);
  const minutes=(Date.parse(made.data.expiresAt)-before)/60000;assert.ok(minutes>59&&minutes<=61,String(minutes));
  // The token itself is never stored, only its hash, and the link does not sign anyone out.
  const token=f.resetToken(made.data.resetUrl);assert.equal(f.app.store.db.prepare('SELECT COUNT(*) AS count FROM tokens WHERE hash=?').get(token).count,0);assert.equal(f.app.store.db.prepare('SELECT COUNT(*) AS count FROM tokens WHERE hash=?').get(hash(token)).count,1);
  assert.equal((await m.request('/api/me')).data.user.id,f.people.member.id);assert.equal((await a.request('/api/me')).data.user.id,f.people.admin.id);
  const audits=f.app.store.all('audit').filter(row=>row.action==='password-reset-link');assert.equal(audits.length,1);assert.equal(audits[0].subject,f.people.member.id);assert.doesNotMatch(JSON.stringify(audits),new RegExp(token));
});

test('a link replaced by another issuer right after it is written still answers with its expiry and audit',async t=>{
  // GPT 검수 GA1: the operator command may replace the link between the write and a later read; nothing is read after the write.
  const f=await fixture(t),a=f.client();await a.login(f.people.admin);
  const transaction=f.app.store.transaction.bind(f.app.store);
  t.mock.method(f.app.store,'transaction',fn=>{const result=transaction(fn);if(result&&typeof result==='object'&&'expiresAt' in result)f.app.store.revokeTokens(f.people.member.id,'password-reset');return result;});
  const made=await a.request(`/api/members/${f.people.member.id}/password-reset`,{body:{}});
  assert.equal(made.status,201);assert.ok(Date.parse(made.data.expiresAt)>Date.now());assert.match(made.data.resetUrl,/#reset=/);
  assert.ok(f.app.store.all('audit').some(row=>row.action==='password-reset-link'&&row.subject===f.people.member.id));
  assert.equal(f.links(f.people.member.id),0);
});

test('only an administrator, with CSRF, can make a link, and never for an administrator or a stopped crew',async t=>{
  const f=await fixture(t),a=f.client(),m=f.client();await a.login(f.people.admin);await m.login(f.people.member);
  assert.equal((await m.request(`/api/members/${f.people.viewer.id}/password-reset`,{body:{}})).status,403);
  assert.equal((await a.request(`/api/members/${f.people.member.id}/password-reset`,{body:{},csrf:'wrong'})).status,403);
  assert.equal((await a.request(`/api/members/${f.people.member.id}/password-reset`,{body:{},origin:'https://elsewhere.example.test'})).status,403);
  assert.equal((await a.request(`/api/members/${f.people.admin.id}/password-reset`,{body:{}})).status,403);
  assert.equal((await a.request(`/api/members/${f.people.other.id}/password-reset`,{body:{}})).status,403);
  assert.equal((await a.request('/api/members/missing/password-reset',{body:{}})).status,404);
  assert.equal((await a.request(`/api/members/${f.people.viewer.id}/status`,{body:{active:false}})).status,200);
  assert.equal((await a.request(`/api/members/${f.people.viewer.id}/password-reset`,{body:{}})).status,409);
  assert.equal(f.links(f.people.member.id)+f.links(f.people.viewer.id)+f.links(f.people.admin.id)+f.links(f.people.other.id),0);
});

test('opening a link shows only whose account it is, as often as needed, and a newer link replaces it',async t=>{
  const f=await fixture(t),a=f.client(),visitor=f.client();await a.login(f.people.admin);
  const first=f.resetToken((await a.request(`/api/members/${f.people.member.id}/password-reset`,{body:{}})).data.resetUrl);
  for(let i=0;i<2;i++){const seen=await visitor.request('/api/password-reset/inspect',{body:{token:first}});assert.equal(seen.status,200);assert.deepEqual(Object.keys(seen.data).sort(),['expiresAt','loginId','name']);assert.equal(seen.data.loginId,'member@example.test');}
  assert.equal((await visitor.request('/api/password-reset/inspect',{body:{token:first},origin:'https://elsewhere.example.test'})).status,403);
  const second=f.resetToken((await a.request(`/api/members/${f.people.member.id}/password-reset`,{body:{}})).data.resetUrl);
  const old=await visitor.request('/api/password-reset/inspect',{body:{token:first}});assert.equal(old.status,403);assert.match(old.data.error,/만료됐거나 이미 썼어요/);
  assert.equal((await visitor.request('/api/password-reset/inspect',{body:{token:second}})).status,200);assert.equal(f.links(f.people.member.id),1);
  for(const token of ['', 'x'.repeat(201), 42, null, 'not-a-link'])assert.equal((await visitor.request('/api/password-reset/inspect',{body:{token}})).status,403);
});

test('the new password is the one use: every session and link of that crew ends and no session is issued',async t=>{
  const f=await fixture(t),a=f.client(),old=f.client(),visitor=f.client();await a.login(f.people.admin);await old.login(f.people.member);
  const token=f.resetToken((await a.request(`/api/members/${f.people.member.id}/password-reset`,{body:{}})).data.resetUrl);
  // A bad link is refused before hashing; a valid link with a short password is refused and stays usable.
  assert.equal((await visitor.request('/api/password-reset',{body:{token:'unknown-link',password:'short'}})).status,403);
  const short=await visitor.request('/api/password-reset',{body:{token,password:'short'}});assert.equal(short.status,400);assert.match(short.data.error,/9~256/);
  const done=await visitor.request('/api/password-reset',{body:{token,password:fresh}});
  assert.equal(done.status,200);assert.deepEqual(done.data,{ok:true,loginId:'member@example.test'});assert.equal(done.setCookie,false);
  assert.equal(f.sessions(f.people.member.id),0);assert.equal(f.links(f.people.member.id),0);
  assert.equal((await old.request('/api/me')).data.user,null);assert.equal((await old.request('/api/workspace-summary')).status,401);
  assert.equal((await visitor.request('/api/password-reset',{body:{token,password:fresh+'-again'}})).status,403);
  assert.equal((await f.client().login(f.people.member)).status,401);
  const signed=f.client();assert.equal((await signed.login(f.people.member,fresh)).status,200);assert.equal((await signed.request('/api/me')).data.passwordSet,true);
  assert.equal((await a.request('/api/me')).data.user.id,f.people.admin.id);
  const audit=f.app.store.all('audit').find(row=>row.action==='password-reset');assert.equal(audit.userId,f.people.member.id);assert.equal(audit.issuedBy,f.people.admin.id);assert.equal(audit.via,'admin-link');
});

test('two submissions of the same link change the password once',async t=>{
  const f=await fixture(t),a=f.client();await a.login(f.people.admin);
  const token=f.resetToken((await a.request(`/api/members/${f.people.member.id}/password-reset`,{body:{}})).data.resetUrl);
  const results=await Promise.all(['first-new-password','second-new-password'].map(value=>f.client().request('/api/password-reset',{body:{token,password:value}})));
  assert.deepEqual(results.map(row=>row.status).sort(),[200,403]);
  const winner=results[0].status===200?'first-new-password':'second-new-password',loser=winner==='first-new-password'?'second-new-password':'first-new-password';
  assert.equal((await f.client().login(f.people.member,winner)).status,200);assert.equal((await f.client().login(f.people.member,loser)).status,401);
});

test('a role change or a stopped crew ends an unused link',async t=>{
  const f=await fixture(t),a=f.client(),visitor=f.client();await a.login(f.people.admin);
  const roleLink=f.resetToken((await a.request(`/api/members/${f.people.member.id}/password-reset`,{body:{}})).data.resetUrl);
  assert.equal((await a.request(`/api/members/${f.people.member.id}/assignment`,{body:{role:'viewer',teamId:null}})).status,200);
  assert.equal((await visitor.request('/api/password-reset',{body:{token:roleLink,password:fresh}})).status,403);
  const stopLink=f.resetToken((await a.request(`/api/members/${f.people.viewer.id}/password-reset`,{body:{}})).data.resetUrl);
  assert.equal((await a.request(`/api/members/${f.people.viewer.id}/status`,{body:{active:false}})).status,200);
  assert.equal((await visitor.request('/api/password-reset/inspect',{body:{token:stopLink}})).status,403);
  assert.equal((await f.client().login(f.people.member)).status,200);
});

test('unknown links are limited per address like failed logins, and good links do not use the budget',async t=>{
  const f=await fixture(t),a=f.client();await a.login(f.people.admin);
  const token=f.resetToken((await a.request(`/api/members/${f.people.member.id}/password-reset`,{body:{}})).data.resetUrl);
  for(let i=0;i<5;i++)assert.equal((await f.client().request('/api/password-reset/inspect',{body:{token},ip:'203.0.113.7'})).status,200);
  for(let i=0;i<30;i++)assert.equal((await f.client().request('/api/password-reset/inspect',{body:{token:'guess-'+i},ip:'203.0.113.7'})).status,403);
  assert.equal((await f.client().request('/api/password-reset/inspect',{body:{token},ip:'203.0.113.7'})).status,429);
  assert.equal((await f.client().request('/api/password-reset',{body:{token,password:fresh},ip:'203.0.113.7'})).status,429);
  assert.equal((await f.client().request('/api/password-reset/inspect',{body:{token},ip:'203.0.113.8'})).status,200);
});

test('changing one\'s own password keeps this session and its CSRF, and ends the other sessions and links',async t=>{
  const f=await fixture(t),here=f.client(),there=f.client(),a=f.client();await here.login(f.people.member);await there.login(f.people.member);await a.login(f.people.admin);
  await a.request(`/api/members/${f.people.member.id}/password-reset`,{body:{}});assert.equal(f.links(f.people.member.id),1);
  const cookie=here.cookie,csrf=here.csrf;
  assert.equal((await here.request('/api/account/password',{body:{oldPassword:'wrong',password:fresh}})).status,403);
  const changed=await here.request('/api/account/password',{body:{oldPassword:password,password:fresh}});
  assert.equal(changed.status,200);assert.equal(changed.setCookie,false);assert.equal(changed.data.csrfToken,csrf);assert.equal(changed.data.user.passwordHash,undefined);
  assert.equal(here.cookie,cookie);assert.equal((await here.request('/api/me')).data.user.id,f.people.member.id);
  assert.equal((await here.request('/api/workspace-summary')).status,200);assert.equal((await there.request('/api/me')).data.user,null);
  assert.equal(f.sessions(f.people.member.id),1);assert.equal(f.links(f.people.member.id),0);
  assert.equal((await f.client().login(f.people.member,fresh)).status,200);
  assert.ok(f.app.store.all('audit').some(row=>row.action==='password-changed'&&row.userId===f.people.member.id&&row.firstPassword===false));
});

test('an account without a password sets its first one without a current password and /api/me says so',async t=>{
  const f=await fixture(t),c=f.client();await c.login(f.people.member);
  f.app.store.put('users',f.people.member.id,{...f.app.store.get('users',f.people.member.id),passwordHash:null});
  assert.equal((await c.request('/api/me')).data.passwordSet,false);
  assert.equal((await c.request('/api/account/password',{body:{password:fresh}})).status,200);
  assert.equal((await c.request('/api/me')).data.passwordSet,true);
  assert.equal((await c.request('/api/account/password',{body:{password:'third-new-password'}})).status,403);
  assert.equal((await f.client().request('/api/me')).data.passwordSet,false);
});

test('the operator command writes a 30-minute link into the running server, administrator included',async t=>{
  const f=await fixture(t),env={...process.env,SYNK_COMPANY_DATA:f.dir,SYNK_COMPANY_ORIGIN:f.app.origin};
  const usage=await run(process.execPath,[admin,'reset-link'],{env}).then(()=>null,error=>error);assert.ok(usage);assert.match(usage.stderr,/사용법/);
  const missing=await run(process.execPath,[admin,'reset-link','nobody@example.test'],{env}).then(()=>null,error=>error);assert.match(missing.stderr,/계정이 없습니다/);
  const a=f.client();await a.login(f.people.admin);
  const earlier=f.resetToken((await a.request(`/api/members/${f.people.member.id}/password-reset`,{body:{}})).data.resetUrl);
  const before=Date.now(),{stdout}=await run(process.execPath,[admin,'reset-link',' ADMIN@example.test '],{env});
  const url=stdout.trim().split(/\r?\n/).at(-1),token=f.resetToken(url);assert.equal(new URL(url).origin,f.app.origin);assert.match(stdout,/관리자\(admin@example\.test\)/);
  const seen=await f.client().request('/api/password-reset/inspect',{body:{token}});assert.equal(seen.status,200);assert.equal(seen.data.loginId,'admin@example.test');
  const minutes=(Date.parse(seen.data.expiresAt)-before)/60000;assert.ok(minutes>29&&minutes<=31,String(minutes));
  assert.equal((await f.client().request('/api/password-reset/inspect',{body:{token:earlier}})).status,200);
  assert.equal((await f.client().request('/api/password-reset',{body:{token,password:fresh}})).status,200);
  assert.equal((await a.request('/api/me')).data.user,null);assert.equal((await f.client().login(f.people.admin,fresh)).status,200);
  const audit=f.app.store.all('audit').filter(row=>row.subject===f.people.admin.id||row.userId===f.people.admin.id);
  assert.ok(audit.some(row=>row.action==='password-reset-link'&&row.by==='operator'&&row.userId===null));assert.ok(audit.some(row=>row.action==='password-reset'&&row.via==='operator'));
  f.app.store.put('users',f.people.viewer.id,{...f.app.store.get('users',f.people.viewer.id),active:false});
  const stopped=await run(process.execPath,[admin,'reset-link','viewer@example.test'],{env}).then(()=>null,error=>error);assert.match(stopped.stderr,/이용을 멈춘 계정/);
});

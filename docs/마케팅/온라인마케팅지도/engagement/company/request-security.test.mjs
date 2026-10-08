import test from 'node:test';
import assert from 'node:assert/strict';
import { createClientAddress, createAttemptLimiter, reserveAttempts, createConcurrencyGuard } from './request-security.mjs';
import { passwordHash, passwordHashAsync, passwordMatches } from './store.mjs';

const req=(peer,forwarded,rawHeaders)=>({socket:{remoteAddress:peer},headers:{'x-forwarded-for':forwarded},rawHeaders});
test('only an exact trusted proxy peer supplies the last valid client IP; spoofed or repeated headers fail closed',()=>{
  const client=createClientAddress('172.30.77.3');
  assert.equal(client(req('::ffff:172.30.77.3','198.51.100.9')),'198.51.100.9');
  assert.equal(client(req('172.30.77.3','203.0.113.99, 198.51.100.9')),'198.51.100.9');
  assert.equal(client(req('198.51.100.10','198.51.100.9')),'198.51.100.10');
  assert.equal(createClientAddress('')(req('172.30.77.3','198.51.100.9')),'172.30.77.3');
  assert.equal(client(req('172.30.77.3','2001:0db8:0:0::5')),'2001:db8::5');
  for(const value of ['', 'unknown','198.51.100.9, bad','bad, 198.51.100.9','198.51.100.9:1234','fe80::1%eth0',['198.51.100.9']])assert.equal(client(req('172.30.77.3',value)),'172.30.77.3');
  assert.equal(client(req('172.30.77.3','198.51.100.9',['X-Forwarded-For','198.51.100.9','x-forwarded-for','203.0.113.8'])),'172.30.77.3');
  for(const setting of ['1','*','172.30.77.0/29','172.30.77.3,','localhost'])assert.throws(()=>createClientAddress(setting),/SYNK_COMPANY_TRUSTED_PROXY_IPS/);
});

test('attempt windows bound memory, reserve before awaits, expire and roll back partial reservations',()=>{
  let now=0;const limits=createAttemptLimiter({limit:2,windowMs:100,maxEntries:2,now:()=>now});
  const first=limits.reserve('a');limits.reserve('a');assert.throws(()=>limits.reserve('a'),{status:429});
  limits.reserve('b');assert.equal(limits.size,2);assert.throws(()=>limits.reserve('c'),{status:429});
  first();first();const released=limits.reserve('a');assert.throws(()=>limits.reserve('a'),{status:429});released();
  const another=createAttemptLimiter({limit:1,windowMs:100,maxEntries:1,now:()=>now});another.reserve('full');
  assert.throws(()=>reserveAttempts([[limits,'a'],[another,'full']]),{status:429});
  assert.doesNotThrow(()=>limits.reserve('a'));
  now=100;assert.equal(limits.size,0);assert.doesNotThrow(()=>limits.reserve('c'));
});

test('concurrency guard rejects work without queuing and releases its slot after success or failure',async()=>{
  const guard=createConcurrencyGuard(2);let release,calls=0;const held=new Promise(resolve=>{release=resolve;});
  const first=guard(async()=>{calls++;await held;return 1;}),second=guard(async()=>{calls++;await held;throw Error('fixture');});
  const failed=assert.rejects(second,/fixture/);
  await assert.rejects(guard(()=>{calls++;}),{status:429,code:'SYNK_AUTH_BUSY'});assert.equal(calls,2);
  release();assert.equal(await first,1);await failed;assert.equal(await guard(()=>3),3);
});

test('real scrypt verification yields to the event loop and caps simultaneous crypto work',async()=>{
  const password='synthetic-valid-password',stored=passwordHash(password),order=[];
  const tick=new Promise(resolve=>setImmediate(()=>{order.push('tick');resolve();}));
  const pending=passwordMatches(password,stored).then(value=>{order.push('hash');return value;});
  await tick;assert.equal(order[0],'tick');assert.equal(await pending,true);
  const attempts=await Promise.allSettled(Array.from({length:10},()=>passwordMatches(password,stored)));
  assert.equal(attempts.filter(row=>row.status==='fulfilled'&&row.value===true).length,4);
  assert.equal(attempts.filter(row=>row.status==='rejected'&&row.reason.status===429).length,6);
  assert.equal(await passwordMatches(password,'malformed:hash'),false);
  assert.equal(await passwordMatches('wrong',stored),false);
  assert.equal(await passwordMatches(password,await passwordHashAsync(password)),true);
  await assert.rejects(passwordHashAsync('short'),{status:400});
});

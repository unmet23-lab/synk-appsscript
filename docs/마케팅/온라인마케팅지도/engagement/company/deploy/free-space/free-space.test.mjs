// 옛 판(secure_delete 끔)이 남긴 문의 잔여가 새 판 지우기 뒤에도 남고, vacuum.mjs가 그것을 0으로 만드는지(README).
// vacuum.mjs의 멈춤 길(STOP·예산 넘김·앞 WAL 막힘)이 DB를 그대로 두는지, free-space-node.py가 실제 파일의 옛 페이지까지 세는지.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const here=fileURLToPath(new URL('.',import.meta.url));
const VACUUM=join(here,'vacuum.mjs'),NODE_SCAN=join(here,'free-space-node.py');
const {clean,layout}=createRequire(import.meta.url)(join(here,'scan.cjs'));
const base=mkdtempSync(join(tmpdir(),'synk-free-space-'));
test.after(()=>rmSync(base,{recursive:true,force:true}));

function open(dir){
  const db=new DatabaseSync(join(dir,'company.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS documents (kind TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(kind,id));
    CREATE TABLE IF NOT EXISTS credentials (id TEXT PRIMARY KEY, ciphertext TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tokens (hash TEXT PRIMARY KEY, purpose TEXT NOT NULL, userId TEXT, body TEXT NOT NULL, expiresAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions_wr (token TEXT NOT NULL, userId TEXT NOT NULL, PRIMARY KEY(token)) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS token_expiry ON tokens(expiresAt);`);
  for(const f of ['postId','status','channelId'])db.exec(`CREATE INDEX IF NOT EXISTS documents_socialPublishJobs_${f} ON documents(json_extract(body,'$.${f}')) WHERE kind='socialPublishJobs'`);
  return db;
}
const put=(db,kind,id,body)=>db.prepare('INSERT INTO documents(kind,id,body) VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body').run(kind,id,JSON.stringify(body));
const hits=(dir,marker)=>{const m=Buffer.from(marker);let n=0;for(const f of ['company.sqlite','company.sqlite-wal']){const p=join(dir,f);if(!existsSync(p))continue;const b=readFileSync(p);for(let i=b.indexOf(m);i>=0;i=b.indexOf(m,i+1))n++;}return n;};
const inquiry=(id,payload,replyDraft)=>({id,payload,fingerprint:'f'.repeat(64),classification:{category:'lab',isTest:false},replyDraft,draftEdited:true,status:'new',revision:1});
const MARK={long:'긴옛초안LONGOLD',growPayload:'GROWPAY',live:'산줄초안LIVEDRAFT'};
const pragma=(dir,name)=>{const db=new DatabaseSync(join(dir,'company.sqlite'));try{return Object.values(db.prepare('PRAGMA '+name).get())[0];}finally{db.close();}};

// 옛 판 두 경로: (1) 짧은 초안 → 더 긴 초안 — 옛 칸이 페이지 안 빈 칸으로 가고, 새 칸은 그 칸 끝부터 덮어 옛 칸의 앞머리
// (암호문 자리)가 남는다. (2) 긴 초안 → 짧은 초안 — 넘침 페이지가 빈 목록으로 간다(긴 초안 글이 그대로).
// 그 뒤 새 판 방식(secure_delete ON 지우기 + WAL TRUNCATE)으로 두 줄을 지운다. 산 줄 하나는 남긴다.
function oldVersionThenNewErase(dir){
  mkdirSync(dir,{recursive:true});
  const db=open(dir);
  db.prepare('INSERT INTO sessions_wr VALUES (?,?)').run('t-b','u2');db.prepare('INSERT INTO sessions_wr VALUES (?,?)').run('t-a','u1');
  const grow=inquiry('R2',MARK.growPayload+randomBytes(60).toString('base64'),'자라기 전 초안 연락처 확인');
  const long=inquiry('R1','LONGPAY'+randomBytes(1500).toString('base64'),Array.from({length:400},(_,i)=>MARK.long+' 문장 '+i).join(' '));
  put(db,'websiteInquiries','R2',grow);
  put(db,'tasks','t1',{id:'t1',note:'짧은 줄'});put(db,'tasks','t2',{id:'t2',note:'짧은 줄'});
  put(db,'websiteInquiries','L1',inquiry('L1','LIVEPAY'+randomBytes(60).toString('base64'),MARK.live));
  put(db,'websiteInquiries','R2',{...grow,replyDraft:'다시 쓴 초안 '.repeat(30),revision:2});
  put(db,'websiteInquiries','R1',long);
  put(db,'websiteInquiries','R1',{...long,replyDraft:'짧은 새 초안',revision:2});
  db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
  db.exec('PRAGMA secure_delete=ON');
  db.exec('BEGIN IMMEDIATE');
  for(const id of ['R1','R2']){db.prepare("DELETE FROM documents WHERE kind='websiteInquiries' AND id=?").run(id);put(db,'websiteInquiryErasures',id,{id,erasedAt:'2026-10-22T00:00:00.000Z'});}
  db.exec('COMMIT');
  db.exec('PRAGMA secure_delete=OFF');
  db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
  return db;
}
function runVacuum(dir,{input='GO\n',env={}}={}){
  const p=spawnSync(process.execPath,[VACUUM],{encoding:'utf8',timeout:60000,input,env:{...process.env,SYNK_FREE_SPACE_DIR:dir,...env}});
  const lines=p.stdout.trim().split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
  return {status:p.status,ready:lines[0],result:lines.at(-1),stderr:p.stderr};
}
const python=(()=>{for(const cmd of ['python3','python']){const p=spawnSync(cmd,['-c','import sys;print(sys.version_info>=(3,11))'],{encoding:'utf8'});if(p.status===0&&p.stdout.trim()==='True')return cmd;}return null;})();
const nodeScan=file=>{const p=spawnSync(python,['-B',NODE_SCAN,'--db',file],{encoding:'utf8',timeout:60000});assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);};
// free-space-node.py가 vacuum.mjs 결과에 종료 코드를 exit로 덧붙여 scan.cjs에 넘긴다 — 시험도 같은 꼴로 판정한다.
const vacuumed=run=>({...run.result,exit:run.status});
const residue=(scan,parts=['freelist','inPage','logical','dbFile','walFile'])=>parts.reduce((n,k)=>n+scan.residue[k].payloadResidue+scan.residue[k].draftResidue,0);

test('옛 판 잔여는 새 판 지우기 뒤에도 남고, vacuum.mjs(GO) 뒤에는 DB·WAL 어디에도 없다', ()=>{
  const dir=join(base,'old');const db=oldVersionThenNewErase(dir);
  const rows=db.prepare('SELECT rowid,kind,id,body FROM documents ORDER BY rowid').all();db.close();
  assert.ok(hits(dir,MARK.long)>0,'긴 옛 초안이 빈 페이지에 남아 있다(GA2)');
  assert.ok(hits(dir,MARK.growPayload)>0,'지운 줄의 옛 칸 앞머리(암호문 자리)가 페이지 안 빈 칸에 남아 있다');
  const run=runVacuum(dir);
  assert.equal(run.status,0,run.stderr);
  assert.equal(run.ready.ready,true);
  assert.equal(run.ready.childMark,false,'표식 없이 띄우면 자식도 표식이 없다(부르는 쪽은 이때 STOP한다)');
  assert.equal(run.result.quickCheck,'ok');
  assert.equal(run.result.logical,'same','다른 연결이 쓰지 않았으니 논리 내용 지문이 같다(WITHOUT ROWID 표 포함)');
  assert.equal(run.result.after.freePages,0);
  assert.equal(run.result.walTruncated,true);
  for(const marker of [MARK.long,MARK.growPayload,'LONGPAY'])assert.equal(hits(dir,marker),0,marker+' 바이트가 0이어야 한다');
  assert.equal(hits(dir,MARK.live),1,'산 줄은 그대로');
  const after=open(dir);
  assert.deepEqual(after.prepare('SELECT rowid,kind,id,body FROM documents ORDER BY rowid').all(),rows,'rowid 순서·본문 그대로');
  after.close();
});

test('빈 페이지 덮기(채웠다 secure_delete로 지우기)는 페이지 안 빈 칸 잔여를 지우지 못한다 — 그래서 VACUUM', ()=>{
  const dir=join(base,'fill');const db=oldVersionThenNewErase(dir);
  const page=db.prepare('PRAGMA page_size').get().page_size;
  db.exec('PRAGMA secure_delete=ON');
  for(let i=0;db.prepare('PRAGMA freelist_count').get().freelist_count>0;i++)put(db,'__freePageWipe','w'+i,{z:'0'.repeat(page*4)});
  db.prepare("DELETE FROM documents WHERE kind='__freePageWipe'").run();
  db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();db.close();
  assert.equal(hits(dir,MARK.long),0,'빈 목록의 넘침 잔여는 덮인다');
  assert.ok(hits(dir,MARK.growPayload)>0,'페이지 안 빈 칸 잔여는 남는다');
});

test('STOP·예산 넘김·앞 WAL 막힘이면 vacuum.mjs는 DB를 그대로 둔다', ()=>{
  const stop=join(base,'stop');oldVersionThenNewErase(stop).close();
  const free=pragma(stop,'freelist_count');
  const stopped=runVacuum(stop,{input:'STOP\n'});
  assert.equal(stopped.status,5);assert.equal(stopped.result.error,'STOPPED');
  assert.equal(pragma(stop,'freelist_count'),free);assert.ok(hits(stop,MARK.growPayload)>0);
  const silent=runVacuum(stop,{input:''});
  assert.equal(silent.status,5,'GO가 없으면 멈춘다');
  const capped=runVacuum(stop,{env:{SYNK_FREE_SPACE_MAX_BYTES:'4096'}});
  assert.equal(capped.status,6);assert.equal(capped.result.error,'TOO_LARGE_FOR_ONLINE_VACUUM','앞 WAL을 비운 뒤 논리 크기가 상한을 넘으면 시작하지 않는다');
  assert.equal(pragma(stop,'freelist_count'),free);

  // 예산 넘김: 자식 프로세스를 SIGKILL로 끝내 커밋 전에 버린다(워커 스레드는 process.exit이 VACUUM 끝까지 기다렸다).
  // VACUUM이 예산(1ms)보다 확실히 오래 걸리게 몇 MB짜리 DB로 본다.
  const big=join(base,'over');const bigDb=oldVersionThenNewErase(big);
  bigDb.exec('BEGIN');for(let i=0;i<4000;i++)put(bigDb,'runs','r'+i,{id:'r'+i,x:randomBytes(1500).toString('base64')});bigDb.exec('COMMIT');
  bigDb.exec('BEGIN');for(let i=0;i<2000;i++)bigDb.prepare("DELETE FROM documents WHERE kind='runs' AND id=?").run('r'+i);bigDb.exec('COMMIT');
  bigDb.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();bigDb.close();
  const bigFree=pragma(big,'freelist_count'),bigPages=pragma(big,'page_count');
  assert.ok(bigFree>500,'정리할 빈 페이지가 많다');
  const over=runVacuum(big,{env:{SYNK_FREE_SPACE_LOCK_WAIT_MS:'0',SYNK_FREE_SPACE_BUDGET_MS:'1'}});
  assert.equal(over.status,3,JSON.stringify(over.result));assert.equal(over.result.error,'VACUUM_OVER_BUDGET');
  assert.equal(over.result.quickCheck,'ok');
  assert.equal(pragma(big,'quick_check'),'ok');
  assert.equal(pragma(big,'freelist_count'),bigFree,'끊긴 VACUUM은 커밋되지 않았다');
  assert.equal(pragma(big,'page_count'),bigPages);
  const redo=runVacuum(big);
  assert.equal(redo.status,0,'끊긴 뒤 다시 하면 끝난다');assert.equal(pragma(big,'freelist_count'),0);

  // 앞 WAL을 못 비우면(옛 스냅숏을 쥔 읽는 연결) 시작하지 않는다.
  const writer=new DatabaseSync(join(stop,'company.sqlite'));put(writer,'audit','a1',{n:1});
  const reader=new DatabaseSync(join(stop,'company.sqlite'));reader.exec('BEGIN');reader.prepare('SELECT count(*) FROM documents').get();
  put(writer,'audit','a2',{n:2});
  const busy=runVacuum(stop);
  reader.exec('COMMIT');reader.close();writer.close();
  assert.equal(busy.status,2);assert.equal(busy.result.error,'WAL_BUSY_BEFORE');
  assert.equal(pragma(stop,'freelist_count'),free);
});

test('free-space-node.py가 정리 전 잔여를 세고 정리 뒤 0으로 센다 — 빈 칸의 산 줄 사본도', {skip:!python&&'python 3.11+ 없음'}, ()=>{
  const dir=join(base,'scan');oldVersionThenNewErase(dir).close();
  const before=nodeScan(join(dir,'company.sqlite'));
  // 넘침 페이지에는 표식이 없어(초안 글의 이어지는 부분) 잔여 수로는 못 센다 — 빈 페이지 수와 0 아닌 바이트로 본다(README).
  assert.ok(before.pragma.freelist_count>0&&before.residue.freelist.nonzeroBytes>0,'빈 페이지에 0 아닌 바이트');
  assert.ok(before.residue.inPage.payloadResidue>=1,'페이지 안 빈 칸의 옛 칸 앞머리(암호문)');
  assert.ok(before.residue.dbFile.payloadResidue>=1,'실제 DB 파일에서도 보인다');
  assert.equal(before.residue.logical.payloadLive,1,'산 줄은 산 것으로 센다');
  const run=runVacuum(dir);
  const after=nodeScan(join(dir,'company.sqlite'));
  assert.equal(after.pragma.freelist_count,0);
  assert.equal(residue(after),0);
  assert.equal(after.residue.freelist.payloadLive+after.residue.inPage.payloadLive+after.residue.inPage.draftLive,0,'빈 칸에 산 줄 사본도 없다');
  assert.equal(after.residue.logical.payloadLive,1);
  assert.equal(JSON.stringify(after).includes(MARK.live),false,'결과에 글이 나오지 않는다');
  // 작은 합성 DB에서는 VACUUM 뒤 빈 칸의 0 아닌 바이트·조각이 0이다(운영 꼴 DB는 아래 시험 — VACUUM 자체가 남긴다).
  assert.ok(before.residue.inPage.nonzeroBytes>0);
  assert.equal(after.residue.freelist.nonzeroBytes+after.residue.inPage.nonzeroBytes,0,'VACUUM 뒤 빈 칸의 옛 바이트 0');
  assert.equal(after.residue.fragmentBytes,0,'VACUUM 뒤 셀 사이 조각도 0');
  assert.equal(clean(null,before),false,'다시 썼다는 VACUUM 결과 없이는 깨끗하지 않다');
  assert.equal(clean(vacuumed(run),after),true);
});

test('운영 꼴 DB(PRIMARY KEY 자동 색인·부분 색인·tokens)에서는 VACUUM 자체가 빈 틈에 산 키 바이트를 남긴다 — 끝 판정은 그것을 잔여로 보지 않는다', {skip:!python&&'python 3.11+ 없음'}, ()=>{
  const dir=join(base,'shaped');mkdirSync(dir);const db=open(dir);
  // 운영처럼 키(kind,id)가 rowid 순서와 상관없이 들어간다 — 같은 결과가 나게 고정 난수(sha256)로. 46종·6,000줄·tokens 2,000줄.
  const key=i=>createHash('sha256').update('k'+i).digest('hex').slice(0,32);
  db.exec('BEGIN');
  for(let i=0;i<6000;i++)put(db,'kind'+(i*7919%46).toString(36),key(i),{n:i,x:'v'.repeat(80+(i*31)%900)});
  for(let i=0;i<2000;i++)db.prepare('INSERT INTO tokens VALUES (?,?,?,?,?)').run(key('t'+i),'p','u','{}',new Date(1792000000000+i*997).toISOString());
  put(db,'websiteInquiries','L9',inquiry('L9','LIVE9PAY'+'A'.repeat(80),'산 줄 초안 그대로입니다'));
  put(db,'websiteInquiries','R9',inquiry('R9','GONE9PAY'+'B'.repeat(80),'지운 줄 초안입니다 연락처'));
  db.exec('COMMIT');
  // 옛 판처럼 secure_delete 끔으로 문의 하나를 지워 옛 잔여를 남긴다.
  db.exec('PRAGMA secure_delete=OFF');db.prepare("DELETE FROM documents WHERE kind='websiteInquiries' AND id='R9'").run();
  db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();db.close();
  const before=nodeScan(join(dir,'company.sqlite'));
  assert.ok(residue(before)>=1,'정리 전에는 지운 줄의 잔여가 있다');
  const run=runVacuum(dir);
  assert.equal(run.status,0,run.stderr+JSON.stringify(run.result));
  const after=nodeScan(join(dir,'company.sqlite'));
  assert.equal(after.files.wal,0,'뒤 재기 때 WAL 0 — 그사이 쓰기가 없으니 남은 바이트는 VACUUM이 쓴 것');
  assert.equal(residue(after),0,'지운 줄 잔여 0');
  assert.equal(after.residue.freelist.payloadLive+after.residue.inPage.payloadLive+after.residue.inPage.draftLive,0,'빈 칸에 산 줄 사본(표식) 0');
  assert.ok(after.residue.inPage.nonzeroBytes+after.residue.fragmentBytes>0,'VACUUM이 색인을 채우며 빈 틈에 산 키 바이트·조각을 남긴다(10-23 운영 2,419·12와 같은 꼴)');
  assert.ok(run.result.walAfterVacuum>=run.result.after.pages*after.pragma.page_size,'VACUUM이 모든 쪽을 WAL로 다시 썼다');
  assert.equal(clean(vacuumed(run),after),true,'다시 쓴 뒤 남은 표식 없는 바이트는 배치라 깨끗하다');
  assert.deepEqual(layout(after),{gapBytes:after.residue.inPage.nonzeroBytes,fragmentBytes:after.residue.fragmentBytes});
  assert.equal(clean(null,after),false,'같은 재기라도 다시 썼다는 결과가 없으면 깨끗하다고 하지 않는다');
});

test('scan.cjs 끝 판정 — VACUUM이 모든 쪽을 다시 썼을 때만 빈 틈의 표식 없는 바이트·조각을 배치로 보고, 표식 잔여·사본은 언제나 막는다', ()=>{
  const part=change=>({payloadResidue:0,draftResidue:0,payloadLive:0,draftLive:0,payloadShort:0,draftShort:0,nonzeroBytes:0,...change});
  // 10-23 운영 VACUUM의 꼴: 빈 틈 2,419바이트·조각 12, WAL 37,215,992 ≥ 9,033쪽 × 4,096.
  const scan=(inPage={},change={})=>({pragma:{freelist_count:0,page_size:4096},residue:{attempts:1,changedDuringScan:false,fragmentBytes:12,freelist:part(),
    inPage:part({nonzeroBytes:2419,...inPage}),walTorn:part(),logical:part({payloadLive:5,draftLive:78,nonzeroBytes:34848907}),dbFile:part({payloadLive:5,nonzeroBytes:34803252}),...change}});
  const v={exit:0,quickCheck:'ok',walTruncated:true,logical:'same',walAfterVacuum:37215992,after:{pages:9033}};
  assert.equal(clean(v,scan()),true,'운영 VACUUM 결과 — 남은 빈 틈 바이트·조각은 배치');
  assert.equal(clean({...v,logical:'app-wrote-meanwhile'},scan()),true,'그사이 앱이 썼어도 지문이 다르지 않으면');
  assert.equal(clean(v,scan({nonzeroBytes:6510000})),true,'모든 쪽을 다시 쓴 뒤라면 표식 없는 바이트는 양과 상관없이 산 줄에서 왔다(첫 GA2의 예를 이 증거로 가른다)');
  assert.equal(clean({...v,walAfterVacuum:9033*4096-1},scan()),false,'모든 쪽을 다시 썼다는 증거(WAL ≥ 쪽 수 × 쪽 크기)가 모자라면 너그럽지 않다');
  for(const missing of [{walAfterVacuum:undefined},{after:undefined},{after:{pages:0}}])assert.equal(clean({...v,...missing},scan()),false,'증거가 없으면 아니다');
  assert.equal(clean(null,scan()),false);
  for(const bad of [{exit:5},{quickCheck:'corrupt'},{walTruncated:false},{logical:'DIFFERENT'}])assert.equal(clean({...v,...bad},scan()),false,JSON.stringify(bad));
  assert.equal(clean(v,{...scan(),pragma:{freelist_count:0}}),false,'쪽 크기를 모르면 다시 썼다고 못 본다');
  assert.equal(clean(v,scan({draftLive:11})),false,'빈 칸의 산 줄 사본(표식)은 막는다');
  assert.equal(clean(v,scan({payloadResidue:1})),false,'표식 잔여');
  assert.equal(clean(v,scan({payloadShort:1})),false,'판정 못 한 조각');
  assert.equal(clean(v,scan({},{walTorn:part({draftLive:1})})),false,'덜 쓴 WAL 꼬리의 표식');
  assert.equal(clean(v,scan({},{walTorn:part({nonzeroBytes:256})})),false,'덜 쓴 WAL 꼬리의 0 아닌 바이트는 배치가 아니다 — VACUUM 뒤 쓰기에서 생기고 칸 경계도 모른다(GPT GA1)');
  assert.equal(clean(v,scan({},{walTorn:undefined})),false,'덜 쓴 꼬리를 세지 못한 재기');
  assert.equal(clean(v,{...scan(),pragma:{freelist_count:3,page_size:4096}}),false,'빈 페이지');
  assert.equal(clean(v,scan({},{freelist:part({nonzeroBytes:10})})),false,'빈 페이지 목록의 0 아닌 바이트');
  assert.equal(clean(v,scan({},{changedDuringScan:true})),false,'판정 못 한 재기');
  assert.deepEqual(layout(scan()),{gapBytes:2419,fragmentBytes:12});
});

test('운영처럼 -e로 표식을 붙여 띄우면 실제 VACUUM을 하는 자식도 그 표식을 받는다 — 부모가 먼저 죽어도 호스트가 찾게(다섯째 GA1)', ()=>{
  const dir=join(base,'mark');oldVersionThenNewErase(dir).close();
  const mark='synk-free-space-vacuum-'+'c'.repeat(32);
  const p=spawnSync(process.execPath,['--input-type=module','-e',readFileSync(VACUUM,'utf8'),mark],{encoding:'utf8',timeout:60000,input:'GO\n',env:{...process.env,SYNK_FREE_SPACE_DIR:dir}});
  const lines=p.stdout.trim().split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
  assert.equal(p.status,0,p.stderr);
  assert.equal(lines[0].childMark,true);
  assert.equal(lines.at(-1).quickCheck,'ok');
  const wrong=spawnSync(process.execPath,['--input-type=module','-e',readFileSync(VACUUM,'utf8'),'not-a-mark'],{encoding:'utf8',timeout:60000,input:'STOP\n',env:{...process.env,SYNK_FREE_SPACE_DIR:dir}});
  assert.equal(JSON.parse(wrong.stdout.trim().split('\n')[0]).childMark,false,'꼴이 다른 낱말은 표식으로 넘기지 않는다');
});

test('뒤 지문에서 자식이 멎으면 끝없이 기다리지 않고 끊은 뒤 WAL을 비우고 실패로 낸다 — VACUUM은 커밋된 채', ()=>{
  const dir=join(base,'stall');oldVersionThenNewErase(dir).close();
  const started=Date.now();
  const run=runVacuum(dir,{env:{SYNK_FREE_SPACE_STALL_MS:'30000',SYNK_FREE_SPACE_AFTER_MS:'300'}});
  assert.ok(Date.now()-started<20000,'멎은 자식을 끊는다 — 30초를 기다리지 않는다(GPT GA3)');
  assert.equal(run.status,6,JSON.stringify(run.result));
  assert.equal(run.result.error,'FINGERPRINT_FAILED');
  assert.equal(run.result.walTruncated,true);
  assert.equal(run.result.quickCheck,'ok');
  assert.equal(pragma(dir,'freelist_count'),0,'VACUUM은 끊기기 전에 커밋됐다');
  assert.equal(pragma(dir,'quick_check'),'ok');
});

test('free-space-node.py는 체크포인트 전 실제 DB 파일의 옛 페이지를 세고, 넘침으로 이어지는 산 긴 초안은 잔여로 세지 않는다', {skip:!python&&'python 3.11+ 없음'}, ()=>{
  const dir=join(base,'stale');mkdirSync(dir);const db=open(dir);
  put(db,'websiteInquiries','L2',inquiry('L2','LIVE2PAY'+randomBytes(900).toString('base64'),Array.from({length:300},(_,i)=>'산 긴 초안 '+i).join(' ')));
  put(db,'websiteInquiries','R3',inquiry('R3','STALEPAY'+randomBytes(60).toString('base64'),'곧 지울 줄의 초안입니다'));
  db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
  // 읽는 연결이 체크포인트를 막는 동안 지우면, 0으로 덮인 새 페이지는 WAL에만 있고 DB 파일에는 옛 페이지가 남는다.
  const reader=new DatabaseSync(join(dir,'company.sqlite'));reader.exec('BEGIN');reader.prepare('SELECT count(*) FROM documents').get();
  db.exec('PRAGMA secure_delete=ON');db.prepare("DELETE FROM documents WHERE kind='websiteInquiries' AND id='R3'").run();
  const scan=nodeScan(join(dir,'company.sqlite'));
  reader.exec('COMMIT');reader.close();db.close();
  assert.equal(scan.residue.logical.payloadResidue,0,'논리 스냅샷에는 지운 모습만 있다');
  assert.ok(scan.residue.dbFile.payloadResidue>=1,'실제 DB 파일에 남은 옛 페이지를 센다(A1·GA1)');
  assert.equal(scan.residue.logical.draftResidue+scan.residue.walFile.draftResidue,0,'넘침으로 이어지는 산 긴 초안은 잔여가 아니다(GA7)');
  assert.equal(scan.residue.dbFile.draftResidue,1,'DB 파일의 옛 페이지에는 지운 줄의 초안 하나만 잔여다');
  assert.ok(scan.residue.logical.draftLive>=1,'산 긴 초안은 산 것으로 센다');
});

test('앱이 계속 쓰는 동안에도 VACUUM이 끝나고 쓰기는 실패 없이 잠깐 기다린다', async()=>{
  const dir=join(base,'busy');mkdirSync(dir);const db=open(dir);
  db.exec('BEGIN');for(let i=0;i<3000;i++)put(db,i%2?'runs':'hypeObservations','r'+i,{id:'r'+i,x:randomBytes(300+(i*7919)%1200).toString('base64')});db.exec('COMMIT');
  db.exec('BEGIN');for(let i=0;i<3000;i+=3)put(db,'runs','r'+i,{id:'r'+i,x:'kept'});db.exec('COMMIT');db.close();
  const writerCode=`import {DatabaseSync} from 'node:sqlite';const db=new DatabaseSync(process.argv[1]);db.exec('PRAGMA busy_timeout=5000');
    const put=db.prepare('INSERT INTO documents(kind,id,body) VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET body=excluded.body');
    const end=Date.now()+Number(process.argv[2]),pause=new Int32Array(new SharedArrayBuffer(4));let n=0,fail=0,max=0;
    while(Date.now()<end){const t=performance.now();try{put.run('audit','w'+(n%50),'{"n":'+n+'}');}catch{fail++;}max=Math.max(max,performance.now()-t);n++;Atomics.wait(pause,0,0,15);}
    console.log(JSON.stringify({n,fail,maxMs:Math.round(max)}));db.close();`;
  const writer=spawn(process.execPath,['--input-type=module','-e',writerCode,join(dir,'company.sqlite'),'3000'],{stdio:['ignore','pipe','pipe']});
  let text='';writer.stdout.on('data',chunk=>text+=chunk);
  await new Promise(resolve=>setTimeout(resolve,400));
  const run=runVacuum(dir);
  await new Promise(resolve=>writer.on('close',resolve));
  const stats=JSON.parse(text.trim());
  assert.equal(run.status,0,run.stderr+JSON.stringify(run.result));
  assert.equal(run.result.quickCheck,'ok');
  assert.notEqual(run.result.logical,'DIFFERENT');
  assert.equal(run.result.after.freePages,0);
  assert.equal(stats.fail,0,'앱 쓰기 실패 없음');
  assert.ok(stats.n>20,'VACUUM 앞뒤로 계속 썼다');
  assert.ok(stats.maxMs<5000,'busy_timeout 안에서 기다렸다');
});

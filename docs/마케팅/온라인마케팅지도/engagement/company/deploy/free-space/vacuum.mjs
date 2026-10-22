// 회사 DB 한 번 정리(VACUUM) — 빈 페이지와 페이지 안 빈 칸에 남은 옛 바이트를 없앤다(README 「정리」).
// 회사 컨테이너 안에서 앱과 같은 SQLite(node:sqlite)로, 앱이 도는 채로 돈다. free-space-node.py가 이렇게 부른다:
//   docker exec -i -u node <회사 컨테이너> node --input-type=module -e "<이 파일>"   (DB 폴더는 SYNK_COMPANY_DATA)
// 순서: WAL 비우기(못 비우면 멈춤) → READY를 내고 표준 입력에서 GO를 기다림(STOP·끝이면 멈춤) → 자식 프로세스에서
// 지문 → VACUUM → 지문 → WAL TRUNCATE(못 비우면 실패) → quick_check.
// VACUUM이 예산(잠금 기다림 1초 + 일 3초)을 넘으면 자식을 SIGKILL로 끝낸다. 커밋 전이면 WAL 프레임은 커밋 표시가 없어
// 버려지고 잠금은 프로세스와 함께 풀린다(워커 스레드는 process.exit이 VACUUM 끝까지 기다려 쓰지 않는다).
// 앱 쓰기는 busy_timeout 5초 안에서 기다린다. 숫자와 DB 전체 지문 앞 16자만 낸다(고객 글·암호문은 내지 않는다).
// 종료 코드: 0 끝 · 1 quick_check·지문 이상 · 2 앞 WAL 못 비움 · 3 예산 넘김 · 4 뒤 WAL 못 비움 · 5 멈춤(STOP) · 6 그 밖
import {DatabaseSync} from 'node:sqlite';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {statSync} from 'node:fs';
import {join} from 'node:path';

const dir=process.env.SYNK_FREE_SPACE_DIR||process.env.SYNK_COMPANY_DATA;
const file=join(dir||'','company.sqlite');
// 예산은 시험만 줄인다(SYNK_FREE_SPACE_LOCK_WAIT_MS·SYNK_FREE_SPACE_BUDGET_MS). 운영에서 부르는 쪽은 넘기지 않는다.
const budget=(name,fallback)=>{const value=Number(process.env[name]);return Number.isInteger(value)&&value>=0&&value<=fallback?value:fallback;};
const LOCK_WAIT_MS=budget('SYNK_FREE_SPACE_LOCK_WAIT_MS',1000),WORK_MS=budget('SYNK_FREE_SPACE_BUDGET_MS',3000);
const size=p=>{try{return statSync(p).size;}catch{return null;}};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const emit=value=>process.stdout.write(JSON.stringify(value)+'\n');
// 한 줄씩 받는 통로: 먼저 온 줄은 쌓아 두고, 기다리는 쪽이 있으면 바로 넘긴다. 끝나면 null.
function lineQueue(input){
  const lines=[],waiters=[];let ended=false;
  const reader=createInterface({input});
  reader.on('line',line=>{const waiter=waiters.shift();waiter?waiter(line):lines.push(line);});
  reader.on('close',()=>{ended=true;for(const waiter of waiters.splice(0))waiter(null);});
  return {next:(ms=60000)=>lines.length?Promise.resolve(lines.shift()):ended?Promise.resolve(null):new Promise(resolve=>{
    const timer=setTimeout(()=>{waiters.splice(waiters.indexOf(done),1);resolve(null);},ms);
    function done(line){clearTimeout(timer);resolve(line);}
    waiters.push(done);
  }),close:()=>reader.close()};
}

// 자식: 자기 연결 하나로 지문 → (GO 기다림) → VACUUM → 지문. data_version은 다른 연결의 커밋만 세므로
// 같은 연결의 앞뒤 값이 같으면 그사이 앱이 쓰지 않은 것이다.
function child(){
  const {DatabaseSync}=require('node:sqlite');
  const {createHash}=require('node:crypto');
  const send=message=>process.stdout.write(JSON.stringify(message)+'\n');
  const db=new DatabaseSync(process.argv[1]);
  const one=sql=>db.prepare(sql).get();
  db.exec(`PRAGMA busy_timeout=${Number(process.argv[2])}; PRAGMA secure_delete=ON; PRAGMA temp_store=MEMORY;`);
  const tables=db.prepare("SELECT name,wr FROM pragma_table_list WHERE schema='main' AND type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const quote=name=>'"'+String(name).replaceAll('"','""')+'"';
  // 표마다 정해진 순서의 행: documents는 rowid 값까지(앱이 rowid 순서로 읽는다), WITHOUT ROWID 표는 기본 키 순서.
  function fingerprint(){
    const hash=createHash('sha256');
    for(const {name,wr} of tables){
      const keys=wr?db.prepare('SELECT name FROM pragma_table_info(?) WHERE pk>0 ORDER BY pk').all(name).map(row=>quote(row.name)).join(','):'';
      const sql=name==='documents'?'SELECT rowid AS r,kind,id,body FROM documents ORDER BY rowid':`SELECT * FROM ${quote(name)} ORDER BY ${wr?keys:'rowid'}`;
      hash.update(name+'\0');
      for(const row of db.prepare(sql).iterate())hash.update(JSON.stringify(row,(key,value)=>typeof value==='bigint'?String(value):value)+'\n');
    }
    return hash.digest('hex');
  }
  function snapshot(){db.exec('BEGIN');try{return {dataVersion:one('PRAGMA data_version').data_version,fingerprint:fingerprint()};}finally{db.exec('COMMIT');}}
  let before;
  try{before=snapshot();}catch(error){send({type:'error',code:error.code||'SNAPSHOT_FAILED'});db.close();return;}
  send({type:'ready'});
  let input='';
  process.stdin.on('data',chunk=>{
    input+=chunk;
    if(!input.includes('\n'))return;
    process.stdin.destroy();
    try{
      if(input.trim()!=='GO'){send({type:'stopped'});return;}
      const started=performance.now();
      db.exec('VACUUM');
      send({type:'vacuumed',vacuumMs:Math.round(performance.now()-started)});
      send({type:'done',before,after:snapshot()});
    }catch(error){send({type:'error',code:error.code||error.errcode||'VACUUM_FAILED'});}
    finally{db.close();}
  });
}

async function main(){
  // DatabaseSync는 없는 파일을 새로 만든다. 빈 DB를 만들지 않게 먼저 본다.
  if(!dir||!size(file))return [{error:'COMPANY_DB_MISSING'},6];
  const db=new DatabaseSync(file);
  const one=sql=>db.prepare(sql).get();
  const state=()=>({pages:one('PRAGMA page_count').page_count,freePages:one('PRAGMA freelist_count').freelist_count,dbBytes:size(file),walBytes:size(file+'-wal')});
  // WAL 비우기는 기다리지 않고(busy_timeout 0) 짧게 여러 번 — 앱 쓰기를 붙잡지 않는다.
  async function truncate(tries,waitMs){
    for(let i=1;i<=tries;i++){
      let result;
      db.exec('PRAGMA busy_timeout=0');
      try{result=one('PRAGMA wal_checkpoint(TRUNCATE)');}catch(error){result={busy:1,error:error.code||'CHECKPOINT_FAILED'};}
      finally{db.exec('PRAGMA busy_timeout=3000');}
      if(result.busy===0)return {...result,tries:i};
      await sleep(waitMs);
    }
    return {busy:1,tries};
  }
  let worker=null;
  try{
    if(one('PRAGMA journal_mode').journal_mode!=='wal')return [{error:'JOURNAL_MODE_NOT_WAL'},6];
    const before=state();
    // 앞 WAL을 못 비우면(오래 읽는 연결이 있으면) VACUUM 뒤 TRUNCATE도 막혀 옛 페이지가 DB 파일에 남는다 — 시작하지 않는다.
    const preCheckpoint=await truncate(20,250);
    if(preCheckpoint.busy!==0)return [{error:'WAL_BUSY_BEFORE',before,preCheckpoint},2];
    // 부른 쪽이 준 상한을 WAL을 비운 뒤(논리 크기 그대로) 다시 본다 — 예산 안에 끝난다고 볼 수 없는 크기면 시작하지 않는다.
    const maxBytes=Number(process.env.SYNK_FREE_SPACE_MAX_BYTES)||0,logicalBytes=one('PRAGMA page_count').page_count*one('PRAGMA page_size').page_size;
    if(maxBytes&&logicalBytes>maxBytes)return [{error:'TOO_LARGE_FOR_ONLINE_VACUUM',logicalBytes,maxBytes,before,preCheckpoint},6];
    worker=spawn(process.execPath,['-e',`(${child})()`,file,String(LOCK_WAIT_MS)],{stdio:['pipe','pipe','inherit']});
    const exited=new Promise(resolve=>worker.once('exit',(code,signal)=>resolve({code,signal})));
    const messages=lineQueue(worker.stdout);
    const read=async ms=>{const line=await messages.next(ms);try{return line==null?{type:'gone'}:JSON.parse(line);}catch{return {type:'garbled'};}};
    const ready=await read(60000);
    if(ready.type!=='ready'){worker.kill('SIGKILL');return [{error:ready.code||'CHILD_NOT_READY',before,preCheckpoint},6];}
    // 부른 쪽이 이 줄을 받고 릴리스 잠금·서비스를 다시 본 뒤 GO나 STOP을 보낸다.
    emit({ready:true,before});
    const answers=lineQueue(process.stdin);
    const answer=String(await answers.next(30000)||'').trim();
    answers.close();process.stdin.destroy();
    if(answer!=='GO'){
      worker.stdin.end('STOP\n');await read(10000);await exited;
      return [{error:'STOPPED',answer:answer.slice(0,20),before,preCheckpoint},5];
    }
    worker.stdin.end('GO\n');
    // 예산을 넘기면 자식을 SIGKILL로 끝낸다. 커밋 전이면 SQLite가 그 쓰기를 버린다.
    let overBudget=false;
    const watchdog=setTimeout(()=>{overBudget=true;worker.kill('SIGKILL');},LOCK_WAIT_MS+WORK_MS);
    const vacuumed=await read(LOCK_WAIT_MS+WORK_MS+60000);
    clearTimeout(watchdog);
    if(overBudget||vacuumed.type!=='vacuumed'){
      await exited;
      return [{error:overBudget?'VACUUM_OVER_BUDGET':vacuumed.code||'VACUUM_FAILED',budgetMs:LOCK_WAIT_MS+WORK_MS,before,preCheckpoint,
        after:state(),quickCheck:one('PRAGMA quick_check').quick_check},overBudget?3:6];
    }
    const done=await read(120000);
    await exited;
    if(done.type!=='done')return [{error:done.code||'FINGERPRINT_FAILED',before,preCheckpoint,vacuumMs:vacuumed.vacuumMs},6];
    const walAfterVacuum=size(file+'-wal');
    // VACUUM이 쓴 새 페이지는 아직 WAL에 있고, 옛 페이지는 DB 파일에 남아 있다. TRUNCATE까지 끝나야 정리가 끝난다.
    const postCheckpoint=await truncate(40,500);
    const quickCheck=one('PRAGMA quick_check').quick_check;
    const logical=done.after.dataVersion!==done.before.dataVersion?'app-wrote-meanwhile':done.before.fingerprint===done.after.fingerprint?'same':'DIFFERENT';
    const result={before,after:state(),vacuumMs:vacuumed.vacuumMs,walAfterVacuum,preCheckpoint,postCheckpoint,walTruncated:postCheckpoint.busy===0,
      quickCheck,logical,fingerprint:{before:done.before.fingerprint.slice(0,16),after:done.after.fingerprint.slice(0,16)}};
    return [result,quickCheck!=='ok'||logical==='DIFFERENT'?1:postCheckpoint.busy!==0?4:0];
  }finally{
    if(worker&&worker.exitCode===null&&worker.signalCode===null)worker.kill('SIGKILL');
    db.close();
  }
}

main().then(([result,code])=>{emit(result);process.exitCode=code;},error=>{emit({error:error.code||'FAILED'});process.exitCode=6;});

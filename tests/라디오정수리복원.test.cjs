'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const file=path.resolve(__dirname,'../docs/라디오/선정무대_20260910/정수리복원.cjs'),code=fs.readFileSync(file,'utf8'),dir=path.dirname(file),root=path.resolve(dir,'../../..'),out=path.join(dir,'정수리수정');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function run(change){
 const files=new Map(),before=Buffer.from('original before'),after=Buffer.from('original fixed'),radioBefore=Buffer.from('radio before'),radioAfter=Buffer.from('radio fixed');
 const report={results:[{name:'라디오',file:'radio-before.webp',filename:'radio.png',sourceSha:sha(radioBefore),sha256:sha(radioAfter)},{name:'원본',promotedTo:'original.png',backup:'before.png',sha256:sha(after),sourceSha:sha(before)}]};
 files.set(path.join(root,'original.png'),after);files.set(path.join(root,'before.png'),before);files.set(path.join(root,'radio-before.webp'),radioBefore);files.set(path.join(out,'radio.png'),radioAfter);files.set(path.join(out,'복원검증.json'),JSON.stringify(report));
 if(change)change(files);
 const logs=[],errors=[],state={exitCode:0};let writes=0;
 const fakeFs={existsSync:p=>files.has(p),readFileSync:(p,encoding)=>{if(!files.has(p))throw Error('missing '+p);return encoding?String(files.get(p)):Buffer.from(files.get(p));},writeFileSync:()=>{writes++;throw Error('Unexpected write');},mkdirSync:()=>{writes++;throw Error('Unexpected mkdir');}};
 vm.runInNewContext(code,{require:n=>n==='fs'?fakeFs:n==='sharp'?()=>{throw Error('Unexpected image edit');}:require(n),__dirname:dir,Buffer,process:state,console:{log:x=>logs.push(x),error:x=>errors.push(String(x))}});
 await new Promise(r=>setImmediate(r));return {logs,errors,code:state.exitCode,writes};
}
test('promoted assets are verified without any re-edit or write',async()=>{const r=await run();assert.equal(r.code,0);assert.equal(r.writes,0);assert.equal(r.errors.length,0);assert.match(r.logs[0],/radio input\/output verified/);});
test('missing radio result cannot report success',async()=>{const r=await run(files=>files.delete(path.join(out,'radio.png')));assert.equal(r.code,1);assert.equal(r.writes,0);assert.match(r.errors[0],/Required asset missing/);});
test('modified radio result cannot report success',async()=>{const r=await run(files=>files.set(path.join(out,'radio.png'),Buffer.from('wrong')));assert.equal(r.code,1);assert.equal(r.writes,0);assert.match(r.errors[0],/Required asset changed/);});
test('missing archived original gives restoration guidance without regeneration',async()=>{const r=await run(files=>files.delete(path.join(root,'original.png')));assert.equal(r.code,1);assert.equal(r.writes,0);assert.match(r.errors[0],/restore the verified asset/);});

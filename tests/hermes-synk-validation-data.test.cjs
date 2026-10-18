'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {validateData}=require('../tools/hermes-synk/validation-data.cjs');
const helpers=require('../tools/hermes-synk/validation.cjs');
const repo=path.resolve(__dirname,'..'),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function fixture(t,{files,changes,sourceFiles={},checks}){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'synk-data-'));
  t.after(()=>{if(path.dirname(path.resolve(base))!==path.resolve(os.tmpdir())||!path.basename(base).startsWith('synk-data-'))throw new Error('Unsafe cleanup');fs.rmSync(base,{recursive:true,force:true});});
  const candidateRoot=path.join(base,'candidate'),sourceRoot=path.join(base,'source'),evidence=path.join(base,'evidence');for(const dir of [candidateRoot,sourceRoot,evidence])fs.mkdirSync(dir);
  const put=(root,rel,text)=>{const file=path.join(root,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
  for(const [rel,text]of Object.entries(files))put(candidateRoot,rel,text);
  for(const [rel,text]of Object.entries(sourceFiles))put(sourceRoot,rel,text);
  const fixed=changes.map(change=>{if(change.kind==='add')return {...change,beforeSha256:null};const before=sourceFiles[change.path]??'';put(sourceRoot,change.path,before);return {...change,beforeSha256:sha(before)};});
  return {taskDir:base,request:{source_root:repo,repo_root:repo},prepared:{candidateRoot,sourceRoot,changes:fixed,candidateFiles:Object.keys(files).map(path=>({path}))},report:{checks},evidence,env:helpers.cleanEnvironment(path.join(base,'environment')),helpers};
}
const SCHEMA=JSON.stringify({type:'object',required:['limit'],additionalProperties:false,properties:{limit:{type:'integer',minimum:1,maximum:100}}});
function jsonFixture(t,{data='{"limit":5}',schema=SCHEMA,body="const value=require('../data.json');assert.equal(value.limit,5);",changes=[{path:'data.json',kind:'modify'}],extra={},sourceExtra={}}={}){
  return fixture(t,{files:{'data.json':data,'schema.json':schema,'tests/data.test.cjs':"const test=require('node:test');const assert=require('node:assert/strict');test('consumes configured limit',()=>{"+body+'});',...extra},changes,sourceFiles:{'data.json':'{"limit":2}','schema.json':schema,...sourceExtra},checks:[{kind:'json_schema',path:'data.json',schema:'schema.json',tests:['tests/data.test.cjs']}]});
}
test('strict schema and actual changed JSON property consumption pass',async t=>{
  const result=await validateData(jsonFixture(t));assert.deepEqual(result.validatedPaths,['data.json','schema.json']);assert.deepEqual(result.checks[0].consumedPointers,['/limit']);assert.equal(result.checks[0].tests,1);
});
test('unrelated passing Node tests do not validate JSON',async t=>{
  await assert.rejects(validateData(jsonFixture(t,{body:'assert.equal(2+2,4);'})),{code:'JSON_DATA_NOT_CONSUMED'});
});
test('reading the JSON bytes without consuming changed values is insufficient',async t=>{
  await assert.rejects(validateData(jsonFixture(t,{body:"require('node:fs').readFileSync(require('node:path').join(__dirname,'../data.json'),'utf8');"})),{code:'JSON_DATA_NOT_CONSUMED'});
});
test('checking only unchanged property existence does not consume its changed value',async t=>{
  await assert.rejects(validateData(jsonFixture(t,{body:"assert.ok('limit' in require('../data.json'));"})),{code:'JSON_DATA_NOT_CONSUMED'});
});
test('readFile JSON.parse consumer and asynchronous read consumer are observed',async t=>{
  const f=jsonFixture(t,{body:"const fs=require('node:fs');const path=require('node:path');assert.equal(JSON.parse(fs.readFileSync(path.join(__dirname,'../data.json'),'utf8')).limit,5);"});
  assert.equal((await validateData(f)).checks[0].passed,true);
  const asyncFixture=jsonFixture(t,{body:"return require('node:fs').promises.readFile(require('node:path').join(__dirname,'../data.json'),'utf8').then(text=>assert.equal(JSON.parse(text).limit,5));"});
  assert.equal((await validateData(asyncFixture)).checks[0].passed,true);
});
test('invalid JSON value, broad schema, remote refs and changed existing schema hold',async t=>{
  for(const [options,code]of [
    [{data:'{"limit":0}'},'JSON_SCHEMA_VALIDATION_FAILED'],
    [{schema:'{"type":"object"}'},'JSON_SCHEMA_CONSTRAINT_REQUIRED'],
    [{schema:'{"$ref":"https://example.invalid/schema.json"}'},'JSON_SCHEMA_REMOTE_REFERENCE_FORBIDDEN'],
    [{changes:[{path:'data.json',kind:'modify'},{path:'schema.json',kind:'modify'}]},'JSON_SCHEMA_CHANGE_REVIEW_REQUIRED'],
  ])await assert.rejects(validateData(jsonFixture(t,options)),{code});
});
test('new concrete schema and new data are supported together',async t=>{
  const result=await validateData(jsonFixture(t,{changes:[{path:'data.json',kind:'add'},{path:'schema.json',kind:'add'}]}));assert.deepEqual(result.validatedPaths,['data.json','schema.json']);
});
test('strict unknown schema keywords cannot silently pass',async t=>{
  await assert.rejects(validateData(jsonFixture(t,{schema:JSON.stringify({type:'object',properties:{limit:{type:'number',madeUpConstraint:true}}})})),{code:'JSON_SCHEMA_INVALID'});
});
test('local schema references are bound and returned as validated paths',async t=>{
  const leaf=JSON.stringify({type:'integer',minimum:1,maximum:100});const schema=JSON.stringify({type:'object',required:['limit'],properties:{limit:{$ref:'defs/limit.json'}},additionalProperties:false});
  const f=jsonFixture(t,{schema,extra:{'defs/limit.json':leaf},sourceExtra:{'defs/limit.json':leaf}});
  assert.deepEqual((await validateData(f)).validatedPaths,['data.json','schema.json','defs/limit.json']);
});
test('unchanged schema accepts only CRLF versus LF differences from Git autocrlf',async t=>{
  const original=JSON.stringify(JSON.parse(SCHEMA),null,2)+'\n',crlf=original.replaceAll('\n','\r\n');
  assert.equal((await validateData(jsonFixture(t,{schema:crlf,sourceExtra:{'schema.json':original}}))).checks[0].passed,true);
  assert.equal((await validateData(jsonFixture(t,{schema:original,sourceExtra:{'schema.json':crlf}}))).checks[0].passed,true);
});
test('schema content and JSON-equivalent reformatting still require review',async t=>{
  const original=JSON.stringify(JSON.parse(SCHEMA),null,2)+'\n';
  for(const schema of [original.replace('"minimum": 1','"minimum": 0'),JSON.stringify(JSON.parse(SCHEMA))])
    await assert.rejects(validateData(jsonFixture(t,{schema,sourceExtra:{'schema.json':original}})),{code:'JSON_SCHEMA_CHANGE_REVIEW_REQUIRED'});
});
test('reading another JSON object with the same property cannot credit target data',async t=>{
  const f=jsonFixture(t,{extra:{'other.json':'{"limit":5}'},body:"const v=require('../other.json');assert.equal(v.limit,5);"});
  await assert.rejects(validateData(f),{code:'JSON_DATA_NOT_CONSUMED'});
  const ambiguous=jsonFixture(t,{extra:{'other.json':'{"limit":5}'},body:"const fs=require('node:fs'),p=require('node:path');fs.readFileSync(p.join(__dirname,'../data.json'),'utf8');assert.equal(JSON.parse(fs.readFileSync(p.join(__dirname,'../other.json'),'utf8')).limit,5);"});
  await assert.rejects(validateData(ambiguous),{code:'JSON_DATA_NOT_CONSUMED'});
});
test('test skip or failure holds JSON validation',async t=>{
  const f=jsonFixture(t);fs.writeFileSync(path.join(f.prepared.candidateRoot,'tests/data.test.cjs'),"require('node:test').skip('skip',()=>{});");
  await assert.rejects(validateData(f),{code:'RELATED_TESTS_FAILED_OR_INCOMPLETE'});
});
test('draft 2020 schema validates using its actual Ajv dialect',async t=>{
  const schema=JSON.stringify({$schema:'https://json-schema.org/draft/2020-12/schema',type:'object',required:['limit'],properties:{limit:{type:'integer',minimum:1}},unevaluatedProperties:false});
  assert.equal((await validateData(jsonFixture(t,{schema}))).checks[0].passed,true);
});
test('unknown JSON format and primitive unobservable consumer fail closed',async t=>{
  await assert.rejects(validateData(jsonFixture(t,{schema:JSON.stringify({type:'object',properties:{limit:{type:'integer',format:'domain-number'}}})})),{code:'JSON_SCHEMA_INVALID'});
  await assert.rejects(validateData(jsonFixture(t,{data:'5',schema:'{"type":"integer"}'})),{code:'JSON_PRIMITIVE_CONSUMPTION_UNOBSERVABLE'});
});
test('large changed JSON field sets are bounded before repeated domain probes',async t=>{
  const data=JSON.stringify(Object.fromEntries(Array.from({length:513},(_,i)=>['field'+i,i])));
  await assert.rejects(validateData(jsonFixture(t,{data,schema:'{"type":"object","additionalProperties":{"type":"integer"}}'})),{code:'JSON_VALIDATION_LIMIT'});
});
const CONFIG=JSON.stringify({compilerOptions:{target:'ES2022',module:'CommonJS',strict:true,noEmit:true},include:['src/**/*.ts']});
function tsFixture(t,{app='export function add(a:number,b:number):number { return a+b; }\n',before='export function add(a:number,b:number):number { return 0; }\n',body="assert.equal(require('../src/app.js').add(2,3),5);",config=CONFIG,extra={},changes=[{path:'src/app.ts',kind:'modify'}]}={}){
  return fixture(t,{files:{'tsconfig.json':config,'src/app.ts':app,'tests/app.test.cjs':"const test=require('node:test');const assert=require('node:assert/strict');test('runs emitted function',()=>{"+body+'});',...extra},changes,sourceFiles:{'src/app.ts':before},checks:[{kind:'typescript',path:'tsconfig.json',tests:['tests/app.test.cjs']}]});
}
test('TypeScript actual typecheck and emitted changed-line coverage pass',async t=>{
  const result=await validateData(tsFixture(t));assert.equal(result.checks[0].passed,true);assert.match(result.checks[0].compilerVersion,/^7\./);assert.deepEqual(result.validatedPaths,['tsconfig.json','src/app.ts']);assert.deepEqual(result.checks[0].changedCodeExercised,['src/app.ts']);
});
test('TypeScript type errors cannot be replaced with passing unrelated tests',async t=>{
  await assert.rejects(validateData(tsFixture(t,{app:'export const total:number="wrong";\n',body:'assert.equal(1,1);'})),{code:'TYPESCRIPT_TYPECHECK_FAILED'});
});
test('loading emitted module without invoking changed function holds',async t=>{
  await assert.rejects(validateData(tsFixture(t,{body:"assert.ok(require('../src/app.js').add);"})),{code:'CHANGED_CODE_NOT_EXERCISED'});
});
test('changed branch must execute, but untouched unused functions do not block',async t=>{
  const before='export function choose(x:boolean):number { if(x) return 1; return 0; }\nexport function unused():number { return 8; }\n';
  const app='export function choose(x:boolean):number { if(x) return 1; return 9; }\nexport function unused():number { return 8; }\n';
  await assert.rejects(validateData(tsFixture(t,{before,app,body:"assert.equal(require('../src/app.js').choose(true),1);"})),{code:'CHANGED_CODE_NOT_EXERCISED'});
  assert.equal((await validateData(tsFixture(t,{before,app,body:"const c=require('../src/app.js').choose;assert.equal(c(true),1);assert.equal(c(false),9);"}))).checks[0].passed,true);
});
test('JSONC tsconfig is parsed by compiler and included as validated config',async t=>{
  const f=tsFixture(t,{config:'{ // official compiler parses comments\n"compilerOptions":{"target":"ES2022","module":"CommonJS","strict":true,},"include":["src/**/*.ts"],}'});
  assert.ok((await validateData(f)).validatedPaths.includes('tsconfig.json'));
});
test('compiler config excluding changed TypeScript cannot claim it validated',async t=>{
  const f=tsFixture(t,{config:JSON.stringify({compilerOptions:{target:'ES2022',module:'CommonJS'},files:['src/other.ts']}),extra:{'src/other.ts':'export const other=1;'}});
  await assert.rejects(validateData(f),{code:'TYPESCRIPT_PROJECT_SCOPE_INCOMPLETE'});
});
test('noCheck is explicitly rejected instead of accepting unchecked emit',async t=>{
  const f=tsFixture(t,{config:JSON.stringify({compilerOptions:{target:'ES2022',module:'CommonJS',noCheck:true},include:['src/**/*.ts']})});
  await assert.rejects(validateData(f),{code:'TYPESCRIPT_CONFIG_UNSUPPORTED'});
});
test('file-level TypeScript check suppression does not provide typecheck proof',async t=>{
  const f=tsFixture(t,{app:'// @ts-nocheck\nexport function add(a:number,b:number):number { return a+b; }\n'});
  await assert.rejects(validateData(f),{code:'TYPESCRIPT_CHECK_SUPPRESSED'});
});
test('weakening an existing strict project cannot auto validate changed config',async t=>{
  const f=tsFixture(t,{config:JSON.stringify({compilerOptions:{target:'ES2022',module:'CommonJS',strict:false},include:['src/**/*.ts']})});
  fs.writeFileSync(path.join(f.prepared.sourceRoot,'tsconfig.json'),CONFIG);f.request.source_root=f.prepared.sourceRoot;
  await assert.rejects(validateData(f),{code:'TYPESCRIPT_CONFIG_WEAKENED'});
});
test('mutating an emitted source during tests invalidates TypeScript proof',async t=>{
  const f=tsFixture(t,{body:"const fs=require('node:fs');const p=require('node:path').join(__dirname,'../src/app.js');assert.equal(require(p).add(2,3),5);fs.appendFileSync(p,'// test changed executable');"});
  await assert.rejects(validateData(f),{code:'CANDIDATE_CHANGED_DURING_VALIDATION'});
});
test('TSX uses the installed JSX runtime and verifies executed component output',async t=>{
  const f=tsFixture(t,{config:JSON.stringify({compilerOptions:{target:'ES2022',module:'CommonJS',jsx:'react-jsx',strict:true,types:['react']},include:['src/**/*.tsx']}),extra:{'src/card.tsx':'export function card(){ return <div>Hello</div>; }\n'},changes:[{path:'src/card.tsx',kind:'add'}],body:"const node=require('../src/card.js').card();assert.equal(node.type,'div');assert.equal(node.props.children,'Hello');"});
  assert.deepEqual((await validateData(f)).checks[0].changedCodeExercised,['src/card.tsx']);
});
function trustedFixtureRuntime(f,{dependency:fixtureDependency}={}){
  const root=f.prepared.sourceRoot,compiler=path.join(root,'node_modules/typescript');fs.mkdirSync(path.join(compiler,'bin'),{recursive:true});
  fs.writeFileSync(path.join(compiler,'package.json'),JSON.stringify({name:'typescript',version:'7.0.2-fixture'}));
  const officialCompiler=path.join(repo,'영상/node_modules/typescript/bin/tsc');
  fs.writeFileSync(path.join(compiler,'bin/tsc'),"const r=require('node:child_process').spawnSync(process.execPath,["+JSON.stringify(officialCompiler)+",...process.argv.slice(2)],{stdio:'inherit',env:process.env});process.exit(r.status??1);");
  if(fixtureDependency){const pkg=path.join(root,'node_modules/fixture-runtime');fs.mkdirSync(pkg);for(const [rel,text]of Object.entries({'package.json':JSON.stringify({name:'fixture-runtime',version:'1.0.0',main:'index.cjs',types:'index.d.ts',...fixtureDependency}),'index.cjs':'exports.value=1;','index.d.ts':'export declare const value:number;'}))fs.writeFileSync(path.join(pkg,rel),text);}
  f.request.source_root=root;return path.join(root,'node_modules');
}
test('derived node_modules writes cannot change original dependency root and compiler links are removed',async t=>{
  const f=tsFixture(t,{body:"const fs=require('node:fs');assert.equal(require('../src/app.js').add(2,3),5);fs.mkdirSync('node_modules',{recursive:true});fs.writeFileSync('node_modules/review-marker.txt','derived write');"});
  const modules=trustedFixtureRuntime(f),marker=path.join(modules,'review-marker.txt');fs.writeFileSync(marker,'original');
  await assert.rejects(validateData(f),{code:'CANDIDATE_CHANGED_DURING_VALIDATION'});assert.equal(fs.readFileSync(marker,'utf8'),'original');
  const stage=fs.readdirSync(f.evidence).find(name=>name.startsWith('typescript-'));assert.equal(fs.existsSync(path.join(f.evidence,stage,'source/node_modules')),false);
  assert.equal(fs.lstatSync(path.join(f.evidence,stage,'emitted/node_modules')).isSymbolicLink(),false);
});
test('runtime package is a bounded actual copy and dependency writes invalidate proof without touching originals',async t=>{
  const app="import {value} from 'fixture-runtime';export function add(a:number,b:number){return a+b+value-1;}\n";
  const f=tsFixture(t,{app,body:"const fs=require('node:fs');assert.equal(require('../src/app.js').add(2,3),5);fs.writeFileSync('node_modules/fixture-runtime/index.cjs','exports.value=99;');"});
  const modules=trustedFixtureRuntime(f,{dependency:{}}),original=path.join(modules,'fixture-runtime/index.cjs'),before=fs.readFileSync(original);
  await assert.rejects(validateData(f),{code:'CANDIDATE_CHANGED_DURING_VALIDATION'});assert.deepEqual(fs.readFileSync(original),before);
});
test('malformed dependency graph keys cannot select a path outside isolated node_modules',async t=>{
  const f=tsFixture(t,{app:"import {value} from 'fixture-runtime';export function add(a:number,b:number){return a+b+value-1;}\n"});
  trustedFixtureRuntime(f,{dependency:{dependencies:{'../escape':'1'}}});await assert.rejects(validateData(f),{code:'TYPESCRIPT_DEPENDENCY_ISOLATION_REQUIRED'});
});
test('pure TypeScript compiles and executes when the sandbox rejects all symlink and junction creation',async t=>{
  const f=tsFixture(t),original=fs.symlinkSync;
  fs.symlinkSync=()=>{const error=new Error('Sandbox disallows links');error.code='EPERM';throw error;};
  try{const result=await validateData(f);assert.equal(result.checks[0].compilerIsolation.packages,0);assert.equal(result.checks[0].runtimeIsolation.packages,0);
    const stage=fs.readdirSync(f.evidence).find(name=>name.startsWith('typescript-'));assert.equal(fs.existsSync(path.join(f.evidence,stage,'source/node_modules')),false);
  }finally{fs.symlinkSync=original;}
});
test('TSX type dependencies and JSX runtime are actual copies without any link creation',async t=>{
  const f=tsFixture(t,{config:JSON.stringify({compilerOptions:{target:'ES2022',module:'CommonJS',jsx:'react-jsx',strict:true,types:['react']},include:['src/**/*.tsx']}),extra:{'src/card.tsx':'export function card(){ return <div>Hello</div>; }\n'},changes:[{path:'src/card.tsx',kind:'add'}],body:"const node=require('../src/card.js').card();assert.equal(node.props.children,'Hello');"}),original=fs.symlinkSync;
  fs.symlinkSync=()=>{const error=new Error('Sandbox disallows links');error.code='EPERM';throw error;};
  try{const result=await validateData(f);assert.ok(result.checks[0].compilerIsolation.packages>=2);assert.ok(result.checks[0].runtimeIsolation.packages>=1);
    const stage=fs.readdirSync(f.evidence).find(name=>name.startsWith('typescript-'));
    for(const tree of ['source','emitted'])assert.equal(fs.lstatSync(path.join(f.evidence,stage,tree,'node_modules/react')).isSymbolicLink(),false);
  }finally{fs.symlinkSync=original;}
});

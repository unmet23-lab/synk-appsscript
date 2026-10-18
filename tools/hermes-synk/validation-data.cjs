'use strict';
// Fixed data/type validation adapters. No package installation, npm script or
// caller-selected executable. All tests run on a derived, hash-bound candidate.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const Module=require('node:module');
const {fileURLToPath}=require('node:url');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
// Git autocrlf may change only newline bytes between the frozen source and the
// candidate. Preserve every other byte; this is deliberately not JSON equality.
const schemaLineBytes=bytes=>Buffer.from(bytes.toString('latin1').replaceAll('\r\n','\n'),'latin1');
const slash=x=>x.replaceAll('\\','/');
class Attention extends Error{constructor(code){super(code);this.code=code;}}
const fail=code=>{throw new Attention(code);};
function relative(root,absolute){const rel=slash(path.relative(root,absolute));if(!rel||rel.startsWith('../')||path.isAbsolute(rel))fail('UNSAFE_VALIDATION_PATH');return rel;}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value,{flag:'wx',mode:0o600});}
function runtimeRoots(request,checkPath){
  const result=[];
  for(const root of [request.source_root,request.repo_root,path.resolve(__dirname,'../..')].filter(x=>typeof x==='string')){
    let dir=path.resolve(root,path.dirname(checkPath));const base=path.resolve(root);
    if(!dir.startsWith(base+path.sep)&&dir!==base)continue;
    while(dir===base||dir.startsWith(base+path.sep)){result.push(dir);if(dir===base)break;dir=path.dirname(dir);}
    result.push(path.join(base,'영상'));
  }
  return [...new Set(result)];
}
function dependency(name,request,checkPath){
  for(const root of runtimeRoots(request,checkPath)){
    const file=path.join(root,'node_modules',name,'package.json');
    if(fs.existsSync(file)){const real=fs.realpathSync(path.dirname(file)),pkg=JSON.parse(fs.readFileSync(path.join(real,'package.json'),'utf8'));if(pkg.name===name)return {root:real,version:pkg.version,nodeModules:path.resolve(real,'..')};}
  }
  fail(name==='typescript'?'TYPESCRIPT_RUNTIME_UNAVAILABLE':'JSON_SCHEMA_RUNTIME_UNAVAILABLE');
}
function sourceMapRuntime(){
  for(const base of [path.resolve(__dirname,'../../node_modules'),path.join(process.env.USERPROFILE||'','\.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')]){
    try{return require(path.join(base,'source-map'));}catch{}
  }
  fail('TYPESCRIPT_SOURCEMAP_RUNTIME_UNAVAILABLE');
}
function tests(check,prepared,helpers){
  if(!Array.isArray(check.tests)||!check.tests.length||check.tests.length>12||new Set(check.tests).size!==check.tests.length)fail('RELATED_TESTS_REQUIRED');
  const files=new Set(prepared.candidateFiles.map(x=>x.path));
  for(const rel of check.tests){if(typeof rel!=='string'||! /\.(?:[cm]?js)$/.test(rel)||!files.has(rel))fail('VALIDATION_PLAN_INVALID');helpers.regular(prepared.candidateRoot,rel);}
  return check.tests;
}
function passed(output,helpers){const summary=helpers.tapSummary(output.stdout);if(output.status!==0||!Number.isFinite(summary.tests)||summary.tests<=0||summary.pass!==summary.tests||['fail','cancelled','skipped','todo'].some(k=>summary[k]!==0))fail('RELATED_TESTS_FAILED_OR_INCOMPLETE');return summary;}
function beforeJSON(prepared,change,helpers){
  if(change.kind==='add'&&change.beforeSha256===null)return undefined;
  if(!prepared.sourceRoot||! /^[a-f0-9]{64}$/.test(change.beforeSha256||''))fail('SOURCE_EVIDENCE_UNAVAILABLE');
  let bytes;try{bytes=fs.readFileSync(helpers.regular(prepared.sourceRoot,change.path));}catch{fail('SOURCE_CHANGED');}
  if(hash(bytes)!==change.beforeSha256)fail('SOURCE_CHANGED');
  try{return JSON.parse(bytes.toString('utf8'));}catch{fail('JSON_SOURCE_INVALID');}
}
const escapePointer=x=>String(x).replaceAll('~','~0').replaceAll('/','~1');
const decodePointer=x=>x.replaceAll('~1','/').replaceAll('~0','~');
function boundedJSON(value){const stack=[[value,0]];let nodes=0;while(stack.length){const [item,depth]=stack.pop();if(++nodes>50000||depth>64)fail('JSON_VALIDATION_LIMIT');if(item&&typeof item==='object')for(const next of Object.values(item))stack.push([next,depth+1]);}}
function leaves(value,pointer=''){if(value&&typeof value==='object'&&Object.keys(value).length)return Object.keys(value).flatMap(k=>leaves(value[k],pointer+'/'+escapePointer(k)));return [pointer];}
function changedPointers(before,after,pointer=''){
  if(JSON.stringify(before)===JSON.stringify(after))return [];
  if(before===undefined)return leaves(after,pointer);
  if(after===undefined)return leaves(before,pointer);
  if(before&&after&&typeof before==='object'&&typeof after==='object'&&Array.isArray(before)===Array.isArray(after)){
    return [...new Set([...Object.keys(before),...Object.keys(after)])].flatMap(k=>changedPointers(before[k],after[k],pointer+'/'+escapePointer(k)));
  }
  return [...new Set([...leaves(before,pointer),...leaves(after,pointer)])];
}
function replacePointer(value,pointer,replacement){
  if(pointer==='')return replacement;
  const copy=JSON.parse(JSON.stringify(value)),parts=pointer.slice(1).split('/').map(decodePointer);let at=copy;
  for(const part of parts.slice(0,-1)){if(!at||typeof at!=='object')return undefined;if(!Object.hasOwn(at,part))at[part]={};at=at[part];}
  if(!at||typeof at!=='object')return undefined;at[parts.at(-1)]=replacement;return copy;
}
function schemas(check,prepared,helpers,Ajv,draft){
  const schemas=new Map(),changes=new Map(prepared.changes.map(x=>[x.path,x]));
  const dataChange=changes.get(check.path),newData=dataChange?.kind==='add';
  function load(rel){
    if(schemas.has(rel))return schemas.get(rel).key;
    if(schemas.size>=32)fail('JSON_SCHEMA_LIMIT');
    const file=helpers.regular(prepared.candidateRoot,rel);let value;try{value=JSON.parse(fs.readFileSync(file,'utf8'));}catch{fail('JSON_SCHEMA_INVALID');}
    const change=changes.get(rel);
    if(change&&!(newData&&change.kind==='add'&&change.beforeSha256===null))fail('JSON_SCHEMA_CHANGE_REVIEW_REQUIRED');
    if(!change){let old;try{old=fs.readFileSync(helpers.regular(prepared.sourceRoot,rel));}catch{fail('JSON_SCHEMA_SOURCE_REQUIRED');}if(!schemaLineBytes(old).equals(schemaLineBytes(fs.readFileSync(file))))fail('JSON_SCHEMA_CHANGE_REVIEW_REQUIRED');}
    if(!value||typeof value!=='object'||Array.isArray(value))fail('JSON_SCHEMA_CONSTRAINT_REQUIRED');
    boundedJSON(value);
    if(value.$schema&&schemaDraft(value.$schema)!==draft)fail('JSON_SCHEMA_DRAFT_UNSUPPORTED');
    const key='schema'+schemas.size;schemas.set(rel,{key,value:null});
    function transform(node){
      if(Array.isArray(node))return node.map(transform);
      if(!node||typeof node!=='object')return node;
      if(node!==value&&node.$id)fail('JSON_SCHEMA_REFERENCE_UNSUPPORTED');
      const out={};for(const [k,v]of Object.entries(node)){
        if(['$id','$schema'].includes(k))continue;
        if(['$anchor','$dynamicRef','$dynamicAnchor','$recursiveRef','$recursiveAnchor'].includes(k))fail('JSON_SCHEMA_REFERENCE_UNSUPPORTED');
        if(k==='$ref'){
          if(typeof v!=='string'||v.length>1024)fail('JSON_SCHEMA_REFERENCE_UNSUPPORTED');
          const [name,fragment='',extra]=v.split('#');if(extra!==undefined||fragment&&!fragment.startsWith('/'))fail('JSON_SCHEMA_REFERENCE_UNSUPPORTED');
          if(name&&value.$id)fail('JSON_SCHEMA_REFERENCE_UNSUPPORTED');
          if(name&&(/^[a-z]+:/i.test(name)||name.startsWith('/')||name.includes('\\')||name.includes('?')))fail('JSON_SCHEMA_REMOTE_REFERENCE_FORBIDDEN');
          const target=name?relative(prepared.candidateRoot,path.resolve(path.dirname(file),name)):rel;
          out[k]='#/$defs/'+load(target)+(fragment||'');
        }else if(['properties','patternProperties','$defs','definitions','dependentSchemas'].includes(k)){
          if(!v||typeof v!=='object'||Array.isArray(v))fail('JSON_SCHEMA_INVALID');
          out[k]=Object.fromEntries(Object.entries(v).map(([name,child])=>[name,transform(child)]));
        }else if(k==='dependencies'){
          if(!v||typeof v!=='object'||Array.isArray(v))fail('JSON_SCHEMA_INVALID');
          out[k]=Object.fromEntries(Object.entries(v).map(([name,child])=>[name,Array.isArray(child)?child:transform(child)]));
        }else if(['allOf','anyOf','oneOf','prefixItems'].includes(k))out[k]=Array.isArray(v)?v.map(transform):v;
        else if(['not','if','then','else','additionalProperties','unevaluatedProperties','items','additionalItems','contains','propertyNames','contentSchema','unevaluatedItems'].includes(k))out[k]=transform(v);
        else out[k]=v;
      }return out;
    }
    schemas.get(rel).value=transform(value);return key;
  }
  const first=load(check.schema),defs={};for(const {key,value}of schemas.values())defs[key]=value;
  const schema={$ref:'#/$defs/'+first,$defs:defs};
  // Unknown formats are an error, rather than silently disabling a domain rule.
  let validate;try{validate=new Ajv({strict:true,allErrors:true,coerceTypes:false,useDefaults:false,removeAdditional:false}).compile(schema);}catch{fail('JSON_SCHEMA_INVALID');}
  return {validate,paths:[...schemas.keys()]};
}
function schemaDraft(uri){
  if(uri===undefined||/^https?:\/\/json-schema\.org\/draft-07\/schema#?$/.test(uri))return 'draft7';
  if(/^https:\/\/json-schema\.org\/draft\/2020-12\/schema#?$/.test(uri))return '2020';
  if(/^https:\/\/json-schema\.org\/draft\/2019-09\/schema#?$/.test(uri))return '2019';
  fail('JSON_SCHEMA_DRAFT_UNSUPPORTED');
}
function installConsumptionProbe(){
  const manifestFile=process.env.SYNK_JSON_CONSUMPTION_MANIFEST;if(!manifestFile)return;
  const readSync=fs.readFileSync.bind(fs),writeSync=fs.writeFileSync.bind(fs),parse=JSON.parse;
  let manifest;try{manifest=parse(readSync(manifestFile,'utf8'));}catch{return;}
  const entries=new Map(manifest.targets.map(x=>[path.resolve(x.file),{...x,seen:new Set()}])),texts=new Map(),targetHashes=new Set(manifest.targets.map(x=>x.sha256));
  const receipts=path.resolve(manifest.receipts);let serial=0;
  function note(file,data){let name;try{name=path.resolve(file instanceof URL?fileURLToPath(file):String(file));}catch{return;}
    const entry=entries.get(name),digest=hash(data);if(!targetHashes.has(digest))return;
    const text=Buffer.isBuffer(data)?data.toString('utf8'):String(data);
    if(!entry||digest!==entry.sha256){texts.set(text,null);return;}
    if(texts.has(text)&&texts.get(text)!==entry)texts.set(text,null);else if(!texts.has(text))texts.set(text,entry);return entry;}
  function wrap(value,entry,pointer=''){
    if(!value||typeof value!=='object'){entry.seen.add(pointer);return value;}
    return new Proxy(value,{get(target,key,receiver){const result=Reflect.get(target,key,receiver);if(typeof key==='string'){const next=pointer+'/'+escapePointer(key);entry.seen.add(next);return wrap(result,entry,next);}return result;}});
  }
  fs.readFileSync=function(file,...args){const data=readSync(file,...args);note(file,data);return data;};
  const read=fs.readFile.bind(fs);fs.readFile=function(file,...args){const cb=args.pop();return read(file,...args,(error,data)=>{if(!error)note(file,data);cb(error,data);});};
  const promiseRead=fs.promises.readFile.bind(fs.promises);fs.promises.readFile=async function(file,...args){const data=await promiseRead(file,...args);note(file,data);return data;};
  JSON.parse=function(text,...args){const value=parse(text,...args),entry=texts.get(String(text));return entry?wrap(value,entry):value;};
  const old=Module._extensions['.json'];Module._extensions['.json']=function(mod,file){old(mod,file);const entry=entries.get(path.resolve(file));if(entry&&hash(readSync(file))===entry.sha256)mod.exports=wrap(mod.exports,entry);};
  process.on('exit',()=>{try{writeSync(path.join(receipts,'consumption-'+process.pid+'-'+serial+++'.json'),JSON.stringify({version:1,targets:[...entries.values()].map(x=>({path:x.path,sha256:x.sha256,pointers:[...x.seen]}))}),{flag:'wx',mode:0o600});}catch{}});
}
async function validateJSON(ctx,check){
  const {prepared,helpers,evidence,env,request}=ctx;
  if(typeof check.path!=='string'||typeof check.schema!=='string'||check.path===check.schema)fail('VALIDATION_PLAN_INVALID');
  const change=prepared.changes.find(x=>x.path===check.path);if(!change)fail('JSON_SCHEMA_TARGET_NOT_CHANGED');
  const dataFile=helpers.regular(prepared.candidateRoot,check.path),bytes=fs.readFileSync(dataFile);let data;
  try{data=JSON.parse(bytes.toString('utf8'));}catch{fail('JSON_INVALID');}
  if(!data||typeof data!=='object')fail('JSON_PRIMITIVE_CONSUMPTION_UNOBSERVABLE');
  boundedJSON(data);
  const testPaths=tests(check,prepared,helpers),dep=dependency('ajv',request,check.path);
  let schema;try{schema=JSON.parse(fs.readFileSync(helpers.regular(prepared.candidateRoot,check.schema),'utf8'));}catch{fail('JSON_SCHEMA_INVALID');}
  const draft=schemaDraft(schema?.$schema);let Ajv;try{Ajv=require(path.join(dep.root,'dist',draft==='draft7'?'ajv.js':draft+'.js'));}catch{fail('JSON_SCHEMA_RUNTIME_UNAVAILABLE');}
  const {validate,paths}=schemas(check,prepared,helpers,Ajv,draft);
  if(!validate(data))fail('JSON_SCHEMA_VALIDATION_FAILED');
  const before=beforeJSON(prepared,change,helpers);boundedJSON(before);
  const pointers=changedPointers(before,data);
  if(pointers.length>512)fail('JSON_VALIDATION_LIMIT');if(!pointers.length)fail('JSON_CHANGE_EVIDENCE_UNAVAILABLE');
  for(const pointer of pointers){
    const alternatives=[null,'__synk_schema_probe__',987654321,true,[],{}];
    if(!alternatives.some(value=>{const altered=replacePointer(data,pointer,value);return altered!==undefined&&!validate(altered);}))fail('JSON_SCHEMA_CONSTRAINT_REQUIRED');
  }
  const folder=path.join(evidence,'json-'+crypto.randomBytes(6).toString('hex'));fs.mkdirSync(folder);
  const receipts=path.join(folder,'receipts');fs.mkdirSync(receipts);
  const manifest=path.join(folder,'manifest.json');write(manifest,JSON.stringify({targets:[{path:check.path,file:dataFile,sha256:hash(bytes)}],receipts}));
  const output=helpers.run(process.execPath,['--require',__filename,'--test','--test-reporter=tap',...testPaths],prepared.candidateRoot,{...env,SYNK_JSON_CONSUMPTION_MANIFEST:manifest});
  const summary=passed(output,helpers),observed=new Set();
  for(const name of fs.readdirSync(receipts)){
    if(!/^consumption-\d+-\d+\.json$/.test(name))continue;
    const file=path.join(receipts,name);if(fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size>1024*1024)fail('JSON_CONSUMPTION_EVIDENCE_INVALID');
    const row=JSON.parse(fs.readFileSync(file,'utf8'));
    for(const target of row.targets||[])if(target.path===check.path&&target.sha256===hash(bytes))for(const pointer of target.pointers||[])observed.add(pointer);
  }
  if(pointers.some(pointer=>!observed.has(pointer)))fail('JSON_DATA_NOT_CONSUMED');
  if(hash(fs.readFileSync(dataFile))!==hash(bytes))fail('CANDIDATE_CHANGED_DURING_VALIDATION');
  return {checks:[{kind:'json_schema',path:check.path,schema:check.schema,passed:true,ajvVersion:dep.version,...summary,consumedPointers:pointers}],validatedPaths:[check.path,...paths]};
}
function copyCandidate(prepared,root,helpers){
  let bytes=0;if(prepared.candidateFiles.length>30000)fail('TYPESCRIPT_PROJECT_LIMIT');
  for(const {path:rel}of prepared.candidateFiles){const source=helpers.regular(prepared.candidateRoot,rel),buffer=fs.readFileSync(source);bytes+=buffer.length;if(bytes>128*1024*1024)fail('TYPESCRIPT_PROJECT_LIMIT');write(path.join(root,rel),buffer);}
}
function tsPaths(config,root){if(!Array.isArray(config.files)||!config.files.length||config.files.length>10000)fail('TYPESCRIPT_PROJECT_SCOPE_INCOMPLETE');return config.files.map(name=>relative(root,path.resolve(root,name)));}
function assertTypeScriptOptions(options,base,mirror){
  if(options.plugins?.length||options.noCheck||options.noResolve||options.outFile||options.noLib)fail('TYPESCRIPT_CONFIG_UNSUPPORTED');
  for(const key of ['baseUrl','rootDir'])if(options[key]){const resolved=path.resolve(base,options[key]);if(resolved!==mirror&&!resolved.startsWith(mirror+path.sep))fail('TYPESCRIPT_CONFIG_UNSUPPORTED');}
  for(const item of options.rootDirs||[])relative(mirror,path.resolve(base,item));
  for(const item of options.typeRoots||[])relative(mirror,path.resolve(base,item));
  for(const patterns of Object.values(options.paths||{}))for(const item of patterns){if(typeof item!=='string'||path.isAbsolute(item)||slash(item).split('/').includes('..'))fail('TYPESCRIPT_CONFIG_UNSUPPORTED');}
}
function lineStarts(text){const rows=[0];for(let at=text.indexOf('\n');at>=0;at=text.indexOf('\n',at+1))rows.push(at+1);return rows;}
function isolateRuntimeDependencies(emitted,dep,request,checkPath,compile={}){
  const builtin=new Set(Module.builtinModules.map(name=>name.replace(/^node:/,''))),wanted=new Set(),wantedTypes=new Set(compile.config?.compilerOptions?.types||[]),sourcePaths=compile.sourcePaths?new Set(compile.sourcePaths):null;
  const packageName=name=>name.startsWith('@')?name.split('/').slice(0,2).join('/'):name.split('/')[0];
  const validPackage=name=>/^(?:@[a-z0-9][a-z0-9_.-]*\/)?[a-z0-9][a-z0-9_.-]*$/i.test(name);
  function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.name==='node_modules')continue;const file=path.join(dir,entry.name);
    if(entry.isDirectory())scan(file);else if(entry.isFile()&&(sourcePaths?sourcePaths.has(relative(emitted,file)):/\.(?:[cm]?js)$/.test(entry.name))){
      const text=fs.readFileSync(file,'utf8'),pattern=/(?:\brequire\s*\(\s*|\bimport\s*\(\s*|\bfrom\s*|\bimport\s*)(['"])([^'"\r\n]+)\1/g;
      for(const match of text.matchAll(pattern)){
        const name=match[2];if(name.startsWith('node:')||builtin.has(name)){if(sourcePaths)wantedTypes.add('node');continue;}
        if(name.startsWith('.')){relative(emitted,path.resolve(path.dirname(file),name));continue;}
        if(name.startsWith('/')||name.startsWith('#')||name.includes('\\')||/^[a-z]+:/i.test(name))fail('TYPESCRIPT_DEPENDENCY_ISOLATION_REQUIRED');
        const pkg=packageName(name);
        if(!validPackage(pkg))fail('TYPESCRIPT_DEPENDENCY_ISOLATION_REQUIRED');wanted.add(pkg);
      }
      if(sourcePaths)for(const match of text.matchAll(/<reference\s+types\s*=\s*['"]([^'"]+)['"]/g))wantedTypes.add(match[1]);
    }else if(!entry.isFile())fail('TYPESCRIPT_DEPENDENCY_ISOLATION_REQUIRED');
  }}scan(emitted);
  const runtimeRootsList=[...runtimeRoots(request,checkPath).map(root=>path.join(root,'node_modules')),dep.nodeModules],target=path.join(emitted,'node_modules');
  let bytes=0,files=0,packages=0;
  function find(name,from){
    const options=[];if(from){let dir=from;while(path.dirname(dir)!==dir){options.push(path.join(dir,'node_modules'));dir=path.dirname(dir);}}
    options.push(...runtimeRootsList);
    for(const root of options){const source=path.join(root,name);if(fs.existsSync(path.join(source,'package.json')))return source;}
  }
  if(sourcePaths){
    const jsx=compile.config?.compilerOptions?.jsx;
    if(['react-jsx','react-jsxdev','react'].includes(jsx))wanted.add(packageName(compile.config.compilerOptions.jsxImportSource||'react'));
    for(const name of [...wanted]){const types=name.startsWith('@')?'@types/'+name.slice(1).replace('/','__'):'@types/'+name;if(find(types))wanted.add(types);}
    for(const name of wantedTypes){
      if(typeof name!=='string')fail('TYPESCRIPT_DEPENDENCY_ISOLATION_REQUIRED');
      const types=name.startsWith('@types/')?name:name.startsWith('@')?'@types/'+name.slice(1).replace('/','__'):'@types/'+name;
      if(validPackage(types)&&find(types))wanted.add(types);
      else if(validPackage(packageName(name))&&find(packageName(name)))wanted.add(packageName(name));
      else fail('TYPESCRIPT_DEPENDENCY_ISOLATION_REQUIRED');
    }
  }
  function copyPackage(name,destination,from,ancestors=[]){
    if(!validPackage(name))fail('TYPESCRIPT_DEPENDENCY_ISOLATION_REQUIRED');
    const source=find(name,from);if(!source)fail('TYPESCRIPT_DEPENDENCY_ISOLATION_REQUIRED');
    let component=path.parse(path.resolve(source)).root;for(const part of path.resolve(source).slice(component.length).split(path.sep)){component=path.join(component,part);if(fs.lstatSync(component).isSymbolicLink())fail('TYPESCRIPT_DEPENDENCY_ISOLATION_REQUIRED');}
    const real=fs.realpathSync(source);if(ancestors.includes(real))return;
    if(++packages>64||ancestors.length>16)fail('TYPESCRIPT_DEPENDENCY_ISOLATION_REQUIRED');
    let pkg;try{pkg=JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8'));}catch{fail('TYPESCRIPT_DEPENDENCY_ISOLATION_REQUIRED');}
    if(pkg.name!==name)fail('TYPESCRIPT_DEPENDENCY_ISOLATION_REQUIRED');
    function copy(dir,out){
      const stat=fs.lstatSync(dir);if(stat.isSymbolicLink())fail('TYPESCRIPT_DEPENDENCY_ISOLATION_REQUIRED');
      if(stat.isDirectory()){fs.mkdirSync(out,{recursive:true});for(const entry of fs.readdirSync(dir)){if(entry==='node_modules')continue;copy(path.join(dir,entry),path.join(out,entry));}}
      else if(stat.isFile()){
        bytes+=stat.size;if(++files>8000||stat.size>8*1024*1024||bytes>64*1024*1024)fail('TYPESCRIPT_DEPENDENCY_ISOLATION_REQUIRED');
        const value=fs.readFileSync(dir);write(out,value);if(hash(fs.readFileSync(dir))!==hash(value))fail('TYPESCRIPT_DEPENDENCY_ISOLATION_REQUIRED');
      }else fail('TYPESCRIPT_DEPENDENCY_ISOLATION_REQUIRED');
    }copy(source,destination);
    const required={...pkg.dependencies},optional={...pkg.peerDependencies,...pkg.optionalDependencies};
    for(const child of Object.keys(required))copyPackage(child,path.join(destination,'node_modules',child),source,[...ancestors,real]);
    for(const child of Object.keys(optional))if(!Object.hasOwn(required,child)&&find(child,source))copyPackage(child,path.join(destination,'node_modules',child),source,[...ancestors,real]);
  }
  for(const name of wanted)copyPackage(name,path.join(target,name));
  return {packages,files,bytes};
}
async function validateTypeScript(ctx,check){
  const {prepared,helpers,evidence,env,request}=ctx;
  if(typeof check.path!=='string'||! /(?:^|\/)tsconfig[^/]*\.json$/.test(check.path))fail('VALIDATION_PLAN_INVALID');
  const testPaths=tests(check,prepared,helpers);helpers.regular(prepared.candidateRoot,check.path);
  const dep=dependency('typescript',request,check.path),compiler=path.join(dep.root,'bin/tsc');if(!fs.existsSync(compiler))fail('TYPESCRIPT_RUNTIME_UNAVAILABLE');
  const folder=path.join(evidence,'typescript-'+crypto.randomBytes(6).toString('hex')),mirror=path.join(folder,'source'),emitted=path.join(folder,'emitted'),coverage=path.join(folder,'coverage');
  fs.mkdirSync(mirror,{recursive:true});fs.mkdirSync(emitted);fs.mkdirSync(coverage);copyCandidate(prepared,mirror,helpers);
  const configDir=path.dirname(path.join(mirror,check.path));
  const show=helpers.run(process.execPath,[compiler,'--showConfig','-p',path.join(mirror,check.path)],mirror,env);
  if(show.status!==0)fail('TYPESCRIPT_CONFIG_INVALID');let config;try{config=JSON.parse(show.stdout);}catch{fail('TYPESCRIPT_CONFIG_INVALID');}
  if(config.references?.length)fail('TYPESCRIPT_CONFIG_UNSUPPORTED');
  assertTypeScriptOptions(config.compilerOptions||{},configDir,mirror);
  const included=tsPaths(config,configDir).map(rel=>relative(mirror,path.resolve(configDir,rel))),known=new Set(prepared.candidateFiles.map(x=>x.path));
  for(const rel of included)if(!known.has(rel))fail('TYPESCRIPT_PROJECT_SCOPE_INCOMPLETE');
  // An existing project may not silently shrink to the sparse checkout.
  const trusted=request.source_root;
  if(typeof trusted==='string'&&fs.existsSync(path.join(trusted,check.path))){
    const old=helpers.run(process.execPath,[compiler,'--showConfig','-p',path.join(trusted,check.path)],trusted,env);
    if(old.status!==0)fail('TYPESCRIPT_PROJECT_SCOPE_INCOMPLETE');let original;try{original=JSON.parse(old.stdout);}catch{fail('TYPESCRIPT_CONFIG_INVALID');}
    for(const key of ['strict','noImplicitAny','strictNullChecks','strictFunctionTypes','strictBindCallApply','strictPropertyInitialization','noImplicitThis','useUnknownInCatchVariables','alwaysStrict','noUnusedLocals','noUnusedParameters','noImplicitReturns','noFallthroughCasesInSwitch','noUncheckedIndexedAccess','exactOptionalPropertyTypes']){
      if(original.compilerOptions?.[key]===true&&config.compilerOptions?.[key]!==true)fail('TYPESCRIPT_CONFIG_WEAKENED');
    }
    for(const rel of tsPaths(original,path.dirname(path.join(trusted,check.path))).map(rel=>relative(trusted,path.resolve(path.dirname(path.join(trusted,check.path)),rel))))if(!known.has(rel))fail('TYPESCRIPT_PROJECT_SCOPE_INCOMPLETE');
  }
  const typeChanges=prepared.changes.filter(x=>/\.(?:[cm]?tsx?|jsx)$/.test(x.path));
  if(!typeChanges.length||typeChanges.some(x=>!included.includes(x.path)))fail('TYPESCRIPT_PROJECT_SCOPE_INCOMPLETE');
  for(const rel of included){const text=fs.readFileSync(helpers.regular(prepared.candidateRoot,rel),'utf8');if(/@ts-nocheck\b/.test(text))fail('TYPESCRIPT_CHECK_SUPPRESSED');}
  const compilerIsolation=isolateRuntimeDependencies(mirror,dep,request,check.path,{config,sourcePaths:included});
  const options={...config.compilerOptions,rootDir:mirror,outDir:emitted,noEmit:false,noEmitOnError:true,sourceMap:true,inlineSources:true,declaration:false,declarationMap:false,emitDeclarationOnly:false,incremental:false,composite:false,rewriteRelativeImportExtensions:true};
  delete options.allowImportingTsExtensions;delete options.tsBuildInfoFile;delete options.mapRoot;delete options.sourceRoot;delete options.declarationDir;
  const generated=path.join(configDir,'.synk-typecheck-'+crypto.randomBytes(5).toString('hex')+'.json');
  write(generated,JSON.stringify({compilerOptions:options,files:included.map(rel=>path.join(mirror,rel))}));
  const compile=helpers.run(process.execPath,[compiler,'-p',generated,'--pretty','false'],mirror,env);if(compile.status!==0)fail('TYPESCRIPT_TYPECHECK_FAILED');
  for(const {path:rel}of prepared.candidateFiles)if(!/\.(?:[cm]?tsx?|jsx)$/.test(rel)){const target=path.join(emitted,rel);if(!fs.existsSync(target))write(target,fs.readFileSync(helpers.regular(prepared.candidateRoot,rel)));}
  for(const rel of testPaths)if(!fs.existsSync(path.join(emitted,rel)))fail('TYPESCRIPT_TEST_NOT_EMITTED');
  const runtimeIsolation=isolateRuntimeDependencies(emitted,dep,request,check.path);
  function emittedFingerprint(){const rows=[];function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(entry.isFile())rows.push([relative(emitted,file),hash(fs.readFileSync(file))]);else fail('VALIDATION_SYMLINK');}}walk(emitted);return hash(JSON.stringify(rows.sort((a,b)=>a[0].localeCompare(b[0]))));}
  const beforeEmit=emittedFingerprint();
  const output=helpers.run(process.execPath,['--test','--test-reporter=tap',...testPaths],emitted,{...env,NODE_V8_COVERAGE:coverage}),summary=passed(output,helpers);
  try{if(emittedFingerprint()!==beforeEmit)fail('CANDIDATE_CHANGED_DURING_VALIDATION');}catch{fail('CANDIDATE_CHANGED_DURING_VALIDATION');}
  const SourceMapConsumer=sourceMapRuntime().SourceMapConsumer,required=new Map(),testSet=new Set(testPaths);
  for(const change of typeChanges){
    if(testSet.has(change.path))continue;
    const text=fs.readFileSync(helpers.regular(prepared.candidateRoot,change.path),'utf8'),spans=helpers.changedLineSpans({prepared,change,text,evidence,env});
    const sourceStarts=lineStarts(text),sourceLines=new Set();for(const span of spans)for(let i=0;i<sourceStarts.length;i++)if(sourceStarts[i]<span.end&&(sourceStarts[i+1]??text.length)>span.start)sourceLines.add(i+1);
    const jsRel=change.path.replace(/\.(?:tsx|jsx|ts)$/i,'.js').replace(/\.mts$/i,'.mjs').replace(/\.cts$/i,'.cjs'),js=path.join(emitted,jsRel),mapFile=js+'.map';
    if(!fs.existsSync(js)||!fs.existsSync(mapFile))fail('TYPESCRIPT_EXECUTION_EVIDENCE_REQUIRED');
    const code=fs.readFileSync(js,'utf8'),starts=lineStarts(code),map=JSON.parse(fs.readFileSync(mapFile,'utf8')),consumer=new SourceMapConsumer(map),mapped=[],seen=new Set();
    consumer.eachMapping(item=>{if(!item.source||!item.originalLine||!sourceLines.has(item.originalLine))return;
      const absolute=path.resolve(path.dirname(mapFile),map.sourceRoot||'',item.source);
      if(path.resolve(absolute)!==path.resolve(mirror,change.path))return;
      const start=(starts[item.generatedLine-1]??-1)+item.generatedColumn;if(start<0||start>=code.length)return;
      mapped.push({start,end:start+1});seen.add(item.originalLine);
    });
    if(consumer.destroy)consumer.destroy();
    // Type-only/comment lines have no executable mapping. The actual typecheck
    // proves them; at least one changed executable line must still be exercised.
    if(!mapped.length)fail('TYPESCRIPT_EXECUTION_EVIDENCE_REQUIRED');
    required.set(jsRel,mapped);
  }
  const found=helpers.coveredFiles(coverage,emitted,required);for(const rel of required.keys())if(!found.has(rel))fail('CHANGED_CODE_NOT_EXERCISED');
  return {checks:[{kind:'typescript',path:check.path,passed:true,compilerVersion:dep.version,typecheckedFiles:included.length,compilerIsolation,runtimeIsolation,tests:testPaths,...summary,changedCodeExercised:typeChanges.filter(x=>!testSet.has(x.path)).map(x=>x.path)}],validatedPaths:[check.path,...typeChanges.map(x=>x.path)]};
}
async function validateData(ctx){
  const checks=[],validatedPaths=[];
  for(const check of ctx.report.checks.filter(x=>['typescript','json_schema'].includes(x.kind))){const result=check.kind==='typescript'?await validateTypeScript(ctx,check):await validateJSON(ctx,check);checks.push(...result.checks);validatedPaths.push(...result.validatedPaths);}
  return {checks,validatedPaths:[...new Set(validatedPaths)]};
}
installConsumptionProbe();
module.exports={validateData,changedPointers,installConsumptionProbe};

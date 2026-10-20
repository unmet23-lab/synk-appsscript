// 트렌드·레퍼런스·제작 데스크 글 바꾸기 적용기.
// node apply.cjs <회사 폴더> <map.txt|map.json…> [--check] [--tests] [--json <폴더>] [--verbose]
//
// 짝 파일(.txt) 형식 — 한 줄에 하나, 앞 글자로 구분한다(줄 끝 공백도 글의 일부다):
//   ## <회사 폴더 기준 경로>   이후 짝이 들어갈 파일. "## tests"는 화면 짝과 함께 시험 파일에만 넣을 짝.
//   =<숫자>                   다음 짝이 그 파일에 정확히 몇 번 나와야 하는지(없으면 1번 이상).
//   -<옛 문장>                 바꿀 글
//   +<새 문장>                 바뀐 글(바로 앞 - 줄과 짝)
//   # …                        설명(무시)
// .json 짝 파일은 --json이 만든 기록 그대로({"<경로>":[["옛","새",{"n":개수}],…]})를 읽는다.
// - 짝 파일은 넘긴 순서대로 하나씩 넣는다(뒤 짝 파일이 앞 짝 파일의 새 문장을 다시 다듬을 수 있다).
// - 한 짝 파일 안에서는 긴 문장부터 바꾼다. 짝은 그 파일에서 1번 이상(또는 정확히 n번) 나와야 한다.
//   0번인데 새 문장이 이미 있으면 「이미 바뀜」으로 넘긴다. 맞는 짝은 넣고 안 맞는 짝만 알린다(파일을 건너뛰지 않는다).
// - --tests: 화면 짝(public/*.js)과 "tests" 짝을 그 화면 파일을 읽는 회사 시험 파일에만 넣는다(없어도 됨).
// - 줄 끝(CRLF)은 건드리지 않는다. 임시 파일에 쓰고 바꿔 넣는다. 거꾸로(새→옛) 돌리는 기능은 두지 않는다.
// - --check는 파일을 쓰지 않으므로 여러 짝 파일을 넘기면 뒤 짝 파일은 앞 짝이 들어가기 전 판을 본다.
// - --json <폴더>: .txt 짝 파일마다 같은 이름의 .json(옛→새 짝 기록)을 쓴다.
'use strict';
const fs=require('fs'),path=require('path');
const args=process.argv.slice(2);
const root=path.resolve(args[0]);
const flag=name=>args.includes(name);
const jsonIndex=args.indexOf('--json'),jsonDir=jsonIndex>=0?path.resolve(args[jsonIndex+1]):null;
const maps=args.slice(1).filter((a,i,all)=>/\.(txt|json)$/.test(a)&&all[i-1]!=='--json');
const check=flag('--check'),tests=flag('--tests'),verbose=flag('--verbose');
function parse(file){
  if(file.endsWith('.json'))return JSON.parse(fs.readFileSync(file,'utf8'));
  const lines=fs.readFileSync(file,'utf8').replace(/^﻿/,'').split(/\r?\n/);const result={};let key=null,count,old=null;
  lines.forEach((line,index)=>{
    if(line.startsWith('## ')){key=line.slice(3).trim();old=null;count=undefined;return;}
    if(!line||line.startsWith('# '))return;
    if(/^=\d+$/.test(line)){count=Number(line.slice(1));return;}
    if(line.startsWith('-')){if(old!==null)throw new Error(`${path.basename(file)}:${index+1} 짝 없는 - 줄`);old=line.slice(1);return;}
    if(line.startsWith('+')){if(old===null||!key)throw new Error(`${path.basename(file)}:${index+1} 앞 - 줄 없음`);(result[key]||=[]).push([old,line.slice(1),...(count===undefined?[]:[{n:count}])]);old=null;count=undefined;return;}
    throw new Error(`${path.basename(file)}:${index+1} 모르는 줄: ${line.slice(0,40)}`);
  });
  if(old!==null)throw new Error(`${path.basename(file)} 끝에 짝 없는 - 줄`);
  return result;
}
const sortPairs=pairs=>[...pairs].sort((x,y)=>y[0].length-x[0].length);
function applyTo(file,pairs,strict,src){
  let s=fs.readFileSync(file,'utf8');const before=s,notes=[],counts=[];let hits=0;
  for(const [a,b,opts={}] of sortPairs(pairs)){
    if(a===b)continue;
    const n=s.split(a).length-1;
    if(strict){
      if(n===0){if(b&&s.includes(b)){counts.push(`이미 ${a.slice(0,50)}`);continue;}notes.push(`0곳 — ${a.slice(0,110)} (${src})`);continue;}
      if(opts.n!==undefined&&n!==opts.n){notes.push(`${n}곳(기대 ${opts.n}) — ${a.slice(0,110)} (${src})`);continue;}
    }
    if(n){s=s.split(a).join(b);hits+=n;if(verbose)counts.push(`${n} × ${a.slice(0,60)}`);}
  }
  const changed=s!==before;
  if(changed&&!check){const t=file+'.tmp-'+process.pid;fs.writeFileSync(t,s);fs.renameSync(t,file);}
  return {changed,notes,hits,counts};
}
let problems=0,touched=0;
for(const mapFile of maps){
  const map=parse(mapFile),src=path.basename(mapFile);
  if(jsonDir&&mapFile.endsWith('.txt')){fs.mkdirSync(jsonDir,{recursive:true});fs.writeFileSync(path.join(jsonDir,path.basename(mapFile,'.txt')+'.json'),JSON.stringify(map,null,1)+'\n');}
  for(const [rel,pairs] of Object.entries(map)){
    if(rel==='tests')continue;
    const file=path.join(root,rel);
    if(!fs.existsSync(file)){console.log('없음',rel,`(${src})`);problems++;continue;}
    const r=applyTo(file,pairs,true,src);
    if(r.notes.length){problems+=r.notes.length;console.log('!!',rel);for(const n of r.notes)console.log('   ',n);}
    if(verbose)for(const c of r.counts)console.log('    ·',c);
    if(r.changed){touched++;console.log((check?'바꿀 예정':'바꿈').padEnd(6),rel,r.hits+'곳',`(${src})`);}
  }
  if(tests){
    const screens=Object.keys(map).filter(rel=>/^public\/[^/]+\.js$/.test(rel));
    const all=[...screens.flatMap(rel=>map[rel]),...(map.tests||[])];
    if(!all.length)continue;
    for(const f of fs.readdirSync(root).filter(f=>/\.test\.mjs$/.test(f))){
      const file=path.join(root,f),text=fs.readFileSync(file,'utf8');
      if(!screens.some(rel=>text.includes(path.basename(rel)))&&!(map.tests||[]).some(([a])=>text.includes(a)))continue;
      const r=applyTo(file,all,false,src);
      if(r.changed){touched++;console.log((check?'시험 예정':'시험 바꿈').padEnd(6),f,r.hits+'곳',`(${src})`);}
    }
  }
}
console.log('파일',touched,'문제',problems);
if(problems)process.exitCode=1;

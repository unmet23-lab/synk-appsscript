'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../../..');
const records=[];
const agentFiles=new Set(['docs/엔진8종_상향설계_v3.md','docs/아틀라스_설계.md','docs/아틀라스_구현명세.md','docs/Strata_설계.md','docs/코어엔진_설계.md']);
const list=cp.execFileSync('rg',['--files','--hidden','docs'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/).map(p=>p.replaceAll('\\','/'));
function write(p,before,after){if(before===after)return;fs.writeFileSync(path.join(root,p),after);records.push(p);}
function pathOnly(s){return s.replace(/https?:\/\/[^\s<>"')]+|엔진7종_상향설계_v3\.md/g,m=>m.startsWith('http')?m:'엔진8종_상향설계_v3.md');}
for(const p of list){
 if(agentFiles.has(p)||p==='docs/엔진7종_상향설계_v3.md'||/^docs\/(?:_ops|reviews)\//.test(p)||! /\.(?:md|txt|json|html|js|cjs|mjs|yml|yaml)$/.test(p))continue;
 if(p==='docs/SYNK_기억그물.html'||p.includes('/미리보기/')||p.includes('/registration-'))continue;
 const before=fs.readFileSync(path.join(root,p),'utf8');
 write(p,before,pathOnly(before));
}
const countFiles=[
 'docs/Reed_설계_v0.1.md','docs/교실수집_목표왕복_설계_v1.md','docs/가져가는것_설계_v1.md','docs/Temper_개입로그_규격_v1.md','docs/Loom_엔진_설계.md','docs/시즌회고_설계.md','docs/엔진/README.md',
 'docs/정본/SYNK/SYNK 기업소개서.txt','docs/정본/SYNK/SYNK 기업마스터.txt','docs/정본/SYNK 보안/SYNK_사업계획서.txt','docs/정본/SYNK/SYNK 한국어 회화 AI 가이드라인.txt','docs/정본/SYNK LAB/SYNK LAB 상세서.txt','docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/05_운영_시스템.txt','docs/정본/SYNK LAB/About Syestem/SYNK_리라이팅_v2/04_SYNK_크루_핸드북.txt',
 ...list.filter(p=>p.startsWith('docs/엔진/_원고/')&&p.endsWith('.html'))
];
for(const p of countFiles){const before=fs.readFileSync(path.join(root,p),'utf8');const after=before.replace(/엔진 7종/g,'엔진 8종').replace(/일곱 엔진/g,'여덟 엔진').replace(/엔진 일곱/g,'엔진 여덟').replace(/일곱 개의 엔진/g,'여덟 개의 엔진').replace(/엔진은 일곱/g,'엔진은 여덟').replace(/소개서 6벌/g,'소개서 8벌');write(p,before,after);}
function exact(p,old,replacement){const before=fs.readFileSync(path.join(root,p),'utf8');if(!before.includes(old))throw Error('Expected text missing: '+p+' '+old.slice(0,80));write(p,before,before.replaceAll(old,replacement));}
exact('docs/앱재설계_재기_0905.md','[엔진 7종과 담당 정본]','[엔진 8종과 담당 정본]');
exact('docs/엔진/지도_20260921/data-prism-strata.json','상세 설계를 참조하되 문서명의 7종을 현재 엔진 수로 읽지 않음.','8종 기준 상세 설계에서 Prism의 역할과 구현 경계를 확인합니다.');
exact('docs/엔진/지도_20260921/README.md','이전 7개 엔진 소개서와 표지는 보존했다.','기존 소개서와 표지를 이어 쓰며 2026-09-21에 Strata 소개서를 추가해 8종 안내로 맞췄다.');
fs.writeFileSync(path.join(__dirname,'변경파일-root.json'),JSON.stringify([...new Set(records)],null,2)+'\n');
console.log(JSON.stringify({changed:[...new Set(records)].length,files:[...new Set(records)]}));

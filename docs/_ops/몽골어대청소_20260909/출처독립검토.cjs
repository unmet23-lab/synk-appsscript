'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const load = file => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
const inventory = load('조각과문맥.json');
const korean = new Map(load('한국어짝.json').map(row => [row.id, row.koreanRows]));
const verdicts = load('출처정밀결과.json').reviews;
verdicts.push({id:'0078',decision:'correct',reasonKo:'HW123 기본형 сурах бичиг의 출처 오역 추가 확인.',newText:'Дуудлага нь төстэй хос үгийг (달/딸 гэх мэт) толь бичгээс эсвэл өнөөдөр уншсан эх бичвэрээсээ олж, ялгааг нь тэмдэглээрэй.'});
const candidates = verdicts.filter(row=>row.decision==='correct').map(verdict=>{
  const old = inventory.find(row=>row.id===verdict.id);
  return {id:old.id,oldText:old.text,newText:verdict.newText,locations:old.locations,koreanRows:korean.get(old.id),parallelKorean:[],reasons:[verdict.reasonKo],evidence:['출처정밀결과.json']};
});
fs.writeFileSync(path.join(__dirname,'출처교정후보.json'), JSON.stringify(candidates,null,2)+'\n');
const data = candidates.map(row=>({id:row.id,mn:row.newText,ko:row.koreanRows.map(row=>row.source)}));
const prompt = `몽골어 숙제 ${data.length}개 새 번역의 독립 최종 검토. 한국어 ko가 최신 과제 조건이며 '교재'가 아니라 '오늘 읽은 글/오늘 배운 문장/이번 주 배운 글'에서 재료를 고르게 바뀌었습니다. mn은 새 교정문입니다. 이전 평가/설명은 주지 않습니다. 한국어가 요구하는 자료 출처·시간·횟수·숫자·필수/선택·행동이 빠짐없이 맞는지와 몽골어 자연스러움을 직접 확인하세요. 새 숙제 요구를 추가하거나 원문을 재기획하지 마세요. 한국어 학습 예문은 그대로 둡니다. 파일/도구/검색 없이 이 자료만 읽습니다. JSON만: {"reviews":[{"id":"...","decision":"accept|revise|uncertain","reasonKo":"실제 판정 근거","newText":"revise일 때 완전한 새 문구"}]} 모든 ${data.length}개 실제 ID마다 답하고 예시 마커나 요약으로 완료 처리하지 마세요.\n자료:\n${JSON.stringify(data)}`;
const child = spawn('C:/Users/q1212/.local/bin/claude.exe', ['-p','--output-format','json','--model','opus','--effort','high','--tools','','--disable-slash-commands'], {cwd:root,windowsHide:true,stdio:['pipe','pipe','pipe']});
let stdout='',stderr=''; child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
child.stdout.on('data',v=>stdout+=v);child.stderr.on('data',v=>stderr+=v);child.stdin.end(prompt);
console.log(`출처 독립 ${data.length}개 시작`);
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('close',code=>{
  fs.writeFileSync(path.join(__dirname,'출처독립응답.json'),stdout); fs.writeFileSync(path.join(__dirname,'출처독립응답.stderr.txt'),stderr);
  try {
    const envelope=JSON.parse(stdout);if(code!==0||envelope.is_error)throw new Error('호출 실패');
    const result=JSON.parse(envelope.result.replace(/^\s*```(?:json)?\s*/,'').replace(/\s*```\s*$/,''));
    if(result.reviews.length!==data.length||new Set(result.reviews.map(row=>row.id)).size!==data.length||data.some(row=>!result.reviews.some(verdict=>verdict.id===row.id)))throw new Error('누락된 ID');
    fs.writeFileSync(path.join(__dirname,'출처독립결과.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
  }catch(error){console.error(error.message);process.exitCode=1;}
});

'use strict';
const fs=require('node:fs'),path=require('node:path');
const {base,put,hash}=require('./revise-01-voice.cjs');
const policy=require('../../../tools/모델정책.js');
async function main(){
 const mode=process.argv[2];const sources=[];let parts;
 if(mode==='audio'){
  const prompt='두 한국어 합성음성 후보를 실제 첨부 오디오로 비교하십시오. 사용자는 이전의 낮고 차분한 여성 음성 둘을 기각했고 밝고 명랑하거나 상큼한 성인 여성의 자연스러운 대화 예문을 원합니다. 제공한 A/B를 각각 들리는 대로 받아쓰고, 억양/단어 끊기/기계적 질감/과장된 발성/밝은 여성 음색 적합성을 구체적으로 관찰하십시오. 절대적 음량은 정규화해서 비교했으므로 원본보다 작다는 주장은 하지 마십시오. 판별 불가능하면 그렇게 쓰십시오. 단순 받아쓰기 정확도를 듣기 좋은 목소리의 증거로 삼지 마십시오. 추천이 있다면 짧은 근거와 한계를 쓰십시오. 이것은 AI 청각 분석이며 사람의 청취나 사용자의 선호 확정이 아닙니다. 한국어로 답하십시오.';
  parts=[{text:prompt}];for(const [name,file] of [['A','bright-sample.mp3'],['B','fresh-sample.mp3']]){const p=path.join(base,file),data=fs.readFileSync(p);sources.push({name,file,sha256:hash(data)});parts.push({text:name},{inlineData:{mimeType:'audio/mp3',data:data.toString('base64')}})}
 }else if(mode==='studio'){
  parts=[{text:'한국어 여성 목소리 세 오디오의 녹음 질감을 직접 비교하십시오. 사용자는 첫 파일의 밝고 상큼한 톤은 좋지만 얇고 거칠고 디지털로 깨지는 듯한 음질을 싫어하며, 풍부하고 선명한 고급 스튜디오 같은 목소리를 원합니다. 세 파일을 실제로 들을 수 있는 범위에서만 각각 전사하고, 목소리의 자연스러움·매끈함·몸통의 풍부함·거친 금속성이나 떨림·자음·말끝에 대해 구체 차이를 쓰십시오. 파일 사양이나 전사 정확도를 고음질 근거로 대신하지 마십시오. 차이가 작거나 판별 불가면 그대로 말하십시오. 어떤 파일이 목적에 가까운지와 그 한계를 한국어로 답하십시오. 사람 검수가 아니라 AI 오디오 분석입니다.'}];
  for(const [name,file] of [['old','freshpolish-normalized.wav'],['ref','studio-reference.wav'],['new','studio-clean.wav']]){const p=path.join(base,file),data=fs.readFileSync(p);sources.push({name,file,sha256:hash(data)});parts.push({text:name},{inlineData:{mimeType:'audio/wav',data:data.toString('base64')}})}
 }else if(mode==='language'){
  const p=path.join(__dirname,'원고/video.json'),data=fs.readFileSync(p),item=JSON.parse(data.toString()).items.find(x=>x.id==='01-lab-youtube');sources.push({file:'원고/video.json',sha256:hash(data)});
  parts=[{text:'한국어-몽골어 학생 콘텐츠 독립 대조입니다. 사용자는 첫 영상에서 연습과 라디오가 갑자기 바뀌는 문제를 지적했고, 이제 같은 노래를 권하는 대화 뒤 그 곡이 실제로 재생되도록 연결합니다. 몽골 10대 후반 대상이며 쉬운 언어지만 유아적 말투는 피합니다. 첨부 원고의 title/thumbnail/slides/scenes/caption/captionKo를 읽고 몽골어 문법·자연스러움·한국어 예문 뜻과의 불일치를 확인하십시오. 한국어 뜻도 판단용입니다. 구체 오류만 JSON {issues:[{field,original,replacement,reasonKo,severity}],summaryKo:string}로 제시하십시오. 음악에 한국어 향상/집중 효과를 약속하지 않습니다. 실제 학생 대화로 주장하지 않습니다. 원고 전체를 불필요하게 다시 쓰지 마십시오. 이것은 AI 검토이며 사람 원어민 감수가 아닙니다.\n\n'+JSON.stringify(item)}];
 }else throw Error('Use audio or language');
 const pick=policy.제미나이설정();if(!policy.제미나이키('글'))throw Error('Configured free route unavailable; no paid fallback');
 const response=await fetch(policy.제미나이URL('글',pick.model),{method:'POST',headers:await policy.제미나이헤더('글'),body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{thinkingConfig:{thinkingLevel:pick.thinking_level||'high'}}}),signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error('Review HTTP '+response.status);
 const result=await response.json(),answer=result.candidates?.[0]?.content?.parts?.filter(p=>p.text).map(p=>p.text).join('\n');if(!answer)throw Error('Empty review');
 put(path.join(base,mode+'-review.json'),JSON.stringify({createdAt:new Date().toISOString(),route:'explicit free route',requestedModel:pick.model,modelVersion:result.modelVersion,sources,answer,humanReview:false},null,2));
 put(path.join(base,mode+'-review.md'),answer);console.log(answer);
}
main().catch(e=>{console.error(e.message);process.exitCode=1});

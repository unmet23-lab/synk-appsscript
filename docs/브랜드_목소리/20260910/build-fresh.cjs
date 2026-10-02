'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {page}=require('./build-listening-page.cjs');
const read=file=>JSON.parse(fs.readFileSync(path.join(__dirname,file),'utf8'));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const old=read('data.json');
const specifications=[
 ['qwen-fresh-sparkle','A','Qwen3-TTS VoiceDesign 1.7B','새 음색 설계: 밝게 웃는 중고음, 매끈한 울림, 가벼운 말끝.'],
 ['qwen-fresh-sunshine','B','Qwen3-TTS VoiceDesign 1.7B','별도 새 음색 설계: 둥근 모음과 공명, 편안한 자신감.'],
 ['qwen-sohee-sparkle','C','Qwen3-TTS CustomVoice 1.7B · Sohee','기존 05 화자. 새 한국어 연기 지시로 말끝의 에너지 유지.'],
 ['moss8-fresh-sparkle','D','MOSS-TTS v1.5 8B','새 A의 합성 음원을 참조. 처음 시험하는 8B 모델이며 출력은 24kHz.'],
 ['moss-nano-fresh','E','MOSS-TTS-Nano-100M','새 A의 합성 음원을 참조. 원래 출력이 48kHz인 별도 모델.'],
 ['chatterbox-fresh','F','Chatterbox Multilingual V3','새 A의 합성 음원을 참조. 다른 모델의 발음 질감과 말끝 비교.'],
];
const checks=[];
const samples=specifications.map(([id,letter,model,notes])=>{
 const manifest=read(`실험/${id}/manifest.json`),qa=read(`실험/${id}/inspection.json`);
 if(manifest.status!=='completed'||hash(qa.rawFile)!==qa.rawSha256||hash(qa.listenFile)!==qa.listenSha256||qa.characterSimilarity!==1)throw Error('Unverified sample '+id);
 if(Math.abs(Number(qa.listenLoudness.input_i)+23)>.1||Number(qa.listenLoudness.input_tp)>-3)throw Error('Invalid audio balance '+id);
 checks.push({id,label:`새 ${letter}`,duration:Number(qa.probe.format.duration),nativeSampleRate:Number(qa.probe.streams[0].sample_rate),sourceBits:qa.probe.streams[0].bits_per_sample,actual:qa.actual,characterSimilarity:qa.characterSimilarity,LUFS:Number(qa.listenLoudness.input_i),truePeak:Number(qa.listenLoudness.input_tp),rawSha256:qa.rawSha256,listenSha256:qa.listenSha256,reference:manifest.reference||null});
 return {id,blindLabel:`새 ${letter}`,label:`새 ${letter} · ${model}`,model,provider:manifest.space+' 공식 데모',notes,file:`실험/${id}/listen.wav`,duration:Number(qa.probe.format.duration),text:manifest.text,scriptLabel:'같은 문장, 새 비교본 6개'};
});
for(const [id,num] of [['qwen-design','01'],['qwen-sohee','05']]){
 const sample=old.samples.find(s=>s.id===id);if(!sample)throw Error('Missing baseline '+id);
 samples.push({...sample,blindLabel:`기존 ${num}`,label:`기존 ${num} · ${sample.model}`,notes:'첫 비교에서 만든 동일 파일. 새 A~F와 비교하는 기준 음원.'});
}
const modelNames=['Qwen3-TTS 1.7B','MOSS-TTS 8B v1.5','MOSS-TTS-Nano-100M','Chatterbox Multilingual V3'];
const models=modelNames.map(name=>{
 const original=old.models.find(m=>m.name===name);if(!original)throw Error('Missing researched model '+name);
 return {...original,status:name.startsWith('Qwen')?'새 3개 생성 완료':'새 참조 음색으로 생성 완료'};
});
models.push({name:'Humelo DIVE · 나나',korean:'한국어 Arena 전체 1위 (참가 10모델)',commercial:'상용 서비스 조건 확인 필요',fixedVoice:'나나 프리셋',status:'공식 체험 생성 실패: 크레딧 부족',url:'https://console.humelo.com/playground?tab=dive',notes:'청년 여성 · 중고음. 동일 대본 비교 파일 없음.'},
 {name:'Typecast v3 · 자인',korean:'한국어 Arena 전체 2위 (참가 10모델)',commercial:'상용 서비스 조건 확인 필요',fixedVoice:'자인 프리셋',status:'음색 목록 로그인 필요; 파일 생성 미확인',url:'https://typecast.ai/kr/',notes:'공식 첫 화면 기쁨 주하는 별도 음색. 순위 전이 금지.'},
 {name:'VoxCPM2',korean:'공식 지원; 한국어 포함 연구 확인',commercial:'공개 코드·가중치 Apache-2.0',fixedVoice:'음색 설계·참조 음성',status:'공식 데모 대기열 포화; 로컬 실행 미완료',url:'https://github.com/OpenBMB/VoxCPM',notes:'48kHz. 새 청취 파일 확보하지 못함.'},
 {name:'Breeze-TTS-2',korean:'영어·중국어만 공식 지원',commercial:'가중치 비상업 조건',fixedVoice:'음색 설계·참조 음성',status:'한국어 브랜드 후보 제외',url:'https://huggingface.co/BreezeBlue/Breeze-TTS-2',notes:'글로벌 순위와 한국어 품질을 구별.'});
const report=fs.readFileSync(path.join(__dirname,'상큼한_재조사.md'),'utf8');
const data={createdAt:new Date().toISOString(),summary:'상큼한 말끝과 풍부한 음질을 찾는 두 번째 비교입니다. 새 A~F는 같은 대본으로 만들었고, 기존 01·05를 기준 음원으로 함께 두었습니다.',scope:'실제 생성 6개 · 기존 기준 2개. 체감 음량을 동일하게 맞추고 원래 음질을 보존했습니다. 모델명은 처음에 가립니다. 한국어 평가 상위 서비스 2곳은 별도로 안내합니다.',samples,models,sources:[
 {title:'한국어 TTS Arena — 공개 전체 순위',url:'https://channelcorp-ko-tts-arena.hf.space/leaderboard',note:'2026-09-10 직접 조회. 나나 1686, 자인 1637. 10개 참가 모델에 한정.'},
 {title:'한국어 TTS Arena — 평가 방식·운영·음원 조건',url:'https://channelcorp-ko-tts-arena.hf.space/about'},
 {title:'VoxCPM2 기술 보고서 — 청취 평가 §4.7',url:'https://arxiv.org/html/2606.06928v1'},
 {title:'한국어 추가 학습의 독립 청취 평가',url:'https://arxiv.org/html/2606.26618v1'},
 {title:'MOSS-TTS v1.5 8B 공식 모델',url:'https://huggingface.co/OpenMOSS-Team/MOSS-TTS-v1.5'},
 {title:'나나 공식 소개·예시 음성',url:'https://humelo.com/swcc2026'},
 {title:'타입캐스트 공식 체험·평가 소개',url:'https://typecast.ai/kr/'},
],reportMarkdown:report};
let html=page(data).replace('<title>목소리 비교 · SYNK</title>','<title>상큼한 목소리 · 새 A–F 비교 · SYNK</title>').replace('<h1>이름보다, 소리부터.</h1>','<h1>목소리에, 생기를 더.</h1>');
const refs=`<section class="reference-section" aria-labelledby="reference-heading"><div><p class="script-label">한국어 청취 평가에서 새로 찾은 후보</p><h2 id="reference-heading">나나, 그리고 자인.</h2><p class="reference-intro">공개 한국어 Arena의 참가 10모델 중 전체 1·2위입니다. 상큼함만의 순위는 아니지만, 함께 들어볼 근거가 있는 후보입니다. <a href="https://channelcorp-ko-tts-arena.hf.space/leaderboard" target="_blank" rel="noreferrer">평가 원문</a></p></div><div class="reference-list"><article><h3>Humelo DIVE · 나나</h3><p>밝고 또렷한 청년 여성 중고음. 이번 취향에 맞을 가능성이 있어 먼저 권합니다.</p><a href="https://humelo.com/swcc2026" target="_blank" rel="noreferrer">공식 페이지의 ‘나나’ 예시 듣기 ↗</a><small>같은 대본의 무료 체험은 크레딧 부족으로 실패했습니다.</small></article><article><h3>Typecast · 자인 / 주하</h3><p>평가 2위는 자인. 공식 첫 화면의 ‘기쁨 주하’도 밝은 연기 방향을 볼 별도 후보입니다.</p><a href="https://typecast.ai/kr/" target="_blank" rel="noreferrer">공식 체험·음색 보기 ↗</a><small>음색 목록은 로그인 필요. 동일 대본 파일은 확보하지 못했습니다.</small></article></div><p class="reference-foot">아래 새 A~F는 직접 생성한 공개 모델 비교본입니다. 위 두 서비스의 음성은 포함되어 있지 않습니다.</p></section>`;
html=html.replace('<div id="listening">',refs+'<div id="listening">').replace('<a href="#listening">청취</a>','<a href="#listening">새 A~F 듣기</a><a href="상큼한_음원_6개.zip" download>6개 한 번에 받기</a><a href="index.html">기존 10개</a>');
html=html.replace('</style>','\n.reference-section{padding:36px 0;border-bottom:1px solid var(--synk-stone)}.reference-intro{max-width:850px;margin-top:16px}.reference-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px;margin-top:24px}.reference-list article{padding:22px;border:1px solid var(--synk-stone);border-radius:14px}.reference-list p{margin:10px 0 12px;font-size:15px}.reference-list a{display:inline-flex;align-items:center;min-height:44px;font-size:14px}.reference-list small{display:block;color:var(--synk-deep-wool);margin-top:8px;word-break:keep-all}.reference-foot{margin-top:20px;font-size:14px;color:var(--synk-deep-wool)}.jump{flex-wrap:wrap;gap:12px 18px}@media(max-width:680px){.reference-list{grid-template-columns:1fr;gap:16px}.reference-section{padding:30px 0}.reference-list article{padding:18px}}\n</style>');
fs.writeFileSync(path.join(__dirname,'상큼한_비교.html'),html);
fs.writeFileSync(path.join(__dirname,'상큼한_데이터.json'),JSON.stringify(data,null,2));
fs.writeFileSync(path.join(__dirname,'검증/상큼한_음성검사.json'),JSON.stringify({checkedAt:new Date().toISOString(),status:'passed',samples:checks,humanListening:false,processing:'Fixed gain only. No resampling, EQ, compression, denoising, speed or silence edits.',baselineDataSha256:hash(path.join(__dirname,'data.json')),originalIndexSha256:hash(path.join(__dirname,'index.html'))},null,2));
console.log(JSON.stringify({output:path.join(__dirname,'상큼한_비교.html'),newSamples:checks.length,totalPlayers:samples.length,modelRows:models.length,checks:checks.map(({label,nativeSampleRate,duration,LUFS,truePeak})=>({label,nativeSampleRate,duration,LUFS,truePeak}))},null,2));

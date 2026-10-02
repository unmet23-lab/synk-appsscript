'use strict';
const fs=require('node:fs'),path=require('node:path');
const base=__dirname,read=p=>JSON.parse(fs.readFileSync(path.join(base,p),'utf8').replace(/^\uFEFF/,''));
// These are source-supported review items, not an auditory ranking.
const rows=[
 ['Qwen3-TTS 1.7B','공식 지원','코드·가중치 Apache-2.0','Sohee ID / 설계 원본을 Base 참조로 재사용','2개 음원 생성','https://github.com/QwenLM/Qwen3-TTS','24kHz. VoiceDesign·CustomVoice·Base 기능 구분'],
 ['VoxCPM2','공식 지원','코드·가중치 Apache-2.0','새 음색 설계 + 참조 재사용','공식 데모 대기열 포화 2회; 음원 없음','https://huggingface.co/openbmb/VoxCPM2','모델 48kHz. 공식 데모는 MP3 경로'],
 ['Chatterbox Multilingual V3','공식 지원','코드·가중치 MIT','참조 음색','동일 대본 생성','https://github.com/resemble-ai/chatterbox','24kHz. 새 가상 화자 참조 사용. Turbo 영어판과 구분'],
 ['MOSS-TTS-Nano-100M','공식 지원','코드·가중치 Apache-2.0','참조 음색','동일 대본 생성','https://huggingface.co/OpenMOSS-Team/MOSS-TTS-Nano-100M','48kHz. 같은 Qwen 가상 화자 참조 사용'],
 ['Magpie 357M v2607','2026-07 추가','코드 Apache-2.0 / NVIDIA Open Model License','Aria 등 고정 5명','Aria 동일 대본 생성','https://huggingface.co/nvidia/magpie_tts_multilingual_357m','22.05kHz. 현행판은 참조 복제 제거'],
 ['Supertonic 3','공식 지원','코드 MIT / OpenRAIL-M; 합성 고지 등 조건','고정 F1–F5·M1–M5','이 PC에서 여성 5개 생성','https://github.com/supertone-oss-archive/supertonic','44.1kHz. 2026-09-09 개발·지원 종료 공지'],
 ['MOSS Local-Transformer v1.5','공식 지원','코드·가중치 Apache-2.0','참조 음색','공식 자료 확인; 생성 안 함','https://huggingface.co/OpenMOSS-Team/MOSS-TTS-Local-Transformer-v1.5','48kHz stereo. 본체+codec 가중치 약17.6GB'],
 ['MOSS-TTS 8B v1.5','공식 지원','코드·가중치 Apache-2.0','참조 음색·이어말하기','공식 Space 설정 확인; 생성 안 함','https://huggingface.co/OpenMOSS-Team/MOSS-TTS-v1.5','24kHz. Local 48kHz판과 구분'],
 ['MOSS-VoiceGenerator','영·중만 명시','코드·가중치 Apache-2.0','설명문으로 새 음색','한국어 직접 후보 후순위','https://huggingface.co/OpenMOSS-Team/MOSS-VoiceGenerator','24kHz. MOSS-TTS의 한국어 지원을 전이하지 않음'],
 ['ZONOS2','Tier 2','코드 MIT / 가중치 Apache-2.0','화자 임베딩 저장','무료 실제 생성 미확인','https://github.com/Zyphra/ZONOS2','44.1kHz. 감정·속도 제어; 한국어 소리 미검증'],
 ['Fun-CosyVoice3 0.5B-2512','공식 지원','코드·가중치 Apache-2.0','참조 음색 + 표현 지시','공식 자료 확인; 생성 안 함','https://huggingface.co/FunAudioLLM/Fun-CosyVoice3-0.5B-2512','24kHz. 공개0.5B와 논문1.5B 결과 구분'],
 ['Audio8 Preview 0.6B','공식 지원','코드·가중치 Apache-2.0 표기','참조 복제 / 참조 없이 생성','공식 Space PAUSED; 생성 안 함','https://huggingface.co/Edge0/Audio8-TTS-Preview-0.6b','44.1kHz. Windows ONNX 경로 공개; 실제 품질 미검증'],
 ['GPT-SoVITS v4 / v2Pro','공식 지원','코드 MIT; 사용할 정확한 가중치·참조 권리 추가 특정','참조 복제·추가 학습','공식 버전 안내 확인; 생성 안 함','https://github.com/RVC-Boss/GPT-SoVITS','v4 원생성48kHz. v2Pro와 출력·구조 혼동 금지'],
 ['MeloTTS Korean','공식 한국어판','코드·모델 카드 MIT','한국어 기본 화자','공식 자료 확인; 생성 안 함','https://huggingface.co/myshell-ai/MeloTTS-Korean','로컬 실행 비교 기준. 자유로운 감정 설계 후보와 구분'],
 ['Kani-TTS 400M Korean','공식 한국어판','카드 LFM 조건과 본문 Apache 표기 상충; 확정 보류','선택한 모델 기능 추가 확인','문서 불일치 확인; 생성 안 함','https://huggingface.co/nineninesix/kani-tts-400m-ko','22kHz 표기. Kani 2 영어판 기능을 그대로 적용하지 않음'],
 ['IndexTTS2 / 한국어 포크','한국어는 비공식 적응판','bilibili 조건 + 한국어 가중치·학습 자료 별도 확인','참조 음색·감정','공식판·한국어 포크 문서 확인','https://github.com/acidsound/index-tts-kr','한국어 tokenizer·48화자 학습 변경. 완성된 상업 한국어 화자로 미승인'],
 ['Bark','공식 예시 있음','코드·가중치 MIT','history preset','공식 자료 확인; 생성 안 함','https://github.com/suno-ai/bark','음악·효과음도 생성하는 모델. 대본 이탈 가능성 개발자 명시'],
 ['OmniVoice','한국어·몽골어 명시','코드 Apache-2.0 / 가중치 CC-BY-NC','참조 / 속성 설계','상업 브랜드 후보 보류','https://huggingface.co/k2-fsa/OmniVoice','24kHz. 음색 설계는 영·중 중심 학습'],
 ['Fish S2 Pro','한국어 Tier 2','Fish Audio Research License; 상업 별도 계약','참조 음색·표현 태그','무료 상업 후보 보류','https://huggingface.co/fishaudio/s2-pro','표현 태그 기능 확인. 한국어 청취 순위 미판정'],
 ['Boson Higgs TTS 3','한국어·몽골어 명시','Creator Use Grant 조건부 자사 콘텐츠; 앱/API 별도','참조 음색·표현 태그','권리 검토만; 생성 안 함','https://huggingface.co/bosonai/higgs-tts-3-4b','24kHz. Higgsfield와 별개. 눈에 띄는 Boson 출처 표시 조건'],
 ['F5-TTS','원판 영·중 중심; 한국어 파생 별도','코드 MIT / 기본 가중치 CC-BY-NC','참조 음색','무료 상업 후보 보류','https://github.com/SWivid/F5-TTS','한국어 포크 권리·완성도는 원판 허용과 별개'],
 ['XTTS-v2','공식 지원','가중치 CPML: 모델·출력 비상업 조건','참조 복제','무료 상업 후보 보류','https://huggingface.co/coqui/XTTS-v2/blob/main/LICENSE.txt','24kHz. 공개 코드와 출력 이용 조건을 분리'],
 ['OuteTTS 1.0 1B','공식 지원','Llama3.2 기반 + CC-BY-NC-SA','화자 프로필 저장','무료 상업 후보 보류','https://huggingface.co/OuteAI/Llama-OuteTTS-1.0-1B','한국어 지원과 상업 이용 가능성을 구분'],
 ['FireRedTTS2','공식 지원','Apache 표기와 복제의 학술 목적 안내가 공존; 해당 범위 확인','참조·대화 생성','공식 자료 확인; 채택 보류','https://huggingface.co/FireRedTeam/FireRedTTS2','24kHz. 긴 다화자 대화 기능'],
 ['VibeVoice 1.5B / Realtime0.5B','Realtime의 KR은 실험 화자','MIT 표기; 1.5B 카드 연구 목적 제한과 적용판 구분 필요','참조·실험 프리셋','공식 자료 확인; 채택 보류','https://github.com/microsoft/VibeVoice','ASR의 언어 수를 TTS 지원으로 인용하지 않음'],
 ['Kokoro 82M 기본판','공식 한국어 화자 미확인','코드·가중치 Apache-2.0','공식 화자 목록','한국어 우선 후보에서 제외','https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md','파생판의 ko 태그만으로 기본판 한국어 지원을 확정하지 않음'],
 ['Dia 1.6B / 0626','조사한 공식판 영어만','코드·가중치 Apache-2.0','참조·시드','한국어 우선 후보에서 제외','https://github.com/nari-labs/dia','개발팀 이름이 한국어인 것과 한국어 생성 지원은 별개'],
 ['TADA 3B multilingual','조사한 공식 언어 목록에 없음','코드 MIT / Llama3.2 Community 조건','참조 음색','한국어 우선 후보에서 제외','https://github.com/HumeAI/tada','ko 태그가 달린 파생 GGUF를 원 모델 지원 근거로 사용하지 않음'],
 ['Gwen-TTS 0.6B','목록 포함; 베트남어 최적화','MIT 표기; 기반 Qwen 조건 함께 확인','참조 음색','한국어 우선 후보 후순위','https://huggingface.co/g-group-ai-lab/gwen-tts-0.6B','베트남어 학습 파생판. 한국어가 원판보다 좋아졌다는 검증 없음'],
];
const models=rows.map(([name,korean,commercial,fixedVoice,status,url,notes])=>({name,korean,commercial,fixedVoice,status,url,notes}));
const ids=['qwen-design','chatterbox-v3','magpie-aria','moss-nano','qwen-sohee',...['F1','F2','F3','F4','F5'].map(x=>'supertonic3-'+x)];
const specs={
 'qwen-design':['Qwen3-TTS 1.7B VoiceDesign','Qwen 공식 HF 데모','설명문으로 새로 설계한 가상 화자. 아직 고정 화자 채택 전'],
 'chatterbox-v3':['Chatterbox Multilingual V3','Resemble AI 공식 HF 데모','후보 01의 새 가상 화자를 참조해 재생성. 독립 기본 화자 비교와 조건이 다름'],
 'magpie-aria':['Magpie v2607 · Aria','NVIDIA 공식 HF 데모','기본 여성 화자 Aria / Korean. 참조 음성 없음'],
 'moss-nano':['MOSS-TTS-Nano-100M','OpenMOSS 공식 HF 데모','후보 01의 새 가상 화자를 참조해 재생성. 원생성 48kHz'],
 'qwen-sohee':['Qwen3-TTS 1.7B CustomVoice · Sohee','Qwen 공식 HF 데모','기본 한국어 여성 Sohee에 같은 밝은 스타일 지시'],
};
for(const v of ['F1','F2','F3','F4','F5'])specs['supertonic3-'+v]=['Supertonic 3 · '+v,'이 컴퓨터에서 ONNX 실행','여성 고정 프리셋 '+v+' / speed 1 / steps 8 / seed 42'];
const inspections=read('조사/비교음성검사.json');
const samples=ids.map((id,i)=>{
 const x=inspections.find(v=>v.candidate===id);if(!x)throw Error('Missing inspection '+id);
 const [model,provider,notes]=specs[id],file=path.relative(base,x.listenFile).split(path.sep).join('/');
 if(!fs.existsSync(path.join(base,file)))throw Error('Missing audio '+id);
 return {id,label:'후보 '+String(i+1).padStart(2,'0')+' · '+model,model,provider,notes:notes+'\n음량만 조절. 자동 문장 검사는 청취 평가가 아닙니다.',file,duration:Number(x.probe.format.duration),text:x.expected,scriptLabel:'같은 문장, 다른 목소리',sampleRate:Number(x.probe.streams[0].sample_rate),gainDb:x.gainDb,lufs:Number(x.listenLoudness.input_i),truePeakDb:Number(x.listenLoudness.input_tp),rawSha256:x.rawSha256,listenSha256:x.listenSha256,characterSimilarity:x.characterSimilarity,humanListening:false,userApproved:false};
});
const escape=v=>String(v).replace(/\|/g,'/').replace(/\n/g,' ');
const sampleTable='| 후보 | 모델·화자 | 실제 길이 | 원본 표본/초 | 청취 음량 |\n|---|---|---:|---:|---:|\n'+samples.map((s,i)=>`| ${String(i+1).padStart(2,'0')} | ${s.model} | ${s.duration.toFixed(2)}초 | ${s.sampleRate.toLocaleString('en-US')}Hz | ${s.lufs.toFixed(2)} LUFS |`).join('\n');
const modelTable='| 모델·변형 | 한국어 | 사용 조건 | 재사용 | 이번 확인 |\n|---|---|---|---|---|\n'+models.map(m=>`| [${m.name}](${m.url}) | ${escape(m.korean)} | ${escape(m.commercial)} | ${escape(m.fixedVoice)} | ${escape(m.status)}. ${escape(m.notes)} |`).join('\n');
const exact=samples.filter(x=>x.characterSimilarity===1).length;
const result=`${samples.length}개 파일을 해독하고 길이·실제 출력 주파수·음량을 확인했다. 자동 받아쓰기는 공백·문장부호를 제외한 문자 기준으로 ${exact}/${samples.length}개가 입력과 일치했다. ${exact===samples.length?'뜻이 바뀐 문장이나 누락은 자동 검사에서 발견되지 않았다.':'일치하지 않은 후보는 세부 검사 기록의 전사와 실제 소리를 함께 확인해야 한다.'} 원본 대본을 받아쓰기 힌트로 넣지 않았다.`;
const report=fs.readFileSync(path.join(base,'report-body.md'),'utf8').replace('{{SAMPLE_TABLE}}',sampleTable).replace('{{SAMPLE_RESULT}}',result).replace('{{MODEL_TABLE}}',modelTable);
fs.writeFileSync(path.join(base,'조사보고서.md'),report);
const data={updatedAt:new Date().toISOString(),summary:`같은 문장으로 만든 합성음성 ${samples.length}개입니다. 음량만 비슷하게 맞췄습니다. 편안한 크기로 듣고, 가장 자연스럽고 계속 듣고 싶은 후보 번호 한두 개를 골라주세요.`,scope:`한국어 TTS 태그 781개는 목록을 끝까지 수집했습니다. 주요 모델·변형 ${models.length}개 항목을 비교했고, 5개 계열에서 실제 음성 ${samples.length}개를 생성했습니다. 모든 공개 모델을 설치·청취한 조사는 아닙니다. 모델 이름을 열면 실행 조건과 남은 확인을 볼 수 있습니다.`,samples,models,sources:models.map(m=>({title:m.name,url:m.url,note:m.notes})),reportMarkdown:report};
fs.writeFileSync(path.join(base,'data.json'),JSON.stringify(data,null,2));
fs.writeFileSync(path.join(base,'조사','모델비교표.json'),JSON.stringify({reviewedAt:data.updatedAt,models,notes:'Primary-source review. No subjective listening scores or user approval.'},null,2));
console.log(JSON.stringify({samples:samples.length,models:models.length,exactTranscripts:exact,report:'조사보고서.md'}));

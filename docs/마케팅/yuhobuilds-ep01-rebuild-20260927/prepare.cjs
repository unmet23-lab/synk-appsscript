const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),crypto=require('node:crypto');
const root=__dirname,old=path.resolve(root,'../yuhobuilds_1편_쇼츠수정_20260922'),asset=path.join(root,'assets');
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{encoding:'utf8',windowsHide:true,maxBuffer:8e6});if(r.status!==0)throw Error(r.stderr||String(r.error));return r;};
const write=(p,o)=>fs.writeFileSync(p,typeof o==='string'?o:JSON.stringify(o,null,2)+'\n');
for(const d of [asset,path.join(root,'audit'),path.join(root,'audio/edited'),path.join(root,'compositions')])fs.mkdirSync(d,{recursive:true});
const copies=[['runtime-public/yuho-journey-01/yuho-head.png','face.png'],['runtime-public/yuho-journey-01/ending-portrait.jpg','portrait.jpg'],...['smile','puzzled','surprise','blink'].map(x=>['assets/expressions/'+x+'.png',x+'.png']),['audio/music-bed.wav','music-source.wav']];
const assets=[];for(const [from,to] of copies){const input=path.join(old,from);fs.copyFileSync(input,path.join(asset,to));assets.push({file:'assets/'+to,source:input,sha256:crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex')});}
fs.copyFileSync(path.resolve(root,'../synkbrief_회의메모_20260921/assets/fonts/SUIT-Variable.woff2'),path.join(asset,'SUIT-Variable.woff2'));
const script=JSON.parse(fs.readFileSync(path.join(root,'narration-script.json'),'utf8'));
let frame=0;const segments=[],scenes=[],captions=[],words=[],chars=[];
for(let i=0;i<script.segments.length;i++){
 const s=script.segments[i],data=JSON.parse(fs.readFileSync(path.join(root,'audio/narration-'+s.id+'.json'),'utf8')),first=data.words[0].start,last=data.words.at(-1).end;
 const trim=Math.max(0,first-.07),voiceDuration=data.audio_duration-trim;
 const isLast=script.segments[i+1]?.scene!==s.scene;
 const pause=isLast?({demo:.50,prompt:.7,ending:.8,reset:.22}[s.scene]??.16):.095;
 const frames=Math.ceil((voiceDuration+pause)*30),duration=frames/30,start=frame/30;
 const localWords=data.words.map(w=>({...w,start:Math.max(0,w.start-trim),end:Math.min(duration,w.end-trim)}));
 const localChars=(data.characters||[]).map(w=>({...w,start:Math.max(0,w.start-trim),end:Math.min(duration,w.end-trim)}));
 const segment={...s,start,frame,duration,frames,trim,words:localWords,characters:localChars};segments.push(segment);
 let scene=scenes.at(-1);if(scene?.id!==s.scene){scene={id:s.scene,start,frame,duration:0,segments:[]};scenes.push(scene);}scene.segments.push({...segment,local:start-scene.start});scene.duration+=duration;
 const out=path.join(root,'audio/edited/'+s.id+'.wav');run('ffmpeg',['-v','error','-y','-i',path.join(root,'audio/narration-'+s.id+'.wav'),'-af',`atrim=start=${trim},asetpts=PTS-STARTPTS,apad,atrim=duration=${duration}`,'-ar','48000','-ac','2','-c:a','pcm_s16le',out]);
 words.push(...localWords.map(w=>({...w,start:w.start+start,end:w.end+start,segment:s.id})));
 chars.push(...localChars.map(w=>({...w,start:w.start+start,end:w.end+start,segment:s.id})));
 let group=[];const flush=()=>{if(!group.length)return;captions.push({start:start+group[0].start,end:Math.min(start+duration,start+group.at(-1).end+.075),text:group.map(w=>w.text).join(' '),segment:s.id});group=[];};
 for(const w of localWords){if(group.length&&(group.map(x=>x.text).join(' ').length+1+w.text.length>19))flush();group.push(w);if(/[.!?]$/.test(w.text)||(/,$/.test(w.text)&&group.map(x=>x.text).join(' ').length>9))flush();}flush();frame+=frames;
}
const timing={fps:30,width:1080,height:1920,frames:frame,duration:frame/30,scenes,segments,captions,words,characters:chars};
write(path.join(root,'timing.json'),timing);write(path.join(asset,'timing.js'),'window.YUHO_TIMING='+JSON.stringify(Object.fromEntries(scenes.map(s=>[s.id,s])))+';');
const concat=path.join(root,'audio/concat.txt');write(concat,segments.map(s=>`file 'edited/${s.id}.wav'`).join('\n'));
run('ffmpeg',['-y','-v','error','-f','concat','-safe','0','-i',concat,'-c:a','pcm_s16le',path.join(asset,'narration.wav')]);
write(path.join(root,'audit/assets.json'),assets);
const fmt=t=>{const ms=Math.round(t*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
write(path.join(root,'yuhobuilds_EP01_자막.srt'),captions.map((c,i)=>`${i+1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.text}\n`).join('\n'));
write(path.join(root,'복사용_첫완성질문.txt'),'나는 개발이 처음이야.\n학생 한 명의 출석을 저장하고, 다시 확인하고 싶어.\n추가 기능은 빼고, 가장 쉬운 방법과 확인 순서를 알려줘.\n\n내 상황에 맞게 바꾸기\n- 무엇을 만들지보다 첫 번째로 무엇이 되어야 하는지 적어보세요.\n- 위 질문의 두 번째 줄을 내 목표로 바꾸세요.\n- 예: 지출 한 건을 저장하고 다시 확인하고 싶어.\n- AI가 제시한 첫 단계만 따라 한 뒤 결과를 직접 확인하세요.\n- 원하는 결과가 나오면 다음 기능을 하나씩 붙여보세요.\n');
write(path.join(root,'원고.md'),'# 출석 앱 만들다 출석을 까먹었습니다\n\n'+segments.map(s=>'## '+s.id+' · '+s.start.toFixed(2)+'초\n\n'+s.text).join('\n\n')+'\n\n'+script.provenance+'\n');
const descriptions={hook:'출석앱 목표를 먼저 크게 보여준 뒤 출석이 사라진 빈칸과 당황한 얼굴. 두 번째 대사에 한 줄 카드가 예고로 드러난다.',origin:'6월의 번역 결제에서 학생 문의 알림으로 빠르게 전환. 몽골 학원 부원장의 실제 출발 배경을 연결한다.',loop:'모른다는 표정→화면 찍기→질문→따라하기. 대사마다 대상이 이동한다.',monster:'추가 기능 카드가 연속 쌓여 출석 카드와 얼굴을 덮는다. 정작 출석은 뒷전에서 흐름이 멈추고 당황한 얼굴이 드러난다.',reset:'복잡한 카드가 옆으로 정리되고 한 줄의 목표만 남는다. 학생 한 명·저장·다시 확인에 순서대로 초점.',demo:'가상 학생 A 선택→저장 클릭→기록 생성→새로 열기→같은 기록 확인. 실제 제작한 로컬 예시와 일치한다.',prompt:'세 줄 질문이 해당 발화에 맞춰 타이핑된다. 경험 수준→작은 목표→추가기능 제외와 확인순서의 세 부분을 색과 위치로 설명.',payoff:'작게 완성→확인→다음기능 세 단계가 공간을 따라 연결되고 완료 체크. 전체 앱 욕심의 회고가 실행 순서로 바뀐다.',ending:'웃는 실제 사용자 사진과 헤맨 길의 선이 짧은 직선으로 정리된다. 기존 채널 엔딩 약속으로 닫는다.'};
write(path.join(root,'STORYBOARD.md'),'---\nformat: 1080x1920\nduration: '+timing.duration+'s\nmessage: 첫 완성 기준을 정해 앱이 산으로 가는 일을 줄이기\narc: 실수의 반전 → 실제 배경 → 기능 욕심 → 한 줄 목표 → 저장과 재확인 → 복사 질문 → 작은 완성\naudience: 비개발자\nmode: autonomous\n---\n\n'+scenes.map((s,i)=>`## Frame ${i+1} — ${s.id}\n\n- status: outline\n- src: compositions/${s.id}.html\n- duration: ${s.duration}s\n- transition_in: cut\n- scene: ${descriptions[s.id]}\n- voiceover: ${s.segments.map(x=>x.text).join(' ')}\n- rules: waterfall-entry, spring-pop-entrance, discrete-text-sequence\n\n${descriptions[s.id]} 실제 음성 word timing으로 시각 변화를 맞춘다.\n`).join('\n'));
console.log(JSON.stringify({duration:timing.duration,scenes:scenes.map(s=>({id:s.id,start:s.start,duration:s.duration})),captions:captions.length}));
require('./polish-captions.cjs');

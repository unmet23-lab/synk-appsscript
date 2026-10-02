'use strict';
const fs=require('node:fs'),path=require('node:path');
const {base,put,hash}=require('./revise-01-voice.cjs');
const source=path.join(__dirname,'원고/video.json'),bytes=fs.readFileSync(source),all=JSON.parse(bytes.toString()),item=all.items.find(x=>x.id==='01-lab-youtube');
const backup=path.join(base,'before-video.json');if(!fs.existsSync(backup))put(backup,bytes);
const before=JSON.parse(fs.readFileSync(backup)).items.find(x=>x.id===item.id);
const track=before.scenes.find(x=>x.layout==='music');
Object.assign(item,{
 revision:'2026-09-10-voice-and-story-v2',
 title:'Дуртай дуугаа хамт сонсъё · SYNK LAB × K-LOFI24',
 target:'좋아하는 것을 한국어로 제안하고 함께 나누고 싶은 몽골 10대 후반, 음악과 장면을 감상하려는 시청자',
 need:'함께 들을 노래를 제안하는 한국어를 써보고, 이어서 그 곡을 실제로 함께 감상하기',
 promise:'같이 듣자고 권하기 → 곡 제안하기 → 응답하기의 한국어 세 문장과, 그 대화에서 소개한 61.6초 전곡',
 philosophy:'자기 취향을 말하고 함께 나누는 경험. 학습과 감상을 같은 노래를 권하는 한 장면으로 연결합니다.',
 slides:[{layout:'cover',kicker:'SYNK LAB · K-LOFI24',title:'Дуртай дуугаа\nхамт сонсъё.',body:'Солонгосоор санал болгоод,\nнэг дууг хамт сонсоно.',asset:'mong'}],
 thumbnail:{layout:'cover',kicker:'SYNK LAB · K-LOFI24',title:'Дуртай дуугаа\nхамт сонсъё.',body:'같이 들을까요?\nСолонгос хэл + хамт сонсох нэг дуу',asset:'mong'},
 audioMix:{narration:1,bedSpeech:.055,bedSilent:.11,music:.56},
 scenes:[
  {layout:'cover',duration:6,kicker:'SYNK LAB · K-LOFI24',title:'Өөрийн бодлоо хэлээд,\nнэг дууг хамт сонсъё.',body:'LAB — өөрийн бодлоо хэлэх солонгос хэл.\nK-LOFI24 — дуу, дүрслэлтэй өнгөрүүлэх цаг.',asset:'mong',narration:''},
  {layout:'example',duration:7,kicker:'01 · ХАМТ СОНСОХЫГ УРИХ',title:'Найздаа хөгжим\nсанал болгоё.',primary:'같이 들을까요?',secondary:'Хамт сонсох уу?',asset:'pulse-frame',narration:'같이 들을까요?'},
  {layout:'example',duration:7,kicker:'02 · ДУУ САНАЛ БОЛГОХ',title:'Сонсох дуугаа\nсанал болгоорой.',primary:'이 노래는 어때요?',secondary:'Энэ дуу ямар байна?',note:'이 노래 → дуртай дууныхаа нэр',asset:'pulse-frame',narration:'이 노래는 어때요?'},
  {layout:'example',duration:6,kicker:'03 · ХАРИУ ХЭЛЭХ',title:'Тэгье.\nХамт сонсъё.',primary:'좋아요. 같이 들어요.',secondary:'Тэгье. Хамт сонсъё.',asset:'pulse-frame',narration:'좋아요. 같이 들어요.'},
  {layout:'music-bridge',duration:6,kicker:'K-LOFI24 · ӨНӨӨДРИЙН ДУУ',title:'Тэгвэл энэ дууг\nхамт сонсъё.',primary:track.musicTitle,body:'Бүтэн дуу · 1 минут 1.6 секунд',note:'AI хөгжим: Suno · Дүрслэл: SYNK PULSE',asset:'pulse-frame',narration:'',musicLeadSeconds:1.2},
  {...track,duration:60.4,sourceStartSeconds:1.2}
 ],
 caption:'Та дуртай дуугаа найздаа санал болгохдоо солонгосоор юу гэж хэлэх вэ?\n\nSYNK LAB-д тавтай морил. Энд өдөр тутмын нөхцөлд өөрийн бодлоо хэлэх солонгос хэл, хэрэгтэй хэллэг, өөртөө тохируулж бичих материалыг хуваалцана. K-LOFI24-өөр дуу, дүрслэлтэй өнгөрүүлэх цагийг бүтээнэ.\n\nЭнэ удаа дуу хамт сонсох харилцан яриа хийж үзье.\n\n1. Хамт сонсохыг урих\n«같이 들을까요?» — Хамт сонсох уу?\n\n2. Дуу санал болгох\n«이 노래는 어때요?» — Энэ дуу ямар байна?\n«이 노래»-г дуртай дууныхаа нэрээр сольж болно.\n\n3. Хариу хэлэх\n«좋아요. 같이 들어요.» — Тэгье. Хамт сонсъё.\n\nДараа нь энэ ярианд санал болгосон «오늘 밤 제일 환한 사람» дууг бүтнээр нь хамт сонсоно. Ярианд гарсан орчин хөгжмийн видео болж үргэлжилнэ.\n\nӨөрөө давтаж болно. Сэтгэгдэл бичих шаардлагагүй. Энэ нь зохиомол дасгалын нөхцөл; бодит сурагчийн яриа биш.\n\nK-LOFI24 — «오늘 밤 제일 환한 사람»\nБүтэн дуу: 1 минут 1.6 секунд\nAI хөгжмийн бүтээл: Suno\nДүрслэл, эвлүүлэг: SYNK PULSE\n\nТусгайлан бүтээсэн хөгжмийн видео; шууд дамжуулалт эсвэл бодит газрын бичлэг биш.',
 captionKo:'좋아하는 노래를 친구에게 권할 때, 한국어로 어떻게 말할까요?\n\nSYNK LAB에 오신 것을 환영합니다. 생활 장면에서 자기 생각을 말하는 한국어, 필요한 표현과 자기 상황에 맞게 고쳐 쓰는 자료를 나눕니다. K-LOFI24에서는 음악과 장면을 곁에 두는 시간을 만듭니다.\n\n이번에는 한 곡을 함께 듣는 대화를 해봅니다.\n\n1. 같이 듣자고 권하기\n같이 들을까요?\n\n2. 곡 제안하기\n이 노래는 어때요?\n‘이 노래’를 좋아하는 곡 이름으로 바꿔 말할 수 있습니다.\n\n3. 응답하기\n좋아요. 같이 들어요.\n\n이어 방금 대화에서 소개한 ‘오늘 밤 제일 환한 사람’을 실제로 함께 듣습니다. 대화 중 보인 공간이 같은 음악 영상으로 이어집니다.\n\n혼자 연습해도 되며 댓글은 조건이 아닙니다. 실제 학생의 대화가 아닌 가상 학습 상황입니다.\n\nK-LOFI24 · 오늘 밤 제일 환한 사람\n61.6초 전곡\nAI 음악 제작: Suno / 장면·편집: SYNK PULSE\n별도로 제작한 감상 영상이며 실시간 방송·실제 장소 촬영이 아닙니다.',
 alt:['좋아하는 노래를 한국어로 권하고 함께 듣는 SYNK LAB와 K-LOFI24의 첫 영상 표지.'],
 nextAction:'같이 듣자고 권하고, 좋아하는 곡을 제안하는 한국어를 자기 말로 바꿔 사용합니다. 영상에서 소개한 곡은 이어서 전곡으로 감상합니다.',
 relationship:'공용 @synkkorean의 첫 안내 영상입니다. SYNK LAB의 한국어 경험과 K-LOFI24의 감상을 같은 곡을 권하는 장면으로 연결합니다. PULSE는 별도 신규 계정으로 세지 않습니다.'
});
item.musicReuse={...before.musicReuse,duration:61.6,renderPolicy:'전환 장면 마지막 1.2초에 원곡 0초부터 재생하고 음악 장면은 원곡 1.2초부터 이어 재생. 원곡 시간 중복·누락 없이 61.6초 보존. 기존 음악 장면에 새 해설·장식은 겹치지 않음.'};
if(!fs.readFileSync(source).equals(bytes))throw Error('Source changed concurrently');
put(source,JSON.stringify(all,null,2));
put(path.join(base,'story-change.json'),JSON.stringify({beforeSha256:hash(bytes),afterSha256:hash(fs.readFileSync(source)),userCorrection:'라디오 삭제가 아니라 말하기 연습에서 라디오로 넘어가는 맥락과 자연스러운 전환 요청',scenes:item.scenes.length,duration:item.scenes.reduce((n,s)=>n+s.duration,0),musicFullDuration:61.6},null,2));
console.log(JSON.stringify({id:item.id,scenes:item.scenes.length,duration:item.scenes.reduce((n,s)=>n+s.duration,0)}));

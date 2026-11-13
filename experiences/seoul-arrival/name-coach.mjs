// 서울행 이름 쓰기 · 서하 선배의 목소리 응원(설계 이름손글씨.md 「겉 v2」 · 11-14 유호님 「실수하고 있으면 나레이션으로 가이드 … 제대로 하고 있어도 응원 … 최종 나오면 점수랑 같이 승부욕 자극하든지 응원」).
// 줄 고르기는 순수 함수(화면 없이 시험), 소리는 app.mjs SND.speak로 낸다. 목소리는 늘 한국어(서하가 옆에서 하는 말), 화면에는 한국어 줄과 학생 언어 번역을 같이 둔다.

// 줄 파일은 assets/snd/vo_nt_<id>.mp3 — 글이 바뀌면 다시 굽는다(qa/소리출처.json 「글」과 같아야 한다)
export const VO=Object.freeze({
 g1:'좋아요!',g2:'오, 반듯해요.',g3:'잘 쓰고 있어요!',g4:'그렇지, 바로 그거예요.',
 o1:'아, 순서! 번호부터 써 봐요.',o2:'잠깐요, 번호 순서대로요.',
 d1:'어, 반대로 갔어요. 화살표 따라가요.',d2:'방향이 반대예요! 화살표 쪽으로요.',
 w1:'흐린 글씨 위로, 천천히요.',i1:'괜찮아요. 천천히 해도 돼요.',
 f100:'백 점! 처음 쓴 거 맞아요?',ftop:'와, 거의 똑같아요! 진짜 처음이에요?',fhi:'오, 잘 썼다! 한 번 더 하면 백 점 나오겠는데요?',
 fmid:'좋아요! 한 번만 더 써 보면 훨씬 예뻐질 거예요.',flow:'처음엔 다 그래요. 한 번 더 같이 써 볼까요?',
 r100:'백 점! 이건 진짜 학생증감이에요.',rup:'오, 올랐어요! 손이 벌써 익었네요.',rdown:'아깝다! 최고 기록까지 조금만 더요.'
});
export const SETS=Object.freeze({praise:['g1','g2','g3','g4'],order:['o1','o2'],dir:['d1','d2'],stray:['w1'],idle:['i1']});
// 우선: 끝 점수 > 바로잡기 > 칭찬 · 기다림. 낮은 줄은 높은 줄이 도는 동안 끼어들지 않는다
const PRIO={praise:1,idle:1,stray:2,order:2,dir:2,final:3};

// 끝 점수 줄: 첫 판은 점수 층으로(80점대는 「한 번 더 하면 백 점」으로 승부욕), 다시 쓴 판은 지난 최고와 견준다
export function finalLine({score,attempt=1,prev=null}){
 if(attempt<=1||prev==null){if(score>=100)return 'f100';if(score>=92)return 'ftop';if(score>=80)return 'fhi';if(score>=65)return 'fmid';return 'flow';}
 if(score>=100)return 'r100';
 return score>prev?'rup':'rdown';
}
// 점수 층(소리 · 색): 100 · 92 · 80 · 그 아래
export const tier=s=>s>=100?'full':s>=92?'top':s>=80?'hi':'mid';
// 음절에서 점수를 가장 많이 잃은 곳(비교판의 작은 꼬리표): 순서 15% · 방향 10% · 모양 55% 가운데 잃은 몫이 큰 것, 3점 넘게 잃었을 때만
export function weakTag({ord=1,dir=1,like=1}={}){
 const loss=[['순서',.15*(1-ord)],['방향',.1*(1-dir)],['모양',.55*(1-like)]].sort((a,b)=>b[1]-a[1])[0];
 return loss[1]>.03?loss[0]:null;
}

// 고르고 내는 쪽: 같은 줄이 잇달아 나오지 않게 돌리고, 바로잡기는 음절마다 두 번까지 · 1.8초 안에 다시 하지 않는다(잔소리가 되지 않게)
export const voUrl=id=>new URL(`./assets/snd/vo_nt_${id}.mp3`,import.meta.url).href;
export function createCoach({SND,url=voUrl,now=()=>performance.now()}={}){
 const turn={};let cur=null,until=0,lastFix=-1e9,fixes=0,said=null;
 // 차례는 실제로 낸 때만 넘긴다(막힌 줄 때문에 다음 칭찬이 건너뛰지 않게)
 const next=set=>{const list=SETS[set],k=((turn[set]??-1)+1)%list.length;return {id:list[k],ok:()=>{turn[set]=k;}};};
 function play(pick,kind,{force=false}={}){
  const t=now(),p=PRIO[kind]||1,{id,ok}=typeof pick==='string'?{id:pick,ok:()=>{}}:pick;
  if(!force&&cur&&t<until&&PRIO[cur]>=p)return null;
  const dur=SND?.speak?.(url(id));
  if(dur==null)return null;
  ok();cur=kind;until=t+dur*1000;said=id;return {id,dur};
 }
 return {
  warm(){for(const id of Object.keys(VO))SND?.voWarm?.(url(id));},
  // 쓰는 동안: 음절이 바뀌면 바로잡기 수를 새로
  syllable(){fixes=0;},
  fix(set){const t=now();if(fixes>=2||t-lastFix<1800)return null;const r=play(next(set),set);if(r){fixes++;lastFix=t;}return r;},
  praise(){return play(next('praise'),'praise');},
  idle(){return play(next('idle'),'idle');},
  final(info){return play(finalLine(info),'final',{force:true});},
  hush(){SND?.hush?.();cur=null;until=0;},
  get said(){return said;},
 };
}

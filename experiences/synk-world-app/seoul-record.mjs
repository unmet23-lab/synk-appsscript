// 첫 실행 서울행의 학생 칸(experiences/seoul-arrival/설계.md 5절). 생활 기록의 선택 칸 arrival과 손님 사본이 같은 꼴을 쓴다.
// 화면 언어 칸처럼 모르는 값은 그 칸만 없는 것으로 읽는다(기록 전체를 거절하지 않는다). 다른 창에서 온 객체도 읽게 프로토타입을 묻지 않는다.
const STAGES=new Set(['prologue','dream','card','left']),DREAMS=new Set(['idol','actor']),CALLS=new Set(['누나','언니','선배']),MOM=new Set(['fix','ok','later']);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const time=value=>Number.isSafeInteger(value)&&value>=0;
const text=value=>typeof value==='string'&&value.trim()?value.trim().slice(0,40):null;
export function readArrival(value){
 if(!object(value)||value.version!==1)return null;
 const scenes=Array.isArray(value.scenes)?value.scenes.filter(s=>object(s)&&typeof s.id==='string'&&/^[a-z0-9._-]{1,40}$/i.test(s.id)&&time(s.at)).slice(-200).map(s=>({id:s.id,at:s.at,...(Number.isSafeInteger(s.lines)&&s.lines>=0&&s.lines<=200?{lines:s.lines}:{})})):[];
 const best={};if(object(value.best))for(const [id,b] of Object.entries(value.best).slice(0,100))if(/^[a-z0-9]{1,12}$/.test(id)&&object(b)&&Number.isSafeInteger(b.n)&&b.n>=0&&b.n<=200)best[id]={n:b.n,t2:b.t2===true,tr:b.tr===true};
 return {version:1,stage:STAGES.has(value.stage)?value.stage:'prologue',dream:DREAMS.has(value.dream)?value.dream:null,name:text(value.name),nameEn:text(value.nameEn),from:text(value.from),call:CALLS.has(value.call)?value.call:null,
  look:typeof value.look==='string'&&/^[a-z]{2}_[mf]$/.test(value.look)?value.look:null,lights:Number.isSafeInteger(value.lights)&&value.lights>=0&&value.lights<=100000?value.lights:0,best,scenes,momAnswer:MOM.has(value.momAnswer)?value.momAnswer:null,momAt:time(value.momAt)?value.momAt:null,updatedAt:time(value.updatedAt)?value.updatedAt:null};
}

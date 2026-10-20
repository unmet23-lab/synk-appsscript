// Account snapshots must be readable before an editor can open them. Preserve a
// newer/corrupt payload rather than normalizing it to a blank learner record.
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const token=v=>typeof v==='string'&&/^[a-z0-9_-]{1,80}$/i.test(v);
const date=v=>typeof v==='string'&&v.length<=40&&Number.isFinite(Date.parse(v));
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);
const fields=(v,allowed)=>object(v)&&Object.keys(v).every(key=>allowed.includes(key));
const states=new Set(['unmet','met','learning','mastered']);
const failure=()=>{throw Object.assign(Error('한글 진도의 판이나 내용을 확인하지 못했어요. 기존 기록은 그대로 보존했어요.'),{code:'HANGUL_PROGRESS_UNREADABLE'});};
export function validateHangulProgress(value){
 if(!fields(value,['v','core','letters','pairs','recent','sessions','difficulty','trend','amount','skipped','demoSeen','wordStreak','graduated'])
  ||value.v!==1||!['hangul-core-1','hangul-core-2'].includes(value.core)||!object(value.letters)||Object.keys(value.letters).length>64
  ||!object(value.pairs)||Object.keys(value.pairs).length>4096||![1,2,3].includes(value.difficulty)||!Number.isSafeInteger(value.trend)
  ||![5,10,15].includes(value.amount)||typeof value.skipped!=='boolean'||!integer(value.wordStreak)
  ||!Array.isArray(value.recent)||value.recent.length>20||value.recent.some(v=>!fields(v,['ok'])||typeof v.ok!=='boolean')
  ||!Array.isArray(value.sessions)||value.sessions.length>60||!Array.isArray(value.demoSeen)||value.demoSeen.length>7
  ||value.demoSeen.some(v=>!['listen_pick','see_pick','build','match','pair','teach','build_final'].includes(v)))failure();
 for(const [id,letter]of Object.entries(value.letters)){
  if(!token(id)||!fields(letter,['state','best','streak','streakSessions','step','due','lapses','seen','correct','lastAt','metAt'])
   ||!states.has(letter.state)||!states.has(letter.best)||!['streak','step','lapses','seen','correct'].every(k=>integer(letter[k]))
   ||letter.step>5||letter.correct>letter.seen||!Array.isArray(letter.streakSessions)||letter.streakSessions.length>3
   ||letter.streakSessions.some(v=>typeof v!=='string'||v.length>120)||['due','lastAt','metAt'].some(k=>letter[k]!==null&&!date(letter[k])))failure();
 }
 for(const [key,pair]of Object.entries(value.pairs))if(key.split('|').length!==2||key.split('|').some(v=>!token(v))||!fields(pair,['wrong','lastAt'])||!integer(pair.wrong)||!date(pair.lastAt))failure();
 for(const session of value.sessions)if(!fields(session,['day','sessionNo','total','independent'])||!day(session.day)||!['sessionNo','total','independent'].every(k=>integer(session[k]))||session.independent>session.total)failure();
 if(value.graduated!==null&&(!fields(value.graduated,['at','day'])||!date(value.graduated.at)||!day(value.graduated.day)))failure();
 return value;
}

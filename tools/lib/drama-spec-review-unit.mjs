// 드라마 말하기 · 대사 칸 명세 AI 2중 검수의 단위와 지문(2026-10-31, 결정 10-31 ③ — 결정 10-21 TOPIK 문항 2중 검수 규칙을 대사 칸 명세로 넓힘).
// 검수 도구(tools/topik-review.mjs --드라마)와 talk 사본 빌더(tools/build-world-speaking-talk.mjs)가 같은 단위 · 지문을 쓴다.
// · 단위는 그 줄이 학습 근거가 되는 내용이다: 줄 id · 종류(장면 대사/처음 보는 대사) · 능력 · 대사 · 뜻 · 문법 · 어휘 · 상황(처음 보는 대사) ·
//   바로 앞 사람 말(장면 대사) · 칸 명세 · 판정 판(DRAMA_JUDGE_VERSION). 판정 규칙이 바뀌면 같은 명세도 다르게 판정하므로 판도 지문에 넣는다
//   (찻집 틀이 판정 계약 TEA_JUDGE를 지문에 넣는 것과 같다).
// · 대본 줄에 검수:'passed'와 검수지문:'<이 지문>'이 함께 있고 지문이 지금 단위와 같을 때만 passed다 — 고치면 통과가 풀린다.
// · 연기 지문 · 칸 그림 · 소리 파일은 넣지 않는다(학생이 할 말 · 판정과 상관없다).
import {createHash} from 'node:crypto';
import {DRAMA_JUDGE_VERSION} from './드라마판정.mjs';

// 검수 기준 판(experiences/drama/review/rubric-spec-<판>.md). r1은 첫 묶음의 기준이고, r2가 지금 기준이다(장면 대사의 쉬운 같은 뜻 말 · 너그러움은 처음 보는 대사에서만).
export const DRAMA_SPEC_RUBRIC='drama-spec-r2';
export const DRAMA_SPEC_RUBRICS=Object.freeze({'drama-spec-r1':'rubric-spec-r1.md','drama-spec-r2':'rubric-spec-r2.md'});
const stable=value=>Array.isArray(value)?'['+value.map(stable).join(',')+']'
 :value&&typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stable(value[key])).join(',')+'}':JSON.stringify(value??null);

/** 대본에서 검수할 줄 — 학생 줄(scene, 바로 앞 사람 말과 그 촬영일)과 처음 보는 대사(unseen). 차례는 talk 대사 은행과 같다. */
export function dramaReviewRows(episode){
 const out=[];
 for(const day of episode?.촬영일||[]){
  let before=null;
  for(const row of day.줄||[]){if(row.누가==='학생')out.push({row,kind:'scene',day,before});before=row;}
 }
 for(const row of episode?.처음보는대사||[])out.push({row,kind:'unseen',day:null,before:null});
 return out;
}
/** 검수 단위(지문을 재는 내용). */
export function dramaSpecUnit({row,kind,before=null},episodeId){
 return {episode:episodeId,id:row.id,kind,능력:row.능력??null,말:row.말,뜻:row.뜻??null,문법:row.문법||[],어휘:row.어휘||[],
  상황:row.상황??null,앞말:before?{누가:before.누가,말:before.말}:null,명세:row.명세??null,judge:DRAMA_JUDGE_VERSION};
}
export const dramaSpecHash=unit=>createHash('sha256').update(stable(unit)).digest('hex').slice(0,16);
/** 줄의 검수 상태 — 검수:'passed'이고 검수지문이 지금 단위 지문과 같을 때만 passed. */
export function dramaReviewStatus(entry,episodeId){
 const hash=dramaSpecHash(dramaSpecUnit(entry,episodeId));
 return {status:entry.row.검수==='passed'&&entry.row.검수지문===hash?'passed':'draft',hash,stale:entry.row.검수==='passed'&&entry.row.검수지문!==hash};
}

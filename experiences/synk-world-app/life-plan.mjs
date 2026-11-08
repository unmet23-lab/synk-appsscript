// 생활 레슨 · 새 상황 복습 후보가 Core에 넘기는 targets(Atlas × WORLD 2단계 D, 2026-11-08 · 설계 docs/_ops/qa/atlas-world-engine-20261108/D_생활한국어.md §4-3).
// 홈 계획(world-learning-plan.mjs)과, 공개본 계정 묶음에 D를 끼울 때의 엔진 판(docs/_ops/qa/atlas-world-engine-20261108/D_공개묶음.cjs)이 이 두 함수를 함께 쓴다.
// 순수 함수다 — 기록 · 화면 · 저장을 모른다.
import {lifeItem,lifeTarget} from './life-items.mjs';

// 레슨 · 복습 문항들의 엔진 측정. 카페 방문 장면 문항은 측정이 아니라(life-items.mjs confounded) 장면 레슨은 target이 없고 지금처럼 목표로 순서를 받는다.
export const lifeTargets=(lesson,questions,review=false)=>questions.map(question=>lifeItem({lesson,question,review})).filter(item=>item&&!item.confounded).map(lifeTarget);

// 후보 하나가 Core에 넘길 targets. known: 그 후보의 targets 가운데 요약에 있는 능력만.
// 생활 레슨(이어 하기 아님)의 targets는 놓친 칸을 당길 때만 싣는다(§4-3 2판 — 검수 Fable F1): 생활 문항은 Core 칸 몇 개를 나눠 써서 그대로 실으면
// 잘 푼 학생일수록 다음 레슨이 아직 기록 없는 활동 뒤로 밀린다. 다시 연습할 칸 — 놓침 · 도움으로만 · 오래됨(practice · supported · review, Core 급한 줄)
// 또는 틀린 답이 있는 확인 중(checking, 같은 줄 안에서 점수로 앞섬) — 이 있을 때만 그 칸의 targets를 싣는다.
// 돌아온 · 하던 새 상황 복습이 있는 동안(reviewWaiting)은 레슨에 싣지 않는다(§4-3 3판 — 다시 검수 Fable FA1): 처음 배우는 사람의 기본 도움
// 「한 단계씩」은 첫 답이 모두 도움 받은 답이라 칸이 supported가 되고, 그 칸 레슨이 복습과 같은 급한 줄에서 목표 수로 복습을 앞지른다.
// 복습 · 이어 하기 · 게임 · 연습 후보는 그대로 둔다.
export function planTargets({candidate,known,profile,reviewWaiting=false}={}){
 if(candidate?.route!=='lesson'||candidate.resume)return known;
 if(reviewWaiting||profile?.evidenceComplete!==true)return [];
 const rows=new Map((Array.isArray(profile.skills)?profile.skills:[]).map(skill=>[skill.id,skill]));
 return known.filter(target=>{
  const cell=rows.get(target.skillIds[0])?.levels?.[target.difficulty]?.formats?.[target.responseFormat];
  return !!cell&&(['practice','supported','review'].includes(cell.status)||cell.status==='checking'&&cell.incorrect>0);
 });
}

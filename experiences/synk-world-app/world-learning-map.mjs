// WORLD 코치의 학습 지도(2026-10-21 ④ · 최종 제안 §2-2 #13 TOPIK II 화면 연결, 결정 표 10-20 「TOPIK II 전부 공개」).
// 게임들이 함께 쓰는 엔진(atlas/game-browser.js)은 TOPIK I 지도(낱말 층 포함)로 그대로 두고, WORLD가 직접 내는 연습
// (홈·짧은 진단·짧은 연습·시험 형식 연습·쓰기)의 코치만 TOPIK I 지도에 TOPIK II 능력 15개(strata/maps/topik-ii.json)를 더한
// 지도로 만든다. 한 계정의 학습 기록(Trail)은 하나라 게임 코치도 같은 기록을 읽는데, 자기 지도에 없는 능력(ko2.*)의 사건은
// 요약에서 건너뛴다(TOPIK I 지도 코치·서버 요약 모두 — qa/world-learning-map.test.mjs가 섞인 기록으로 확인한다).
// 기록 모양(Trail 칸)은 바꾸지 않는다. 문항이 가리키는 능력 이름만 늘어난다.
import strata from '../../strata/index.js';
import topikI from '../../strata/topik-i.js';
import topikII from '../../strata/maps/topik-ii.json' with {type:'json'};
import gameBrowser from '../../atlas/game-browser.js';
import learning from '../../atlas/game-learning.js';

// 두 지도의 출처 이름이 겹치면(둘 다 practice-taxonomy) TOPIK II 쪽 이름에 -ii를 붙여 각 능력이 제 원천을 가리키게 한다.
const II='-ii';
export function worldMapData({base=topikI.topikMap(),second=topikII}={}){
 const rename=key=>Object.hasOwn(base.sources,key)?`${key}${II}`:key;
 const refs=list=>list.map(ref=>({...ref,source:rename(ref.source)}));
 return {map_ver:`world:${base.map_ver}:${second.map_ver}`,subject:base.subject,
  sources:{...base.sources,...Object.fromEntries(Object.entries(second.sources).map(([key,value])=>[rename(key),value]))},
  nodes:[...base.nodes,...second.nodes.map(node=>({...node,source_refs:refs(node.source_refs)}))],
  edges:[...base.edges,...second.edges.map(edge=>({...edge,source_refs:refs(edge.source_refs)}))],
  tag_vocabulary:[...base.tag_vocabulary,...second.tag_vocabulary],
  links:{...base.links,tags:[...base.links.tags,...second.links.tags.map(link=>({...link,source_refs:refs(link.source_refs)}))],
   ...(base.links.goals||second.links.goals?.length?{goals:[...(base.links.goals||[]),...(second.links.goals||[]).map(link=>({...link,source_refs:refs(link.source_refs)}))]}:{})}};
}
export const worldMap=strata.createMap(worldMapData());

// createWorldEducation이 쓰는 꼴은 atlas/game-browser.js 그대로(engine.createGame·SKILLS·POLICY·recommendActivities…)이고
// 코치를 만드는 함수와 항목 목록만 이 지도다. 게임 안에서 부르는 createGame(게임 화면의 학습 호스트 연결)은 게임 엔진 그대로다.
export const worldLearning=Object.freeze({...gameBrowser,SKILLS:worldMap.allNodes(),
 engine:Object.freeze({...gameBrowser.engine,createGame:config=>learning.createGame({...config,map:worldMap})})});

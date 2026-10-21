// WORLD 계정·생활 묶음에 넣는 문항 검수 판정 목록(experiences/topik-items/review/existing-verdicts.json) — 읽기 짧은 연습
// (world-reading-practice.mjs practicePool)이 쓰는 칸만 남긴다. 검수 이유·검수한 모델(by)·해시·시각은 공개 묶음에 싣지 않는다
// (synk.im에는 AI 도구 이름을 두지 않는다 · 10-21). 원본 JSON과 node로 바로 읽는 시험은 그대로다.
import fs from 'node:fs';

export const VERDICT_FIELDS=Object.freeze(['itemKey','verdict','skillId','difficulty','responseFormat','familyKey']);

export function slimVerdicts(text){
 const data=JSON.parse(text);
 const rows=Array.isArray(data?.items)?data.items:[];
 return {version:data?.version??null,items:rows.map(row=>row&&typeof row==='object'?Object.fromEntries(VERDICT_FIELDS.filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]])):{})};
}

// esbuild 플러그인: 그 JSON을 불러올 때 줄인 판으로 바꾼다(import 속성 `with {type:'json'}` 그대로).
export const verdictsPlugin=Object.freeze({name:'world-verdicts',setup(build){
 build.onLoad({filter:/[\\/]topik-items[\\/]review[\\/]existing-verdicts\.json$/},args=>({contents:JSON.stringify(slimVerdicts(fs.readFileSync(args.path,'utf8'))),loader:'json'}));
}});

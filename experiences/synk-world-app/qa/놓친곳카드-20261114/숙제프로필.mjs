// 시험 목표를 넣은 손님의 학습 프로필(life-progress 저장값)을 실제 모듈로 만든다 — 후보시험에서 「이번 주 숙제」 줄을 세우려고(다음 판 11-14).
//   node experiences/synk-world-app/qa/놓친곳카드-20261114/숙제프로필.mjs > <파일.json>  → SYNK_EXTRA_SEED=<파일.json> node …/후보시험.mjs …
import {createLifeProgress} from '../../life-progress.mjs';
const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
const p=createLifeProgress({storage,owner:'guest'});
const r=p.updateLearningProfile({values:{primaryReason:'exam',reasons:['exam'],examType:'topik1',targetGrade:2,examDate:'2027-04',weeklyMinutes:60},consent:true,expectedRevision:0});
await p.flush?.();
console.error('profile',JSON.stringify(r.profile?.status),JSON.stringify(p.learningProfileValues()));
process.stdout.write(JSON.stringify(Object.fromEntries(values)));

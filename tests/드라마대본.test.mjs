import test from 'node:test';
import assert from 'node:assert/strict';
import ep01 from '../experiences/drama/s1/ep01.mjs';
import {checkSpec,judgeLine} from '../tools/lib/드라마판정.mjs';
import {dramaReviewRows,dramaSpecUnit,dramaSpecHash} from '../tools/lib/drama-spec-review-unit.mjs';
// 드라마 말하기 1화 대본(2026-10-29 초안): 분량(기획 §6)·칸 명세 점검(tools/lib/드라마판정.mjs)·실수 유형 몇 개가 바라는 노트를 받는지.
// 네트워크·모델을 부르지 않는다.

const 학생줄=ep01.촬영일.flatMap(d=>d.줄||[]).filter(l=>l.누가==='학생');
const 상대줄=ep01.촬영일.flatMap(d=>d.줄||[]).filter(l=>l.누가!=='학생');
const 명세=l=>({...l.명세,id:l.id,line:l.말});
const 찾기=id=>[...학생줄,...ep01.처음보는대사].find(l=>l.id===id);

test('분량: 칸 12~20 · 내 대사 6~9 · 처음 보는 대사 6~10 · 인물마다 되묻기 셋(기획 §6)',()=>{
 assert.ok(ep01.칸.length>=12&&ep01.칸.length<=20,`칸 ${ep01.칸.length}`);
 assert.ok(학생줄.length>=6&&학생줄.length<=9,`내 대사 ${학생줄.length}`);
 assert.ok(ep01.처음보는대사.length>=6&&ep01.처음보는대사.length<=10,`처음 보는 대사 ${ep01.처음보는대사.length}`);
 for(const 누가 of new Set(상대줄.map(l=>l.누가)))assert.equal(ep01.되묻기[누가]?.length,3,`${누가} 되묻기`);
 const ids=[...학생줄,...ep01.처음보는대사].map(l=>l.id);
 assert.equal(new Set(ids).size,ids.length,'id가 겹친다');
 // 장면이 가리키는 칸은 있는 칸이다.
 const 칸번호=new Set(ep01.칸.map(c=>c.n));
 for(const d of ep01.촬영일)for(const n of d.칸||[])assert.ok(칸번호.has(n),`촬영일 ${d.n}의 칸 ${n}`);
 // 상대 인물 대사에는 연기 지문이 있다(녹음·합성 목소리의 연기 지시).
 for(const l of 상대줄)assert.ok(l.지문,`${l.말} 지문`);
});

test('칸 명세 점검: 내 대사와 처음 보는 대사가 모두 자기 명세를 확실히 통과한다',()=>{
 for(const l of [...학생줄,...ep01.처음보는대사]){
  assert.ok(l.뜻,`${l.id} 뜻`);
  assert.deepEqual(checkSpec(명세(l)),[],l.id);
 }
});

test('칸 명세 검수(결정 10-31 ③): 검수:passed인 줄은 검수지문이 지금 내용과 같다 — 검수 뒤 고쳤으면 다시 검수하거나 검수 칸을 지운다',()=>{
 for(const entry of dramaReviewRows(ep01)){
  const {row}=entry;
  assert.ok(row.검수===undefined||row.검수==='passed',`${row.id} 검수 칸은 passed만`);
  if(row.검수==='passed')assert.equal(row.검수지문,dramaSpecHash(dramaSpecUnit(entry,ep01.id)),`${row.id}: 검수 뒤 바뀜 — node tools/topik-review.mjs 준비 <이름> --드라마 ${row.id}`);
  else assert.equal(row.검수지문,undefined,`${row.id} 검수지문만 남음`);
 }
});

test('실수 유형: 교수님께 반말·「요」 빠짐·짧게 끝냄·핵심 말 빠짐은 그 노트를, 쉬운 말로 바꾼 정답은 통과',()=>{
 const say=(id,t)=>judgeLine(명세(찾기(id)),{transcript:t});
 assert.equal(say('s1e01-5','네, 알겠어. 고마워, 교수님').note?.kind,'ending');
 assert.equal(say('s1e01-1','교수님 안녕').note?.kind,'ending');
 assert.equal(say('s1e01-3','과제에 대해 여쭤볼 게 있어서 왔어').note?.kind,'ending');
 assert.equal(say('s1e01-2','낯설어요').note?.kind,'length');
 assert.deepEqual(say('s1e01-3','과제 때문에 왔어요').note,{kind:'missing',word:'여쭤볼 게 있어서'});
 // 「질문이 있어서」는 높임이 맞은 쉬운 말이라 노트 없이 통과한다(여쭤보다는 문화 카드가 가르친다).
 assert.equal(say('s1e01-3','과제에 대해 질문이 있어서 왔어요').verdict,'pass');
 // 「언제까지예요?」로 물어도 통과(허용 변형).
 assert.equal(say('s1e01-4','제출 기한이 언제까지예요').sure,true);
 // 선배의 이름은 소리가 달라도 고르지 않는다.
 assert.equal(say('s1e01-7','네, 태호 선배님! 그런데 혹시 도서관이 어디에 있는지 아세요?').verdict,'pass');
 // 선배에게 반말 덩어리.
 assert.equal(say('s1e01-8','정말? 고마워').note?.kind,'ending');
 assert.equal(say('s1e01-9','네, 꼭 살게').note?.kind,'ending');
});

test('자연스러운 다른 정답은 노트 없이 확실한 통과(10-30 Fable 실측 — 고치기 전에는 「빠진 말」 노트가 나갔다)',()=>{
 const sure=(id,t)=>{const r=judgeLine(명세(찾기(id)),{transcript:t});assert.equal(r.note,null,`${id} ${t} → ${JSON.stringify(r.note)}`);assert.equal(r.sure,true,`${id} ${t}`);};
 sure('s1e01-4','제출 기한이 언제까지인가요?');
 sure('s1e01-4','제출 기한이 언제까지입니까?');
 sure('s1e01-4','제출 기한이 언제까지인지 알고 싶어서요.');
 sure('s1e01-2','아직 좀 낯설지만 조금씩 적응하고 있어요.');
 sure('s1e01-2','아직 어렵지만 조금씩 익숙해지고 있어요.');
 sure('s1e01-t3','처음엔 힘들었지만 조금씩 적응하고 있어요.');
 sure('s1e01-3','과제에 대해 여쭤보려고 왔어요.');
 sure('s1e01-3','과제에 대해 궁금한 게 있어서 왔어요.');
 sure('s1e01-6','네, 맞아요. 길을 잃어서 한참 돌아다녔어요.');
 sure('s1e01-7','선배님, 도서관이 어디예요?');
 sure('s1e01-9','네, 꼭 사겠습니다.');
});

test('끝맺음 애매·「요」 빠짐: 통째로 닮아도 「알아?」는 혼자 해냄이 아니고, 「궁금해서」·「유학생이에」·「감사해」는 끝맺음 노트',()=>{
 const say=(id,t)=>judgeLine(명세(찾기(id)),{transcript:t});
 const unsure=say('s1e01-7','네, 선배님! 그런데 혹시 도서관이 어디에 있는지 알아?');
 assert.equal(unsure.note,null);assert.equal(unsure.sure,false);
 assert.equal(say('s1e01-4','제출 기한이 언제까지인지 궁금해서').note?.kind,'ending');
 assert.equal(say('s1e01-1','안녕하세요, 교수님. 이번 학기에 새로 온 유학생이에').note?.kind,'ending');
 assert.equal(say('s1e01-5','네, 알겠습니다. 감사해').note?.kind,'ending');
});

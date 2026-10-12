import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {getContentCatalog,generateContentIdeas,renderBriefMarkdown} from './content-engine.mjs';

const input=(extra={})=>({seriesId:'synkbrief-use',topic:'회의 메모에서 할 일 찾기',...extra});
const filled=()=>input({audience:'첫 업무를 맡은 동료',experience:'직접 적은 회의 메모에서 담당자를 다시 찾았다.',proof:'제작일의 원본 메모와 실제 실행 화면을 비교할 예정',takeaway:'담당자가 적힌 문장을 원본에서 대조하기',entertainment:'같은 이름이 메모와 표에서 이어지는 모습을 보기',authenticity:{basis:'직접 경험은 메모를 다시 읽었던 일. 도구 결과는 새로 검증해야 한다.',ownPerspective:'표의 모양보다 담당자와 기한의 근거를 먼저 본다.',limits:'메모에 없는 기한은 만들지 않는다.',disclosure:'예시 메모는 가상 자료로 표시한다.'}});

test('editorial experiment notes stay metadata across every series and never enter viewer ideas or reviews',()=>{
  const editorialNote='제작자 전용 실험표식\n72시간 완주율 40% · 이전 3편 중앙값 70%\n중간 설명만 줄이고 같은 출처로 다시 관측한다.\n출처 https://www.youtube.com/watch?v=abcdefghijk';
  for(const series of getContentCatalog().series){
    const values=input({seriesId:series.id}),baseline=generateContentIdeas(values),plan=generateContentIdeas({...values,editorialNote});
    assert.equal(plan.input.editorialNote,editorialNote);assert.deepEqual(plan.ideas,baseline.ideas,'editor notes cannot change narration, visuals, CTA or materials for '+series.id);
    for(const key of ['personalization','authenticity','reviewAxes','missingQuestions','checklist'])assert.deepEqual(plan[key],baseline[key],key+' must retain viewer-facing requirements');
    assert.doesNotMatch(JSON.stringify(plan.ideas),/제작자 전용 실험표식|72시간 완주율|abcdefghijk/);
    const markdown=renderBriefMarkdown(plan);assert.match(markdown,/## 이번 편 제작 실험/);assert.ok(markdown.includes(editorialNote));assert.doesNotMatch(markdown.slice(markdown.indexOf('## 안 1.')),/제작자 전용 실험표식|72시간 완주율|abcdefghijk/);
  }
});

test('editorial notes enforce their own size and text contract and are escaped only in the editor section',()=>{
  assert.equal(generateContentIdeas(input()).input.editorialNote,'');assert.equal(generateContentIdeas(input({editorialNote:'x'.repeat(3000)})).input.editorialNote.length,3000);
  for(const editorialNote of ['x'.repeat(3001),{},[],3,'bad\u0000note'])assert.throws(()=>generateContentIdeas(input({editorialNote})),TypeError);
  const raw='## forged heading\n<script>alert(1)</script>',plan=generateContentIdeas(input({editorialNote:raw})),markdown=renderBriefMarkdown(plan);assert.equal(plan.input.editorialNote,raw);assert.doesNotMatch(markdown,/<script>/);assert.match(markdown,/&lt;script&gt;/);assert.ok(!markdown.includes('\n## forged heading'));
});

test('catalog resolves ten company series and current synkbrief names to source documents',()=>{
  const catalog=getContentCatalog();assert.equal(catalog.series.length,10);
  assert.deepEqual(catalog.series.filter(s=>s.id.startsWith('synkbrief')).map(s=>s.name),['synkbrief 뉴스','synkbrief 활용','synkbrief 기초']);
  for(const series of catalog.series){assert.equal(series.angles.length,3);assert.ok(existsSync(resolve(series.sourcePath.split('#')[0])),series.sourcePath);}
  assert.ok(catalog.guidelines.some(item=>item.id==='both'));
});

test('catalog and generated plans cannot mutate shared templates or their input',()=>{
  const catalog=getContentCatalog();catalog.series[0].name='mutated';assert.equal(getContentCatalog().series[0].name,'synkbrief 뉴스');
  const original=filled(),copy=structuredClone(original),plan=generateContentIdeas(original);
  plan.ideas[0].materials.push('mutation');plan.input.authenticity.basis='mutation';
  assert.deepEqual(original,copy);assert.ok(!generateContentIdeas(original).ideas[0].materials.includes('mutation'));
});

test('minimal valid input returns three usable outlines and explicit missing questions',()=>{
  const plan=generateContentIdeas(input());
  assert.equal(plan.mode,'guided-template');assert.equal(plan.ideas.length,3);
  assert.equal(new Set(plan.ideas.map(idea=>idea.id)).size,3);assert.equal(new Set(plan.ideas.map(idea=>idea.hook)).size,3);
  assert.ok(plan.missingQuestions.some(q=>q.field==='proof'));assert.ok(plan.missingQuestions.some(q=>q.field==='takeaway'));assert.ok(plan.missingQuestions.some(q=>q.field==='entertainment'));
  assert.ok(!plan.missingQuestions.some(q=>q.field==='experience'),'non-experience series must not require a personal story');
  for(const idea of plan.ideas){assert.equal(idea.storyBeats.length,5);assert.ok(idea.viewerReason.includes('회의 메모'));assert.ok(idea.entertainment.includes('제안'));assert.ok(idea.factChecks.length>=5);assert.match(idea.takeaway,/작성할 내용/);}
});

test('every series has distinct format-aware concepts and exactly one topic substitution',()=>{
  for(const series of getContentCatalog().series){
    const plan=generateContentIdeas(input({seriesId:series.id,topic:'검증할 주제'}));
    assert.equal(plan.ideas.length,3);assert.equal(plan.sourcePaths.at(-1),series.sourcePath);
    for(const idea of plan.ideas){assert.match(idea.title,/검증할 주제/);assert.ok(idea.storyBeats.every(beat=>beat.time&&beat.visual&&beat.narration));assert.doesNotMatch(JSON.stringify(idea),/\{topic\}/);}
  }
  const writing=generateContentIdeas(input({seriesId:'writing-newsletter'}));assert.equal(writing.ideas[0].storyBeats[0].time,'첫 문장');
  const news=generateContentIdeas(input({seriesId:'synkbrief-news'}));assert.equal(news.ideas[0].storyBeats[0].time,'0~3초');
});

test('personal journey asks for actual events and never fabricates first-person success',()=>{
  const plan=generateContentIdeas(input({seriesId:'yuhobuilds'}));
  assert.ok(plan.missingQuestions.some(q=>q.field==='experience'));
  assert.equal(plan.checklist.find(item=>item.id==='experience').status,'needs-input');
  assert.match(plan.ideas[0].storyBeats[1].visual,/경험이 없는 상태/);
  assert.doesNotMatch(JSON.stringify(plan),/제가 성공했|직접 해보니|매출.*증가했|만들었더니|조회수.*올랐/);
  const withExperience=generateContentIdeas(input({seriesId:'yuhobuilds',experience:'출석 버튼을 찾다가 메뉴가 많다는 사실을 알았다.'}));
  assert.match(withExperience.ideas[0].storyBeats[1].narration,/출석 버튼을 찾다가 메뉴가 많다는 사실을 알았다\./);
  assert.match(withExperience.ideas[0].storyBeats[1].narration,/사실 확인 전/);
});

test('information and entertainment remain independent and both are required in the outline',()=>{
  const plan=generateContentIdeas(input({takeaway:'원문에서 날짜 확인하기'}));
  assert.equal(plan.checklist.find(item=>item.id==='information').status,'provided');
  assert.equal(plan.checklist.find(item=>item.id==='entertainment').status,'needs-input');
  const inverse=generateContentIdeas(input({entertainment:'정답을 고른 뒤 비교 화면 공개'}));
  assert.equal(inverse.checklist.find(item=>item.id==='information').status,'needs-input');
  assert.equal(inverse.checklist.find(item=>item.id==='entertainment').status,'provided');
});

test('authenticity records basis, perspective, limits and disclosure without a score or verdict',()=>{
  const empty=generateContentIdeas(input());assert.equal(empty.authenticity.items.length,4);
  assert.deepEqual(empty.authenticity.items.map(item=>item.status),['needs-input','needs-input','needs-input','review']);
  const plan=generateContentIdeas(filled());assert.ok(plan.authenticity.items.every(item=>item.status==='provided'));
  assert.ok(plan.authenticity.items.every(item=>item.detail.includes('확인 전')));
  assert.match(plan.authenticity.summary,/자동 판정한 결과가 아닙니다/);
  assert.ok(!('score' in plan.authenticity));assert.ok(!('verified' in plan.authenticity));
  assert.ok(!plan.missingQuestions.some(q=>q.field.startsWith('authenticity.')));
  assert.match(plan.ideas[2].storyBeats[0].narration,/회의 메모/);
});

test('submitted proof does not silently convert checks to verified or completed',()=>{
  const plan=generateContentIdeas(filled());
  assert.equal(plan.checklist.find(item=>item.id==='evidence').status,'provided');
  assert.ok(plan.checklist.every(item=>['provided','needs-input','review'].includes(item.status)));
  assert.match(plan.checklist.find(item=>item.id==='evidence').detail,/직접 대조/);
  assert.match(plan.ideas[0].factChecks[0],/비교할 예정/);
});

test('reference preserves unknown reactions and never certifies current popularity',()=>{
  const plan=generateContentIdeas(input({reference:{url:'https://www.instagram.com/reel/Example/',title:'참고할 공개 영상',publishedAt:'2026-09-20',checkedAt:'2026-09-27',reactions:{views:1000,likes:null},structure:'정답을 가리고 선택 뒤 공개'}}));
  assert.equal(plan.input.reference.reactions.views,1000);assert.equal(plan.input.reference.reactions.likes,null);assert.equal(plan.input.reference.reactions.comments,null);
  for(const idea of plan.ideas){assert.match(idea.referenceAdaptation,/정답을 가리고/);assert.match(idea.referenceAdaptation,/최신·인기 여부를 자동 검증하지 않았습니다/);}
  assert.equal(plan.checklist.find(item=>item.id==='reference').status,'review');
  assert.ok(!plan.missingQuestions.some(q=>q.field==='reference.dates'));
  const sparse=generateContentIdeas(input({reference:'https://www.instagram.com/reel/Example/'}));
  assert.ok(sparse.missingQuestions.some(q=>q.field==='reference.structure'));assert.ok(sparse.missingQuestions.some(q=>q.field==='reference.dates'));
});

test('LAB situation and expression keep separate casting and language checks',()=>{
  const situation=generateContentIdeas(input({seriesId:'lab-situation'})),expression=generateContentIdeas(input({seriesId:'lab-expression'}));
  assert.match(situation.ideas[0].storyBeats[1].visual,/AI 실사 인물/);
  assert.match(expression.ideas[0].storyBeats[1].visual,/마스코트 한 명/);
  assert.ok(situation.ideas[0].factChecks.some(value=>value.includes('학습자를 비웃지')));
  assert.ok(expression.ideas[0].factChecks.some(value=>value.includes('발음')&&value.includes('왜곡하지')));
  assert.match(JSON.stringify(expression),/교사 검토/);
});

test('interview plans leave actual quotes blank even when proof text was supplied',()=>{
  for(const seriesId of ['founder-clip','interview']){
    const plan=generateContentIdeas(input({seriesId,proof:'인터뷰 영상이 있다.'}));
    const quote=plan.ideas[0].storyBeats.find(beat=>beat.visual.includes('타임코드를 대조한 발언'));
    assert.ok(quote);assert.match(quote.narration,/작성할 내용/);assert.match(quote.narration,/실제 발언 원문/);
  }
});

test('invalid inputs fail before plan generation and ignore unrelated privileged fields',()=>{
  for(const value of [null,[],{},input({seriesId:'not-real'}),input({topic:' '}),input({topic:'x'.repeat(301)}),input({experience:{x:1}}),input({authenticity:[]}),input({authenticity:{basis:123}}),input({reference:'javascript:alert(1)'}),input({reference:{url:'https://name:secret@example.com'}}),input({reference:{reactions:{views:-1}}})])assert.throws(()=>generateContentIdeas(value),TypeError);
  const plan=generateContentIdeas(input({ownerId:'should-not-pass',channelContext:{id:'one',displayName:'Our channel',platform:'youtube',accessToken:'private'}}));
  assert.ok(!('ownerId' in plan.input));assert.ok(!('accessToken' in plan.input.channelContext));
});

test('same input is deterministic without current timestamps or network access',()=>{
  const raw=filled(),first=generateContentIdeas(raw),second=generateContentIdeas(raw);
  assert.deepEqual(first,second);assert.equal(renderBriefMarkdown(first),renderBriefMarkdown(second));
  assert.ok(!('generatedAt' in first));assert.equal(first.ideas[0].id,'synkbrief-use:follow');
});

test('Markdown contains all three concepts, real-source paths and authenticity questions',()=>{
  const plan=generateContentIdeas(filled()),out=renderBriefMarkdown(plan);
  assert.equal((out.match(/^## 안 /gm)||[]).length,3);
  assert.match(out,/## 진정성 검토/);assert.match(out,/우리만의 관점과 선택/);assert.match(out,/메모에 없는 기한은 만들지 않는다/);
  assert.match(out,/## 회사 제작 원문/);assert.match(out,/콘텐츠\\_제작양식\.md/);
  assert.ok(out.includes('직접 적은 회의 메모에서 담당자를 다시 찾았다.'));
  assert.ok(out.includes('기획 안내'));assert.ok(out.includes('입력됨 · 검토 전'));assert.doesNotMatch(out,/- \[x\]/);
  assert.match(renderBriefMarkdown(generateContentIdeas(input())),/## 더 작성할 질문/);
});

test('Markdown escapes injected HTML, images and links without deleting the user text',()=>{
  const raw=input({topic:'<script>alert(1)</script> ![image](https://example.com/a)',experience:'**실제**\n<script>bad()</script>',proof:'[click](javascript:alert(1))'});
  const out=renderBriefMarkdown(generateContentIdeas(raw));
  assert.doesNotMatch(out,/<script>/);assert.match(out,/&lt;script&gt;/);assert.ok(out.includes('\\!\\[image\\]\\(https://example.com/a\\)'));
  assert.ok(out.includes('\\[click\\]\\(javascript:alert\\(1\\)\\)'));
  assert.throws(()=>renderBriefMarkdown({mode:'fake',ideas:[],checklist:[]}),TypeError);
});

const personalized=()=>({situation:'회의가 끝나고 10분 안에 할 일을 보내야 하는 신입',choice:'담당자가 적혀 있으면 대조하고 없으면 동료에게 확인하기',nextStep:'자기 메모에서 한 문장을 골라 담당자와 기한을 표시하기'});
const analyzedReference=()=>({url:'https://www.instagram.com/reel/example/',title:'분류 질문 참고',publishedAt:'2026-09-20',checkedAt:'2026-09-27',hook:'두 메모 중 빠진 정보를 먼저 찾게 한다',structure:'혼자 선택 → 원문 단서 → 대조 과정 순서',payoff:'처음에는 못 본 빈칸을 스스로 발견한다',brandFit:'업무 초보가 자기 메모 상태에 맞춰 판단하게 돕는다',adaptation:'원본의 음식 비교를 우리 가상 회의 메모의 정보 비교로 바꾼다',reactions:{views:null,likes:0}});

test('four review axes never certify supplied fields and keep missing inputs actionable',()=>{
  const blank=generateContentIdeas(input());
  assert.deepEqual(blank.reviewAxes.map(axis=>axis.id),['fun','usefulness','authenticity','personalization']);
  assert.ok(blank.reviewAxes.every(axis=>axis.status==='needs-input'&&axis.questions.length&&axis.nextAction));
  assert.ok(blank.reviewAxes.every(axis=>!('score' in axis)&&!('passed' in axis)&&!('verified' in axis)));
  assert.ok(blank.reviewAxes.find(axis=>axis.id==='usefulness').questions.some(q=>q.includes('원문')));
  assert.ok(blank.reviewAxes.find(axis=>axis.id==='fun').questions.some(q=>q.includes('해소')));
  const full=generateContentIdeas({...filled(),personalization:personalized()});
  assert.ok(full.reviewAxes.every(axis=>axis.status==='review'));
  assert.match(full.reviewAxes.find(axis=>axis.id==='authenticity').reason,/실제 경험.*인증되지 않습니다/);
  assert.ok(full.reviewAxes.every(axis=>axis.evidence.length>0));
  assert.ok(full.personalization.items.every(item=>item.status==='review'));
  assert.match(full.personalization.summary,/이름 삽입이나 취향 추정/);
  assert.ok(full.sourcePaths.includes('docs/비전_정본.md'));
  assert.ok(full.sourcePaths.includes('docs/SYNK_플랫폼_계정과_연결_설계.md'));
});

test('personalization changes the viewer reason, opening, choices and ending in all series',()=>{
  for(const series of getContentCatalog().series){
    const personal=personalized(),original=generateContentIdeas(input({seriesId:series.id})),plan=generateContentIdeas(input({seriesId:series.id,personalization:personal}));
    assert.deepEqual(plan.input.personalization,personal);
    for(const [index,idea] of plan.ideas.entries()){
      for(const value of Object.values(personal))assert.ok(idea.viewerReason.includes(value));
      assert.notEqual(idea.hook,original.ideas[index].hook);assert.ok(idea.storyBeats[0].narration.includes(personal.situation));
      assert.ok(idea.storyBeats[2].narration.includes(personal.choice));assert.ok(idea.storyBeats.at(-1).narration.includes(personal.nextStep));
      assert.notDeepEqual(idea.storyBeats,original.ideas[index].storyBeats);
    }
  }
  const second=generateContentIdeas(input({personalization:{situation:'메모를 처음 작성하는 팀장',choice:'회의 전에 결정할 항목을 고르기',nextStep:'다음 회의의 질문 한 줄 작성하기'}}));
  assert.ok(!second.ideas[0].viewerReason.includes('10분 안에'));
  assert.ok(second.ideas[0].storyBeats.at(-1).narration.includes('질문 한 줄'));
});

test('missing personalization is a question rather than invented viewer history or shipped product',()=>{
  const plan=generateContentIdeas(input({personalization:{situation:'처음 한국어를 배우는 사람'}}));
  assert.deepEqual(plan.personalization.items.map(item=>item.status),['review','needs-input','needs-input']);
  for(const field of ['choice','nextStep'])assert.ok(plan.missingQuestions.some(q=>q.field==='personalization.'+field));
  assert.ok(plan.guidance.some(item=>item.includes('본인이 밝힌 정보·관측 사실·추정')));
  assert.ok(plan.guidance.some(item=>item.includes('장기 개인화 전체 시스템의 완성이나 효과를 이 기획으로 주장하지 않습니다')));
  assert.doesNotMatch(JSON.stringify(plan),/SYNK ID가 자동으로 기억합니다|성격을 분석했습니다|개인화 효과가 검증됐습니다/);
});

test('reference analysis affects production beats without copying it into dialogue or claiming popularity',()=>{
  const reference=analyzedReference(),plan=generateContentIdeas({...filled(),reference,personalization:personalized()});
  for(const idea of plan.ideas){
    const visuals=idea.storyBeats.map(beat=>beat.visual).join('\n'),dialogue=idea.storyBeats.map(beat=>beat.narration).join('\n');
    for(const key of ['hook','structure','payoff','brandFit','adaptation']){assert.ok(visuals.includes(reference[key]),key);assert.ok(idea.referenceAdaptation.includes(reference[key]),key);assert.ok(!dialogue.includes(reference[key]),key);}
    assert.match(idea.referenceAdaptation,/최신·인기 여부를 자동 검증하지 않았습니다/);
  }
  assert.equal(plan.input.reference.reactions.views,null);assert.equal(plan.input.reference.reactions.likes,0);
  const sparse=generateContentIdeas(input({reference:{url:reference.url}}));
  for(const key of ['hook','structure','payoff','brandFit','adaptation','dates','reactions'])assert.ok(sparse.missingQuestions.some(q=>q.field==='reference.'+key),key);
  assert.match(sparse.ideas[0].referenceAdaptation,/미확인/);
  assert.ok(!('trendScore' in sparse));
});

test('benchmark selection conditions, age and series fit remain explicit when missing',()=>{
  const plan=generateContentIdeas({...filled(),personalization:personalized(),benchmark:{id:'issue-1',itemId:'item-1',title:'회사 참고 1호',rank:1,stale:true,seriesIds:['lab-expression']}});
  for(const key of ['scope','periodStart','periodEnd','researchedAt','selectionBasis','freshness','seriesFit'])assert.ok(plan.missingQuestions.some(q=>q.field==='benchmark.'+key),key);
  assert.ok(plan.missingQuestions.some(q=>q.field==='reference.url'));
  assert.equal(plan.reviewAxes.find(axis=>axis.id==='personalization').status,'needs-input');
  assert.equal(plan.benchmark.rank,1);assert.equal(plan.benchmark.stale,true);
  assert.deepEqual(plan.benchmark,plan.input.benchmark);
  assert.match(plan.ideas[0].referenceAdaptation,/플랫폼 전체 인기 순위를 뜻하지 않습니다/);
  const unknown=generateContentIdeas(input({benchmark:{}}));assert.equal(unknown.benchmark.stale,null);
  assert.ok(unknown.missingQuestions.some(q=>q.field==='benchmark.freshness'&&q.question.includes('미확인')));
});

test('complete company benchmark metadata preserves its provenance without certifying the result',()=>{
  const reference=analyzedReference(),benchmark={id:'issue-1',itemId:'item-1',title:'업무 참고',scope:'직접 확인한 릴스 8개',periodStart:'2026-09-20',periodEnd:'2026-09-27',researchedAt:'2026-09-27T00:00:00Z',selectionBasis:'우리 업무 대상에 맞는 설명 구조',rank:2,stale:false,seriesIds:['synkbrief-use'],...Object.fromEntries(['hook','structure','payoff','brandFit','adaptation'].map(key=>[key,reference[key]]))};
  const raw={...filled(),reference,benchmark,personalization:personalized()},copy=structuredClone(raw),plan=generateContentIdeas(raw);
  assert.deepEqual(plan.benchmark,benchmark);assert.ok(!plan.missingQuestions.some(q=>q.field.startsWith('benchmark.')));
  assert.ok(plan.reviewAxes.every(axis=>axis.status==='review'));
  plan.benchmark.scope='mutated';assert.deepEqual(raw,copy);assert.equal(plan.input.benchmark.scope,benchmark.scope);
  const withoutCounts=generateContentIdeas({...raw,reference:{...reference,reactions:{}}});
  assert.ok(withoutCounts.missingQuestions.some(q=>q.field==='reference.reactions'));
});

test('personalization and benchmark inputs reject malformed fields and discard privileged metadata',()=>{
  for(const extra of [{personalization:[]},{personalization:{choice:1}},{personalization:{situation:'x'.repeat(2001)}},{benchmark:[]},{benchmark:{rank:0}},{benchmark:{rank:'1'}},{benchmark:{stale:'yes'}},{benchmark:{seriesIds:'all'}},{benchmark:{seriesIds:[42]}},{reference:{hook:42}}])assert.throws(()=>generateContentIdeas(input(extra)),TypeError);
  const plan=generateContentIdeas(input({benchmark:{id:'one',apiKey:'private',ownerId:'other'},personalization:{situation:'가정한 상황',trackingId:'private'}}));
  assert.ok(!('apiKey' in plan.benchmark));assert.ok(!('ownerId' in plan.benchmark));assert.ok(!('trackingId' in plan.input.personalization));
});

test('Markdown exports personalization, four axes, reference analysis and benchmark limits safely',()=>{
  const plan=generateContentIdeas({...filled(),personalization:personalized(),reference:analyzedReference(),benchmark:{id:'one',title:'<script>bad</script>',rank:1,stale:true}}),out=renderBriefMarkdown(plan);
  assert.match(out,/## 개인화 방향 검토/);assert.match(out,/## 네 가지 콘텐츠 검토 축/);
  for(const label of ['재미와 몰입','도움과 이해','진정성과 사실','SYNK다운 개인화'])assert.ok(out.includes(label));
  assert.ok(out.includes(personalized().nextStep));assert.ok(out.includes('다음 수정:'));
  assert.match(out,/## 회사 참고 선정 기록/);assert.match(out,/플랫폼 전체 순위나 콘텐츠 효과의 인증이 아닙니다/);
  assert.match(out,/갱신 상태: 다시 확인 필요/);assert.match(out,/미확인/);assert.doesNotMatch(out,/<script>/);
  assert.match(out,/&lt;script&gt;/);assert.ok(out.includes('음식 비교'));assert.doesNotMatch(out,/- \[x\]/);
});

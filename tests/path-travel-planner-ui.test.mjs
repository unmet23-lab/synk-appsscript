import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { TRAVEL_PLACES } from '../experiences/path-travel/places-v2.mjs';
import { normalizePlannerInput, planTravel, replanRemainingTravel, plannerInputFingerprint, PREFERENCE_LABELS } from '../experiences/path-travel/planner.mjs';
import { createTravelMemory, validateTravelMemory } from '../experiences/path-travel/planner-storage.mjs';
import { recordPlanDecision, recordPlanExposure, recordVisit, confirmTravelPreference, removeTravelPreference, removeTravelVisit, clearTravelHistory, recordTripOutcome } from '../experiences/path-travel/planner-feedback.mjs';
import { createMapOrigin } from '../experiences/path-travel/planner-origin.mjs';

// Exercise the shipped controller functions with small DOM stubs. Browser visual,
// focus and download verification remain separate; this covers state regressions.
const source = readFileSync(new URL('../experiences/path-travel/planner-ui.mjs', import.meta.url), 'utf8');
const html = readFileSync(new URL('../experiences/path-travel/planner.html', import.meta.url), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
function controller(name) {
  const match = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`, 'm'));
  assert.ok(match, `controller ${name} must remain testable`);
  return match[0];
}
const now = '2026-10-09T03:00:00.000Z';
const query = { date: '2026-10-10', startTime: '10:00', endTime: '18:00',
  origin: { id: 'anguk', name: '안국역', lat: 37.5765, lon: 126.9854 },
  party: { adults: 1, children: 0 }, budget: 70000, maxWalkMinutes: 100, stopCount: 3,
  preferences: {}, requiredFeatures: {}, requiredCategories: [], lockedIds: [], excludedIds: [] };
const originalResult = planTravel(query, { now, ask: false });
let originalMemory = createTravelMemory({ query: originalResult.input, plan: originalResult.primary }, { now });
originalMemory = recordPlanDecision(originalMemory, { planId: originalMemory.plan.id, now });
originalMemory = recordPlanExposure(originalMemory, { decisionId: originalMemory.journal.decisions.at(-1).id, now });

function harness(memory = originalMemory, functions = ['readInput', 'writeInput']) {
  const controls = new Map();
  const get = selector => {
    if (!controls.has(selector)) controls.set(selector, { value: '', checked: false, hidden: false, options: [],
      append(option) { this.options.push(option); }, replaceChildren(){this.options=[];}, closest(){return null;}, focus() {}, scrollIntoView() {}, close() {} });
    return controls.get(selector);
  };
  const checkboxes = ['preference', 'avoid'].flatMap(name => [...html.matchAll(new RegExp(`name="${name}" value="([^"]+)"`, 'g'))].map(match => ({ name, value: match[1], checked: false })));
  const tastes = [...html.matchAll(/data-taste="([^"]+)"/g)].map(match => ({ dataset: { taste: match[1] }, value: '' }));
  const rendered = [], notices = [];
  const context = vm.createContext({
    memory: copy(memory), outcome: copy(originalResult), pending: null, restored: false, mapZoom: 1,
    formDirty: false, formPreferences: {}, formRequiredFeatures: {}, formRequiredCategories: [],
    activeDecision: null, exposureObserver: null, origins: [copy(query.origin)], destinationDraft:null,companionDraft:[],TRAVEL_PLACES,PREFERENCE_LABELS,e:String,placeMap:new Map(TRAVEL_PLACES.map(p=>[p.id,p])),
    $: get, $$: selector => selector === '[data-taste]' ? tastes : checkboxes.filter(input => selector.includes(`name=${input.name}`) && (!selector.includes(':checked') || input.checked)),
    document: { visibilityState: 'visible', createElement: () => ({}), body: { classList: { add() {}, remove() {} } } },
    normalizePlannerInput: value => normalizePlannerInput(copy(value), { places: TRAVEL_PLACES }),
    plannerInputFingerprint,
    now: () => now, defaultTravelQuery: () => ({ date: '2026-10-09' }),
    settings: () => ({ now, ask: false }),
    planTravel: value => planTravel(copy(value), { now, ask: false }),
    recordPlanDecision: (value, options) => recordPlanDecision(copy(value), copy(options)),
    recordPlanExposure: (value, options) => recordPlanExposure(copy(value), copy(options)),
    renderResult: () => rendered.push('result'), renderProgressSummary: () => {}, renderUnavailable: () => rendered.push('unavailable'), persist: () => {},
    toast: message => notices.push(message), beginExposure: () => {}, clearRecovery: () => {}, pushView: () => {}, intentSpecs: () => [], picksFromQuery: () => {},
    IntersectionObserver: class { constructor(callback) { this.callback = callback; } observe() { this.callback([{ isIntersecting: true }]); } disconnect() {} },
    matchMedia: () => ({ matches: true }), structuredClone, innerWidth: 1280,
  });
  vm.runInContext([...new Set([...functions,'readPreferences','readMeal','syncScheduleFields','readScheduleInput','writeScheduleInput','progressMealFields','readCompanions','writeCompanions','renderCompanions','updateCompanionCount'])].map(controller).join('\n'), context);
  return { context, get, checkboxes, tastes, rendered, notices,
    run: code => vm.runInContext(code, context), read: code => copy(vm.runInContext(code, context)) };
}

test('startup renders a consented itinerary snapshot without changing guest bytes before the login handoff',async()=>{
 const guest=copy(originalMemory);guest.consent=true;
 const h=harness(guest,['restorePlan','writeInput']);let writes=0,connected=false;
 h.context.persist=()=>writes++;
 h.context.connectTravelAccount=async()=>{connected=true;assert.equal(writes,0);assert.deepEqual(h.read('memory'),guest);};
 const boot=source.slice(source.lastIndexOf('// Startup must leave saved bytes untouched'));
 assert.match(boot,/await connectTravelAccount/);
 await h.run(`(async()=>{${boot}\n})()`);
 assert.equal(connected,true);assert.equal(writes,0);assert.equal(h.read('memory.consent'),true);
});

test('saved snapshots keep explicit adjustment actions for today and future dates',()=>{
 for(const [date,hidden] of [['2026-10-08',true],['2026-10-09',false],['2026-10-10',false]]){
  const h=harness(originalMemory,['renderResult']);h.context.memory.query.date=date;h.context.restored='snapshot';h.context.outcome=null;
  Object.assign(h.context,{money:String,categoryLabel:{},categoryShort:{},seoulDay:String,placeTile:()=>'',renderConditionChips(){},photo:()=>'',credit:()=>'',directionLink:()=>'',safeUrl:()=>'',scheduleNote:()=>'',companionSummary:()=>'',renderJourney(){},renderMap(){},renderAlternatives(){},renderEvidence(){},TRAVEL_META:{checkedAt:'test'},network:null});
  h.get('#plan-overview').insertAdjacentHTML=()=>{};
  h.run('renderResult()');assert.equal(h.get('#quick-actions').hidden,hidden);
 }
});

test('future document timestamps do not change the actual date used for planning',()=>{
 const h=harness();h.context.memory.updatedAt='2099-01-01T00:00:00.000Z';h.context.now=()=>h.context.memory.updatedAt;h.context.routeLeg=null;
 h.run(controller('settings'));const before=Date.now();const actual=Date.parse(h.read('settings().now'));
 assert.ok(actual>=before&&actual<=Date.now());assert.notEqual(actual,Date.parse(h.context.memory.updatedAt));
});

test('all feedback actions keep a fast-device event clock when editing on a slower device',()=>{
 const future='2099-01-01T00:00:00.000Z';
 let guest=createTravelMemory({query:originalResult.input,plan:originalResult.primary},{now:future});
 guest=recordPlanDecision(guest,{planId:guest.plan.id,now:future});guest=recordPlanExposure(guest,{decisionId:guest.journal.decisions[0].id,now:future});
 guest=recordVisit(guest,{placeId:guest.plan.stops[0].placeId,planId:guest.plan.id,decisionId:guest.journal.decisions[0].id,rating:4,reasons:[],now:future});guest=confirmTravelPreference(guest,{key:'indoor',value:true,now:future});
 const cases=[
  ["if(target.dataset.forgetPref)",{target:{dataset:{forgetPref:'indoor'}}}],
  ["if(target.dataset.deleteVisit)",{target:{dataset:{deleteVisit:guest.visits[0].id}}}],
  ["if(target.dataset.confirmPreference)",{target:{dataset:{confirmPreference:'tea',value:'true'}}}],
  ["case 'clear-history':",{}],
  ["if(event.target.id==='preference-form')",{event:{target:{id:'preference-form'}}}],
  ["if(event.target.id==='trip-rating-form')",{event:{target:{id:'trip-rating-form'}}}],
 ];
 for(const [prefix,values]of cases){
  const h=harness(guest);h.context.activeDecision=guest.journal.decisions[0].id;
  Object.assign(h.context,values,{now:()=>future,confirmTravelPreference:(m,o)=>confirmTravelPreference(copy(m),copy(o)),removeTravelPreference:(m,k,o)=>removeTravelPreference(copy(m),k,copy(o)),removeTravelVisit:(m,k,o)=>removeTravelVisit(copy(m),k,copy(o)),clearTravelHistory:(m,o)=>clearTravelHistory(copy(m),copy(o)),recordTripOutcome:(m,o)=>recordTripOutcome(copy(m),copy(o)),invalidatePreferencePreview(){},renderMemory(){}});
  h.get('#preference-key').value='tea';h.get('#preference-value').value='true';h.get('#trip-rating').value='4';
  let line=source.split('\n').find(row=>row.trim().startsWith(prefix));assert.ok(line,prefix);
  if(prefix.startsWith('case'))line=line.slice(line.indexOf(':')+1).replace(/break;\s*$/,'');
  h.run(`(()=>{${line}})()`);assert.equal(h.read('memory.updatedAt'),future,prefix);
  assert.doesNotThrow(()=>validateTravelMemory(h.read('memory')));
 }
});

test('지도 출발점 이름 편집은 적용된 query와 분리되고 이전안 복원 시 이름도 돌아온다',()=>{
 const h=harness(originalMemory,['writeInput','acceptOrigin']);
 h.context.memory.query.origin=createMapOrigin({lat:37.5765,lon:126.9854},'원래 숙소');
 h.context.createMapOrigin=createMapOrigin;h.context.originTarget='trip';h.context.originDraft={lat:37.5765,lon:126.9854};
 h.run('writeInput(memory.query)');h.get('#origin-name').value='다른 이름';h.run('acceptOrigin()');
 assert.equal(h.context.memory.query.origin.name,'원래 숙소');assert.equal(h.read('origins.at(-1).name'),'다른 이름');assert.equal(h.context.formDirty,true);
 h.run('writeInput(memory.query)');assert.equal(h.read('origins.at(-1).name'),'원래 숙소');
 assert.equal(h.get('#origin').options.at(-1).textContent,'원래 숙소');
});

test('복구안은 명시 적용 때만 바뀌고 취소된 선택지는 사용할 수 없다',()=>{
 const h=harness(originalMemory,['applyRecovery','clearRecovery']);let applied=null;
 h.context.recoveryChoices=[{result:copy(originalResult),progress:null}];h.context.acceptResult=value=>{applied=value;};
 const previous=h.context.memory.plan.id;
 h.run('applyRecovery(0)');assert.equal(applied.primary.id,previous);assert.equal(h.read('recoveryChoices.length'),0);
 applied=null;h.run('applyRecovery(0)');assert.equal(applied,null);assert.match(h.notices.at(-1),/다시 계산/);
});

test('식사·예약·마지막 도착점은 폼 복원과 명시 해제를 거쳐 그대로 전달된다',()=>{
 const h=harness();const destination=createMapOrigin({lat:37.574721,lon:126.983216},'마지막 약속 장소');
 Object.assign(h.context.memory.query,{destination,appointments:[{placeId:'unhyeongung',time:'14:00'}],meal:{mode:'window',startTime:'12:00',endTime:'13:00'}});
 h.run('writeInput(memory.query);globalThis.roundTrip=readInput();');
 assert.deepEqual(h.read('roundTrip.destination'),destination);assert.deepEqual(h.read('roundTrip.appointments'),[{placeId:'unhyeongung',time:'14:00'}]);
 assert.deepEqual(h.read('roundTrip.meal'),{mode:'window',startTime:'12:00',endTime:'13:00'});assert.equal(h.get('#meal-window').hidden,false);
 h.get('#meal-start').value='';assert.throws(()=>h.run('readInput()'),/식사/);
 h.get('#meal-mode').value='none';h.get('#appointment-place-0').value='';h.get('#destination').value='';h.run('syncScheduleFields();globalThis.cleared=readInput();');
 assert.equal(h.read('cleared.meal.mode'),'none');assert.deepEqual(h.read('cleared.appointments'),[]);assert.equal(h.read('cleared.destination'),null);assert.equal(h.get('#meal-window').hidden,true);
});

test('식사 시간창을 해제하면 숨긴 잘못된 시각이 주폼과 여행 중 재계획을 막지 않는다',()=>{
 for(const prefix of ['', 'progress-'])for(const mode of ['any','none']){
  const h=harness();h.get('#'+prefix+'meal-mode').value='window';h.get('#'+prefix+'meal-start').value='13:00';h.get('#'+prefix+'meal-end').value='12:00';
  assert.throws(()=>normalizePlannerInput({...query,meal:h.read(`readMeal('${prefix}')`)}));
  h.get('#'+prefix+'meal-mode').value=mode;h.run(`syncScheduleFields('${prefix}')`);
  const input=normalizePlannerInput({...query,meal:h.read(`readMeal('${prefix}')`)});
  assert.equal(input.meal.mode,mode);assert.equal(h.get('#'+prefix+'meal-window').hidden,true);
 }
});

test('지도 도착점 변경은 적용된 출발점과 저장된 도착점을 바꾸지 않는다',()=>{
 const h=harness(originalMemory,['writeInput','acceptOrigin']);h.context.originTarget='destination';h.context.originDraft={lat:37.574721,lon:126.983216};h.context.createMapOrigin=createMapOrigin;
 h.run('writeInput(memory.query)');h.get('#origin-name').value='새 도착점';h.run('acceptOrigin()');
 assert.equal(h.get('#destination').value,'custom');assert.equal(h.read('destinationDraft.name'),'새 도착점');assert.deepEqual(h.read('memory.query.origin'),query.origin);assert.equal(h.context.memory.query.destination,null);assert.equal(h.context.formDirty,true);
 h.run('writeInput(memory.query)');assert.equal(h.get('#destination').value,'');assert.equal(h.context.destinationDraft,null);
});

test('계정에서 돌아온 미적용 게스트 식사 시간창은 입력칸까지 다시 열린다',()=>{
 const h=harness(originalMemory,['restoreGuestDraft']);h.context.labelOriginPicker=()=>{};
 const controls=['#meal-mode','#meal-start','#meal-end'].map(id=>h.get(id));
 h.get('#trip-form').querySelectorAll=()=>controls;controls[0].value='any';h.run('syncScheduleFields()');
 h.context.draft={origins:[query.origin],controls:[{value:'window'},{value:'12:15'},{value:'13:15'}],formDirty:true,formPreferences:{},formRequiredFeatures:{},formRequiredCategories:[],outcome:null,pending:null,recoveryChoices:[],changeHtml:'',changeHidden:true,destinationDraft:null,originTarget:'trip',originDraft:null,originHtml:'',originHeading:'',originFooter:'',originControls:[],originOpen:false};
 h.run('restoreGuestDraft(draft)');assert.equal(h.get('#meal-window').hidden,false);assert.equal(h.get('#meal-start').disabled,false);assert.deepEqual(h.read('readMeal()'),{mode:'window',startTime:'12:15',endTime:'13:15'});
});

test('동행의 폼 왕복과 삭제는 공통 취향·확정 계획을 바꾸지 않고 명시 적용을 기다린다',()=>{
 const h=harness(originalMemory,['readInput','writeInput','editCompanions']);
 h.context.memory.query.party.adults=2;
 h.context.memory.query.companions=[{id:'person-1',label:'역사 친구',preferences:{history:true,coffee:false},requiredFeatures:{indoor:false}}];
 h.run('writeInput(memory.query)');
 assert.deepEqual(h.read('readInput().companions'),h.context.memory.query.companions);
 const accepted=copy(h.context.memory.query);h.run("editCompanions('remove','person-1')");
 assert.deepEqual(h.read('readInput().companions'),[]);assert.deepEqual(h.context.memory.query,accepted);assert.equal(h.context.formDirty,true);
 h.run('writeInput(memory.query)');assert.equal(h.read('readInput().companions[0].preferences.coffee'),false);assert.equal(h.read('readInput().companions[0].requiredFeatures.indoor'),false);
 assert.deepEqual(h.read('memory.confirmedPreferences'),[]);assert.deepEqual(h.read('readInput().preferences'),accepted.preferences);
});

test('동행 카드의 편집은 해당 인물에게만 적용되고 화면에 없는 필수 조건도 보존한다',()=>{
 const h=harness();h.context.companionDraft=[{id:'person-1',label:'전 이름',preferences:{art:true,coffee:true},requiredFeatures:{outdoor:false,stepFree:true}}];
 const controls={preferences:[{dataset:{companionPreference:'art'},value:'false'},{dataset:{companionPreference:'coffee'},value:''}],required:[{dataset:{companionRequired:'stepFree'},checked:false}]};
 const otherSelect=h.context.$$;h.context.$$=selector=>selector==='[data-companion-id]'?[{dataset:{companionId:'person-1'},querySelector:()=>({value:'새 별칭'}),querySelectorAll:selector=>selector==='[data-companion-preference]'?controls.preferences:controls.required}]:otherSelect(selector);
 assert.deepEqual(h.read('readCompanions()'),[{id:'person-1',label:'새 별칭',preferences:{art:false},requiredFeatures:{outdoor:false}}]);
 assert.equal(h.read('companionDraft[0].label'),'전 이름');assert.deepEqual(h.read('memory.confirmedPreferences'),[]);
});

test('공유용 일정에는 동행 별칭과 개인별 취향을 넣지 않는다',()=>{
 const h=harness(originalMemory,['exportText']);
 h.context.memory.query.party.adults=2;h.context.memory.query.companions=[{id:'person-1',label:'내보내지 않을 별칭',preferences:{quiet:false},requiredFeatures:{}}];
 let output='';h.context.download=text=>{output=text;};h.context.money=String;h.context.placeLink=()=> 'https://example.test/place';h.context.directionLink=()=> 'https://example.test/route';
 h.run('exportText()');assert.match(output,/SYNK PATH/);assert.doesNotMatch(output,/내보내지 않을 별칭|quiet|조용한 곳/);assert.equal(h.context.memory.query.companions.length,1);
});

test('장소 유지 변경 뒤에는 예전 잠금으로 만든 질문·대안·복구안을 적용할 수 없다',()=>{
 const h=harness(originalMemory,['invalidatePreferencePreview','clearRecovery','applyRecovery']);
 h.context.recoveryChoices=[{result:copy(originalResult),progress:null}];h.context.pending=copy(originalResult);
 h.context.target={dataset:{lock:originalResult.primary.stops[0].placeId}};
 const branch=source.match(/if\(target.dataset.lock\)\{[^]*?return;\}/)?.[0];assert.ok(branch);
 h.run(`function toggle(){${branch}}toggle();`);
 assert.deepEqual(h.read('memory.query.lockedIds'),[originalResult.primary.stops[0].placeId]);
 assert.ok(h.context.pending===null);assert.equal(h.read('recoveryChoices.length'),0);
 assert.deepEqual(h.read('outcome.alternatives'),[]);assert.equal(h.context.outcome.question,null);
 let applied=false;h.context.acceptResult=()=>{applied=true;};h.run('applyRecovery(0)');assert.equal(applied,false);
});

test('전체 초기화는 옛 복구안과 개인 출발점 이름도 지우고 재적용을 막는다',()=>{
 const h=harness(originalMemory,['writeInput','clearRecovery','resetOriginChoices','applyRecovery']);
 h.context.recoveryChoices=[{result:copy(originalResult),progress:null}];h.context.pending=copy(originalResult);h.context.formDirty=true;
 h.context.baseOrigins=[copy(query.origin)];h.context.origins.push(createMapOrigin({lat:37.575,lon:126.98},'개인 숙소'));
 h.context.accountSession=null;h.context.createTravelMemory=()=>createTravelMemory({}, {now});h.context.clearTravelMemory=()=>{};h.context.renderMemory=()=>{};
 h.get('#origin').replaceChildren=function(){this.options=[];};h.get('#plan-change').hidden=false;
 const branch=source.match(/case 'reset-all':([^]*?)break;/)?.[1];assert.ok(branch);h.run(branch);
 assert.equal(h.context.memory.plan,null);assert.equal(h.read('recoveryChoices.length'),0);assert.equal(h.context.formDirty,false);
 assert.equal(h.get('#plan-change').hidden,true);assert.deepEqual(h.read('origins'),[query.origin]);
 let applied=false;h.context.acceptResult=()=>{applied=true;};h.run('applyRecovery(0)');assert.equal(applied,false);
});

test('폼 왕복은 반대 취향과 폼에 없는 개인화·필수 조건도 보존한다', () => {
  const h = harness();
  h.context.memory.query.preferences = { outdoor: false, walk: false, culture: true };
  h.context.memory.query.requiredFeatures = { quiet: true };
  h.context.memory.query.requiredCategories = ['tea'];
  h.run('writeInput(memory.query);globalThis.roundTrip=readInput();');
  assert.deepEqual(h.read('roundTrip.preferences'), { outdoor: false, culture: true, walk: false });
  assert.deepEqual(h.read('roundTrip.requiredFeatures'), { quiet: true });
  assert.deepEqual(h.read('roundTrip.requiredCategories'), ['tea']);
  h.get('#budget').value = '';
  assert.throws(() => h.run('readInput()'), /숫자로/);
});

test('세부 취향과 걷기·휴식 조건은 복원·수정·선택 해제를 거쳐 실제 입력으로 전달된다', () => {
  const h = harness();
  Object.assign(h.context.memory.query, { preferences: { coffee: false, dumplings: true }, maxLegWalkMinutes: 17, restEveryMinutes: 75, restDurationMinutes: 12 });
  h.run('writeInput(memory.query);globalThis.roundTrip=readInput();');
  assert.deepEqual(h.read('roundTrip.preferences'), { coffee: false, dumplings: true });
  assert.equal(h.read('roundTrip.maxLegWalkMinutes'), 17);
  assert.equal(h.read('roundTrip.restEveryMinutes'), 75);
  assert.equal(h.read('roundTrip.restDurationMinutes'), 12);
  h.tastes.find(s => s.dataset.taste === 'coffee').value = '';
  h.tastes.find(s => s.dataset.taste === 'traditionalTea').value = 'true';
  h.get('#max-leg-walk').value = ''; h.get('#rest-every').value = '';
  h.run('globalThis.changed=readInput();');
  assert.deepEqual(h.read('changed.preferences'), { dumplings: true, traditionalTea: true });
  assert.equal(h.read('changed.maxLegWalkMinutes'), null);
  assert.equal(h.read('changed.restEveryMinutes'), null);
});

test('결과 없음은 이전 적용안·개인화 조건·대안을 지우지 않고 수정 상태를 남긴다', () => {
  const h = harness(originalMemory, ['readInput', 'writeInput', 'acceptResult']);
  const oldPlanId = h.context.memory.plan.id, oldOutcome = copy(h.context.outcome);
  h.context.formDirty = true;
  h.context.failure = { status: 'unavailable', primary: null, alternatives: [], input: { ...query, budget: 0 }, blocked: [], unknowns: [] };
  h.run('acceptResult(failure)');
  assert.equal(h.context.memory.plan.id, oldPlanId);
  assert.deepEqual(h.read('outcome'), oldOutcome);
  assert.equal(h.context.memory.query.budget, query.budget);
  assert.equal(h.context.formDirty, true);
  assert.deepEqual(h.rendered, ['unavailable']);
});

test('평소 취향 변경은 현재 일정을 보존하고 이전 질문·대안·적용 대기안을 무효화한다', () => {
  const h = harness(originalMemory, ['invalidatePreferencePreview']);
  h.context.outcome.question = { about: 'indoor' }; h.context.pending = copy(originalResult);
  const plan = copy(h.context.memory.plan);
  h.run('invalidatePreferencePreview()');
  assert.equal(h.context.pending, null);
  assert.equal(h.context.outcome.question, null);
  assert.deepEqual(h.read('outcome.alternatives'), []);
  assert.deepEqual(h.read('memory.plan'), plan);
  assert.equal(h.get('#plan-change').hidden, true);
});

test('이전 여행안으로 돌아가기는 화면 입력도 이전 적용 조건으로 돌린다', () => {
  const h = harness();
  h.get('#budget').value = '0'; h.context.formDirty = true;
  const body = source.match(/case 'previous-plan':([^]*?)break;/)?.[1];
  assert.ok(body);
  h.run(body);
  assert.equal(Number(h.get('#budget').value), query.budget);
  assert.equal(h.context.formDirty, false);
  assert.deepEqual(h.rendered, ['result']);
});

test('지난 여행 snapshot은 새 추천 호출 없이 복원되어 기존 방문·취향을 유지한다', () => {
  const memory = copy(originalMemory); memory.query.date = '2026-10-01';
  const h = harness(memory, ['readInput', 'writeInput', 'restorePlan']);
  h.context.planTravel = () => { throw new Error('past trips must not be recomputed'); };
  h.run('restorePlan()');
  assert.equal(h.context.restored, 'snapshot');
  assert.equal(h.context.memory.plan.id, memory.plan.id);
  assert.deepEqual(h.read('memory.journal'), memory.journal);
  assert.deepEqual(h.rendered, ['result']);
});

test('같은 일정 복원은 임시 유지 설정을 제거하고 이전 방문 연결 ID를 지킨다', () => {
  const h = harness(originalMemory, ['readInput', 'writeInput', 'beginExposure', 'restorePlan']);
  const before = copy(h.context.memory), candidate = copy(originalResult);
  candidate.primary.id = 'temporary-locks-result'; candidate.input.lockedIds = before.plan.stops.map(stop => stop.placeId);
  candidate.primary.lockedIds = [...candidate.input.lockedIds];
  h.context.planTravel = () => copy(candidate);
  h.run('restorePlan()');
  assert.equal(h.context.memory.plan.id, before.plan.id);
  assert.deepEqual(h.read('memory.query.lockedIds'), before.query.lockedIds);
  assert.deepEqual(h.read('memory.plan.lockedIds'), before.query.lockedIds);
  assert.equal(h.context.activeDecision, before.journal.decisions.at(-1).id);
  assert.equal(h.context.memory.journal.decisions.length, before.journal.decisions.length);
});

test('다르게 다시 계산된 일정은 새 결정·실제 노출을 연결해 이후 여행 평가를 받는다', () => {
  const h = harness(originalMemory, ['readInput', 'writeInput', 'beginExposure', 'restorePlan']);
  const candidate = copy(originalResult); candidate.primary.id = 'new-route'; candidate.primary.stops[0].arrivalTime = '10:30';
  h.context.planTravel = () => copy(candidate);
  h.run('restorePlan()');
  const decision = h.context.memory.journal.decisions.at(-1);
  assert.equal(decision.selectedId, 'new-route');
  assert.equal(h.context.activeDecision, decision.id);
  assert.ok(h.context.memory.journal.exposures.some(row => row.decisionId === decision.id && row.candidateId === 'new-route'));
});

test('진행 기록 복원은 남은 일정과 자기보고를 다시 추천하거나 과거 장소를 복원하지 않는다', () => {
  const memory=copy(originalMemory);
  memory.progress={date:query.date,currentTime:'12:00',completed:[{placeId:'unhyeongung',completedTime:'12:00'}],skippedIds:[],finished:false,requiredCategories:[],updatedAt:now};
  const h=harness(memory,['writeInput','restorePlan']);
  h.context.planTravel=()=>{throw new Error('progress must remain a snapshot');};
  h.run('restorePlan()');
  assert.equal(h.context.restored,'progress');
  assert.deepEqual(h.read('memory.progress'),memory.progress);
  assert.equal(h.context.memory.plan.id,memory.plan.id);
});

test('남은 일정 수락은 계획·query·진행 기록을 함께 반영하고 평가를 만들지 않는다', () => {
  const completedId=originalMemory.plan.stops[0].placeId;
  const result=replanRemainingTravel(query,{now,ask:false,completedIds:[completedId],skippedIds:[],currentTime:'13:00',origin:query.origin,remainingBudget:5000,maxWalkMinutes:60,stopCount:1});
  assert.ok(result.primary);
  result.progress={date:query.date,currentTime:'13:00',completed:[{placeId:completedId,completedTime:'13:00'}],skippedIds:[],finished:false,requiredCategories:[],updatedAt:now};
  const h=harness(originalMemory,['writeInput','acceptResult']);h.context.result=copy(result);
  h.run('acceptResult(result,{scroll:false,record:false})');
  assert.equal(h.context.memory.query.planningMode,'remaining');
  assert.equal(h.context.memory.plan.stops.length,1);
  assert.deepEqual(h.read('memory.progress'),result.progress);
  assert.deepEqual(h.read('memory.visits'),originalMemory.visits);
  assert.deepEqual(h.read('memory.confirmedPreferences'),originalMemory.confirmedPreferences);
});

test('진행 후 주폼의 명시 필수 변경은 다음 재계산에서 되살거나 사라지지 않는다', () => {
  const h=harness(originalMemory,['writeInput','acceptResult']);
  h.context.memory.query.requiredCategories=['food'];
  h.context.memory.progress={requiredCategories:['food','culture']};
  h.context.result=copy(originalResult);h.context.result.input.requiredCategories=['tea'];
  h.run('acceptResult(result,{scroll:false,record:false})');
  assert.deepEqual(h.read('memory.progress.requiredCategories'),['culture','tea']);
});

test('마친 여행 복원은 빈 결과나 옛 후보 화면을 다시 보여 주지 않는다', () => {
  const memory=copy(originalMemory);memory.plan=null;memory.progress={finished:true};
  const h=harness(memory,['restorePlan']);h.run('restorePlan()');
  assert.equal(h.get('#result').hidden,true);
  assert.equal(h.get('#empty-result').hidden,true);
  assert.equal(h.get('#before-result').hidden,true);
});

test('마친 여행의 주폼 미적용 입력은 저장된 조건으로 복원한 뒤 진행 정정을 연다', () => {
  const memory=copy(originalMemory);memory.plan=null;memory.query.planningMode='remaining';
  memory.progress={date:query.date,currentTime:'12:00',completed:[],skippedIds:[],finished:true,requiredCategories:[],updatedAt:now};
  const h=harness(memory,['writeInput','progressPlaceIds','progressOrigins','showProgress']);
  Object.assign(h.context,{koreanDate:()=>query.date,e:String,placeMap:new Map(TRAVEL_PLACES.map(place=>[place.id,place]))});
  h.get('#progress-dialog').showModal=function(){this.open=true;};
  h.get('#budget').value='123000';h.get('#trip-date').value='2026-10-20';h.get('#form-error').hidden=false;
  h.context.formDirty=true;h.context.pending=copy(originalResult);
  h.run('showProgress()');
  assert.equal(h.context.formDirty,false);
  assert.equal(Number(h.get('#budget').value),memory.query.budget);
  assert.equal(h.get('#trip-date').value,memory.query.date);
  assert.equal(h.get('#form-error').hidden,true);
  assert.equal(h.get('#progress-dialog').open,true);
  assert.equal(h.context.pending,null);
  assert.equal(h.get('#plan-change').hidden,true);
  assert.match(h.notices.at(-1),/미적용 입력을 저장된 조건으로/);
  assert.deepEqual(h.read('memory'),memory,'opening correction does not mutate the saved itinerary or progress');
  // An active trip still requires the user to apply or cancel their form changes.
  h.context.memory.progress.finished=false;h.context.formDirty=true;h.get('#progress-dialog').open=false;h.get('#budget').value='123000';
  h.run('showProgress()');
  assert.equal(h.get('#progress-dialog').open,false);
  assert.equal(h.get('#budget').value,'123000');
  assert.equal(h.context.formDirty,true);
});

test('마친 여행에 남은 유지 장소는 진행 정정에서 건너뛰어 잠금을 해제할 수 있다', () => {
  const memory=copy(originalMemory);memory.plan=null;memory.query.planningMode='remaining';memory.query.lockedIds=['hwangsaengga'];
  memory.progress={date:query.date,currentTime:'12:00',completed:[],skippedIds:[],finished:true,requiredCategories:[],updatedAt:now};
  const h=harness(memory,['progressPlaceIds','progressOrigins','showProgress','collectProgress','progressBaseQuery']);
  Object.assign(h.context,{koreanDate:()=>query.date,e:String,placeMap:new Map(TRAVEL_PLACES.map(place=>[place.id,place]))});
  h.get('#progress-dialog').showModal=function(){this.open=true;};
  h.run('showProgress()');
  const ids=[...h.get('#progress-content').innerHTML.matchAll(/data-progress-place="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(ids,['hwangsaengga']);
  assert.match(h.get('#progress-content').innerHTML,/유지 설정 중 · 완료\/건너뜀 선택 시 유지 해제/);
  const priorSelect=h.context.$$;
  h.context.$$=selector=>selector==='[data-progress-place]'?[{dataset:{progressPlace:'hwangsaengga'},value:'skipped'}]:priorSelect(selector);
  h.get('#progress-time').value='13:00';
  h.run('globalThis.corrected=collectProgress();globalThis.baseQuery=progressBaseQuery(corrected);');
  const progress=h.read('corrected');
  const result=replanRemainingTravel(h.read('baseQuery'),{now,ask:false,completedIds:[],skippedIds:progress.skippedIds,currentTime:progress.currentTime,origin:query.origin,remainingBudget:50000,maxWalkMinutes:100,stopCount:1});
  assert.ok(result.primary);
  assert.deepEqual(result.input.lockedIds,[]);
  assert.ok(result.input.excludedIds.includes('hwangsaengga'));
  assert.equal(result.primary.stops.some(stop=>stop.placeId==='hwangsaengga'),false);
  assert.deepEqual(h.read('memory'),memory,'preview keeps the finished trip until explicit acceptance');
});

test('수정 중 조건을 덮어쓰는 교체·대안·질문·적용 입구는 공통 가드로 막는다', () => {
  const branch = source.match(/if\(formDirty&&[^]*?return;\}/)?.[0];
  assert.ok(branch);
  for (const dataset of [{ lock: 'x' }, { swap: 'x' }, { replaceFrom: 'x' }, { alternative: '0' }, { refine: 'indoor' }, { action: 'accept-change' }]) {
    const h = harness(); h.context.formDirty = true; h.context.target = { dataset };
    h.run(`globalThis.continued=false;function guarded(){${branch};globalThis.continued=true;}guarded();`);
    assert.equal(h.context.continued, false, JSON.stringify(dataset));
    assert.equal(h.notices.length, 1);
  }
});

test('가져온 화면 복원이 실패하면 이전 여행과 저장본을 먼저 지우지 않는다', async () => {
  const h = harness(originalMemory, ['readInput', 'writeInput', 'importFile']);
  const oldId = h.context.memory.plan.id, imported = copy(originalMemory);
  imported.plan.id = 'imported-draft';
  let clears = 0, attempts = 0;
  h.context.TRAVEL_MAX_BYTES = 512 * 1024;
  h.context.accountSession = null;
  h.context.accountLocked = () => false;
  h.context.applyAccountState = value => { h.context.memory = copy(value); h.run('writeInput(memory.query)'); h.context.restorePlan({snapshot:true}); };
  h.context.importTravelMemory = () => copy(imported);
  h.context.restorePlan = () => { if (++attempts === 1) throw new Error('render failed'); };
  h.context.clearTravelMemory = () => { clears++; };
  h.context.file = { size: 100, text: async () => '{}' };
  await h.run('importFile(file)');
  assert.equal(h.context.memory.plan.id, oldId);
  assert.equal(clears, 0);
  assert.equal(attempts, 2);
  assert.ok(h.notices.includes('render failed'));
});

// 하루 만들기의 확인 질문: 가짜 워커로 planThenAsk·startQuestionWorker를 돌린다. 메인은 질문 없이 한 번만 계산하고,
// 워커를 못 쓰면 예전처럼 다음 프레임 뒤 메인에서 계산한다.
function questionHarness({ refuseWorker = false, functions = [] } = {}) {
  const h = harness(originalMemory, ['planThenAsk', 'askQuestion', 'askHere', 'attachQuestion', 'startQuestionWorker', ...functions]);
  const workers = [], calls = [], renders = [], queue = [], warnings = [];
  class FakeWorker {
    constructor(url, options) { if (refuseWorker) throw new Error('blocked by policy'); Object.assign(this, { url, options, posted: [], listeners: {}, terminated: false }); workers.push(this); }
    addEventListener(type, listener) { (this.listeners[type] ??= []).push(listener); }
    postMessage(message) { if (this.refuse) throw new Error('DataCloneError'); this.posted.push(structuredClone(message)); }
    terminate() { this.terminated = true; }
    emit(type, event) { for (const listener of this.listeners[type] ?? []) listener(event); }
  }
  const routeLeg = () => null, options = { now, feedback: [{ key: 'tea', value: true }], routeLeg, intents: [{ id: 'tea', category: 'tea' }] };
  const question = { id: 'refine-indoor', about: 'indoor', options: [] };
  Object.assign(h.context, {
    Worker: FakeWorker, questionWorkerUrl: 'question-worker-url', questionToken: 0, questionWorker: null, questionAsked: null,
    network: { sourceTimestamp: 'map-1' }, routeLeg, input: { date: '2026-10-21' }, settings: () => options,
    planTravel: (input, settings) => { calls.push(settings); return settings.ask === false ? { primary: { id: 'plan-a' }, alternatives: [] } : { primary: { id: 'plan-a' }, alternatives: [], question }; },
    acceptResult: result => { h.context.outcome = result; }, renderEvidence: () => renders.push(h.context.outcome.question),
    requestAnimationFrame: callback => queue.push(callback), setTimeout: callback => queue.push(callback),
    console: { warn: message => warnings.push(String(message)) },
  });
  const flush = () => { while (queue.length) queue.shift()(); };
  return { ...h, workers, calls, renders, queue, flush, options, question, warnings };
}

test('하루 만들기 확인 질문은 워커가 계산하고 같은 요청·같은 일정일 때만 붙인다', () => {
  const q = questionHarness();
  q.run('planThenAsk(input)');
  assert.equal(q.workers.length, 1);
  const [worker] = q.workers;
  assert.equal(worker.url, 'question-worker-url');
  assert.deepEqual(Object.entries(worker.options), [['type', 'module']]);
  assert.deepEqual(q.calls.map(row => row.ask), [false], '메인은 질문 없이 일정만 계산한다');
  assert.equal(q.queue.length, 0, '메인에서 질문 계산을 예약하지 않는다');
  // 경로 함수는 넘기지 않고 지도를 썼는지와 그 판만 알린다(넘겼다면 structuredClone이 실패한다).
  assert.deepEqual(worker.posted, [{ token: 1, input: { date: '2026-10-21' }, now, feedback: [{ key: 'tea', value: true }], intents: [{ id: 'tea', category: 'tea' }], routed: true, mapStamp: 'map-1' }]);
  worker.emit('message', { data: { token: 2, primaryId: 'plan-a', question: { id: 'other-request' } } });
  assert.deepEqual(q.renders, []);
  worker.emit('message', { data: { token: 1, primaryId: 'plan-a', question: q.question } });
  assert.deepEqual(q.renders, [q.question]);
  assert.deepEqual(q.read('outcome.question'), q.question);
  // 같은 요청의 답이 또 와도 다시 붙이지 않는다.
  worker.emit('message', { data: { token: 1, primaryId: 'plan-a', question: { id: 'again' } } });
  assert.equal(q.renders.length, 1);
  assert.deepEqual(q.warnings, [], '워커가 제대로 돌면 콘솔에 아무것도 남기지 않는다');
  // 질문 워커는 지도를 받은 뒤에 미리 띄운다(같은 지도 파일을 두 번 동시에 받지 않게).
  assert.match(source, /mapLoaded\(\);\r?\n[^\n]*\r?\nstartQuestionWorker\(\);/);
});

test('지난 요청·다른 일정·바뀐 결과에 늦게 온 워커 질문은 붙이지 않는다', () => {
  const q = questionHarness();
  q.run('planThenAsk(input)'); q.run('planThenAsk(input)');
  const [worker] = q.workers;
  assert.equal(q.workers.length, 1, '워커는 한 번만 띄운다');
  assert.deepEqual(worker.posted.map(row => row.token), [1, 2]);
  worker.emit('message', { data: { token: 1, primaryId: 'plan-a', question: q.question } });
  worker.emit('message', { data: { token: 2, primaryId: 'plan-b', question: q.question } });
  assert.deepEqual(q.renders, []);
  // 「유지」처럼 결과를 바꾸는 동작(invalidatePreferencePreview) 뒤에 온 질문도 버린다.
  q.run('planThenAsk(input)');
  q.context.outcome = { ...q.context.outcome, question: null };
  worker.emit('message', { data: { token: 3, primaryId: 'plan-a', question: q.question } });
  assert.deepEqual(q.renders, []);
  assert.equal(q.queue.length, 0);
});

test('워커가 계산하지 못했다고 하면 그 요청만 예전처럼 다음 프레임 뒤 메인에서 계산한다', () => {
  const q = questionHarness();
  q.run('planThenAsk(input)');
  const [worker] = q.workers;
  worker.emit('message', { data: { token: 1, error: 'map unavailable' } });
  assert.equal(q.queue.length, 1);
  assert.equal(q.warnings.length, 1);
  assert.match(q.warnings[0], /화면에서 계산해요: map unavailable/);
  q.flush();
  assert.equal(q.calls.length, 2);
  assert.equal(q.calls[1], q.options, '메인 계산은 경로 함수까지 든 같은 조건을 쓴다');
  assert.deepEqual(q.renders, [q.question]);
  // 워커는 그대로 써서 다음 요청은 다시 워커로 간다.
  q.run('planThenAsk(input)');
  assert.deepEqual(worker.posted.map(row => row.token), [1, 2]);
  assert.equal(q.queue.length, 0);
});

test('워커를 못 띄우거나 모듈을 못 읽거나 메시지를 못 보내면 메인에서 계산한다', () => {
  // 모듈을 못 읽음(error): 기다리던 요청을 메인에서 계산하고, 그 뒤로는 워커를 다시 띄우지 않는다.
  const q = questionHarness();
  q.run('planThenAsk(input)');
  const [worker] = q.workers;
  let prevented = false;
  worker.emit('error', { preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(worker.terminated, true);
  assert.equal(q.context.questionWorker, false);
  q.flush();
  assert.deepEqual(q.renders, [q.question]);
  q.run('planThenAsk(input)'); q.flush();
  assert.equal(q.workers.length, 1);
  assert.equal(q.renders.length, 2);
  // 공개본에서 워커 파일이 빠져도 알 수 있게 콘솔에 한 번만 남긴다.
  assert.equal(q.warnings.length, 1);
  assert.match(q.warnings[0], /워커를 읽지 못해/);
  // 띄우기부터 막힘(CSP·오래된 브라우저).
  const blocked = questionHarness({ refuseWorker: true });
  blocked.run('planThenAsk(input)');
  assert.equal(blocked.context.questionWorker, false);
  blocked.flush();
  assert.deepEqual(blocked.renders, [blocked.question]);
  assert.equal(blocked.warnings.length, 1);
  assert.match(blocked.warnings[0], /워커를 띄우지 못해/);
  // 메시지 보내기 실패.
  const refused = questionHarness();
  refused.run('startQuestionWorker()');
  refused.workers[0].refuse = true;
  refused.run('planThenAsk(input)');
  assert.equal(refused.queue.length, 1);
  refused.flush();
  assert.deepEqual(refused.renders, [refused.question]);
  assert.equal(refused.warnings.length, 1);
  assert.match(refused.warnings[0], /워커에 보내지 못해/);
});

test('일정을 만들지 못하면 질문을 묻지 않는다', () => {
  const q = questionHarness();
  q.context.planTravel = (input, settings) => { q.calls.push(settings); return { primary: null, alternatives: [], blocked: [], unknowns: [] }; };
  q.run('planThenAsk(input)');
  assert.equal(q.workers.length, 0);
  assert.equal(q.queue.length, 0);
  assert.equal(q.calls.length, 1);
});

// 바꾸기 전 비교(빠른 변경·답하기·장소 넣기·바꾸기·남은 일정)도 질문 없이 계산하고, 받아들일 때 같은 시각·조건으로 워커에 묻는다.
// 엔진은 부른 조건을 적는 가짜로 바꾸고, 결과는 실제 일정 모양을 써서 미리보기 화면 함수가 그대로 돈다.
function previewHarness(options = {}) {
  const p = questionHarness({ ...options, functions: ['readInput', 'writeInput', 'withoutQuestion', 'acceptChange', 'previewChange', 'adjust', 'progressPlaceIds', 'previewRemaining', 'collectProgress', 'progressOrigins', 'progressBaseQuery'] });
  const engine = [];
  // used: 엔진이 실제로 쓴 고른 것(engineAudit.intents). 남은 일정은 다녀온 곳이 채운 것을 뺀다.
  const fake = (name, used) => (input, settings) => {
    engine.push({ name, input: copy(input), settings });
    const result = copy(originalResult);
    result.primary.id = 'preview-plan'; result.input = { ...copy(input), checkedBy: name };
    result.question = settings.ask === false ? null : { id: 'main-question' };
    result.engineAudit = { intents: used ?? settings.intents.map(rule => rule.id) };
    return result;
  };
  Object.assign(p.context, { planTravel: fake('planTravel'), replanTravel: fake('replanTravel'), replanRemainingTravel: fake('replanRemainingTravel'),
    money: String, scheduleNote: () => '', companionSummary: () => '', renderRecovery: () => '', validateTravelMemory: () => {} });
  const click = (prefix, dataset) => {
    const line = source.split('\n').find(row => row.trim().startsWith(prefix));
    assert.ok(line, prefix);
    p.context.target = { dataset }; p.run(`(()=>{${line}})()`);
  };
  return { ...p, engine, fake, click };
}
// 진행 창: 첫 곳을 다녀왔다고 고르고 13:00 안국역에서 다시 출발한다.
function fillProgress(p, completedId) {
  for (const [id, value] of [['#progress-budget', '40000'], ['#progress-walk', '60'], ['#progress-time', '13:00'], ['#progress-end', '18:00'], ['#progress-origin', 'station:anguk'], ['#progress-stops', '2']]) p.get(id).value = value;
  const select = p.context.$$;
  p.context.$$ = selector => selector === '[data-progress-place]' ? [{ dataset: { progressPlace: completedId }, value: 'completed' }] : select(selector);
}
const firstStop = originalResult.primary.stops[0].placeId, inPlan = id => originalResult.primary.stops.some(stop => stop.placeId === id);
const swapTo = TRAVEL_PLACES.find(place => place.category === TRAVEL_PLACES.find(row => row.id === firstStop).category && !inPlan(place.id) && place.dayPlannerEligible !== false);
const addPlace = TRAVEL_PLACES.find(place => place.dayPlannerEligible !== false && place.category !== 'stay' && !inPlan(place.id));

test('바꾸기 전 비교는 질문 없이 계산하고, 받아들이면 그때 같은 시각·조건으로 워커에 묻는다', () => {
  const cases = [
    ['빠른 변경', 'planTravel', p => p.run("adjust('less-walk')")],
    ['답하기', 'planTravel', p => p.click('if(target.dataset.refine)', { refine: 'indoor', value: 'true' })],
    ['장소 넣기', 'planTravel', p => { p.run('writeInput(memory.query)'); p.click('if(target.dataset.include)', { include: addPlace.id }); }],
    ['바꾸기', 'replanTravel', p => p.click('if(target.dataset.replaceFrom)', { replaceFrom: firstStop, replaceTo: swapTo.id })],
    ['남은 일정', 'replanRemainingTravel', p => { fillProgress(p, firstStop); p.run('previewRemaining()'); }],
  ];
  for (const [label, name, act] of cases) {
    const p = previewHarness();
    act(p);
    assert.deepEqual(p.engine.map(row => [row.name, row.settings.ask]), [[name, false]], `${label}: 누를 때는 질문 없이 한 번만 계산한다`);
    assert.equal(p.workers.length + p.queue.length, 0, `${label}: 미리보기 동안에는 묻지 않는다`);
    assert.equal(p.read('pending.question'), null, label);
    // 계정 화면을 오가면 미리보기를 복제하므로 적어 둔 조건에는 경로 함수가 없어야 한다.
    assert.deepEqual(p.read('pending.questionLater'), { planId: 'preview-plan', now, feedback: p.options.feedback, routed: true, intents: p.options.intents }, label);
    assert.doesNotThrow(() => structuredClone(p.context.pending), label);
    // 「이 코스로 바꾸기」 누름 처리 그대로 받아들인다.
    const accept = source.match(/case 'accept-change':([^]*?)break;/)?.[1];
    assert.ok(accept); p.run(accept);
    const [worker] = p.workers;
    assert.deepEqual(worker.posted, [{ token: 1, input: p.read('outcome.input'), now, feedback: p.options.feedback, intents: p.options.intents, routed: true, mapStamp: 'map-1' }], label);
    assert.equal(worker.posted[0].input.checkedBy, name, `${label}: 엔진이 정리한 조건(result.input)을 보낸다`);
    assert.equal(p.queue.length, 0, `${label}: 받아들인 뒤에도 화면에서는 계산하지 않는다`);
    worker.emit('message', { data: { token: 1, primaryId: 'preview-plan', question: p.question } });
    assert.deepEqual(p.renders, [p.question], label);
    assert.deepEqual(p.read('outcome.question'), p.question, label);
    assert.deepEqual(p.warnings, [], label);
  }
});

test('남은 일정 미리보기는 엔진이 실제로 쓴 고른 것만 적어 두고 그 조건으로 묻는다', () => {
  const p = previewHarness();
  p.options.intents.push({ id: 'palace', feature: 'palace' });
  p.context.replanRemainingTravel = p.fake('replanRemainingTravel', ['palace']);
  fillProgress(p, firstStop); p.run('previewRemaining()');
  assert.equal(p.get('#progress-error').textContent, undefined, '남은 일정 비교가 오류 없이 끝난다');
  assert.deepEqual(p.read('pending.questionLater.intents'), [{ id: 'palace', feature: 'palace' }]);
  p.run('acceptChange()');
  assert.deepEqual(p.workers[0].posted[0].intents, [{ id: 'palace', feature: 'palace' }]);
  assert.equal(p.read('outcome.progress.completed[0].placeId'), firstStop, '진행 기록도 같이 받아들인다');
});

test('받아들인 뒤 다시 계산한 질문은 누를 때 계산하던 것과 같다 — 남은 일정은 다녀온 곳이 채운 고른 것을 빼고', () => {
  // 차+궁궐 13–18시 4곳에서 운현궁을 다녀온 뒤 남은 일정. 궁궐을 빼지 않고 다시 계산하면 일정 id는 같은데 질문이 달라진다.
  const intents = [{ id: 'tea', category: 'tea' }, { id: 'palace', feature: 'palace' }];
  const day = planTravel({ ...query, startTime: '13:00', endTime: '18:00', stopCount: 4, preferences: { tea: true, history: true, walk: true } }, { now, intents, ask: false });
  const stop = day.primary?.stops.find(row => row.placeId === 'unhyeongung');
  assert.ok(stop, '엔진이 바뀌어 운현궁이 일정에 없다 — 궁궐을 채운 곳이 있는 다른 조건으로 바꿔야 한다');
  const place = TRAVEL_PLACES.find(row => row.id === stop.placeId);
  const remaining = settings => replanRemainingTravel(copy(day.input), { ...settings, completedIds: [stop.placeId], skippedIds: [], currentTime: stop.departureTime,
    origin: { id: 'place:' + place.id, name: place.name, lat: place.coordinates.lat, lon: place.coordinates.lon }, remainingBudget: 50000, maxWalkMinutes: 100, stopCount: 2 });
  const before = remaining({ now, feedback: [], intents });
  assert.ok(before.primary && before.question, '질문이 나오는 조건이어야 대조가 된다');
  const h = harness(originalMemory, ['withoutQuestion']);
  Object.assign(h.context, { remaining, options: { now, feedback: [], routeLeg: null, intents } });
  h.run('globalThis.preview=withoutQuestion(remaining,options)');
  const later = h.read('preview.questionLater');
  assert.deepEqual(later.intents, [{ id: 'tea', category: 'tea' }], '다녀온 운현궁이 채운 궁궐은 엔진이 뺀다');
  assert.equal(later.routed, false);
  assert.equal(h.read('preview.question'), null);
  assert.equal(h.read('preview.primary.id'), before.primary.id);
  const again = planTravel(h.read('preview.input'), { now: later.now, feedback: later.feedback, intents: later.intents, routeLeg: null });
  assert.equal(again.primary.id, before.primary.id);
  assert.deepEqual(again.question, before.question);
  // 거르지 않으면 일정 id는 같아도 질문이 달라진다 — 화면의 일정 id 검사로는 막지 못한다.
  const unfiltered = planTravel(h.read('preview.input'), { now, feedback: [], intents, routeLeg: null });
  assert.equal(unfiltered.primary.id, before.primary.id);
  assert.notDeepEqual(unfiltered.question, before.question);
});

test('다른 안을 받아들이면 새로 묻지 않고, 계정 화면을 오가며 복제된 미리보기는 받아들일 때 묻는다', () => {
  const p = previewHarness();
  p.run("adjust('later')"); p.run('acceptChange()');
  const [worker] = p.workers;
  worker.emit('message', { data: { token: 1, primaryId: 'preview-plan', question: p.question } });
  // 받아들인 결과의 다른 안을 비교해 받아들인다: 적힌 일정(preview-plan)과 달라 묻지 않고 지금 결과의 질문을 그대로 가져간다.
  p.context.outcome.alternatives = [{ ...copy(originalResult.primary), id: 'alternative-plan', label: '이동을 줄인 안' }];
  p.click('if(target.dataset.alternative!==undefined)', { alternative: '0' });
  assert.equal(p.read('pending.primary.id'), 'alternative-plan');
  p.run('acceptChange()');
  assert.equal(worker.posted.length, 1, '다른 안은 새로 묻지 않는다');
  assert.equal(p.read('outcome.primary.id'), 'alternative-plan');
  assert.deepEqual(p.read('outcome.question'), p.question);
  // 계정 화면을 오가면 미리보기는 복제본으로 돌아온다(captureGuestDraft). 받아들이면 적어 둔 조건으로 묻는다.
  p.run("adjust('less-cost')");
  p.context.pending = structuredClone(p.context.pending);
  p.run('acceptChange()');
  assert.deepEqual(worker.posted.map(row => row.token), [1, 2]);
  worker.emit('message', { data: { token: 2, primaryId: 'preview-plan', question: { id: 'cloned' } } });
  assert.deepEqual(p.read('outcome.question'), { id: 'cloned' });
  // 미리보기를 취소하면 묻지 않는다.
  p.run("adjust('indoors')");
  const cancel = source.match(/case 'cancel-change':([^]*?)break;/)?.[1];
  assert.ok(cancel); p.run(cancel);
  assert.equal(p.context.pending, null);
  assert.equal(worker.posted.length, 2);
});

test('받아들인 뒤 워커를 못 쓰면 경로 함수까지 든 같은 조건으로 다음 프레임 뒤 화면에서 계산한다', () => {
  const p = previewHarness({ refuseWorker: true });
  p.click('if(target.dataset.refine)', { refine: 'indoor', value: 'false' });
  p.run('acceptChange()');
  assert.equal(p.queue.length, 1);
  assert.equal(p.warnings.length, 1);
  assert.match(p.warnings[0], /워커를 띄우지 못해/);
  p.flush();
  const last = p.engine.at(-1);
  assert.equal(p.engine.length, 2);
  assert.equal(last.input.checkedBy, 'planTravel', '엔진이 정리한 조건(result.input)으로 다시 계산한다');
  assert.equal(last.settings.routeLeg, p.context.routeLeg, '지도를 썼으면 화면의 경로 함수로 계산한다');
  assert.deepEqual(copy({ ...last.settings, routeLeg: null }), { now, feedback: p.options.feedback, intents: p.options.intents, routeLeg: null });
  assert.deepEqual(p.renders, [{ id: 'main-question' }]);
});

test('일정이 없을 때 장소 넣기는 하루 만들기처럼 바로 받아들이고 워커에 묻는다', () => {
  const p = previewHarness();
  p.context.memory.plan = null;
  p.run('writeInput(memory.query)');
  p.click('if(target.dataset.include)', { include: addPlace.id });
  assert.deepEqual(p.engine.map(row => [row.name, row.settings.ask]), [['planTravel', false]]);
  assert.equal(p.context.pending, null);
  assert.equal(p.read('outcome.primary.id'), 'preview-plan');
  const [worker] = p.workers;
  assert.equal(worker.posted.length, 1);
  assert.ok(worker.posted[0].input.lockedIds.includes(addPlace.id));
});

test('질문 카드의 도보 차이는 지금 보이는 일정 기준이다 — 다른 안을 받아들인 뒤에도', () => {
  const h = harness(originalMemory, ['renderQuestion']);
  Object.assign(h.context, { placeThumb: () => '', money: String, credit: () => '' });
  const preview = (maxMinutes, walkMaxDelta) => ({ planId: 'plan-' + maxMinutes, status: 'complete', stops: [], knownAmount: 0, costStatus: 'complete', walking: { minMinutes: 10, maxMinutes }, endTime: '18:00',
    changes: { addedIds: [], removedIds: [], knownAmountDelta: 0, walkMaxDelta } });
  // 도보 상단 35분인 일정에서 계산한 질문: 답에 따라 40분·52분이 된다.
  h.context.question = { about: 'indoor', label: '실내 선호에 따라 어느 일정이 더 맞나요?', caveat: '', options: [
    { value: true, label: '실내 쪽으로', preview: preview(40, 5) }, { value: false, label: '실내 피하는 쪽으로', preview: preview(52, 17) }] };
  const deltas = () => [...h.run('renderQuestion(question)').matchAll(/<small>\(([^)]*)\)<\/small>/g)].map(match => match[1]);
  h.context.memory.plan.walking.maxMinutes = 35;
  assert.deepEqual(deltas(), ['+5분', '+17분'], '질문을 계산한 일정이 지금 일정이면 엔진이 잰 차이 그대로');
  // 도보 상단 40분인 다른 안을 받아들이면 질문은 그대로 따라오고 차이는 그 일정 기준으로 다시 잰다.
  h.context.memory.plan.walking.maxMinutes = 40;
  assert.deepEqual(deltas(), ['현재와 같음', '+12분']);
});

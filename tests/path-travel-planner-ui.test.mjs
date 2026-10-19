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

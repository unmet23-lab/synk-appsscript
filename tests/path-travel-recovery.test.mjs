import test from 'node:test';
import assert from 'node:assert/strict';
import { planTravel, suggestTravelRecovery } from '../experiences/path-travel/planner.mjs';
const now='2026-10-09T03:00:00.000Z', sourceUrl='https://example.org/official';
const hours={verifiedAt:'2026-10-09',sourceUrl,scope:'full',holidayPolicy:'same',weekly:Object.fromEntries(Array.from({length:7},(_,d)=>[d,[{open:'09:00',close:'23:59'}]]))};
const places=['a','b','c'].map(id=>({id,name:id,category:'culture',coordinates:{lat:37.575,lon:126.985},features:{indoor:true},planningStayMinutes:40,checkedAt:'2026-10-09',verifiedAt:'2026-10-09',conditions:{hours,price:{kind:'free',amount:0,label:'일반 관람',scope:'adult-one',taxStatus:'included',sourceUrl,verifiedAt:'2026-10-09'}}}));
const base={date:'2026-10-10',startTime:'10:00',endTime:'11:00',origin:{id:'test',name:'출발',lat:37.575,lon:126.985},party:{adults:1,children:0},budget:0,maxWalkMinutes:20,stopCount:2,preferences:{indoor:true},requiredFeatures:{indoor:true},requiredCategories:['culture'],lockedIds:[],excludedIds:[]};
const options={places,now,routeLeg:(from,to)=>({distanceMeters:100,minMinutes:4,maxMinutes:5,coordinates:[[from.lon,from.lat],[to.lon,to.lat]],source:'test'})};
test('실제로 가능한 최소 시간 변경만 보여 주고 원래 입력을 바꾸지 않는다',()=>{
 const before=JSON.stringify(base), recovery=suggestTravelRecovery(base,options);
 assert.equal(planTravel(base,{...options,ask:false}).primary,null);
 assert.equal(recovery.suggestions.length,1);assert.equal(recovery.suggestions[0].result.input.endTime,'11:30');
 assert.deepEqual(recovery.suggestions[0].changes,[{field:'endTime',from:'11:00',to:'11:30'}]);
 assert.equal(JSON.stringify(base),before);
 assert.ok(recovery.suggestions[0].result.primary.stops.length>=2);
});
test('새벽으로 넘기거나 필수 접근 조건과 제외 기록을 풀어 대안을 만들지 않는다',()=>{
 const input={...base,endTime:'23:50',requiredFeatures:{stepFree:true},excludedIds:['a']};
 const result=suggestTravelRecovery(input,options);assert.equal(result.suggestions.length,0);assert.ok(result.attempts<=13);
});
test('이미 성립하는 여행에는 변경안을 제안하지 않는다',()=>{
 const result=suggestTravelRecovery({...base,endTime:'18:00'},options);assert.equal(result.attempts,1);assert.deepEqual(result.suggestions,[]);
});
test('남은 일정의 한 곳과 완료 제외는 복구안에서도 보존된다',()=>{
 const input={...base,planningMode:'remaining',endTime:'10:20',stopCount:1,excludedIds:['a','b']};
 const {suggestions}=suggestTravelRecovery(input,options);assert.ok(suggestions.length);
 for(const s of suggestions){assert.deepEqual(s.result.primary.stops.map(p=>p.placeId),['c']);assert.deepEqual(s.result.input.excludedIds,['a','b']);assert.equal(s.result.input.planningMode,'remaining');}
});
test('유지 해제는 명시적인 별도 선택이며 필수 조건은 계속 지킨다',()=>{
 const unavailable={...places[2],features:{indoor:false}}, input={...base,endTime:'18:00',lockedIds:['c']};
 const result=suggestTravelRecovery(input,{...options,places:[places[0],places[1],unavailable]});
 assert.equal(result.suggestions.length,1);assert.deepEqual(result.suggestions[0].changes,[{field:'lockedIds',from:['c'],to:[]}]);
 assert.deepEqual(result.suggestions[0].result.input.requiredFeatures,{indoor:true});
});

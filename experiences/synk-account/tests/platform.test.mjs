import test from 'node:test';
import assert from 'node:assert/strict';
import { APPLICATIONS, messengerDestination } from '../src/applications.mjs';
import { normalizeLibrary, updateLibrary, createLibrary, filterApplications, libraryItemRoute, LIBRARY_KEY } from '../src/library.mjs';
import { readConfig } from '../src/core.mjs';
test('catalog keeps two independent clients and a standalone PATH web interview',()=>{assert.deepEqual(APPLICATIONS.map(v=>v.id),['world','messenger','path']);assert.deepEqual(APPLICATIONS.filter(v=>!v.webOnly).map(v=>v.id),['world','messenger']);assert.ok(APPLICATIONS.every(v=>v.tags.length&&v.audience));});
test('messenger development fallback is never used on public platform',()=>{assert.equal(messengerDestination('', 'http://127.0.0.1:4280/'),'http://127.0.0.1:4191/?tab=messenger');assert.equal(messengerDestination('', 'https://platform.example/'),null);assert.throws(()=>messengerDestination('http://127.0.0.1:4191/','https://platform.example/'));assert.equal(messengerDestination('https://company.example/?tab=messenger','https://platform.example/'),'https://company.example/?tab=messenger');});
test('launch links reject secrets, credentials, fragments, redirects and unsafe protocols',()=>{for(const url of ['javascript:alert(1)','file:///C:/app.exe','http://example.test/','https://u:p@company.example/','https://company.example/#token','https://company.example/?token=x','https://company.example/?redirect=https://evil.example','https://company.example/?tab=admin'])assert.throws(()=>messengerDestination(url,'http://localhost/'),url);});
test('public account configuration accepts only explicit messenger entry field',()=>{assert.equal(readConfig({version:1,messengerUrl:'https://company.example/'},'https://platform.example/').messengerUrl,'https://company.example/');assert.throws(()=>readConfig({version:1,companySecret:'secret'},'https://platform.example/'));});
test('library excludes injected keys, unknown apps and duplicated launch entries',()=>{const value=normalizeLibrary({saved:['world','unknown','world'],favorites:['messenger'],admin:true,recent:[{id:'world',at:10,mode:'web',token:'secret'},{id:'world',at:20,mode:'client'},{id:'x',at:30,mode:'web'}]});assert.deepEqual(value.saved,['world']);assert.deepEqual(value.favorites,[]);assert.equal(value.admin,undefined);assert.deepEqual(value.recent,[{id:'world',at:20,mode:'client'}]);});
test('favorite and collection add to local library; removal cleans references',()=>{let s=updateLibrary({}, {type:'favorite',id:'world'});s=updateLibrary(s,{type:'collection',id:'world',collection:'learn'});assert.deepEqual(s.saved,['world']);assert.deepEqual(s.collections.learn,['world']);s=updateLibrary(s,{type:'save',id:'world'});assert.deepEqual(s.saved,[]);assert.deepEqual(s.favorites,[]);assert.deepEqual(s.collections.learn,[]);assert.throws(()=>updateLibrary(s,{type:'save',id:'platform'}));});
test('disabling recent history clears stored entries and prevents future records',()=>{let s=updateLibrary({}, {type:'launch',id:'messenger',mode:'web'},100);s=updateLibrary(s,{type:'remember',value:false});s=updateLibrary(s,{type:'launch',id:'world',mode:'client'},200);assert.deepEqual(s.recent,[]);});
test('failed durable write does not report library update as persisted',()=>{const lib=createLibrary({getItem:()=>null,setItem:()=>{throw new Error('QuotaExceeded');}});assert.throws(()=>lib.dispatch({type:'save',id:'world'}));assert.deepEqual(lib.read().saved,[]);});

test('a tab whose storage event has not arrived preserves another tab favorite when saving its own',()=>{
 const map=new Map(),storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};
 const first=createLibrary(storage),second=createLibrary(storage);
 first.dispatch({type:'favorite',id:'world'});second.dispatch({type:'favorite',id:'care'});
 assert.deepEqual(JSON.parse(map.get(LIBRARY_KEY)).favorites,['world','care']);
});

test('an older tab cannot restore recent history disabled and cleared by another tab',()=>{
 const map=new Map(),storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};
 const first=createLibrary(storage);first.dispatch({type:'launch',id:'world',mode:'web'});
 const second=createLibrary(storage);first.dispatch({type:'remember',value:false});
 second.dispatch({type:'compact',value:true});second.dispatch({type:'launch',id:'care',mode:'web'});
 const saved=JSON.parse(map.get(LIBRARY_KEY));assert.equal(saved.rememberRecent,false);assert.deepEqual(saved.recent,[]);assert.equal(saved.compact,true);
});

for(const failedAtStart of [false,true])test(`a ${failedAtStart?'startup':'later'} storage read failure cannot overwrite existing device shortcuts`,()=>{
 const original=JSON.stringify(normalizeLibrary({saved:['world'],favorites:['world'],rememberRecent:false}));
 const map=new Map([[LIBRARY_KEY,original]]);let blocked=failedAtStart,writes=0;
 const storage={getItem:key=>{if(blocked)throw new Error('Synthetic blocked read');return map.get(key)??null;},setItem:(key,value)=>{writes++;map.set(key,value);}};
 const library=createLibrary(storage);blocked=true;assert.throws(()=>library.dispatch({type:'favorite',id:'care'}));
 assert.equal(map.get(LIBRARY_KEY),original);assert.equal(writes,0);
 blocked=false;library.dispatch({type:'favorite',id:'care'});assert.deepEqual(library.read().favorites,['world','care']);assert.equal(library.read().rememberRecent,false);
});
test('malformed storage does not break platform and reset clears only its own namespace',()=>{const map=new Map([['other','keep']]);const lib=createLibrary({getItem:()=>'{bad',setItem:(k,v)=>map.set(k,v)});lib.dispatch({type:'save',id:'world'});lib.dispatch({type:'reset'});assert.equal(map.get('other'),'keep');assert.deepEqual(lib.read().saved,[]);});
test('search, category and local collection filters combine without granting access',()=>{const library=normalizeLibrary({saved:['world','messenger'],collections:{learn:['world']}});assert.deepEqual(filterApplications({query:'리듬',library}).map(v=>v.id),['world']);assert.deepEqual(filterApplications({query:'AI',library}).map(v=>v.id),['world']);assert.deepEqual(filterApplications({query:'협업',library}).map(v=>v.id),['messenger']);assert.deepEqual(filterApplications({category:'work',collection:'learn',library}),[]);assert.deepEqual(filterApplications({onlySaved:true,collection:'learn',library}).map(v=>v.id),['world']);});
test('benefit shortcuts persist beside existing apps and can be found by category, search and favorites', () => {
 const map = new Map(), storage = { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
 let library = createLibrary(storage);
 library.dispatch({ type: 'save', id: 'world' });library.dispatch({ type: 'favorite', id: 'care' });library.dispatch({ type: 'save', id: 'fortune' });
 library = createLibrary(storage);
 assert.deepEqual(library.read().saved, ['world', 'care', 'fortune']);assert.deepEqual(library.read().recent, []);
 assert.deepEqual(filterApplications({ library: library.read(), onlySaved: true, category: 'life' }).map(v => v.id), ['care', 'fortune']);
 assert.deepEqual(filterApplications({ library: library.read(), onlySaved: true, query: '운세' }).map(v => v.id), ['fortune']);
 assert.deepEqual(filterApplications({ library: library.read(), onlySaved: true, collection: 'favorites' }).map(v => v.id), ['care']);
 assert.deepEqual(filterApplications({ library: library.read() }).map(v => v.id), ['world', 'messenger', 'path']);
 assert.equal(libraryItemRoute('care'), '#benefits/care');assert.equal(libraryItemRoute('world'), '#app/world');assert.equal(libraryItemRoute('unknown'), '#discover');
 library.dispatch({ type: 'save', id: 'care' });assert.deepEqual(library.read().favorites, []);assert.deepEqual(library.read().saved, ['world', 'fortune']);
});
test('five explicit launch requests survive reload without becoming completed activity or account records', () => {
 const ids = ['world', 'messenger', 'path', 'care', 'fortune'];
 let state = normalizeLibrary();ids.forEach((id, index) => { state = updateLibrary(state, { type: 'launch', id, mode: 'web' }, index + 1); });
 assert.deepEqual(state.recent.map(v => v.id), [...ids].reverse());assert.deepEqual(state.saved, []);
 state = updateLibrary(state, { type: 'launch', id: 'care', mode: 'web' }, 20);
 assert.equal(state.recent.length, 5);assert.deepEqual(state.recent[0], { id: 'care', at: 20, mode: 'web' });
 assert.deepEqual(normalizeLibrary(JSON.parse(JSON.stringify(state))), state);
 state = updateLibrary(state, { type: 'remember', value: false });state = updateLibrary(state, { type: 'launch', id: 'care', mode: 'web' }, 30);
 assert.deepEqual(state.recent, []);
});

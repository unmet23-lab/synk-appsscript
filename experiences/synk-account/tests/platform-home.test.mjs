import test from 'node:test';
import assert from 'node:assert/strict';
import { platformRoute, searchRoute, shortcutDestination } from '../src/platform-home.mjs';
import { platformPublicEntry } from '../src/platform-entry.mjs';

test('home is a stable default and explicit route without depending on an account or stored activity', () => {
  for (const hash of ['', '#home', '#unknown']) assert.equal(platformRoute(hash).page, 'home');
  assert.deepEqual(platformRoute('#app/world'), { page: 'app', id: 'world', query: '' });
});

test('search survives a link round trip and stays scoped to the library when cleared', () => {
  const route=searchRoute('library','  가족 & 사진? #책  ');
  assert.deepEqual(platformRoute(route), { page: 'library', id: undefined, query: '가족 & 사진? #책' });
  assert.equal(searchRoute('library',''), '#library');
  assert.equal(platformRoute(searchRoute('home','리듬')).page, 'discover');
  assert.equal(platformRoute('#home?q=private').query, '');
  assert.equal(platformRoute(searchRoute('discover','가'.repeat(200))).query.length, 120);
});

test('recent web selections keep the web entry, while an installed favorite opens the current client', () => {
  const options={base:'https://platform.example.invalid/',learningUrl:'https://synk.im/try/',clients:[{id:'world',canLaunch:true}]};
  assert.equal(shortcutDestination('world',options).kind,'client');
  assert.deepEqual(shortcutDestination('world',{...options,preferredMode:'web'}),{kind:'web',href:platformPublicEntry('world'),label:'웹 WORLD 열기 ↗'});
  assert.equal(shortcutDestination('world',{...options,clients:[],preferredMode:'client'}).kind,'web');
  assert.equal(shortcutDestination('unknown',options),null);
});

test('teacher shortcut opens the teaching view of the configured Messenger without becoming a company client launch',()=>{
  const options={base:'https://platform.example.invalid/',messengerUrl:'https://workspace.example.invalid/?tab=messenger',clients:[{id:'messenger',canLaunch:true}]};
  assert.deepEqual(shortcutDestination('teacher',options),{kind:'web',href:'https://workspace.example.invalid/?tab=teaching',label:'Workspace 내 수업 열기 ↗'});
  assert.equal(shortcutDestination('teacher',{base:options.base}),null);
  assert.equal(shortcutDestination('teacher',{base:'http://127.0.0.1:4280/'}).href,'http://127.0.0.1:4191/?tab=teaching');
});

test('PATH always opens its fixed standalone HTTPS interview instead of company or installed-client routes',()=>{
 for(const options of [{},{base:'http://127.0.0.1:4280/'},{base:'https://synk.im/account/platform.html',messengerUrl:'https://workspace.synk.im/?tab=messenger',clients:[{id:'path',canLaunch:true}],preferredMode:'client'}]){
  assert.deepEqual(shortcutDestination('path',options),{kind:'web',href:'https://synk.im/path/interview/film/rehearsal.html',label:'면접 연습 열기 ↗'});
 }
});

test('missing and local-only entries fall back to their detail without inventing production access', () => {
  const publicOptions={base:'https://platform.example.invalid/',clients:[]};
  assert.deepEqual(shortcutDestination('messenger',publicOptions),{kind:'detail',href:'#app/messenger',label:'여는 방법 보기 →'});
  assert.equal(shortcutDestination('care',publicOptions).kind,'web');
  assert.match(shortcutDestination('care',publicOptions).href,/^https:\/\//);
  // The catalog owns current public URLs; a benefit taken off the catalogue (free fortune, 10-30) has no shortcut at all.
  assert.equal(shortcutDestination('fortune',publicOptions),null);
  assert.equal(shortcutDestination('fortune',{base:'http://127.0.0.1:4280/',clients:[]}),null);
});

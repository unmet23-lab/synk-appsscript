import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SLOTS,slotsFor,emptyAnswers,briefRows} from './public/pulse-app/request-data.mjs';
import en from './public/pulse-app/i18n/en.mjs';

// 의뢰서 칸 정리(유호님 11-21 「의뢰서 칸은 최대한 퀄리티있게 반영해줘. … 조잡함이 더 심해질것같으면 안해도 돼」).
// 저장 칸과 서버는 그대로 두고, 같은 것을 두 번 묻지 않게 · 드문 칸은 접어 두고 · 내용물 사진은 있던 칸의 이름으로 받는다.
globalThis.location??=new URL('http://localhost/pulse-app/');
const read=name=>readFileSync(new URL('./public/pulse-app/'+name,import.meta.url),'utf8');
const flow=read('request-flow.mjs');
const view=name=>{const from=flow.indexOf(`  ${name}(a,step,i,n`);assert.ok(from>0,name);return flow.slice(from,flow.indexOf('\n  },',from));};

test('words to avoid are asked once and the feel to avoid once, both on the finishing screen',()=>{
  // 세 막(11-26): 말 · 글자 · 느낌 화면이 「나머지는 추천대로」 한 화면(more)이 됐다. 직접 고르면 열리고, 옛 칸은 「더 알려 주실 것」 안에 그대로 있다.
  const more=view('more');
  assert.equal(more.match(/bind:'avoidNote'/g).length,1);
  assert.match(more,/bind:'avoidNote',label:t\('그 밖에 쓰면 안 되는 말'\),value:a\.avoidNote,placeholder:t\('예\) 경쟁사 이름, 이제 쓰지 않는 제품 이름'\)/);
  assert.equal(more.match(/bind:'avoidFeel'/g).length,1);
  assert.match(more,/bind:'avoidFeel',label:t\('이런 느낌은 피해 주세요 · 선택'\),value:a\.avoidFeel,placeholder:t\('예\) 홈쇼핑 같은 느낌, 과한 표정'\)/);
});

test('the facts that back the one line sit right under it',()=>{
  const more=view('more');
  assert.match(more,/bind:'oneThing'[^\n]*\n\s+field\(\{bind:'facts',label:t\('그 말을 믿게 할 사실 · 선택'\)/);
  // 저장 칸은 그대로라 서버는 바뀌지 않는다. 요약 줄은 칸과 같은 이름으로 그 칸이 선 화면으로 데려간다(Fable F5).
  assert.equal(emptyAnswers().facts,'');
  const row=briefRows({...emptyAnswers(),facts:'누적 12만 개'}).find(item=>item.key==='믿게 할 사실');
  assert.equal(row.step,'more');assert.equal(row.value,'누적 12만 개');
});

test('the two rare file slots fold into one line that opens by itself once they hold a file',()=>{
  const files=view('files');
  assert.match(flow,/const RARE_SLOTS=\['label','sound'\];let slotsMoreOpen=false;/);
  assert.match(files,/const main=slots\.filter\(slot=>!RARE_SLOTS\.includes\(slot\.id\)\),more=slots\.filter\(slot=>RARE_SLOTS\.includes\(slot\.id\)\);/);
  assert.match(files,/const open=slotsMoreOpen\|\|more\.some\(slot=>filesOf\(a,slot\.id\)\.length\);/);
  assert.match(files,/<details class="sx-slots-more" data-slots-more data-in\$\{open\?' open':''\}><summary class="sx-small">/);
  // 이름은 안에 든 칸대로 — 사진 상품은 소리 칸이 없어 라벨 칸만 남는다(카본 A1).
  assert.match(files,/\$\{esc\(moreLabel\(more\)\)\}/);
  assert.match(flow,/return label&&sound\?t\('라벨 인쇄 파일이나 브랜드 음악도 있어요'\):label\?t\('라벨 · 패키지 인쇄 파일도 있어요'\):t\('브랜드 음악이나 로고 소리도 있어요'\);/);
  // 손님이 펼친 것은 다른 화면에 다녀와도 기억한다.
  assert.match(flow,/form\.addEventListener\('toggle',event=>\{if\(event\.target\.matches\?\.\('\[data-slots-more\]'\)\)slotsMoreOpen=event\.target\.open;\},true\);/);
  // 칸은 그대로 있다(이미 올린 파일 · 직원 화면 · 서버가 쓰는 id).
  assert.deepEqual(SLOTS.product.map(slot=>slot.id),['front','side','logo','label','use','sound','etc']);
  // 크기 칸은 제품 묶음(음료 · 화장품 · 생활용품)에서 그대로 묻는다 — 칸 배열을 견주지 않고 묶음 이름으로.
  assert.match(files,/\(\(KINDS\.find\(item=>item\.id===a\.kind\)\?\.group\|\|'product'\)==='product'\?field\(\{bind:'size'/);
  assert.doesNotMatch(flow,/group===slotsFor\(/);
});

test('drinks and cosmetics ask for a photo of what is inside through the same use slot',()=>{
  const use=kind=>slotsFor(kind).find(slot=>slot.id==='use');
  assert.equal(use('food').label,'내용물 · 먹는 모습');assert.match(use('food').note,/따르면 색이 진하고/);
  assert.equal(use('beauty').label,'내용물 · 바른 모습');assert.match(use('beauty').note,/손등에 펴 바르면/);
  assert.equal(use('living').label,'쓰는 모습');
  for(const kind of ['food','beauty','living'])assert.deepEqual(slotsFor(kind).map(slot=>slot.id),SLOTS.product.map(slot=>slot.id),kind);
  // 다른 칸의 값은 그대로(받는 파일 · 꼭 여부).
  assert.equal(use('food').accept,SLOTS.product.find(slot=>slot.id==='use').accept);
});

test('the brief form never promises a video to a photo order: the lines a photo order also reads say 「미리」',()=>{
  for(const line of ['두 가지 안으로 미리 제안해요','담당자가 써서 미리 보여 드려요','들어갈 문구와 자리를 미리 넣어 보여 드리고, 최종 문구는 확인을 받아요.'])assert.ok(flow.includes(line),line);
  // 사진 주문의 마무리에는 마지막 화면 · 그 문구가 없다(영상의 끝 화면이다).
  const more=view('more');
  assert.match(more,/const photo=!!pkgOf\(a\)\?\.photo;/);
  assert.match(more,/\.\.\.\(photo\?\[\]:\[\[k\('마지막 화면'\),k\('로고 \+ 한 줄'\)\],\[k\('문구 한 줄'\),k\('담당자가 써서 미리 보여 드려요'\)\]\]\)/);
  assert.match(more,/\(photo\?'':`<div class="sx-sub" data-in><span class="sx-small">\$\{esc\(t\('마지막 화면'\)\)\}/);
});

test('every new customer line has its English',()=>{
  for(const key of ['그 밖에 쓰면 안 되는 말','예) 경쟁사 이름, 이제 쓰지 않는 제품 이름','그 말을 믿게 할 사실 · 선택','예) 홈쇼핑 같은 느낌, 과한 표정','라벨 인쇄 파일이나 브랜드 음악도 있어요','라벨 · 패키지 인쇄 파일도 있어요','브랜드 음악이나 로고 소리도 있어요','내용물 · 먹는 모습','내용물 · 바른 모습',
    '따랐을 때의 색, 거품, 단면처럼 안에 든 모습은 겉 사진으로 알 수 없어요. 찍어 둔 게 없으면 한 줄로 적어 주세요.','예) 따르면 색이 진하고 거품이 올라와요',
    '제형의 색과 질감, 바르는 법은 겉 사진으로 알 수 없어요. 찍어 둔 게 없으면 한 줄로 적어 주세요.','예) 손등에 펴 바르면 투명하게 스며들어요'])assert.ok(Object.hasOwn(en,key),key);
  for(const gone of ['그 밖에 피할 말이나 표현','자랑해도 되는 사실 · 선택','예) 경쟁사 이름, 과한 표정'])assert.ok(!Object.hasOwn(en,gone),gone);
});

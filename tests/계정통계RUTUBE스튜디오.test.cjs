'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {rutubeRows,otherOwner}=require('../tools/계정통계예약/platform-exports.cjs');

test('RUTUBE는 시청 시간과 인기 영상이 먼저 나타나면 기간 조회수 차트를 기다린다',async()=>{
  const owner='/channel/81398864/',entry='https://studio.rutube.ru/analytics',date='8 − 14 нояб. 2026';
  const shown={getClientRects:()=>[{}]};
  const article=(title,total)=>({...shown,querySelector(selector){
    if(selector.includes('headerTitleText'))return {textContent:title};
    if(selector==='h2')return {innerText:total};
    return null;
  }});
  const cards=[article('Общее время просмотра','175'),article('Популярное за неделю','99')];
  const document={querySelectorAll(sel){
    if(sel==='article')return cards;
    if(sel==='h3')return [{...shown,textContent:date}];
    if(sel.startsWith('a['))return [{...shown,pathname:owner}];
    return [];
  }};
  const realm={document,location:new URL(entry)};
  const read=f=>vm.runInNewContext('('+f.toString()+')()',realm);
  const p={async waitForFunction(f){assert.equal(Boolean(read(f)),false);cards.push(article('Просмотры','3 218'));assert.equal(Boolean(read(f)),true);},
    async evaluate(f){return JSON.parse(JSON.stringify(read(f)));}};
  let saved;
  const ctx={dir:process.cwd(),account:{id:'lab-ru-rutube',externalId:'81398864',platform:'rutube'},profile:{profileId:'fixture',expectedName:'fixture'},setStage:async()=>{}};
  const helpers={collectPublic:async()=>{},pageJob:async(c,n,f,args)=>f(p,args),storeBatch:async(c,n,raw,envelope)=>{saved=envelope;}};
  assert.equal(await otherOwner(ctx,helpers),'limited');
  assert.deepEqual(saved.observations[0].metrics,{views:3218});
  assert.deepEqual(saved.observations[0].period,{start:'2026-11-08',end:'2026-11-14'});
});

test('RUTUBE는 실제 달력 기간과 조회수 카드의 정수만 보관한다',()=>{
  const get=(periodText,value,label='Просмотры')=>rutubeRows({periodText,metric:{label,value}});
  assert.deepEqual(get('29 окт. − 4 нояб. 2026','0')[0].period,{start:'2026-10-29',end:'2026-11-04'});
  assert.deepEqual(get('29 дек. 2025 − 4 янв. 2026','0')[0].period,{start:'2025-12-29',end:'2026-01-04'});
  for(const [period,value,label] of [['30 − 31 февр. 2026','0'],['8 − 14 нояб. 2026',''],['8 − 14 нояб. 2026','7','Общее время просмотра'],['8 − 14 нояб. 2026','12 тыс.'],['8 − 14 нояб. 2026','0,5']])assert.deepEqual(get(period,value,label),[]);
});


import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {emptyGarage,GARAGE_KEY,seoulDate} from '../../../korean-racing/garage-core.js';

// 10-09 출시 때의 사본(공개 변환·옛 모듈)은 이 출시 증거 폴더에만 있다(git 밖) — CI 체크아웃에서는 그 사본을 쓰는 시험을 이름 대고 건너뛴다.
const gitOutside=rel=>Boolean(process.env.CI)&&!fs.existsSync(new URL(rel,import.meta.url))&&`CI 체크아웃에는 없다 — ${rel} (git 밖 10-09 출시 사본)`;
const transformed={skip:gitOutside('./public-transform-source.mjs')};
const {publicText}=transformed.skip?{}:await import('./public-transform-source.mjs');

const bundle=fs.readFileSync(new URL('../../../play-common/collection.js',import.meta.url),'utf8');
const chapters=['size','doors','sky'];
function browser(source,{pathname='/try/word-magic/',wallet=emptyGarage(),magic,order}={}){
 const data=new Map([[GARAGE_KEY,JSON.stringify(wallet)]]);let writes=0;
 if(magic)data.set('synk.word-magic.progress.v1',JSON.stringify(magic));if(order)data.set('synk.order-rush.beginner.v1',JSON.stringify(order));
 const localStorage={getItem:key=>data.get(key)||null,setItem:(key,value)=>{writes++;data.set(key,value);},removeItem:key=>data.delete(key),key:i=>[...data.keys()][i]||null,get length(){return data.size;}};
 const context=vm.createContext({localStorage,location:{pathname},console});vm.runInContext(source,context);return {api:context.SynkPlayCollection,writes:()=>writes};
}
const publish=dir=>publicText(bundle,{dir,rel:'collection.js'});
function claimChapters(){const wallet=emptyGarage();for(const id of chapters)wallet.rewardedRounds[`word-magic:chapter:${id}`]={date:seoulDate(),coins:15};return wallet;}

test('actual public-transformed bundles never prefix the next learning route twice',transformed,async()=>{
 for(const dir of ['word-magic','order-rush','spaceship-coop','learning-hub','korean-racing']){
  const source=publish(dir),b=browser(source,{pathname:`/try/${dir==='korean-racing'?'racing':dir}/`});
  assert.equal((await b.api.beginnerRewardRoute('word-magic')).href,'/try/word-magic/?chapter=0');
  assert.equal((await b.api.beginnerRewardRoute('order-rush')).href,'/try/order-rush/beginner.html');assert.equal(b.writes(),0);
 }
});
test('public daily experiment and free fallback use exactly one /try prefix',transformed,async()=>{
 const wallet=claimChapters(),magic={version:1,introduced:['size']};
 assert.equal((await browser(publish('word-magic'),{wallet,magic}).api.beginnerRewardRoute('word-magic')).href,'/try/word-magic/?play=lab');
 wallet.dailyRaceCounts[seoulDate()]=10;const route=await browser(publish('spaceship-coop'),{wallet,magic}).api.beginnerRewardRoute('spaceship-coop');assert.equal(route.reason,'daily-limit');assert.equal(route.href,'/try/learning-hub/#beginner-title');assert.equal(route.potentialCoins,0);
});
test('source hosting and public nested racing hosting remain valid after canonical generation',transformed,async()=>{
 assert.equal((await browser(bundle,{pathname:'/word-magic/'}).api.beginnerRewardRoute('word-magic')).href,'/word-magic/?chapter=0');
 assert.equal((await browser(publish('korean-racing'),{pathname:'/try/racing/play/rhythm/'}).api.beginnerRewardRoute('word-magic')).href,'/try/word-magic/?chapter=0');
});
test('last local source reconstructs the double-prefix failure before the release fix',{skip:transformed.skip||gitOutside('../return-finish-20261009/source/collection-adapter.after.js')},async()=>{
 const oldAdapter=fs.readFileSync(new URL('../return-finish-20261009/source/collection-adapter.after.js',import.meta.url),'utf8'),marker=bundle.indexOf('/* Shared collection adapter.');assert(marker>0);
 const old=publicText(bundle.slice(0,marker)+oldAdapter,{dir:'word-magic',rel:'collection.js'});
 const route=await browser(old).api.beginnerRewardRoute('word-magic');assert.equal(route.href,'/try/try/word-magic/?chapter=0');
});

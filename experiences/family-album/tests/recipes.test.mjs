import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { emptyAlbum, emptyRecipe, upsertPage, parseAlbum, serializeAlbum, recipeStatus, addRecipeAttempt, nextQuestion, LIMITS } from '../model.mjs';
const require=createRequire(import.meta.url),ask=require('../../../atlas/ask.js'),domain=require('../../../atlas/domain.js');
const now='2026-10-06T01:00:00.000Z', later='2026-10-07T01:00:00.000Z';
const page=(extra={})=>({id:'family-recipe',title:'우리 집 송편',date:'2026-10-06',person:'할머니와 나',author:'나',story:'모양이 달라도 맛있다고 하셨다.',photo:null,audio:null,details:{},skipped:[],contributions:[],createdAt:now,updatedAt:now,...extra});
const recipe=(extra={})=>({...emptyRecipe(now),learnedFrom:'할머니께 직접 들음',ingredients:'쌀가루 한 대접\n물 적당히',steps:'물을 조금씩 넣으며 반죽한다.\n송편을 빚는다.',...extra});
const attempt=(extra={})=>({id:'attempt-1',date:'2026-10-06',note:'우리 대접으로 물을 절반쯤 넣었다.',createdAt:now,...extra});

test('existing version 1 stories roundtrip exactly without adding recipe fields',()=>{
  const a={...emptyAlbum(),pages:[page()]};
  assert.deepEqual(parseAlbum(serializeAlbum(a)),a);
  assert.equal(recipeStatus(a.pages[0]),null);
});

test('recipe roundtrip keeps exact unmeasured instructions, personal history and original media',()=>{
  const bytes=Buffer.from('OggSoriginal-family-voice');
  const audio={name:'grandma.ogg',type:'audio/ogg',data:`data:audio/ogg;base64,${bytes.toString('base64')}`};
  const p=page({audio,recipe:recipe({servings:'두 사람쯤',attempts:[attempt()]})});
  const a=upsertPage(emptyAlbum(),p),restored=parseAlbum(serializeAlbum(a));
  assert.deepEqual(restored,a);
  assert.equal(restored.pages[0].recipe.ingredients,'쌀가루 한 대접\n물 적당히');
  assert.deepEqual(Buffer.from(restored.pages[0].audio.data.split(',')[1],'base64'),bytes);
});

test('new recipe is untried until a real dated attempt is explicitly added',()=>{
  const p=page({recipe:recipe()});
  assert.equal(recipeStatus(p).tried,false);
  const made=addRecipeAttempt(p,attempt());
  assert.equal(recipeStatus(made).tried,true);
  assert.equal(recipeStatus(made).revised,false);
  assert.equal(p.recipe.attempts.length,0);
  made.recipe.revisedAt=later;
  assert.equal(recipeStatus(made).revised,true);
  made.recipe.attempts.push(attempt({id:'attempt-2',createdAt:later,date:'2026-10-07'}));
  assert.equal(recipeStatus(made).revised,false);
  made.recipe.attempts=[];
  assert.equal(recipeStatus(made).tried,false);
});

test('recipe validation requires source, ingredients, steps and known fields',()=>{
  for(const patch of [{learnedFrom:''},{ingredients:' '},{steps:''},{ingredients:'a'.repeat(6001)},{steps:'a'.repeat(10001)},{servings:'a'.repeat(121)},{learnedFrom:'a'.repeat(121)},{verified:true},{revisedAt:'invalid'}]) {
    assert.throws(()=>upsertPage(emptyAlbum(),page({recipe:recipe(patch)})));
  }
  assert.throws(()=>upsertPage(emptyAlbum(),page({recipe:null})));
});

test('attempts reject impossible dates, duplicate ids, missing notes and overflow',()=>{
  const p=page({recipe:recipe()});
  for(const patch of [{date:'2026-02-30'},{date:''},{note:' '},{note:'x'.repeat(2001)},{createdAt:'invalid'},{verified:true}])assert.throws(()=>addRecipeAttempt(p,attempt(patch)));
  assert.throws(()=>addRecipeAttempt(addRecipeAttempt(p,attempt()),attempt()));
  const full=page({recipe:recipe({attempts:Array.from({length:LIMITS.attempts},(_,i)=>attempt({id:`a-${i}`}))})});
  assert.throws(()=>addRecipeAttempt(full,attempt()));
  assert.throws(()=>addRecipeAttempt(page(),attempt()));
});

test('Core asks only recipe details, respects explicit answers and skipped questions',()=>{
  const p=page({recipe:recipe(),details:{place:'집'},skipped:['occasion']});
  assert.equal(nextQuestion(p,{ask,domain,at:now}).id,'amount');
  p.details.amount='우리 대접으로 물 반 대접';
  assert.equal(nextQuestion(p,{ask,domain,at:now}).id,'heat');
  p.skipped.push('heat');
  assert.equal(nextQuestion(p,{ask,domain,at:now}).id,'doneness');
  p.details.doneness='직접 만져 보고 확인';
  assert.equal(nextQuestion(p,{ask,domain,at:now}),null);
  delete p.details.amount;
  assert.equal(nextQuestion(p,{ask,domain,at:now}).id,'amount');
});

test('recipe data does not infer measurements, cooking attempts or completion from prose',()=>{
  const p=page({story:'어제 송편을 만들었다. 물 한 컵을 썼다.',recipe:recipe({steps:'강불로 20분 익혔다.'})});
  const saved=upsertPage(emptyAlbum(),p).pages[0];
  assert.equal(recipeStatus(saved).tried,false);
  assert.deepEqual(saved.details,{});
  assert.equal(nextQuestion(saved,{ask,domain,at:now}).id,'amount');
});

test('unknown recipe questions cannot be smuggled into ordinary story imports',()=>{
  assert.throws(()=>upsertPage(emptyAlbum(),page({details:{amount:'물 반 대접'}})));
  assert.throws(()=>upsertPage(emptyAlbum(),page({skipped:['heat']})));
  const saved=upsertPage(emptyAlbum(),page({recipe:recipe(),details:{place:'부엌',heat:'중불'},skipped:['occasion']}));
  assert.equal(parseAlbum(serializeAlbum(saved)).pages[0].details.place,'부엌');
});

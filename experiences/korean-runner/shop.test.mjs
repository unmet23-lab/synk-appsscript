import test from 'node:test';
import assert from 'node:assert/strict';
import {ShopStore,CATEGORIES,CATALOG,GOALS,goalProgress,SHOP_STORAGE_KEY,WELCOME_STARS,COMPLETION_STARS} from './shop.mjs';
class MemoryStorage{
  data=new Map();fail=false;
  getItem(key){return this.data.get(key)??null;}
  setItem(key,value){if(this.fail)throw new Error('quota');this.data.set(key,String(value));}
}
function fixture(){const storage=new MemoryStorage(),shop=new ShopStore({storage});return{storage,shop};}
test('all five cosmetic categories have one free default and thirteen purchasable styles',()=>{
  assert.equal(CATEGORIES.length,5);assert.equal(CATALOG.filter(item=>item.price>0).length,13);
  assert.equal(new Set(CATALOG.map(item=>item.id)).size,CATALOG.length);
  for(const category of CATEGORIES){assert.equal(CATALOG.filter(item=>item.category===category.id&&item.price===0).length,1);assert.ok(CATALOG.some(item=>item.category===category.id&&item.price>0));}
});
test('welcome stars are saved once and existing best and learning keys stay untouched',()=>{
  const storage=new MemoryStorage();storage.setItem('synk.windrun.best','1384');storage.setItem('learning-record','existing');
  const first=new ShopStore({storage});assert.equal(first.state.wallet,WELCOME_STARS);assert.equal(first.state.owned.length,5);
  first.buy('trail:petals');const next=new ShopStore({storage});assert.equal(next.state.wallet,WELCOME_STARS-35);assert.ok(next.state.owned.includes('trail:petals'));
  assert.equal(storage.getItem('synk.windrun.best'),'1384');assert.equal(storage.getItem('learning-record'),'existing');
});
test('a purchase equips its category without affecting other equipped cosmetics',()=>{
  const {shop}=fixture();shop.settleRun({roundId:'r-1',coins:100,completed:true});
  assert.equal(shop.buy('trail:petals').ok,true);assert.equal(shop.buy('lantern:firefly').ok,true);
  assert.equal(shop.state.equipped.trail,'petals');assert.equal(shop.state.equipped.lantern,'firefly');assert.equal(shop.state.equipped.scenery,'village');
  assert.equal(shop.equip('trail:none').ok,true);assert.equal(shop.state.equipped.trail,'none');assert.equal(shop.state.equipped.lantern,'firefly');
});
test('insufficient stars, repeat buying and unowned equipment never subtract stars',()=>{
  const {shop}=fixture();assert.equal(shop.buy('scenery:moonlight').reason,'insufficient-stars');assert.equal(shop.state.wallet,60);
  shop.buy('trail:petals');const saved=shop.state;assert.equal(shop.buy('trail:petals').reason,'already-owned');assert.equal(shop.equip('companion:cloud').reason,'not-owned');assert.equal(shop.buy('not-a-product').reason,'unknown-item');assert.deepEqual(shop.state,saved);
});
test('real runs save collected stars, full completion adds a bonus, and demonstrations never pay',()=>{
  const {shop,storage}=fixture(),before=storage.getItem(SHOP_STORAGE_KEY);
  assert.equal(shop.settleRun({roundId:'demo',coins:99,completed:true,automatic:true}).earned,0);assert.equal(storage.getItem(SHOP_STORAGE_KEY),before);
  assert.equal(shop.settleRun({roundId:'partial',coins:7,completed:false}).earned,7);
  const complete=shop.settleRun({roundId:'complete',coins:12,completed:true});assert.equal(complete.earned,12+COMPLETION_STARS+25);assert.equal(complete.goalBonus,25);
  assert.equal(shop.state.wallet,60+7+12+COMPLETION_STARS+25);
  assert.equal(shop.settleRun({roundId:'partial',coins:100,completed:true}).earned,0);
  const reloaded=new ShopStore({storage});assert.equal(reloaded.settleRun({roundId:'complete',coins:12,completed:true}).duplicate,true);assert.equal(reloaded.state.wallet,shop.state.wallet);
});
test('failed saving rolls back purchases, equipment and round rewards and can be retried',()=>{
  const {shop,storage}=fixture();shop.settleRun({roundId:'funded',coins:100});shop.buy('trail:petals');const before=shop.state;storage.fail=true;
  for(const result of [shop.buy('trail:footprints'),shop.equip('trail:none'),shop.settleRun({roundId:'pending',coins:5,completed:true})])assert.equal(result.reason,'storage-unavailable');
  const failed=shop.state;assert.deepEqual({...failed,available:true},before);assert.equal(failed.available,false);
  storage.fail=false;assert.equal(shop.settleRun({roundId:'pending',coins:5,completed:true}).earned,40);assert.equal(shop.settleRun({roundId:'pending',coins:5,completed:true}).duplicate,true);
});
test('damaged persisted data is bounded and only owned, known styles can be equipped',()=>{
  const storage=new MemoryStorage();storage.setItem(SHOP_STORAGE_KEY,JSON.stringify({version:1,wallet:1e20,owned:['trail:petals','trail:petals','alien:rich'],equipped:{trail:'petals',lantern:'firefly',companion:'bad',scenery:'moonlight'},settled:['valid','valid',{},'',false]}));
  const shop=new ShopStore({storage});assert.equal(shop.state.wallet,1_000_000);assert.equal(shop.state.owned.length,6);assert.equal(shop.state.equipped.trail,'petals');assert.equal(shop.state.equipped.lantern,'paper');assert.equal(shop.state.equipped.scenery,'village');assert.deepEqual(shop.state.settled,['valid']);
  storage.setItem(SHOP_STORAGE_KEY,'{broken');const broken=new ShopStore({storage});assert.equal(broken.state.wallet,0);assert.equal(broken.state.owned.length,5);
});
test('invalid reward numbers and invalid round ids cannot create an unlimited wallet',()=>{
  const {shop}=fixture();assert.equal(shop.settleRun({roundId:{},coins:100}).reason,'invalid-round');assert.equal(shop.settleRun({roundId:'negative',coins:-9}).earned,0);assert.equal(shop.settleRun({roundId:'not-number',coins:'99999'}).earned,0);
  assert.equal(shop.settleRun({roundId:'bounded',coins:Infinity}).earned,0);assert.equal(shop.settleRun({roundId:'limit',coins:1e20}).earned,10_025);assert.equal(shop.state.wallet,10085);
});
test('two open stores read the latest saved wallet before buying',()=>{
  const {shop,storage}=fixture(),second=new ShopStore({storage});assert.equal(shop.buy('trail:petals').ok,true);assert.equal(second.buy('trail:footprints').reason,'insufficient-stars');assert.equal(second.state.wallet,25);
  shop.settleRun({roundId:'later',coins:30});assert.equal(second.buy('trail:footprints').ok,true);assert.equal(second.state.wallet,40);
});
test('missing or blocked storage leaves cosmetics previewable without reporting a purchase',()=>{
  const unavailable=new ShopStore({storage:null});assert.equal(unavailable.state.available,false);assert.equal(unavailable.buy('trail:petals').reason,'storage-unavailable');assert.equal(unavailable.state.wallet,0);assert.equal(unavailable.state.owned.length,5);
  const storage=new MemoryStorage();storage.fail=true;const blocked=new ShopStore({storage});assert.equal(blocked.state.available,false);assert.equal(blocked.buy('trail:petals').reason,'storage-unavailable');assert.equal(blocked.state.owned.includes('trail:petals'),false);assert.equal(storage.getItem(SHOP_STORAGE_KEY),null);
});
test('existing v1 purchases, wallet, equipment and paid rounds migrate without a second welcome gift',()=>{
  const storage=new MemoryStorage(),old={version:1,wallet:17,owned:['trail:petals','lantern:flower'],equipped:{trail:'petals',lantern:'flower'},settled:['old-paid']};
  storage.setItem(SHOP_STORAGE_KEY,JSON.stringify(old));const shop=new ShopStore({storage});
  assert.equal(shop.state.wallet,17);assert.ok(shop.state.owned.includes('trail:petals'));assert.ok(shop.state.owned.includes('lantern:flower'));assert.equal(shop.state.equipped.trail,'petals');assert.equal(shop.state.equipped.lantern,'flower');
  assert.equal(shop.state.wishlist,null);assert.deepEqual(shop.state.progress,{distance:0,stars:0,runs:0,completions:0,claimed:[]});
  assert.equal(shop.settleRun({roundId:'old-paid',coins:20,distance:200,completed:true}).duplicate,true);assert.equal(shop.state.wallet,17);assert.equal(shop.state.progress.runs,0);
  const reload=new ShopStore({storage});assert.equal(reload.state.wallet,17);assert.deepEqual(reload.state.progress,shop.state.progress);
});
test('wishlist accepts every unowned paid item and rejects free, owned and unknown products',()=>{
  const {shop,storage}=fixture();
  for(const item of CATALOG){const result=shop.setWishlist(item.id);assert.equal(result.ok,item.price>0,item.id);if(item.price>0)assert.equal(shop.state.wishlist,item.id);else assert.equal(result.reason,'not-purchasable');}
  assert.equal(shop.setWishlist('other:rich').reason,'unknown-item');assert.equal(shop.setWishlist(undefined).reason,'unknown-item');
  assert.equal(shop.setWishlist('trail:petals').ok,true);const saved=new ShopStore({storage});assert.equal(saved.state.wishlist,'trail:petals');
  assert.equal(saved.buy('trail:petals').ok,true);assert.equal(saved.state.wishlist,null);assert.equal(saved.setWishlist('trail:petals').reason,'already-owned');
  saved.setWishlist('scenery:moonlight');assert.equal(saved.setWishlist(null).ok,true);assert.equal(saved.state.wishlist,null);
});
test('buying another item keeps the wished item, and a failed wishlist or purchase keeps saved state',()=>{
  const {shop,storage}=fixture();shop.setWishlist('scenery:moonlight');shop.buy('trail:petals');assert.equal(shop.state.wishlist,'scenery:moonlight');
  const before=shop.state;storage.fail=true;assert.equal(shop.setWishlist('companion:sparrow').reason,'storage-unavailable');assert.deepEqual({...shop.state,available:true},before);
  storage.fail=false;shop.settleRun({roundId:'fund-wish',coins:100});const funded=shop.state;storage.fail=true;
  assert.equal(shop.buy('scenery:moonlight').reason,'storage-unavailable');assert.deepEqual({...shop.state,available:true},funded);assert.equal(shop.state.wishlist,'scenery:moonlight');
  storage.fail=false;assert.equal(shop.buy('scenery:moonlight').ok,true);assert.equal(shop.state.wishlist,null);
});
test('six travel goals award once across partial runs and completions without counting gifted or bonus stars',()=>{
  const {shop,storage}=fixture();assert.ok(goalProgress(shop.state).every(goal=>goal.current===0&&!goal.claimed&&goal.progress===0));
  assert.equal(shop.settleRun({roundId:'first',coins:8,distance:80}).earned,8);
  const second=shop.settleRun({roundId:'second',coins:2,distance:70});assert.equal(second.earned,22);assert.equal(second.goalBonus,20);assert.deepEqual(second.goalsUnlocked.map(goal=>goal.id),['distance-150','stars-10']);
  assert.equal(shop.state.progress.stars,10);assert.equal(shop.state.progress.completions,0);
  assert.equal(shop.settleRun({roundId:'third',coins:10,distance:300,completed:true}).earned,45);
  const fourth=shop.settleRun({roundId:'fourth',coins:10,distance:1100,completed:true});assert.equal(fourth.earned,60);assert.deepEqual(fourth.goalsUnlocked.map(goal=>goal.id),['distance-1500','stars-30']);
  const fifth=shop.settleRun({roundId:'fifth',distance:0,completed:true});assert.equal(fifth.earned,40);assert.equal(fifth.goalBonus,20);assert.deepEqual(fifth.goalsUnlocked,[{id:'complete-3',name:'세 번의 등불 여행',reward:20}]);
  assert.equal(shop.state.wallet,235);assert.equal(shop.state.progress.distance,1550);assert.equal(shop.state.progress.stars,30);assert.equal(shop.state.progress.runs,5);assert.equal(shop.state.progress.completions,3);assert.equal(shop.state.progress.claimed.length,6);
  const reloaded=new ShopStore({storage}),later=reloaded.settleRun({roundId:'later',coins:5,distance:100,completed:true});assert.equal(later.goalBonus,0);assert.deepEqual(later.goalsUnlocked,[]);assert.equal(later.earned,25);assert.ok(goalProgress(reloaded.state).every(goal=>goal.claimed&&goal.progress===1));
});
test('demonstration and duplicate rounds never move wishlist or cumulative goals',()=>{
  const {shop,storage}=fixture();shop.setWishlist('companion:cloud');const before=storage.getItem(SHOP_STORAGE_KEY);
  const demo=shop.settleRun({roundId:'demo',coins:100,distance:1500,completed:true,automatic:true});assert.equal(demo.goalBonus,0);assert.deepEqual(demo.goalsUnlocked,[]);assert.equal(storage.getItem(SHOP_STORAGE_KEY),before);
  shop.settleRun({roundId:'manual',coins:3,distance:80});const saved=storage.getItem(SHOP_STORAGE_KEY);
  const duplicate=shop.settleRun({roundId:'manual',coins:100,distance:2000,completed:true});assert.equal(duplicate.goalBonus,0);assert.deepEqual(duplicate.goalsUnlocked,[]);assert.equal(storage.getItem(SHOP_STORAGE_KEY),saved);assert.equal(shop.state.wishlist,'companion:cloud');
});
test('failed milestone saving rolls back wallet, progress and claims and awards correctly on retry',()=>{
  const {shop,storage}=fixture();shop.settleRun({roundId:'start',coins:9,distance:149.75});const before=shop.state;storage.fail=true;
  assert.equal(shop.settleRun({roundId:'reach',coins:1,distance:.25,completed:true}).reason,'storage-unavailable');assert.deepEqual({...shop.state,available:true},before);
  storage.fail=false;const retry=shop.settleRun({roundId:'reach',coins:1,distance:.25,completed:true});assert.equal(retry.goalBonus,35);assert.equal(retry.earned,56);assert.equal(shop.state.progress.distance,150);assert.equal(shop.state.progress.claimed.length,3);
  assert.equal(shop.settleRun({roundId:'reach',coins:1,distance:.25,completed:true}).duplicate,true);assert.equal(shop.state.progress.runs,2);
});
test('migration write failure preserves the old raw record and invalid additive fields are sanitized',()=>{
  const storage=new MemoryStorage(),old=JSON.stringify({version:1,wallet:27,owned:['trail:petals'],equipped:{trail:'petals'},settled:['old']});storage.setItem(SHOP_STORAGE_KEY,old);storage.fail=true;
  const failed=new ShopStore({storage});assert.equal(failed.state.available,false);assert.equal(failed.state.wallet,27);assert.equal(storage.getItem(SHOP_STORAGE_KEY),old);
  storage.fail=false;const migrated=new ShopStore({storage});assert.equal(migrated.state.wallet,27);assert.equal(migrated.state.equipped.trail,'petals');
  const corrupted={...migrated.state,wishlist:'trail:petals',progress:{distance:-1,stars:1e20,runs:'bad',completions:Infinity,claimed:['stars-10','stars-10','skill-mastery']}};
  storage.setItem(SHOP_STORAGE_KEY,JSON.stringify(corrupted));const repaired=new ShopStore({storage});assert.equal(repaired.state.wishlist,null);assert.equal(repaired.state.progress.distance,0);assert.equal(repaired.state.progress.stars,1_000_000_000);assert.equal(repaired.state.progress.runs,0);assert.equal(repaired.state.progress.completions,0);assert.deepEqual(repaired.state.progress.claimed,['stars-10']);assert.ok(!Object.hasOwn(repaired.state,'skill'));
  const cards=goalProgress({progress:{distance:NaN,stars:-2,completions:'99',claimed:['unknown']}});assert.equal(cards.length,GOALS.length);assert.ok(cards.every(card=>card.current===0&&!card.claimed&&card.progress===0));
});
test('milestone snapshots cannot mutate stored claims and reward components sum to the paid total',()=>{
  const {shop,storage}=fixture();shop.settleRun({roundId:'one',coins:10,distance:150});const view=shop.state;view.progress.claimed.length=0;view.progress.distance=0;assert.equal(shop.state.progress.claimed.length,2);assert.equal(shop.state.progress.distance,150);
  const almostFull={...shop.state,wallet:999999};storage.setItem(SHOP_STORAGE_KEY,JSON.stringify(almostFull));const result=shop.settleRun({roundId:'full',coins:2,distance:1500,completed:true});assert.equal(result.earned,1);assert.equal(result.coins+result.completionBonus+result.goalBonus,result.earned);assert.equal(shop.state.wallet,1_000_000);assert.equal(shop.state.progress.completions,1);
  shop.buy('trail:petals');const later=shop.settleRun({roundId:'claim-later'});assert.ok(later.goalsUnlocked.some(goal=>goal.id==='complete-1'));assert.equal(later.coins+later.completionBonus+later.goalBonus,later.earned);
});

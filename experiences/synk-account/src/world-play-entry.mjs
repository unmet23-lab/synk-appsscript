import { WORLD_GAMES } from './atlas-words.mjs';
const KEY='synk.world.play-entry.v1',MAX_AGE=10*60*1000;
const allowed=path=>WORLD_GAMES.some(game=>game.path===path);
const intent=url=>{const params=new URL(url).searchParams;return params.getAll('product').length===1&&params.get('product')==='world'&&params.getAll('play').length===1&&allowed(params.get('play'))?params.get('play'):null;};
export function worldGameHref(path,base=globalThis.location?.href){
  const game=WORLD_GAMES.find(item=>item.path===path);if(!game)throw new Error('지원하는 WORLD 게임 주소가 아니에요.');
  const current=new URL(base);return new URL(current.pathname.startsWith('/account/')?`/try/${game.slug}/`:`../${game.path}/`,current).href;
}
// Keep only a named WORLD destination across the existing OAuth redirect.
// Never accept an arbitrary URL or put credentials in this handoff.
export function rememberWorldPlayEntry({url=globalThis.location?.href,storage=globalThis.sessionStorage,now=Date.now()}={}){
  try{const path=intent(url);if(path)storage.setItem(KEY,JSON.stringify({path,at:now}));else if(new URL(url).searchParams.has('play'))storage.removeItem(KEY);}catch{}
}
export function peekWorldPlayEntry({url=globalThis.location?.href,storage=globalThis.sessionStorage,now=Date.now()}={}){
  try{if(new URL(url).searchParams.has('play'))return intent(url);}catch{}
  let value;try{value=JSON.parse(storage.getItem(KEY)||'null');}catch{}
  return allowed(value?.path)&&Number.isSafeInteger(value.at)&&now>=value.at&&now-value.at<=MAX_AGE?value.path:null;
}
export function takeWorldPlayEntry({url=globalThis.location?.href,storage=globalThis.sessionStorage,now=Date.now(),replace=value=>globalThis.history?.replaceState(null,'',value)}={}){
  const entry=peekWorldPlayEntry({url,storage,now});
  try{const current=new URL(url);if(current.searchParams.has('play')){current.searchParams.delete('play');replace(current.href);}}catch{}
  try{storage.removeItem(KEY);}catch{}
  return entry;
}

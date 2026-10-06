import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyAlbum, emptyRecipe, validateAlbum, parseAlbum, LIMITS } from '../model.mjs';
import { ARCHIVE_NAME, MAX_ARCHIVE_BYTES, BOOK_CSS, buildAlbumArchive, renderAlbumBook, renderAlbumBookContent } from '../takehome.mjs';

const at = '2026-10-06T00:00:00.000Z';
const page = extra => ({id:'page-1',title:'함께 만든 국수',date:'2026-10-05',person:'엄마와 나',author:'나',story:'식탁에 둘러앉아 함께 나눈 이야기.\n다시 꺼내 볼 순간.',photo:null,audio:null,details:{},skipped:[],contributions:[],createdAt:at,updatedAt:at,...extra});
const album = (...pages) => ({...emptyAlbum(),pages});
function media(kind,size=80,name='original') {
  const bytes = Buffer.alloc(size,0x3a);
  if(kind==='photo') {bytes.write('RIFF');bytes.write('WEBP',8);} else {bytes.write('RIFF');bytes.write('WAVE',8);}
  const type=kind==='photo'?'image/webp':'audio/wav';
  return {name,type,data:`data:${type};base64,${bytes.toString('base64')}`};
}
function independentCRC(bytes) {
  let value = 0xffffffff;
  for(const byte of bytes) {
    value ^= byte;
    for(let bit=0;bit<8;bit++) value = value & 1 ? (value>>>1)^0xedb88320 : value>>>1;
  }
  return (value^0xffffffff)>>>0;
}
function unzip(bytes) {
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const u16 = offset => view.getUint16(offset,true),u32 = offset => view.getUint32(offset,true);
  const files = new Map(), offsets = new Map();
  let offset=0;
  while(u32(offset)===0x04034b50) {
    assert.equal(u16(offset+6),0x800,'ZIP filenames use UTF-8');
    assert.equal(u16(offset+8),0,'stored entry is independently readable');
    const size=u32(offset+18),nameLength=u16(offset+26),extraLength=u16(offset+28);
    assert.equal(u32(offset+22),size);
    const name=new TextDecoder().decode(bytes.subarray(offset+30,offset+30+nameLength));
    const data=bytes.subarray(offset+30+nameLength+extraLength,offset+30+nameLength+extraLength+size);
    assert.equal(independentCRC(data),u32(offset+14),`${name} CRC matches`);
    assert.ok(!files.has(name));files.set(name,data);offsets.set(name,offset);
    offset+=30+nameLength+extraLength+size;
  }
  const centralStart=offset;
  let centralCount=0;
  while(u32(offset)===0x02014b50) {
    const nameLength=u16(offset+28),name=new TextDecoder().decode(bytes.subarray(offset+46,offset+46+nameLength));
    assert.equal(u32(offset+42),offsets.get(name));
    assert.equal(u32(offset+24),files.get(name).length);
    assert.equal(u32(offset+16),independentCRC(files.get(name)));
    offset+=46+nameLength+u16(offset+30)+u16(offset+32);centralCount++;
  }
  assert.equal(u32(offset),0x06054b50);assert.equal(u16(offset+8),files.size);assert.equal(u16(offset+10),centralCount);
  assert.equal(u32(offset+12),offset-centralStart);assert.equal(u32(offset+16),centralStart);assert.equal(offset+22,bytes.length);
  return files;
}
const decode = bytes => new TextDecoder().decode(bytes);

test('ZIP opens independently with original bytes, exact restoration data and readable instructions',async()=>{
  const photo=media('photo',120,'../../사진.webp'),audio=media('audio',160,'C:\\private\\목소리.wav');
  const input=album(page({photo,audio,details:{place:'마당'},contributions:[{id:'c1',name:'엄마',text:'네가 국수를 오래 삶았지.',createdAt:at}]}));
  const original=structuredClone(input),result=await buildAlbumArchive(input);
  assert.equal(result.filename,ARCHIVE_NAME);assert.equal(result.mime,'application/zip');assert.ok(result.bytes instanceof Uint8Array);
  assert.deepEqual(input,original,'export never changes the working album');
  const files=unzip(result.bytes);
  assert.deepEqual([...files.keys()],['index.html','synk-family-album.json','읽어주세요.txt','FONT-LICENSE.txt','originals/page-001-photo.webp','originals/page-001-audio.wav']);
  assert.deepEqual(Buffer.from(files.get('originals/page-001-photo.webp')),Buffer.from(photo.data.split(',')[1],'base64'));
  assert.deepEqual(Buffer.from(files.get('originals/page-001-audio.wav')),Buffer.from(audio.data.split(',')[1],'base64'));
  assert.deepEqual(parseAlbum(decode(files.get('synk-family-album.json'))),validateAlbum(input));
  const html=decode(files.get('index.html'));
  assert.match(html,/<img src="originals\/page-001-photo.webp"/);
  assert.match(html,/<audio controls preload="none" src="originals\/page-001-audio.wav"/);
  assert.ok(!html.includes('data:audio/wav;base64,'),'standalone book links originals without duplicating their base64');
  assert.match(html,/마당/);assert.match(html,/네가 국수를 오래 삶았지/);
  assert.match(decode(files.get('읽어주세요.txt')),/압축 해제/);
  assert.match(decode(files.get('FONT-LICENSE.txt')),/SIL OPEN FONT LICENSE/i);
});

test('export escapes every personal text field and uses generated filenames instead of user paths',async()=>{
  const attack='</style><script>alert(1)</script><img src="https://evil.invalid" onerror="alert(2)"> & \' "';
  const input=album(page({title:attack,person:attack,author:'<b>작성자</b>',story:attack,photo:media('photo',80,attack),audio:media('audio',80,attack),details:{place:attack},contributions:[{id:'x',name:'<svg onload=alert(1)>',text:attack,createdAt:at}]}));
  const files=unzip((await buildAlbumArchive(input)).bytes),html=decode(files.get('index.html'));
  assert.ok(!html.includes('<script'));assert.ok(!html.includes('<svg'));assert.ok(!html.includes('src="https://evil.invalid"'));
  assert.match(html,/&lt;script&gt;/);assert.match(html,/&quot;https:\/\/evil.invalid&quot;/);assert.match(html,/&amp;/);assert.match(html,/&#39;/);
  assert.ok([...files.keys()].every(name=>!name.includes('..')&&!name.includes('\\')&&!name.startsWith('/')));
  assert.equal(parseAlbum(decode(files.get('synk-family-album.json'))).pages[0].story,attack,'restoration retains original literal text');
});

test('standalone HTML is offline, forbids active content and embeds licensed fonts',()=>{
  const html=renderAlbumBook(album(page()));
  assert.match(html,/lang="ko"/);assert.match(html,/script-src 'none'/);assert.match(html,/connect-src 'none'/);assert.match(html,/base-uri 'none'/);assert.match(html,/form-action 'none'/);
  assert.match(html,/img-src data: file:/);assert.match(html,/media-src data: file:/);assert.match(html,/font-src data:/);
  assert.match(html,/@font-face/);assert.match(html,/data:font\/woff2;base64,/);
  assert.ok(!/<(?:script|iframe|link|form)\b/i.test(html));
});

test('embedded preview supports scoped CSS and controlled blob audio without permitting remote URLs',()=>{
  const input=album(page({photo:media('photo'),audio:media('audio')}));
  const calls=[];
  const fragment=renderAlbumBookContent(input,{mediaUrl:(item,kind,index)=>{calls.push([kind,index]);return kind==='audio'?'blob:http://127.0.0.1:4298/safe-id':item.data;}});
  assert.match(fragment,/^<div class="album-book">/);assert.ok(!fragment.includes('<html'));assert.ok(!fragment.includes('<style'));
  assert.match(fragment,/src="blob:http:\/\/127.0.0.1:4298\/safe-id"/);assert.match(fragment,/src="data:image\/webp;base64,/);
  assert.deepEqual(calls,[['photo',0],['audio',0]]);
  assert.throws(()=>renderAlbumBookContent(input,{mediaUrl:()=> 'https://example.invalid/media'}),/주소/);
  assert.throws(()=>renderAlbumBook(input,{mediaMode:'external'}),/방식/);
  assert.match(BOOK_CSS,/\.album-book \.book-prose,\.album-book \.book-answer,\.album-book \.book-memory,\.album-book \.book-attempt\{break-inside:auto/);
  assert.match(BOOK_CSS,/max-height:115mm/);
});

test('recipe cards include ingredients, steps, explicit answers and attributed attempts without claiming verification',()=>{
  const recipe={...emptyRecipe(at),servings:'2인분',learnedFrom:'아빠에게',ingredients:'밀가루 200 g\n물 100 ml',steps:'1. 반죽한다.\n2. 얇게 편다.',revisedAt:'2026-10-07T00:00:00.000Z',attempts:[{id:'cook-1',date:'2026-10-05',note:'물이 조금 많았다. 다음에는 10 ml 줄이기.',createdAt:at}]};
  const html=renderAlbumBookContent(album(page({recipe,details:{place:'부엌',amount:'물 100 ml',heat:'중불 5분',doneness:'가운데까지 익음'}})));
  for(const expected of ['아빠에게','2인분','밀가루 200 g','1. 반죽한다.','물이 조금 많았다.','직접 만들어 본 기록 1번','마지막 기록 뒤 레시피를 수정했어요.','부엌','중불 5분'])assert.ok(html.includes(expected),expected);
  assert.ok(!html.includes('검증 완료'));
  const untried=renderAlbumBookContent(album(page({recipe:{...recipe,attempts:[]}})));
  assert.match(untried,/아직 직접 만들어 본 기록이 없어요/);
});

test('Korean and emoji text survives ZIP UTF-8 roundtrip across the full thirty page limit',async()=>{
  const story='우리의 이야기를 오래 보관해요 💙\n'.repeat(300);
  const input=album(...Array.from({length:LIMITS.pages},(_,index)=>page({id:`page-${index}`,title:`가족 이야기 ${index+1}`,story})));
  const files=unzip((await buildAlbumArchive(input)).bytes);
  assert.equal(parseAlbum(decode(files.get('synk-family-album.json'))).pages[29].story,story.trim());
  const html=decode(files.get('index.html'));assert.match(html,/id="story-030"/);assert.match(html,/💙/);
  assert.equal((html.match(/class="book-page"/g)||[]).length,30);
});

test('size bound applies to actual ZIP bytes and cannot be raised by callers',async()=>{
  assert.equal(MAX_ARCHIVE_BYTES,64*1024*1024);
  await assert.rejects(buildAlbumArchive(album(page()),{maxBytes:1000}),/64 MB/);
  await assert.rejects(buildAlbumArchive(album(page()),{maxBytes:MAX_ARCHIVE_BYTES+1}),/제한/);
  const result=await buildAlbumArchive(album(page()));
  assert.equal((await buildAlbumArchive(album(page()),{maxBytes:result.bytes.length})).bytes.length,result.bytes.length);
  await assert.rejects(buildAlbumArchive(album(page()),{maxBytes:result.bytes.length-1}),/64 MB/);
});

test('large accepted album is rejected when duplicated escaped book and original media exceed ZIP limit',async()=>{
  const audio=media('audio',5*1024*1024);
  const pages=Array.from({length:30},(_,index)=>page({id:`big-${index}`,story:'&'.repeat(10000),audio:index<4?audio:null,contributions:Array.from({length:40},(_,i)=>({id:`c${i}`,name:'가족',text:'&'.repeat(2000),createdAt:at})),recipe:{...emptyRecipe(at),learnedFrom:'가족',ingredients:'&'.repeat(6000),steps:'&'.repeat(10000),attempts:Array.from({length:20},(_,i)=>({id:`a${i}`,date:'2026-10-05',note:'&'.repeat(2000),createdAt:at}))}}));
  const input=validateAlbum(album(...pages));
  await assert.rejects(buildAlbumArchive(input),/64 MB/);
});

test('invalid albums and canceled work produce no archive',async()=>{
  await assert.rejects(buildAlbumArchive({format:'other',version:1,pages:[]}));
  await assert.rejects(buildAlbumArchive(album(...Array.from({length:31},(_,i)=>page({id:`p${i}`})))));
  const controller=new AbortController();controller.abort();
  await assert.rejects(buildAlbumArchive(album(page()),{signal:controller.signal}),/취소/);
});

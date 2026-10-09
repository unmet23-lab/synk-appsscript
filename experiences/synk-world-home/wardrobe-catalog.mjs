// Art metadata. The WORLD server remains authoritative for inventory and grants.
export const WARDROBE_ITEMS = Object.freeze([
  {id:'mongle-apron-starter',slot:'body',key:'apron',name:'나의 첫 앞치마',material:'코튼',color:'#859b87',collection:'작은 공방',story:'둥근 주머니에 작은 취향을 담아요.',detail:'촘촘한 평직 · 입체 주머니 · 이중 박음질',gift:'옷장 첫 선물'},
  {id:'mongle-knit-butter',slot:'body',key:'knit',name:'버터빛 니트 조끼',material:'니트',color:'#d9bb76',collection:'포근한 오후',story:'폭신한 실을 꼬아 만든, 햇살 같은 조끼.',detail:'케이블 조직 · 도톰한 골지 · 둥근 목둘레',gift:'옷장 첫 선물'},
  {id:'mongle-denim-workshop',slot:'body',key:'denim',name:'데님 공방 앞치마',material:'데님',color:'#577a96',collection:'작은 공방',story:'나만의 것을 만들고 싶은 날의 차림.',detail:'사선 능직 · 구리 리벳 · 겹친 작업 주머니',gift:'옷장 첫 선물'},
  {id:'mongle-rain-cape',slot:'body',key:'cape',name:'빗방울 산책 케이프',material:'코팅 면',color:'#648d96',collection:'산책의 순간',story:'비 오는 날에도 가벼운 마음으로 나가요.',detail:'어깨를 감싼 곡선 · 접힌 칼라 · 작은 스냅',gift:'옷장 첫 선물'},
  {id:'mongle-hanbok-vest',slot:'body',key:'hanbok',name:'보랏빛 배자',material:'고운 직물',color:'#797d9e',collection:'우리의 하루',story:'고운 깃과 작은 고름으로 오늘을 차려입어요.',detail:'겹친 앞섶 · 밝은 동정 · 입체 고름',gift:'옷장 첫 선물'},
  {id:'mongle-scarf-first-steps',slot:'neck',key:'scarf',name:'첫 산책 목도리',material:'니트',color:'#ede4d1',collection:'산책의 순간',story:'처음 배운 문장이 포근한 선물로 남아요.',detail:'부드러운 뜨개 고리 · 술 장식 · 음표 자수',gift:'첫 문장 놀이를 마치면 받아요'},
  {id:'mongle-scarf-lapis',slot:'neck',key:'lapis-scarf',name:'청금석 니트 머플러',material:'니트',color:'#536c95',collection:'포근한 오후',story:'익숙한 옷에도 새로운 표정이 생겨요.',detail:'짧게 겹친 니트 · 골지 끝단 · 깊은 청금석색',gift:'옷장 첫 선물'},
  {id:'mongle-bandana-meadow',slot:'neck',key:'bandana',name:'메도우 삼각 스카프',material:'면',color:'#bccda4',collection:'산책의 순간',story:'가볍게 묶고, 작은 산책을 시작해요.',detail:'접힌 삼각 면 · 얇은 테두리 · 뒤 매듭',gift:'옷장 첫 선물'},
]);
export const wardrobeItem=id=>WARDROBE_ITEMS.find(item=>item.id===id);
const empty=Object.freeze({body:'',neck:''});
const outfits=new Map([['none',empty]]);
export function outfitForSlots(slots={}){
  const body=wardrobeItem(slots.body),neck=wardrobeItem(slots.neck);
  return [neck?.slot==='neck'?neck.key:'',body?.slot==='body'?body.key:''].filter(Boolean).join('-')||'none';
}
for(const body of ['',...WARDROBE_ITEMS.filter(i=>i.slot==='body').map(i=>i.id)])for(const neck of ['',...WARDROBE_ITEMS.filter(i=>i.slot==='neck').map(i=>i.id)]){
  const slots=Object.freeze({body,neck});outfits.set(outfitForSlots(slots),slots);
}
export const WARDROBE_OUTFITS=Object.freeze([...outfits.keys()]);
export function slotsForOutfit(value){
  if(typeof value==='string')return {...(outfits.get(value)||empty)};
  return {body:wardrobeItem(value?.body)?.slot==='body'?value.body:'',neck:wardrobeItem(value?.neck)?.slot==='neck'?value.neck:''};
}
export const outfitLabel=slots=>[slots?.body,slots?.neck].map(wardrobeItem).filter(Boolean).map(i=>i.name).join(' + ')||'몽글 기본 차림';

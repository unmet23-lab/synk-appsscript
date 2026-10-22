// Art metadata. The WORLD server remains authoritative for inventory and grants.
export const WARDROBE_ITEMS = Object.freeze([
  {id:'mongle-apron-starter',slot:'body',key:'apron',name:'나의 첫 앞치마',material:'코튼',color:'#859b87',collection:'작은 공방',story:'둥근 주머니가 달린 면 앞치마예요.',detail:'촘촘한 평직 · 입체 주머니 · 이중 박음질',gift:'옷장 첫 선물'},
  {id:'mongle-knit-butter',slot:'body',key:'knit',name:'버터빛 니트 조끼',material:'니트',color:'#d9bb76',collection:'포근한 오후',story:'꼬아 짠 무늬가 있는 버터색 니트 조끼예요.',detail:'케이블 조직 · 도톰한 골지 · 둥근 목둘레',gift:'옷장 첫 선물'},
  {id:'mongle-denim-workshop',slot:'body',key:'denim',name:'데님 공방 앞치마',material:'데님',color:'#577a96',collection:'작은 공방',story:'구리 단추를 박은 청색 작업 앞치마예요.',detail:'사선 능직 · 구리 리벳 · 겹친 작업 주머니',gift:'옷장 첫 선물'},
  {id:'mongle-rain-cape',slot:'body',key:'cape',name:'빗방울 산책 케이프',material:'코팅 면',color:'#648d96',collection:'산책의 순간',story:'어깨를 덮는 짧은 비옷 케이프예요.',detail:'어깨를 감싼 곡선 · 접힌 칼라 · 작은 스냅',gift:'옷장 첫 선물'},
  {id:'mongle-hanbok-vest',slot:'body',key:'hanbok',name:'보랏빛 배자',material:'고운 직물',color:'#797d9e',collection:'우리의 하루',story:'한복 저고리 위에 입는 조끼예요. 깃과 고름이 달려 있어요.',detail:'겹친 앞섶 · 밝은 동정 · 입체 고름',gift:'옷장 첫 선물'},
  {id:'mongle-scarf-first-steps',slot:'neck',key:'scarf',name:'첫 산책 목도리',material:'니트',color:'#ede4d1',collection:'산책의 순간',story:'음표를 수놓은 흰 뜨개 목도리예요.',detail:'부드러운 뜨개 고리 · 술 장식 · 음표 자수',gift:'첫 문장 놀이를 마치면 받아요'},
  {id:'mongle-scarf-lapis',slot:'neck',key:'lapis-scarf',name:'청금석 니트 머플러',material:'니트',color:'#536c95',collection:'포근한 오후',story:'짙은 파란색의 짧은 니트 머플러예요.',detail:'짧게 겹친 니트 · 골지 끝단 · 깊은 청금석색',gift:'옷장 첫 선물'},
  {id:'mongle-bandana-meadow',slot:'neck',key:'bandana',name:'메도우 삼각 스카프',material:'면',color:'#bccda4',collection:'산책의 순간',story:'목에 묶는 연두색 삼각 스카프예요.',detail:'접힌 삼각 면 · 얇은 테두리 · 뒤 매듭',gift:'옷장 첫 선물'},
  {id:'mongle-linen-overshirt',slot:'body',key:'linen',name:'오트밀 린넨 셔츠',material:'린넨',color:'#c5b99e',trimColor:'#e8dfcb',collection:'작은 공방',story:'바람이 잘 통하는 넉넉한 린넨 셔츠예요.',detail:'불규칙한 마 섬유 · 접힌 셔츠 깃 · 패치 주머니 · 나무 단추',gift:'옷장 첫 선물'},
  {id:'mongle-corduroy-overall',slot:'body',key:'corduroy',name:'밤색 코듀로이 멜빵',material:'코듀로이',color:'#9b7155',trimColor:'#c9aa81',collection:'작은 공방',story:'세로 골이 도톰한 코듀로이 멜빵이에요.',detail:'입체 세로 골 · 넓은 어깨끈 · 황동 버클 · 분리된 주머니',gift:'옷장 첫 선물'},
  {id:'mongle-quilted-vest',slot:'body',key:'quilted',name:'청금석 퀼팅 베스트',material:'퀼팅',color:'#506783',trimColor:'#adc0c6',collection:'산책의 순간',story:'솜을 넣어 누빈 가벼운 조끼예요.',detail:'부푼 가로 패널 · 눌린 봉제 골 · 입체 지퍼 · 볼륨 칼라',gift:'옷장 첫 선물'},
  {id:'mongle-velvet-capelet',slot:'body',key:'velvet',name:'장밋빛 벨벳 케이프',material:'벨벳',color:'#975b70',trimColor:'#d8b4ba',collection:'우리의 하루',story:'빛에 따라 결이 달라 보이는 벨벳 케이프예요.',detail:'짧은 파일의 광택 · 흘러내린 주름 · 두꺼운 파이핑 · 도자기 여밈',gift:'옷장 첫 선물'},
  {id:'mongle-silk-neckerchief',slot:'neck',key:'silk',name:'살구빛 실크 타이',material:'실크',color:'#d5a58b',trimColor:'#ead8c3',collection:'우리의 하루',story:'작게 매듭지은 매끈한 실크 타이예요.',detail:'방향성 광택 · 얇은 접힘 · 비대칭 꼬리 · 말아 박은 끝단',gift:'옷장 첫 선물'},
  {id:'mongle-wool-muffler',slot:'neck',key:'wool-felt',name:'메도우 울 머플러',material:'울',color:'#91a18c',trimColor:'#d5d4c2',collection:'포근한 오후',story:'보송한 모직으로 만든 넓은 머플러예요.',detail:'압축된 양모 결 · 넓은 겹침 · 도톰한 술 · 가장자리 박음질',gift:'옷장 첫 선물'},
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

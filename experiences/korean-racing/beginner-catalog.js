// Beginner collections: personal expression, reusable play tools, and keepsakes.
// Core learning, help, and the original play spaces remain free.
const rows = [
 ['magic-scene','word-magic',[
  ['default','모험의 빛','Adventure light',0,'#f5c445'],['sunset','노을 마법','Sunset magic',15,'#e6a79a'],['night','별빛 마법','Starlight magic',35,'#3d6bc9']]],
 ['magic-frame','word-magic',[
  ['cream','크림 사진틀','Cream frame',0,'#fff1c9'],['coral','코랄 사진틀','Coral frame',20,'#d63c2a'],['lapis','파랑 사진틀','Blue frame',40,'#3d6bc9']]],
 ['order-stall','order-rush',[
  ['default','처음 가게','First shop',0,'#fff1c9'],['blush','분홍 가게','Blush shop',15,'#fbd3c6'],['lapis','파랑 가게','Blue shop',35,'#3d6bc9']]],
 ['order-tray','order-rush',[
  ['cream','크림 쟁반','Cream tray',0,'#fff1c9'],['butter','버터 쟁반','Butter tray',20,'#f5c445'],['coral','코랄 쟁반','Coral tray',40,'#d63c2a']]],
 ['ship-sky','spaceship-coop',[
  ['default','첫 우주','First sky',0,'#3d6bc9'],['sunset','노을 우주','Sunset sky',15,'#e6a79a'],['night','깊은 우주','Deep space',35,'#333e5c']]],
 ['ship-badge','spaceship-coop',[
  ['sparkle','반짝이는 별','Sparkle',0,'#f5c445'],['ring','행성 고리','Planet ring',20,'#f5c445'],['heart','하트 신호','Heart signal',40,'#d63c2a']]],
 ['magic-toys','word-magic',[
  ['default','첫 마법 소품','First magic toys',0,'#fff1c9'],['picnic','소풍 실험 세트','Picnic experiment set',20,'#f5c445']]]
];
const benefits={
 'magic-scene':['내가 고른 빛 속에서 배운 말로 장면을 만들고 사진으로 남겨요.','Build a scene with your words in your favorite light, then keep a picture.'],
 'magic-frame':['배운 말로 만든 내 장면을 사진틀에 담아 저장해요.','Frame and save a scene you made with the words you learned.'],
 'order-stall':['내 간판을 걸고 손님의 한국어 주문을 들어요.','Put up your own sign and listen to your customers’ Korean orders.'],
 'order-tray':['내가 고른 쟁반에 주문을 담아 손님에게 건네요.','Fill your own tray with the order and serve your customer.'],
 'ship-sky':['내가 고른 우주에서 친구와 듣고 도우며 함께 이륙해요.','Listen, help, and launch together in your favorite sky.'],
 'ship-badge':['함께 고치는 우주선에 나를 나타내는 표식을 붙여요.','Give the ship you repair together your own personal emblem.'],
 'magic-toys':['곰·튜브·간식·상자를 배운 말로 바꾸고 나만의 소풍을 만들어요.','Change a bear, swim ring, snack, and chest with familiar words to make your own picnic.']
};
const playItems=[
 {id:'order-playset-picnic',kind:'order-playset',game:'order-rush',value:'picnic',name:'소풍 친구 초대 세트',nameEn:'Picnic with friends',price:15,color:'#f5c445',ownershipOnly:true,description:'세 친구의 주문을 듣고 음식을 건네 함께하는 소풍 장면을 완성해요.',descriptionEn:'Listen to three friends, serve their orders, and complete a shared picnic.',useLabel:'친구 3명 초대하기',useLabelEn:'Invite three friends'},
 {id:'ship-keepsake-starbook',kind:'ship-keepsake',game:'spaceship-coop',value:'starbook',name:'우리의 탐험 별지도',nameEn:'Our expedition starbook',price:30,color:'#3d6bc9',ownershipOnly:true,description:'함께 고친 실제 탐험을 별지도로 모으고 기념사진으로 남겨요.',descriptionEn:'Collect the expeditions you actually repaired together as star maps and save a keepsake.',useLabel:'내 별지도 열기',useLabelEn:'Open my starbook'}
];
export const BEGINNER_ITEMS=Object.freeze([...rows.flatMap(([kind,game,items])=>items.map(([value,name,nameEn,price,color])=>({id:`${kind}-${value}`,kind,game,value,name,nameEn,price,color,description:kind==='magic-toys'&&value==='default'?'토끼·상자·책·우산에 배운 말을 쓰고 내 장면을 만들어요.':benefits[kind][0],descriptionEn:kind==='magic-toys'&&value==='default'?'Use familiar words on a rabbit, chest, book, and umbrella to create your own scene.':benefits[kind][1]}))),...playItems]);
export const BEGINNER_DEFAULTS=Object.freeze(Object.fromEntries(rows.map(([kind,,items])=>[kind,items[0][0]])));
export const BEGINNER_GAMES=Object.freeze(['word-magic','order-rush','spaceship-coop']);

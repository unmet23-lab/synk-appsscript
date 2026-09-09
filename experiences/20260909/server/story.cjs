'use strict';

// 작가가 설계한 허구. 사적인 단서 원문은 정적 파일로 제공하지 않는다.
const roles = [
  { id: 'signal', title: '전차 정비사', objectId: 'tram', required: true },
  { id: 'archive', title: '방송 기록원', objectId: 'radio', required: true },
  { id: 'coast', title: '등대 감시인', objectId: 'buoy', required: false },
  { id: 'courier', title: '우편 배달인', objectId: 'postbox', required: false },
];
const objects = [
  { id: 'tram', title: '멈춘 전차', description: '빗물 자국이 남은 전차. 운전석의 작은 축전지만 아직 살아 있다.' },
  { id: 'radio', title: '작은 방송국', description: '방송이 끊긴 자리에는 릴 테이프와 마지막 방송 원고가 남아 있다.' },
  { id: 'buoy', title: '항구의 구명환', description: '오래된 구명환 아래에 감시 일지가 천으로 감싸져 있다.' },
  { id: 'postbox', title: '붉은 우체통', description: '오늘 배달하지 못한 편지 한 통. 봉투에는 주소 대신 창문 그림이 있다.' },
];
const clues = {
  signal: [
    { id: 'signal-battery', objectId: 'tram', title: '한 회로만 남은 축전지', text: '전차를 움직일 전력은 없다. 그러나 날이 밝을 때까지 등대, 정류장, 집들의 작은 창등 중 한 회로는 켤 수 있다. 회로를 고르면 아침까지 바꿀 수 없다.' },
    { id: 'signal-reflector', objectId: 'tram', title: '낡은 배선도', text: '등대는 항구 쪽으로만 돈다. 정류장의 천막은 광장에 모인 사람을 비춘다. 창등 회로는 골목마다 작은 불빛을 보낸다. 세 회로를 동시에 켜는 숨은 스위치는 없다.' },
  ],
  archive: [
    { id: 'archive-broadcast', objectId: 'radio', title: '끊기기 직전의 방송', text: '“마지막 배는 방파제 밖에서 아침을 기다리고 있습니다. 승객은 모두 안전합니다. 시야가 돌아오거나 등대가 켜지면 입항할 수 있습니다.” 방송은 그 뒤에 끊겼다.' },
    { id: 'archive-note', objectId: 'radio', title: '방송 원고의 뒷면', text: '“누구를 먼저 집으로 데려올까요?” 원고 옆에는 귀항을 기다리는 사람, 정류장에 모인 이웃, 혼자 창가에 앉은 사람의 그림이 있다. 정답표는 없다. 결정한 이유를 서로에게 전하자는 메모뿐이다.' },
  ],
  coast: [
    { id: 'coast-log', objectId: 'buoy', title: '등대 감시 일지', text: '파도는 잦아들었다. 배는 안전한 곳에 닻을 내렸다. 등대가 켜지면 오래 기다린 사람들이 오늘 밤 서로 만날 수 있다. 꺼져 있어도 선장은 밝아질 때까지 기다릴 수 있다.' },
    { id: 'coast-path', objectId: 'buoy', title: '돌아오는 길', text: '항구에서 광장까지는 난간을 따라 걸을 수 있다. 광장에 등불이 없으면 서로 부르며 천천히 돌아가야 한다. 감시인이 적었다. “불빛이 닿지 않는 자리도 잊지 말 것.”' },
  ],
  courier: [
    { id: 'courier-letter', objectId: 'postbox', title: '주소 없는 편지', text: '“오늘은 아무도 찾아오지 않아도 괜찮아요. 다만 맞은편 창이 한 번 켜지면, 다른 사람도 이 밤을 같이 보내고 있다는 걸 알 것 같아요.” 서명은 작은 매듭 하나다.' },
    { id: 'courier-square', objectId: 'postbox', title: '배달인의 지도', text: '정류장에는 늦게 돌아온 이웃들이 모여 있다. 한쪽에는 젖은 담요를 말릴 자리, 다른 쪽에는 함께 앉을 긴 의자. 광장을 밝히면 누가 아직 오지 않았는지 서로 살필 수 있다.' },
  ],
};
const choiceOptions = [
  { id: 'lighthouse', title: '등대로 보낸다', description: '항구 밖에서 기다리는 배가 오늘 밤 돌아오도록.' },
  { id: 'station', title: '정류장을 밝힌다', description: '광장에 모인 이웃들이 서로를 알아볼 수 있도록.' },
  { id: 'homes', title: '집들의 창을 켠다', description: '혼자 있는 사람에게 함께 깨어 있다는 신호를.' },
];
const endings = {
  lighthouse: { title: '돌아오는 빛', body: '등대의 빛이 천천히 항구를 가른다. 기다리던 배가 움직이고, 광장에서는 누군가의 이름을 부르는 목소리가 번진다. 창가의 사람들은 아직 어두운 골목을 향해 손전등을 내민다. 여러분은 돌아올 사람에게 먼저 길을 열었다. 아침이 오면, 남은 이웃의 창에도 찾아갈 차례다.', epilogue: '누군가에게는 불빛이 길이었다. 여러분에게는 함께 고른 한 장면이 남았다.' },
  station: { title: '기다리는 광장', body: '천막 아래의 등이 하나씩 켜진다. 젖은 어깨들이 긴 의자에 나란히 앉고, 서로 모르던 사람들이 마지막 차를 나눈다. 배는 안전한 바다에서 아침을 기다린다. 여러분은 지금 여기 있는 사람들이 서로를 놓치지 않도록 했다. 날이 밝으면 이 광장에서 함께 항구로 걸어갈 것이다.', epilogue: '누군가에게는 불빛이 자리였다. 여러분에게는 함께 고른 한 장면이 남았다.' },
  homes: { title: '서로의 창문', body: '골목의 작은 창들이 차례로 켜진다. 주소 없는 편지의 주인이 맞은편을 바라본다. 누군가 커튼을 젖히고, 누군가는 손을 흔든다. 배와 광장의 사람들은 아침을 기다리며 서로 연락한다. 여러분은 혼자 있는 사람에게 먼저 신호를 보냈다. 내일은 이 창들이 만나는 길을 걸을 것이다.', epilogue: '누군가에게는 불빛이 대답이었다. 여러분에게는 함께 고른 한 장면이 남았다.' },
};
module.exports = { roles, objects, clues, choiceOptions, endings };

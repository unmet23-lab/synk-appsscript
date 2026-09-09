'use strict';

// 작가가 설계한 허구. 사적인 단서 원문은 정적 파일로 제공하지 않는다.
const roles = [
  { id: 'signal', title: '전차 정비사', objectId: 'tram', required: true },
  { id: 'archive', title: '방송 기록원', objectId: 'radio', required: true },
  { id: 'coast', title: '등대 감시인', objectId: 'buoy', required: false },
  { id: 'courier', title: '우편 배달인', objectId: 'postbox', required: false },
];
const objects = [
  { id: 'tram', title: '멈춘 전차', description: '전차 아래에는 아직 따뜻한 축전지가 있다. 비에 풀린 연결부 세 개를 이어 주면, 광장의 비상 배전판까지 전기가 돌아올 것이다. 연결부는 돌려도 전력을 소비하지 않는다.' },
  { id: 'radio', title: '작은 방송국', description: '수신기는 작은 태엽 전원으로 버틴다. 안테나가 폭풍에 돌아간 뒤 항구의 마지막 방송은 잡음에 묻혔다. 다이얼을 움직여 목소리가 돌아오는 지점을 찾아보자.' },
  { id: 'buoy', title: '항구의 구명환', description: '오래된 구명환 아래에 감시 일지가 천으로 감싸져 있다.' },
  { id: 'postbox', title: '붉은 우체통', description: '오늘 배달하지 못한 편지 한 통. 봉투에는 주소 대신 창문 그림이 있다.' },
];
const clues = {
  signal: [
    { id: 'signal-battery', objectId: 'tram', title: '한 회로만 남은 축전지', text: '전차를 움직일 전력은 없다. 그러나 날이 밝을 때까지 등대, 정류장, 집들의 작은 창등 중 한 회로는 켤 수 있다. 회로를 고르면 아침까지 바꿀 수 없다.' },
    { id: 'signal-reflector', objectId: 'tram', title: '정비사가 남긴 손글씨', text: '전기는 왼쪽 아래에서 들어와 위쪽 두 모서리를 돌아 오른쪽 아래 배전판으로 간다. 밝은 구리선이 서로 마주 보도록 연결부를 돌릴 것. 작은 메모도 붙어 있다. “방송국 다이얼의 작은 눈금 하나는 0.1 MHz.”' },
  ],
  archive: [
    { id: 'archive-broadcast', objectId: 'radio', title: '마지막 수신 위치', text: '항구 채널을 적은 테이프 상자. “96의 큰 눈금에서 오른쪽으로 작은 눈금 네 칸.” 오래된 다이얼에는 작은 눈금의 단위가 지워져 있다. 전차 정비사는 같은 수신기를 고친 적이 있다.' },
    { id: 'archive-note', objectId: 'radio', title: '아직 읽지 못한 방송', text: '“승객은 … 기다리고 … 등대가 …” 이후는 잡음뿐이다. 배가 지금 어떤 상태인지는 수신을 복원한 뒤 확인해야 한다. 원고 뒷면에는 배, 광장에 모인 이웃, 혼자 남은 창가의 그림이 있다.' },
  ],
  coast: [
    { id: 'coast-log', objectId: 'buoy', title: '두 번 울리는 종', text: '한 번은 구조 요청, 두 번은 대기 중이라는 항구 약속이다. 지금 바다에서는 종이 두 번씩 울린다. 선장의 실제 상황은 방송으로 확인하는 것이 좋겠다.' },
    { id: 'coast-path', objectId: 'buoy', title: '돌아오는 길', text: '항구에서 광장까지는 난간을 따라 걸을 수 있다. 광장에 등불이 없으면 서로 부르며 천천히 돌아가야 한다. 감시인이 적었다. “불빛이 닿지 않는 자리도 잊지 말 것.”' },
  ],
  courier: [
    { id: 'courier-letter', objectId: 'postbox', title: '주소 없는 편지', text: '“오늘은 아무도 찾아오지 않아도 괜찮아요. 다만 맞은편 창이 한 번 켜지면, 다른 사람도 이 밤을 같이 보내고 있다는 걸 알 것 같아요.” 서명은 작은 매듭 하나다.' },
    { id: 'courier-square', objectId: 'postbox', title: '배달인의 지도', text: '정류장에는 늦게 돌아온 이웃들이 모여 있다. 한쪽에는 젖은 담요를 말릴 자리, 다른 쪽에는 함께 앉을 긴 의자. 광장을 밝히면 누가 아직 오지 않았는지 서로 살필 수 있다.' },
  ],
};
const choiceOptions = [
  { id: 'lighthouse', title: '등대로 보낸다', description: '안전하게 대기 중인 배에 돌아오는 길을 열어 준다. 광장과 창등은 아침을 기다린다.' },
  { id: 'station', title: '정류장을 밝힌다', description: '광장에 모인 사람들이 서로를 찾고 함께 머물게 한다. 배는 아침까지 기다린다.' },
  { id: 'homes', title: '집들의 창을 켠다', description: '골목에 혼자 남은 사람에게 함께 깨어 있다는 신호를 보낸다. 배와 광장은 아침을 기다린다.' },
];
const endings = {
  lighthouse: { title: '돌아오는 빛', body: '등대가 세 번 천천히 깜박인다. 복원한 수신기에서 “불빛을 확인했습니다”라는 선장의 목소리가 돌아온다. 작은 배가 방파제 안으로 방향을 튼다. 광장의 사람들은 아직 어두운 난간을 따라 항구로 걸어간다. 누군가 빈 담요를 펴서 맨 앞에 든다. 오늘 밤, 여러분이 고친 전선은 돌아오는 길이 되었다.', epilogue: '광장과 창가는 아직 어둡다. 배가 닿은 뒤, 남은 이웃에게 이 소식을 전하러 갈 것이다.' },
  station: { title: '기다리는 광장', body: '전차 천막 아래의 등이 하나씩 켜진다. 젖은 담요가 긴 의자 위에 펴지고, 서로 모르던 두 사람이 빈자리를 조금씩 나눈다. 복원한 수신기에서 선장이 말한다. “이쪽은 안전합니다. 동이 트면 들어가겠습니다.” 광장의 누군가가 마이크 앞에 앉아 이곳에서 기다리고 있다고 답한다. 오늘 밤, 여러분이 고친 전선은 함께 머물 자리가 되었다.', epilogue: '날이 밝으면 이 광장에서 함께 항구로 걸어갈 것이다. 혼자 남은 창가에도 가져갈 따뜻한 차를 준비한다.' },
  homes: { title: '서로의 창문', body: '골목의 작은 창들이 계단처럼 하나씩 켜진다. 주소 없는 편지의 주인이 커튼을 젖힌다. 맞은편 창에서 손이 올라오고, 잠시 뒤 다른 창에서도 손이 흔들린다. 복원한 수신기는 배가 안전하게 아침을 기다린다는 소식을 반복한다. 광장의 사람들은 작은 창등을 길잡이 삼아 이웃의 문으로 걸어간다. 오늘 밤, 여러분이 고친 전선은 혼자가 아니라는 대답이 되었다.', epilogue: '편지의 빈 봉투에는 내일 만날 장소를 적을 수 있다. 이제 서로의 창을 알아본 사람들이 있다.' },
};
const restoredBroadcast = '“여기는 마지막 귀항선. 승객은 모두 안전합니다. 방파제 밖에 닻을 내렸습니다. 등대가 켜지면 오늘 밤 들어갈 수 있습니다. 불빛이 없으면 동이 틀 때까지 이 자리에서 기다리겠습니다.”';
const tilePositions = [[0, 1], [0, 0], [1, 0]];
const vectors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const directions = ['위', '오른쪽', '아래', '왼쪽'];
function invalid(message) { const error = new Error(message); error.status = 400; throw error; }
function createRestorationState() {
  return {
    power: { rotations: [0, 0, 0], solved: false, trace: [], feedback: '왼쪽에서 들어오는 전기를 오른쪽 아래 배전판까지 이어 주세요.' },
    radio: { frequency: 93, signal: 0, solved: false, feedback: '다이얼을 움직이고 수신을 확인해 보세요. 가까워질수록 신호가 선명해집니다.' },
    order: [], marks: [],
  };
}
function traceCircuit(rotations) {
  const trace = []; let at = [0, 1], incoming = 3;
  for (let hop = 0; hop < 6; hop++) {
    const index = tilePositions.findIndex(p => p[0] === at[0] && p[1] === at[1]);
    if (index < 0) return { trace, solved: false, feedback: '구리선이 배전함 바깥을 향하고 있어요. 다음 연결부 쪽으로 돌려 주세요.' };
    const ports = [rotations[index], (rotations[index] + 1) % 4];
    if (!ports.includes(incoming)) return { trace, solved: false, blockedAt: index, feedback: `${index + 1}번 연결부의 ${directions[incoming]}쪽이 막혔어요. 밝은 선을 그쪽 입구와 이어 주세요.` };
    if (trace.includes(index)) return { trace, solved: false, blockedAt: index, feedback: '전기가 제자리로 돌아오고 있어요. 오른쪽 아래 배전판으로 길을 내 주세요.' };
    trace.push(index); const outgoing = ports.find(p => p !== incoming), v = vectors[outgoing];
    at = [at[0] + v[0], at[1] + v[1]]; incoming = (outgoing + 2) % 4;
    if (at[0] === 1 && at[1] === 1 && incoming === 0) return { trace, solved: true, feedback: '연결됐어요. 전차 아래의 작은 불이 켜지고, 비상 배전판이 깨어납니다.' };
  }
  return { trace, solved: false, feedback: '전기가 이어질 다음 길을 찾아 주세요.' };
}
function restorationReady(restoration) { return !!(restoration?.power?.solved && restoration?.radio?.solved); }
function restorationObjective(restoration) {
  if (restorationReady(restoration)) return '전원과 방송이 돌아왔습니다. 확인한 사실을 바탕으로, 불빛이 먼저 도착할 곳을 함께 정하세요.';
  if (restoration?.power?.solved) return '전기가 돌아왔습니다. 방송국 다이얼을 맞춰, 바다에서 기다리는 배의 상태를 확인하세요.';
  if (restoration?.radio?.solved) return '배의 소식이 돌아왔습니다. 전차의 연결부 세 개를 돌려 비상 배전판을 깨우세요.';
  return '전차의 전원과 방송국의 수신을 복원하세요. 어느 곳부터 살펴봐도 좋습니다.';
}
function applyRestorationAction(restoration, type, payload = {}, actor = {}) {
  if (!restoration?.power || !restoration?.radio) invalid('이 밤의 복원 기록을 찾을 수 없습니다.');
  const role = roles.some(r => r.id === actor.role) ? actor.role : 'team';
  if (type === 'mark') {
    const text = typeof payload.text === 'string' ? payload.text.replace(/[\u0000-\u001f\u007f]/g, '').trim() : '';
    if (!text || text.length > 120) invalid('남길 문장을 1~120자로 적어 주세요.');
    if (role === 'team') invalid('이 밤에 참여한 역할로 문장을 남겨 주세요.');
    const previous = restoration.marks.find(m => m.role === role);
    if (previous) previous.text = text; else restoration.marks.push({ role, text });
    return;
  }
  if (type !== 'restore') invalid('알 수 없는 복원 동작입니다.');
  if (payload.kind === 'power') {
    if (!Number.isInteger(payload.index) || payload.index < 0 || payload.index > 2 || !Number.isInteger(payload.rotation) || payload.rotation < 0 || payload.rotation > 3) invalid('돌릴 연결부와 방향을 확인해 주세요.');
    if (restoration.power.solved) return;
    restoration.power.rotations[payload.index] = payload.rotation;
    const result = traceCircuit(restoration.power.rotations);
    delete restoration.power.blockedAt;
    Object.assign(restoration.power, result);
    if (result.solved) { delete restoration.power.blockedAt; restoration.order.push({ kind: 'power', role }); }
  } else if (payload.kind === 'radio') {
    const frequency = payload.frequency;
    if (!Number.isFinite(frequency) || frequency < 90 || frequency > 104 || Math.abs(frequency * 10 - Math.round(frequency * 10)) > 0.00001) invalid('주파수는 90.0~104.0 MHz에서 한 눈금씩 움직여 주세요.');
    if (restoration.radio.solved) return;
    const distance = Math.abs(frequency - 96.4), solved = distance < 0.01;
    restoration.radio.frequency = frequency;
    restoration.radio.signal = Math.max(0, Math.round(100 - distance * 38));
    restoration.radio.solved = solved;
    restoration.radio.feedback = solved ? '잡음 사이에서 선장의 목소리가 돌아왔습니다.' : distance <= .4 ? '목소리가 거의 들립니다. 작은 눈금으로 조금씩 맞춰 보세요.' : distance <= 1.6 ? '잡음 사이에 목소리가 섞이기 시작합니다.' : '아직 잡음이 큽니다. 기록원의 수신 메모에서 범위를 찾아보세요.';
    if (solved) { restoration.radio.broadcast = restoredBroadcast; restoration.order.push({ kind: 'radio', role }); }
  } else invalid('복원할 장소를 골라 주세요.');
}
function buildEnding(choiceId, restoration) {
  if (!endings[choiceId]) invalid('불빛을 보낼 곳을 골라 주세요.');
  const chronicle = (restoration?.order || []).map((event, i) => ({ step: i + 1, role: event.role, text: event.kind === 'power' ? '풀린 전선을 이어 비상 배전판을 깨웠다.' : '잡음 속에서 마지막 귀항선의 소식을 되찾았다.' }));
  return { ...endings[choiceId], choiceId, chronicle, signature: choiceOptions.find(c => c.id === choiceId).title };
}
module.exports = { roles, objects, clues, choiceOptions, endings, createRestorationState, applyRestorationAction, restorationReady, restorationObjective, traceCircuit, buildEnding };

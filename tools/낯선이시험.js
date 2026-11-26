#!/usr/bin/env node
'use strict';
/* 낯선 사람 이해 시험 재료 (2026-10-23, 10-28 넓힘). 영상은 읽기만 하고 재료는 .tmp에 만든다.
 *
 * 10-23 유호님 「synkbrief랑 yuhobuilds가 뭘 말하려는건지 도저히 이해가 안가」 — 두 편 모두 사실 검수는 통과했었다.
 * 같은 날 「synk lab은 훌륭해」라고 하신 관용구 퀴즈 #5와 견주어 본 차이는 알아듣기였다. 영상 장면을 초와 함께 찍고 들리는 말을
 * 초와 함께 적은 뒤, 이 대화 맥락이 없는 새 하위 에이전트에게 줄 질문(그 계정의 시청자 한 사람 역할)을 만든다. 판정은 답을 받은
 * 세션이 한 장 기획의 「한 문장」과 견줘서 한다(docs/마케팅/기획장부/제작절차.md 「시험」).
 *
 * 10-28(유호님 「반영해」): 이해만 보던 질문에 재미 · 3초 · 저장/공유 · 지난 두 편과 같아 보이나를 더했다. 장면은 휴대폰 크기다 —
 * 옛 묶음은 칸을 300px로 줄여 40px 글자가 11px로 보였고(실제 폰에선 14px 남짓), 0~3초도 2초 간격이라 첫 장면을 거의 못 봤다.
 *
 *   node tools/낯선이시험.js <영상.mp4> --말 <말.txt|.srt> --브랜드 <lab-en|lab-mn|lab-cn|lab-mm|synkbrief|yuhobuilds|pulse|공모전>
 *       [--밖 <폴더>] [--컷 <초,초,…>|끔] [--지난 자동|없음|<편 폴더 또는 영상>,<…>] [--틀 퀴즈] [--중간]
 *   --중간(11-20): 30초 시험 판처럼 유호님께 보내기 전의 중간 편집본 — 칸마다 누가 · 무엇을 · 왜를 적게 하고(15번), 끝 · 브랜드 회상(11 · 12번)은 묻지 않는다.
 *     11-20 경산 공모전 편 앞 30초를 이 시험 없이 보냈다가 유호님이 「연계도 안되고 처음에 할머니가 왜 입 막고 호호 부는지 이해도 안가」라고 하셨다.
 *     시험관 둘이 같은 칸을 「왜 모름」 · 「끊김」이라 하면 보내지 않고 그 컷을 고친다(점검표 29 — 제작절차 · synk-video 7단계).
 *   --컷을 안 주면(11-17 자동 칸) ffmpeg 장면 바뀜으로 칸을 찾아, 아래 기본 장면이 빠뜨린 짧은 칸마다 그 칸 가운데 한 장을 더 찍는다.
 *   --컷 끔은 기본 장면만(11-16까지의 꼴). 자세한 까닭은 아래 addCutShots 머리.
 *   --틀 퀴즈(11-10): 퀴즈 칸 편 — 9번을 지난 퀴즈끼리 무대 · 주제 · 표정 · 색 · 구도로만 묻는다(--지난에 그 계정의 지난 퀴즈 영상 둘을 준다).
 *   LAB 새 편(폴더 날짜 11-24부터)은 질문을 만들기 전에 ㉓ 화면 글 시간을 먼저 잰다(11-23 유호님 「2번: 렌더 직후 먼저」 — 아래 화면글먼저).
 *     고칠 것이 있으면 재료를 만들지 않고 끝 코드 1로 멈춘다.
 *
 * 만드는 것: <밖>/정지컷_01.jpg …(한 장에 휴대폰 크기 칸 넷) · <밖>/지난1_<편>.jpg · 지난2_<편>.jpg(같은 계정의 지난 두 편, 작게) ·
 * <밖>/말.txt · <밖>/질문.md(이해 시험관 셋 — sonnet · haiku · GPT(`node tools/GPT시험관.mjs <밖>`) — 에게 그대로 줄 글. 그록은 11-22에 뺐다) ·
 * <밖>/볼이유_질문.md(「볼 이유」 심사관 opus에게 줄 글, 10-29).
 * 장면은 0~3초를 0.5초마다, 그 뒤는 2초마다, 그리고 끝 장면 하나. 2초보다 짧은 컷이 많은 영상은 --컷에 컷이 시작하는 초를 주면
 * 컷마다 한 장(그 컷 가운데 장면)으로 찍는다. --지난 자동(기본)은 그 브랜드의 본 계정 판이 있는 편 가운데 이 편 말고 슬롯이 가장
 * 늦은 두 편을 고른다(공용 작업본의 docs/마케팅/*\/게시/준비.json). 말.txt는 줄마다 「12.3s  들리는 말」 꼴이 좋다. .srt를 주면 그 꼴로 바꾼다.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { 공용작업본 } = require('./lib/공용작업본.js');

const ROOT = path.resolve(__dirname, '..');

// 그 계정에 늘 나오는 캐릭터 · 장소 · 이름표 — 9번 「같아 보임」에서 세지 않는다(유호님 10-29 「조정해」: 10-29 오마주 여섯 편 가운데 다섯이
// 이해는 됐는데 몽글 · 펠트 카페가 지난 편과 같다는 이유가 섞여 떨어졌다). 같은 틀은 무대 구성 · 말 순서 · 머리 글 · 끝 카드로만 본다.
const LAB고정 = '펠트 인형 마스코트(몽글 · 바리스타)와 펠트 카페 · 동네';
const 시청자 = {
  // 11-21부터 영어 편은 @synklabusa(lab-us-youtube)에 먼저 나간다(@synkkorean은 몽골 채널 — 11-26 2주 점검에서 굳힘)
  'lab-en': { 곳: '유튜브 쇼츠', 사람: '한국어를 이제 막 배우기 시작한 영어 사용자', 계정: 'lab-us-youtube', 고정: LAB고정 },
  'lab-mn': { 곳: '인스타 릴스', 사람: '한국어를 이제 막 배우기 시작한 몽골 사람(몽골어로 생각한다)', 계정: 'lab-instagram', 고정: LAB고정 },
  // 10-25 두 채널 판(기획장부/LAB.md 머리말) — 원본 편이 통과한 뒤 옮긴 판의 최종본을 그 나라 사람이 본다.
  'lab-cn': { 곳: '샤오훙수 영상 노트', 사람: '한국어를 이제 막 배우기 시작한 중국 사람(간체 중국어로 생각한다)', 계정: 'lab-cn-xiaohongshu', 고정: LAB고정 },
  'lab-mm': { 곳: '틱톡', 사람: '한국어를 이제 막 배우기 시작한 미얀마 사람(버마어로 생각한다)', 계정: 'lab-mm-tiktok', 고정: LAB고정 },
  // 사람편: 사람이 나오는 재연 · 진행자 · 광고 편 — 10번(같은 사람이 다른 사람처럼 보인 자리)을 묻는다(11-16). LAB은 펠트 마스코트라 묻지 않는다
  synkbrief: { 곳: '인스타 릴스', 사람: 'AI 도구를 가끔 쓰는 30대 한국인 직장인', 계정: 'synkbrief-instagram', 고정: '「SYNK 브리핑」 이름표 · 로고와 같은 목소리', 사람편: true },
  yuhobuilds: { 곳: '인스타 릴스', 사람: 'AI 도구를 일에 자주 쓰지만 개발자는 아닌 30대 한국인 직장인·1인 사업가', 계정: 'yuhobuilds-instagram', 고정: '「yuhobuilds」 이름표 · 로고와 늘 나오는 만든 이', 사람편: true },
  // 10-26 PULSE 포트폴리오 광고(이야기 한 장의 애니매틱 · 완성본) — 광고를 건너뛰지 않고 처음 본 사람.
  pulse: { 곳: '유튜브', 사람: '광고를 건너뛰지 않고 끝까지 볼지 고민하는 20~30대 한국인 직장인', 계정: null, 사람편: true, 회상: true },
  // 11-18 공모전 출품작 — 심사위원이 아닌 보통 시청자가 처음 본다. 기관 · 캠페인 이름이 남는지(회상 셋)를 묻는다.
  공모전: { 곳: '유튜브', 사람: '공모전 출품작을 처음 본 20~40대 한국인 보통 시청자(심사위원 아님)', 계정: null, 사람편: true, 회상: true },
};

// 휴대폰 크기 칸. 세로 영상은 폰 화면 폭(390pt)에 꽉 차니 1080 폭의 40px 글자가 14px 남짓으로 보인다 — 칸을 그 크기로 둔다.
// 그림을 읽는 쪽은 긴 변 1568px · 약 115만 화소를 넘는 그림을 줄여 읽으므로, 한 장에 세로 칸 넷(2×2, 약 110만 화소)까지만 묶는다.
// 가로 영상(PULSE 16:9 광고)은 찌그러지지 않게 480×270 칸을 2×4로 묶는다(10-26).
const 세로칸 = { w: 390, h: 694, 열: 2, 행: 2 };
const 가로칸 = { w: 480, h: 270, 열: 2, 행: 4 };
const 지난칸 = { w: 180, h: 320, 열: 6 }; // 지난 편은 틀이 같아 보이는지만 보니 작게, 한 편 한 장
const FONT = "C\\:/Windows/Fonts/arial.ttf";

// .srt를 「12.3s  말」 줄로 바꾼다. 번호·시각 줄만 있는 블록은 건너뛴다.
function srtToLines(text) {
  return String(text).replace(/\r\n/g, '\n').trim().split(/\n\s*\n+/).map((block) => {
    const lines = block.split('\n');
    const timeAt = lines.findIndex((line) => line.includes('-->'));
    if (timeAt < 0) return null;
    const m = lines[timeAt].match(/(\d+):(\d+):(\d+)[,.](\d+)/);
    if (!m) return null;
    const sec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(`0.${m[4]}`);
    const words = lines.slice(timeAt + 1).join(' ').trim();
    return words ? `${sec.toFixed(1)}s  ${words}` : null;
  }).filter(Boolean);
}

function readSpeech(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (/\.srt$/i.test(file)) return srtToLines(text).join('\n') + '\n';
  return text.replace(/\r\n/g, '\n').trimEnd() + '\n';
}

function 장면안내(cuts) {
  if (cuts === '자동') return '0~3초는 0.5초마다, 그 뒤는 2초마다 찍고, 그 사이에 잠깐 지나가는 짧은 칸은 칸마다 한 장(그 칸의 가운데 장면)을 더 넣었다. 마지막 칸은 끝 장면이다. 각 칸 왼쪽 위 숫자가 영상의 초다 — 숫자 사이가 좁은 칸은 그만큼 잠깐 지나간다.';
  return cuts
    ? '컷이 바뀔 때마다 한 장(그 컷의 가운데 장면), 각 칸 왼쪽 위 숫자는 그 컷이 화면에 나오는 초(시작-끝)다 — 짧은 컷은 그만큼 잠깐 지나간다.'
    : '0~3초는 0.5초마다, 그 뒤는 2초마다, 마지막 칸은 끝 장면이다. 각 칸 왼쪽 위 숫자가 영상의 초다.';
}

// 질문. 1~5는 10-23부터의 이해 질문 그대로, 6~9는 10-28에 더했다 — 이해 시험은 무의미한 슬롭은 막았지만(LAB 10-26~28 버림 12건)
// 재미 · 첫 3초 · 저장/공유 · 같은 틀 찍어 내기를 거르는 단계가 없어 유호님이 먼저 듣고 지적했다.
// 퀴즈 칸(LAB 21:00 「3초 관용구 퀴즈」)은 지난 퀴즈끼리 견주고, 퀴즈 칸에 늘 있는 짜임은 세지 않는다(제작절차 「LAB 하루 두 편」 7 — 설계 23,
// 11-10 퀴즈 틀 v6d: 이야기 편과 견준 시험관이 문제 → 보기 → 정답 되풀이 · 머리 띠를 「같아 보임」으로 셌다). --틀 퀴즈로 켠다.
const 퀴즈고정 = '세 문제를 차례로 맞히는 퀴즈 꼴(제목 → 보기 → 셋 · 둘 · 하나 → 정답 → 따라 말하기), 위의 머리 띠와 별 점수, 끝의 점수 칸';
// 10번(11-16 흠 장부 「인물튐」): 사람이 나오는 브랜드(시청자 표의 사람편)만 — 같은 사람이 장면마다 다른 사람처럼 보인 자리를 묻는다.
// 11-14~15 최종 확인에서 synkbrief 세 편이 이 흠으로 걸렸고(원생명단 「미흡」), 얼굴 닮음(SFace)으로는 걸릴 편과 지나갈 편을 가르는 문턱이
// 없어 기계 검사 대신 최종 확인 전에 영상을 보는 이 시험에 묻는다(docs/마케팅/제작양식/흠장부_설계_20261115.md 「인물튐을 올리며 본 것」).
const 사람10 = '10. 같은 사람인데 장면마다 다른 사람처럼 보인 자리 — 누가, 몇 초와 몇 초 사이에서, 무엇이(얼굴 생김 · 나이 · 머리 · 옷) 달라 보였는지. 처음 보는 사람이 같은 사람으로 알아보기 어려운 자리만 쓰고, 없으면 「없음」.';
// 11번(11-16 흠 장부 「끝약함」 · 점검표 2): 최종 확인을 거치는 브랜드(10번과 같은 셋)에 끝 3초를 묻는다. 메일비서(가장 센 그림이 아님)와
// 윈도우깨짐다시(끝 글 42px · 핵심 숫자가 끝에 안 남음)가 끝소리 · 끝화소 검사를 지나 최종 확인에서 걸렸고, 끝 글 크기 · 끝 조용함으로는 걸릴 편과
// 지나갈 편을 가르는 문턱이 없어 기계 검사 대신 묻는다(docs/마케팅/제작양식/흠장부_설계_20261115.md 「멈춘 화면과 끝 3초를 올리며 본 것」).
// 「가장 센 장면이나 핵심 숫자로 닫히나」로 물으면 시험관이 넷 모두 「약함」이라 해서(통과한 영상통화연인 · 지적147까지), 고르는 말을 일러 주지 않는다.
// 15번(11-20 · --중간): 중간 편집본은 유호님께 보내기 전에 칸마다 이야기가 이어지는지 본다. 왜를 모르는 칸 · 앞 칸과 안 이어지는 칸을 시험관이 직접 짚게 한다.
const 칸15 = '15. 칸마다(칸 왼쪽 위 숫자 초) 누가 · 무엇을 · 왜 하는지 한 줄씩 — 「6.0s 여자 / 문을 두드린다 / 택배가 왔다고 알리려고」 꼴. 왜 그러는지 모르겠으면 「왜 모름」, 바로 앞 칸과 이어지지 않으면(사람 · 물건이 갑자기 다른 자리에 있다, 무슨 일이 있었는지 빠졌다) 「끊김 — 무엇이 안 이어지나」를 쓴다.';
const 중간빼기 = (줄) => `${줄.split('.')[0]}. (편집 중인 앞부분이라 묻지 않는다 — 「중간 판」이라고만 쓴다)`;
const 끝11 = '11. 끝 3초(마지막 칸과 마지막 말)를 보고 영상이 힘 있게 끝났나, 앞보다 맥이 빠져 흐지부지 끝났나 — 「힘 있게」 또는 「흐지부지」와 한 줄 까닭.';
// 회상 셋(11-18 유호님 「브랜드 회상 이거 필요할것같아. 고정 질문 셋으로 넣자」 · 점검표 45): 광고 · 공모전 · 포트폴리오(시청자 표의 회상)에는
// 1번(남은 말 한 문장)과 함께 12 · 13번을 늘 묻는다 — 한 번 본 사람에게 브랜드 이름이 이야기에 붙어 남는지, 어떤 기분과 장면이 남는지.
// 판정은 답을 받은 세션이 한다: 12 이름이 맞고 「이야기에 붙음」 · 1이 컷표 「한문장」과 같은 뜻 · 13 기분이 「이기는것」과 맞고 떠오른 장면이
// 제품 · 브랜드와 붙어 있으면 넘는다. 시험관 둘이 이름을 틀리거나 「끝에만」이라 하면 끝 화면이 아니라 이야기 속에 브랜드를 붙여 다시 짠다(점검표 45).
const 회상12 = '12. 무슨 브랜드(또는 제품 · 기관)의 영상이었나 — 기억나는 이름 그대로(모르면 「모름」), 그 이름을 처음 알아챈 초, 그 이름이 이야기 장면 속에 붙어 있었나 끝에만 나왔나 — 「이야기에 붙음」 또는 「끝에만」.';
const 회상13 = '13. 보고 난 기분 한 낱말과, 이 영상을 떠올리면 가장 먼저 떠오를 장면 하나 — 초와 한 줄 까닭.';
// 14번(11-18 유호님 「스토리에 희노애락이 있고 기승전결이 있나」 → 「넣어줘」): 보는 동안 기분이 바뀌었나 — 컷표 「감정흐름」(T24)과 견준다.
// 시험관 둘이 처음과 끝을 같은 낱말로 대거나 「안 바뀜」이면 굴곡이 화면에서 안 읽힌 것이다.
const 흐름14 = '14. 보는 동안 기분이 어떻게 바뀌었나 — 처음 · 가운데 · 끝을 한 낱말씩, 가장 크게 바뀐 초. 바뀌지 않았으면 「안 바뀜」.';
const 퀴즈9 = (who) => `9. 비교용 묶음(같은 계정의 지난 퀴즈 편)과 견주어 같은 퀴즈를 또 찍어 낸 것처럼 보이나 — 「같아 보임」 또는 「달라 보임」과, 같아 보이면 어디가 같은지(무대 · 주제 · 마스코트 표정 · 색 · 구도 가운데). 이 계정의 퀴즈 칸에 늘 있는 짜임(${퀴즈고정})과 ${who.고정 ? `이 계정에 늘 나오는 것(${who.고정})` : '이 계정에 늘 나오는 캐릭터'}은 같아도 같은 퀴즈로 치지 않는다 — 장면의 무대 · 다루는 주제 · 마스코트의 표정 · 색 · 구도가 겹치는지로만 판단한다.`;

function buildPrompt({ brand, sheets, sheet, speech, cuts = false, previous = [], 틀 = null, 중간 = false }) {
  const who = 시청자[brand];
  if (!who) throw new Error(`브랜드는 ${Object.keys(시청자).join(' · ')} 가운데 하나다: ${brand}`);
  const list = [].concat(sheets || sheet || []);
  const every = 장면안내(cuts);
  const prev = previous.length
    ? ['', `- 비교용(9번에만): 같은 계정이 이 영상 전에 올린 ${previous.length}편의 장면 묶음 — ${previous.map((p) => p.file).join(' · ')}. ${who.회상 ? '1~8번과 10~14번' : who.사람편 ? '1~8번과 10 · 11번' : '1~8번'}은 이 영상만 보고 답한 뒤, 9번을 답할 때만 연다.`]
    : [];
  return [
    `너는 ${who.곳}를 넘기다가 이 영상을 처음 본 사람이다. ${who.사람}이고, 이 계정도 만든 사람도 이 영상의 배경도 모른다. 아래 파일만 Read 도구로 열어 보고 답해라. 다른 파일·폴더·인터넷은 보지 마라.`,
    '',
    `- 장면 묶음(그림 ${list.length}장, 이 순서로 다 연다): ${list.join(' · ')} — 휴대폰에서 보는 크기 그대로다. ${every} 한 장 안은 왼쪽에서 오른쪽, 위에서 아래 순서.`,
    `- 들리는 말: ${speech} — 줄 앞 숫자는 그 말이 시작하는 초. 배경음악은 따로 깔려 있다.`,
    ...prev,
    ...(중간 ? ['- 이 영상은 편집 중인 앞부분이다. 끝까지 다 만든 영상이 아니다.'] : []),
    '',
    `한국어로, 아래 양식 그대로 답해라(전체 ${중간 ? '1500자 안팎 — 15번은 칸마다 한 줄' : '700자 안팎'}). 겉치레 칭찬은 하지 말고, 모르는 것은 모른다고 써라. 휴대폰에서 작아 못 읽은 글자는 못 읽었다고 써라.`,
    '1. 이 영상이 말하려는 것 — 친구에게 전하듯 한 문장.',
    '2. 보고 나서 내가 바로 할 수 있게 된 것 — 없으면 「없음」.',
    '3. 무슨 말인지 모르겠던 낱말·장면 — 초와 함께 전부. 없으면 「없음」.',
    '4. 넘겼을 것 같은 초와 까닭 — 끝까지 봤을 것 같으면 「끝까지」와 까닭.',
    '5. 이해 점수 1~5(5 = 한 번 보고 다 알겠다)와 한 줄 까닭.',
    '6. 재미 점수 1~5(5 = 친구에게 보여 주고 싶을 만큼 재밌다, 1 = 지루하다)와 한 줄 까닭 — 이해와 따로 매긴다.',
    '7. 처음 3초(0~3초 장면)만 보고 넘기겠나 — 「넘김」 또는 「계속 봄」과 까닭.',
    '8. 저장하거나 누구에게 보내겠나 — 「저장」 · 「공유」 · 「둘 다」 · 「안 함」 가운데 하나와 까닭.',
    previous.length && 틀 === '퀴즈'
      ? 퀴즈9(who)
      : previous.length
      ? `9. 비교용 묶음과 견주어 같은 틀을 또 찍어 낸 것처럼 보이나 — 「같아 보임」 또는 「달라 보임」과, 같아 보이면 어디가 같은지(무대 구성 · 말 순서 · 머리 글 · 끝 카드 가운데). ${who.고정 ? `이 계정에 늘 나오는 것(${who.고정})은 같아도 같은 틀로 치지 않는다 — ` : ''}화면에 무엇이 어떻게 놓이고 어떤 순서로 말하고 무엇으로 끝나는지로만 판단한다.`
      : '9. (비교용 묶음 없음 — 「비교 못 함」이라고만 쓴다)',
    ...(who.사람편 ? [사람10, 중간 ? 중간빼기(끝11) : 끝11] : []),
    ...(who.회상 ? [중간 ? 중간빼기(회상12) : 회상12, 회상13, 흐름14] : []),
    ...(중간 ? [칸15] : []),
    '',
  ].join('\n');
}

// 「볼 이유」 심사(10-29 유호님 「제안대로 바꿔」) — 이해 시험과 원본 1:1을 넘고도 「AI 슬롭」으로 버려진 편(PULSE 기프트 세트 · synkbrief B2)을
// 거르려고, 알아듣는지가 아니라 볼 이유 · 무엇으로 이기나 · 슬롭으로 보이나를 묻는다. 맥락 없는 새 심사관(Agent model opus)에게 준다.
function buildWorthPrompt({ brand, sheets, sheet, speech, cuts = false }) {
  const who = 시청자[brand];
  if (!who) throw new Error(`브랜드는 ${Object.keys(시청자).join(' · ')} 가운데 하나다: ${brand}`);
  const list = [].concat(sheets || sheet || []);
  const 광고 = brand === 'pulse';
  return [
    `너는 ${who.곳}에서 하루에 영상을 수백 개 넘기는 까다로운 시청자다. ${who.사람}이고, 이 계정도 만든 사람도 이 영상의 배경도 모른다.${광고 ? ' 그리고 광고 영상을 맡길 곳을 찾는 회사 담당자의 눈으로도 본다.' : ''} 아래 파일만 Read 도구로 열어 보고 답해라. 다른 파일·폴더·인터넷은 보지 마라.`,
    '',
    `- 장면 묶음(그림 ${list.length}장, 이 순서로 다 연다): ${list.join(' · ')} — 휴대폰에서 보는 크기 그대로다. ${장면안내(cuts)} 한 장 안은 왼쪽에서 오른쪽, 위에서 아래 순서.`,
    `- 들리는 말: ${speech} — 줄 앞 숫자는 그 말이 시작하는 초. 배경음악은 따로 깔려 있다.`,
    '',
    '알아듣는지가 아니라 「볼 이유가 있는지」를 묻는다. 한국어로, 아래 양식 그대로 답해라(전체 600자 안팎). 겉치레 칭찬은 하지 말고, 하루에 보는 흔한 AI 영상들과 견주어 냉정하게 답해라.',
    '1. 이 영상이 무엇으로 이기려 하나 — 「이야기」(기승전결이 있고 끝에 여운이 남는다) · 「임팩트」(눈에 박히는 한 장면 · 비싼 효과나 장치) · 「둘 다 아님」 가운데 하나와, 그렇게 본 초 · 장면.',
    '2. 볼 이유 점수 1~5(5 = 끝나고도 여운이 남거나 한 장면이 눈에 박혀 다시 보고 싶다, 3 = 볼 만은 하지만 금방 잊는다, 1 = 볼 이유가 없다)와 한 줄 까닭.',
    `3. AI 슬롭처럼 보이나 — 「슬롭 같음」 또는 「아님」과, 그렇게 보인 초 · 장면(매끈하기만 하고 비어 보이는 화면, 뜻 없는 화려함, 이야기 없이 늘어놓은 장면, 어디서 본 듯한 짜임 같은 것).${who.고정 ? ` 이 계정에 늘 나오는 것(${who.고정})과 그 그림체 · 질감은 그것만으로 슬롭으로 치지 않는다 — 그것으로 무엇을 어떻게 보여 주는지로 판단한다.` : ''}`,
    '4. 가장 약한 자리 한 곳(초)과, 무엇을 바꾸면 볼 이유가 생길지 한 줄.',
    광고 ? '5. 이 영상을 만든 팀에 돈 내고 광고를 맡기겠나 — 「맡김」 · 「고민」 · 「안 맡김」과 한 줄 까닭.' : '5. (광고가 아님 — 「해당 없음」이라고만 쓴다)',
    '',
  ].join('\n');
}

function probe(video) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', video],
    { encoding: 'utf8', windowsHide: true });
  let info = null;
  try { info = JSON.parse(String(r.stdout)); } catch { /* 아래에서 멈춘다 */ }
  const sec = Number(info?.format?.duration);
  const s = info?.streams?.[0] || {};
  if (r.status !== 0 || !(sec > 0)) throw new Error('ffprobe로 길이를 못 읽었다: ' + String(r.stderr || '').trim());
  return { duration: sec, landscape: Number(s.width) > Number(s.height) };
}

// 찍을 장면: 0~3초는 0.5초마다(첫 장면에서 넘길지가 갈린다), 그 뒤는 2초마다, 그리고 끝에서 0.3초 앞 장면(끝 카드).
function shotTimes(duration) {
  const out = [];
  for (let t = 0; t <= 3 + 1e-9 && t < duration; t += 0.5) out.push(Math.round(t * 10) / 10);
  for (let t = 4; t < duration - 1; t += 2) out.push(t);
  const end = Math.max(0, Math.round((duration - 0.3) * 10) / 10);
  if (end - out[out.length - 1] >= 0.5) out.push(end);
  return out.map((t) => ({ at: t, label: `${Number.isInteger(t) ? t : t.toFixed(1)}s` }));
}

// --컷 「0,3.56,4.52,…」(컷이 시작하는 초). 2초보다 짧은 컷이 많은 영상은 2초 정지컷이 컷을 통째로 빠뜨린다 — 원본 1:1
// 리메이크 「옆집의 크리스마스」 36컷/60초는 10컷이 묶음에 없었다(10-26). 그래서 컷마다 그 컷 가운데 장면 한 장을 찍는다.
// 칸이 모두 같은 크기라 0.5초 컷도 3초 컷만큼 무게를 얻으니, 표시는 그 컷이 나오는 「시작-끝」 초로 한다.
function parseCuts(text, end) {
  const starts = String(text).split(',').map((x) => Number(x.trim()));
  if (!starts.length || starts.some((s, i) => !(s >= 0) || s >= end || (i > 0 && s <= starts[i - 1]))) {
    throw new Error(`--컷은 0 이상 ${end.toFixed(2)}초 미만에서 커지는 초를 쉼표로 잇는다: ${text}`);
  }
  return starts;
}

function cutShots(starts, end) {
  return starts.map((s, i) => {
    const e = i + 1 < starts.length ? starts[i + 1] : end;
    return { at: (s + e) / 2, label: `${s.toFixed(1)}-${e.toFixed(1)}s` };
  });
}

// 자동 칸(11-17, 유호님 「검수에서 지적된것들이 다음번에는 실수 안하게 반영 되고있어?」 — LAB 교훈 L01). 「짧은 칸이 많은 편은 처음부터
// --컷」이 이해 시험 기록에 11-01 · 11-02(둘) · 11-07 · 11-16(셋) 일곱 번 다시 적혔다: 사람이 칸 초를 세어 넘기는 일에 기대면 매번 잊는다.
// --컷을 안 주면 ffmpeg 장면 바뀜(scene)으로 칸 경계를 찾아, 기본 장면(0.5초 · 2초 간격)이 안쪽에 하나도 없는 칸마다 그 칸 가운데 한 장을
// 더 찍는다. 칸 첫 장은 쓰지 않는다 — M51 「인사 한마디」는 시험 장면이 칸 첫 장이라 0.05초 늦게 뜬 말풍선이 빠졌다. --컷 끔은 예전 그대로.
// 문턱은 0.1부터 — 11-17 M55 「단디」 최종본에서 0.25는 경계 7곳만 찾아 기록이 「놓쳤다」고 적은 0.5~0.6초 칸(10.8~11.3 · 11.3~11.9초)을
// 못 찾았고, 0.12는 14곳으로 그 칸을 찾았다. 움직임이 큰 실사 영상은 0.1에서 경계가 넘치니, 경계상한을 넘으면 0.25로 한 번 물러난다
const 자동칸 = { 문턱들: [0.1, 0.25], 최소: 0.25, 앞: 0.1, 뒤: 0.05, 경계상한: 60 };

// ffmpeg showinfo 출력(stderr) → 칸 경계 초(커지는 순 · 0.05초 안에 붙은 것은 하나로). 0초 근처와 끝 근처는 뺀다
function sceneTimes(text, duration) {
  const out = [];
  for (const m of String(text || '').matchAll(/pts_time:\s*([0-9]+(?:\.[0-9]+)?)/g)) {
    const t = Number(m[1]);
    if (!(t > 0.05) || !(t < duration - 0.05)) continue;
    if (out.length && t - out[out.length - 1] < 0.05) continue;
    out.push(Math.round(t * 1000) / 1000);
  }
  return out.sort((a, b) => a - b);
}

function detectCuts(video, duration, 문턱 = 자동칸.문턱들[0]) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', video, '-an', '-vf', `select='gt(scene,${문턱})',showinfo`, '-f', 'null', '-'],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('ffmpeg 장면 바뀜 실패: ' + String(r.stderr || '').trim().split('\n').slice(-1).join(' '));
  return sceneTimes(r.stderr, duration);
}

// 기본 장면 + 칸 경계 → 기본 장면이 안쪽(첫 0.1초 · 끝 0.05초를 뺀 곳)에 하나도 없는 칸(0.25초 넘는 칸)마다 가운데 한 장을 더한 장면 목록
function addCutShots(base, bounds, duration, opt = 자동칸) {
  const 점 = [0, ...bounds.filter((t) => t > 0 && t < duration), duration];
  const more = [];
  for (let i = 0; i + 1 < 점.length; i += 1) {
    const s = 점[i];
    const e = 점[i + 1];
    if (e - s < opt.최소) continue;
    if (base.some((b) => b.at > s + opt.앞 && b.at < e - opt.뒤)) continue;
    const at = Math.round(((s + e) / 2) * 100) / 100;
    more.push({ at, label: `${at.toFixed(1)}s`, 칸: [s, e] });
  }
  return { shots: [...base, ...more].sort((a, b) => a.at - b.at), more: more.length };
}

function ffmpeg(args, what) {
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', ...args], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`ffmpeg 실패(${what}): ` + String(r.stderr || '').trim().split('\n').slice(-2).join(' '));
}

// 장면마다 한 장씩 찍어(초를 찍어 넣고) cell.열×cell.행 칸으로 묶는다 → 만든 그림 경로들. -ss를 -i 앞에 두면 그 시각의 프레임을 바로 찾는다.
function makeSheets(video, shots, cell, outFor) {
  const dir = fs.mkdtempSync(path.join(path.dirname(outFor(1)), '.장면-'));
  try {
    shots.forEach((shot, i) => {
      const vf = `scale=${cell.w}:${cell.h},drawtext=fontfile='${FONT}':text='${shot.label}':x=8:y=8:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=6`;
      ffmpeg(['-ss', shot.at.toFixed(3), '-i', video, '-vf', vf, '-frames:v', '1', path.join(dir, `${String(i).padStart(3, '0')}.png`)], `${shot.label} 장면`);
    });
    const per = cell.열 * (cell.행 || Math.ceil(shots.length / cell.열));
    const files = [];
    for (let k = 0; k * per < shots.length; k += 1) {
      const n = Math.min(per, shots.length - k * per);
      const rows = cell.행 ? Math.min(cell.행, Math.ceil(n / cell.열)) : Math.ceil(n / cell.열);
      const out = outFor(k + 1);
      ffmpeg(['-start_number', String(k * per), '-i', path.join(dir, '%03d.png'), '-frames:v', '1', '-vf', `tile=${cell.열}x${rows}:nb_frames=${n}:padding=6:color=white`, '-q:v', '3', out], '묶기');
      files.push(out);
    }
    return files;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// 영상이 든 편 폴더(docs/마케팅/<편>) — 그 편은 지난 편에서 뺀다.
function episodeOf(file) {
  const parts = path.resolve(file).split(path.sep);
  const i = parts.lastIndexOf('마케팅');
  return i >= 0 && parts[i + 1] ? parts[i + 1] : null;
}

// 같은 계정의 지난 편 — 판에 그 계정이 있고 영상이 있는 편 가운데 이 편 말고 「시각」이 가장 늦은 n편.
// 영상은 git 밖이라 공용 작업본에 있고(묶음의 mediaRoot가 찾는다), 준비.json은 이 작업본이 더 새로울 수 있어 먼저 본다(11-03 예약 작업 워크트리 — 공용 작업본이 뒤처지면 지난 편을 놓친다).
function pickPrevious(account, { exclude = null, roots = [ROOT, 공용작업본(ROOT)], n = 2 } = {}) {
  if (!account) return [];
  const 묶음 = require('./lib/게시묶음.js');
  const found = new Map();
  for (const root of [...new Set(roots.map((r) => path.resolve(r)))]) {
    const base = path.join(root, 'docs', '마케팅');
    let names = [];
    try { names = fs.readdirSync(base); } catch { continue; }
    for (const name of names) {
      if (name === exclude || found.has(name) || !fs.existsSync(path.join(base, name, '게시', '준비.json'))) continue;
      let plates;
      try { plates = 묶음.plates(묶음.load(path.join(base, name))); } catch { continue; } // 원고가 깨진 편(JSON 아닌 원고.json 등)은 건너뛴다
      // 돌림 판(나라 판본 — 판 「돌림」: true)은 그 계정의 지난 「편」이 아니다(11-21: @synklabusa에는 몽골 원본의 US 판본이 걸려 있어 영어 편과 견주게 됐다)
      const plate = plates.find((p) => p.account === account && !p.raw?.돌림 && p.video?.exists && Date.parse(p.time || ''));
      if (plate) found.set(name, { name, video: plate.video.path, time: Date.parse(plate.time) });
    }
  }
  return [...found.values()].sort((a, b) => b.time - a.time || a.name.localeCompare(b.name)).slice(0, n);
}

function previousVideo(arg, account = null) {
  const p = path.resolve(arg);
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return { name: episodeOf(p) || path.basename(p, path.extname(p)), video: p };
  const 묶음 = require('./lib/게시묶음.js');
  const bundle = 묶음.load(p);
  // 그 브랜드 계정의 판을 먼저(11-10: 퀴즈 #5 폴더를 주면 첫 판 lab-youtube 영어판을 골라 몽골 시험관이 영어 퀴즈와 견줄 뻔했다)
  const plates = 묶음.plates(bundle).filter((x) => x.video?.exists);
  const plate = plates.find((x) => account && x.account === account) || plates[0];
  if (!plate) throw new Error(`--지난 ${arg}: 판에 영상이 없다`);
  return { name: path.basename(p), video: plate.video.path };
}

// 장면 심사에는 기존 맹검 재료를 그대로 만들고, 첫 컷 확인은 tools/첫컷검사.py가 따로 진행한다.
// 편의 장면/ 폴더를 쓰는 기존 명령도 같은 검사를 거친다. 다른 위치에서 만든 시험 컷은 --첫컷으로 편을 지정한다.
// 11-18 저녁부터 첫 컷 판정은 첫컷검사가 부른 맥락 없는 다른 눈이 한다. 제작 세션은 판정 파일(--첫컷확인)을 쓰지 않고,
// 굽기 전에 정한 장면 주문을 --첫컷주문으로 넘긴다(컷표 틀 2 편은 --첫컷컷들로 컷 이름을 넘기고, 컷표 줄이 주문이다).
// 다른 눈의 '다시'가 틀렸다고 보면 --첫컷반박 "<열쇠>=<근거>"(한 번에 하나).
function 첫컷인자(video, options, duration) {
  if (Object.hasOwn(options, '첫컷확인')) {
    throw new Error('첫 컷 판정은 다른 눈이 한다(11-18). --첫컷확인은 받지 않는다 — 장면 주문은 --첫컷주문, 틀린 판정은 --첫컷반박 "<열쇠>=<근거>".');
  }
  const dir = path.dirname(path.resolve(video));
  const episode = options['첫컷'] || (path.basename(dir) === '장면' && path.basename(path.dirname(path.dirname(dir))) === '마케팅'
    ? path.dirname(dir) : null);
  if (!episode) {
    if (['첫컷주문', '첫컷컷들', '첫컷반박', '첫컷시작', '첫컷끝'].some(k => Object.hasOwn(options, k))) throw new Error('--첫컷주문 · --첫컷컷들 · --첫컷반박 · --첫컷시작에는 --첫컷 <편 폴더>나 편의 장면/ 영상이 필요하다.');
    return null;
  }
  const 구간요청 = Object.hasOwn(options, '첫컷시작') || Object.hasOwn(options, '첫컷끝');
  if (duration > 30 && !구간요청) {
    if (['첫컷', '첫컷주문', '첫컷컷들', '첫컷반박'].some(k => Object.hasOwn(options, k))) {
      throw new Error('긴 영상은 --첫컷시작과 --첫컷끝으로 대표 구간을 지정한다.');
    }
    return null;
  }
  const 주문 = String(options['첫컷주문'] || '').trim();
  const 컷들 = String(options['첫컷컷들'] || '').trim();
  let 틀2 = false;
  try {
    틀2 = JSON.parse(fs.readFileSync(path.join(path.resolve(episode), '컷표.json'), 'utf8').replace(/^﻿/, '')).틀 === 2;
  } catch { /* 컷표가 없거나 읽히지 않으면 장면 주문으로 본다 */ }
  if (틀2 && !컷들) {
    throw new Error('이 편은 컷표 틀 2다. 컷표 줄이 다른 눈의 주문이니 이 영상에 든 컷을 --첫컷컷들 "1-1,1-2"로 준다.');
  }
  if (!틀2 && 컷들) {
    throw new Error('--첫컷컷들은 컷표 틀 2 편에서만 쓴다. 이 편은 장면 주문을 --첫컷주문으로 준다.');
  }
  if (!주문 && !컷들) {
    throw new Error('편의 첫 컷은 다른 눈이 프레임과 주문을 견줘 본다. 굽기 전에 정한 장면 주문을 --첫컷주문 "<보여야 하는 인물 · 동작 · 소품 · 화면 글>"로 준다.');
  }
  const args = [path.resolve(episode), path.resolve(video)];
  if (구간요청) {
    const start = Number(options['첫컷시작']), end = Number(options['첫컷끝']);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end - start > 30) {
      throw new Error('--첫컷시작과 --첫컷끝에 영상 안의 30초 이내 구간을 초 단위로 지정한다.');
    }
    args.push('--시작', String(start), '--끝', String(end));
  }
  if (options['브랜드'].startsWith('lab-')) args.push('--종류', 'LAB');
  if (컷들) args.push('--컷들', 컷들);
  if (주문) args.push('--주문', 주문);
  if (options['첫컷반박']) args.push('--반박', String(options['첫컷반박']));
  return args;
}

// ㉓ 화면 글 먼저(11-23 유호님 「2번: 렌더 직후 먼저」) — LAB 새 편은 질문을 만들기 전에 화면 글 시간을 잰다(tools/lib/화면글관문.js 시험전검사).
// 고칠 것(새 글 5/6초 아래 · 답 1.5초 아래 · 낱말 일곱 넘음)이 있으면 재료를 만들지 않는다 — 원본의 시간만 늘려 다시 렌더한 뒤 이 시험을 돈다.
// 그래서 이해 시험에 떨어져 「가장 나은 판」으로 나가는 판도 시간을 고친 판이다(그 규칙은 그대로). 첫 컷 확인(장면/ 영상 · --첫컷…)은 편의 렌더가 아니라 재지 않는다.
// 확인할 것 · 못 잰 것은 알리고 시험을 이어 간다.
const 화면글언어 = { 'lab-en': 'en', 'lab-mn': 'mn', 'lab-cn': 'zh-Hans', 'lab-mm': 'my' };
function 화면글먼저(video, brand, options = {}, { 검사 = null, 찍기 = console.log } = {}) {
  if (!String(brand).startsWith('lab-')) return { 막음: false };
  if (Object.keys(options).some((k) => k.startsWith('첫컷')) || path.basename(path.dirname(path.resolve(video))) === '장면') return { 막음: false };
  const 관문 = require('./lib/화면글관문.js');
  const r = (검사 || 관문.시험전검사)(video, { 언어: 화면글언어[brand] || null, 알림: () => 찍기('  ㉓ 화면 글 시간을 먼저 잰다(LAB 새 편 · 원본을 다시 렌더해 1~3분)') });
  if (!r.대상) {
    if (r.까닭) 찍기(`㉓ 화면 글 — ${r.까닭}`); // .tmp로 렌더한 새 편이 소리 없이 빠지지 않게(Fable 설계 검토 11-24)
    return { 막음: false };
  }
  const { FIX } = require('./lib/게시글규칙.js');
  const 고칠 = r.줄.filter((x) => x.level === FIX);
  const 나머지 = r.줄.filter((x) => x.level !== FIX);
  if (고칠.length) 찍기(`㉓ 화면 글 — 고칠 것 ${고칠.length}줄: 재료를 만들지 않았다. 원본에서 시간을 늘려 다시 렌더한 뒤 이 시험을 다시 돈다(제작절차 「화면 글은 읽을 만큼」)`);
  else 찍기(`㉓ 화면 글 — 고칠 것 없음${나머지.length ? ` · 확인할 것 ${나머지.length}줄` : ''}`);
  for (const x of [...고칠, ...나머지]) 찍기(`  ${x.level} · ${x.where}: ${x.message}`);
  return { 막음: 고칠.length > 0 };
}

function main(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--중간') args['중간'] = true;   // 값 없는 선택
    else if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1], i += 1;
    else args._.push(argv[i]);
  }
  const video = args._[0];
  if (!video || !args['말'] || !args['브랜드']) {
    console.error('쓰는 법: node tools/낯선이시험.js <영상.mp4> --말 <말.txt|.srt> --브랜드 <lab-en|lab-mn|lab-cn|lab-mm|synkbrief|yuhobuilds|pulse|공모전> [--밖 <폴더>] [--컷 <초,초,…>|끔] [--지난 자동|없음|<편 폴더|영상>,…] [--틀 퀴즈] [--첫컷 <편 폴더>] [--첫컷시작 <초> --첫컷끝 <초>] [--첫컷컷들 "<컷,컷>"] [--첫컷주문 "<장면 주문>"] [--첫컷반박 "<열쇠>=<근거>"]');
    return 2;
  }
  const who = 시청자[args['브랜드']];
  if (!who) throw new Error(`브랜드는 ${Object.keys(시청자).join(' · ')} 가운데 하나다: ${args['브랜드']}`);
  if (args['틀'] !== undefined && args['틀'] !== '퀴즈') throw new Error(`--틀은 퀴즈만 있다: ${args['틀']}`);
  const src = path.resolve(video);
  if (화면글먼저(src, args['브랜드'], args).막음) return 1;
  const info = probe(src);
  const firstCut = 첫컷인자(src, args, info.duration);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
  const out = path.resolve(args['밖'] || path.join(ROOT, '.tmp', '낯선이시험', `${path.basename(video, path.extname(video))}-${stamp}`));
  fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(out)) if (/^(정지컷_|지난\d)/.test(f) && /\.jpg$/.test(f)) fs.rmSync(path.join(out, f)); // 같은 폴더로 다시 돌릴 때 옛 장면을 섞지 않는다
  const start = Number(args['첫컷시작'] || 0);
  const end = Object.hasOwn(args, '첫컷끝') ? Number(args['첫컷끝']) : null;
  if (end !== null && (end > info.duration + 0.005 || args['컷'])) throw new Error('첫 컷 구간은 실제 영상 안에서 고르고 --컷은 생략한다.');
  const 컷끔 = args['컷'] === '끔';
  const 컷줌 = args['컷'] !== undefined && !컷끔;
  let shots = 컷줌 ? cutShots(parseCuts(args['컷'], info.duration), info.duration) : shotTimes(info.duration);
  let 자동글 = '';
  let 자동더함 = 0;
  if (end !== null) {
    shots = shotTimes(end - start).map(shot => {
      const at = start + shot.at;
      return { at, label: `${at.toFixed(2)}s` };
    });
  } else if (!컷줌 && !컷끔) {
    // 자동 칸 — 실패해도 예전 장면으로 시험한다(끝 코드는 그대로)
    try {
      let bounds = null;
      let 문턱 = null;
      let 넘친 = 0;
      for (const t of 자동칸.문턱들) {
        const b = detectCuts(src, info.duration, t);
        if (b.length <= 자동칸.경계상한) { bounds = b; 문턱 = t; break; }
        넘친 = b.length;
      }
      if (!bounds) 자동글 = `  자동 칸: 장면 바뀜이 ${넘친}곳 넘게 잡혀(움직임이 큰 영상) 더하지 않았다. 짧은 칸이 있으면 --컷 <칸 시작 초,…>을 준다`;
      else {
        const r = addCutShots(shots, bounds, info.duration);
        shots = r.shots;
        자동더함 = r.more;
        자동글 = `  자동 칸: 장면 바뀜 ${bounds.length}곳(문턱 ${문턱}) · 기본 장면이 못 덮은 칸 ${r.more}곳을 그 칸 가운데로 더 찍었다(--컷 끔으로 끈다 — LAB 교훈 L01)`;
        // 낮은 문턱이 넘쳐 높은 문턱으로 물러났으면, 그 문턱은 0.5초 남짓한 칸을 놓친다(11-17 M55 실측) — 짧은 칸이 있는 편이면 손으로 준다(Fable 5.2 P3-2)
        if (문턱 !== 자동칸.문턱들[0]) 자동글 += `\n  자동 칸: 문턱 ${자동칸.문턱들[0]}에서 경계가 ${넘친}곳으로 넘쳐 ${문턱}로 물러났다 — 이 문턱은 0.5초 남짓한 칸을 놓칠 수 있으니, 짧은 칸이 있는 편이면 --컷 <칸 시작 초,…>을 준다`;
      }
    } catch (e) {
      자동글 = `  자동 칸: 장면 바뀜을 못 읽어 기본 장면만 찍었다 — ${String(e.message || e).slice(0, 160)}`;
    }
  }
  const cuts = 컷줌 ? true : (자동더함 ? '자동' : false);
  const sheets = makeSheets(src, shots, info.landscape ? 가로칸 : 세로칸, (k) => path.join(out, `정지컷_${String(k).padStart(2, '0')}.jpg`));

  const want = args['지난'] === undefined ? '자동' : String(args['지난']);
  const prevList = want === '없음' ? [] : want === '자동'
    ? pickPrevious(who.계정, { exclude: episodeOf(src) })
    : want.split(',').map((x) => x.trim()).filter(Boolean).map((x) => previousVideo(x, who.계정));
  const previous = prevList.map((p, i) => {
    const d = probe(p.video).duration;
    const times = [];
    for (let t = 0; t < d - 0.05; t += 2) times.push({ at: t, label: `${t}s` });
    const file = path.join(out, `지난${i + 1}_${p.name.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40)}.jpg`);
    makeSheets(p.video, times, { ...지난칸, 행: 0 }, () => file);
    return { ...p, file };
  });

  const speech = path.join(out, '말.txt');
  fs.writeFileSync(speech, readSpeech(path.resolve(args['말'])));
  if (args['틀'] === '퀴즈' && want === '자동') console.log('  --틀 퀴즈: 지난 편 자동 고르기는 이야기 편을 넣는다 — --지난 <그 계정의 지난 퀴즈 편 영상 둘>을 준다(제작절차 「LAB 하루 두 편」 7)');
  fs.writeFileSync(path.join(out, '질문.md'), buildPrompt({ brand: args['브랜드'], sheets, speech, cuts, previous, 틀: args['틀'] || null, 중간: args['중간'] === true }));
  fs.writeFileSync(path.join(out, '볼이유_질문.md'), buildWorthPrompt({ brand: args['브랜드'], sheets, speech, cuts }));
  console.log(`재료: ${out} · 장면 ${shots.length}칸 / 그림 ${sheets.length}장 · 지난 편 ${previous.length ? previous.map((p) => p.name).join(' · ') : '없음'}`);
  if (자동글) console.log(자동글);
  if (want === '자동' && who.계정 && previous.length < 2) console.log(`  지난 편을 ${previous.length}편만 찾았다(${who.계정} 판에 영상이 있는 편) — 9번은 그만큼만 본다`);
  for (const 줄 of 다음글(args['브랜드'])) console.log(줄);
  if (args['중간'] === true) console.log(중간관문);
  if (firstCut) {
    // 시험용 눈 바꿔치기 변수는 실제 첫 컷 검사에 넘기지 않는다(첫컷검사.py 눈변수와 같다).
    // Windows는 환경 변수 이름의 대소문자를 가리지 않으므로 대문자로 견준다.
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !['SYNK_FIRSTCUT_EYE', 'SYNK_FIRSTCUT_EYE_NAME', 'SYNK_CODEX_ROTATE', 'CODEX_BIN'].includes(k.toUpperCase())));
    const result = spawnSync(process.env.SYNK_PYTHON || 'python', ['-X', 'utf8', path.join(__dirname, '첫컷검사.py'), ...firstCut],
      { stdio: 'inherit', windowsHide: true, env });
    if (result.error) throw result.error;
    return result.status ?? 1;
  }
  return 0;
}

// 재료를 다 만든 뒤 찍는 「다음:」 줄과, 사람이 나오는 브랜드면 그 아래 답 처리 줄(11-16 흠 장부). 파일을 쓰지 않고 던지지 않는다
const 다음줄 = '다음: 질문.md를 이 대화 맥락이 없는 새 시험관 셋(Agent model sonnet · model haiku, 그리고 `node tools/GPT시험관.mjs <이 폴더>`, 서로 따로)에게 그대로 주고, 볼이유_질문.md는 새 심사관(Agent model opus)에게 준다 — 답을 한 장 기획의 「한 문장」 · 「무엇으로 이기나」와 견준다(제작절차 「시험」).';
const 중간관문 = '  → 중간 판 관문(11-20 · 점검표 29): 15번에서 시험관 둘이 같은 칸을 「왜 모름」 · 「끊김」이라 하면 유호님께 보내지 않는다 — 그 컷의 연기 · 소리 · 앞 컷 이음을 고친 뒤 다시 시험한다.';
function 다음글(brand, 갈래경로 = 흠갈래) {
  return [다음줄, ...답처리줄(brand, 갈래경로).map((x) => `  → 할 것: ${x}`)];
}

// 답 10 · 11처럼 통과 판정과 따로 다룰 답(11-16 흠 장부 「인물튐」 · 「끝의 힘」) — 흠갈래.json에서 단계가 「검수 질문」이고 자리가 이 도구로
// 시작하는 「올린곳」의 「할것」을 그대로 읽는다. 문장을 이 도구에 따로 두지 않는다 — 다음에 검수 질문을 올릴 때 흠갈래에 「할것」만 적으면
// 저절로 뜬다. 사람이 나오는 브랜드(시청자 표의 사람편)만. 흠갈래를 못 읽거나 꼴이 다르면 빈 목록이다(끝 코드 · 만드는 파일 · 질문.md는 그대로).
const 흠갈래 = path.join(ROOT, 'docs', '마케팅', '제작양식', '흠갈래.json');
function 답처리줄(brand, 갈래경로 = 흠갈래) {
  try {
    if (!Object.prototype.hasOwnProperty.call(시청자, brand) || 시청자[brand].사람편 !== true) return [];
    const 표 = JSON.parse(fs.readFileSync(갈래경로, 'utf8').replace(/^﻿/, ''));
    if (!표 || typeof 표 !== 'object') return [];
    const 자리들 = [...(Array.isArray(표.줄) ? 표.줄 : []), ...(표.항목 && typeof 표.항목 === 'object' ? Object.values(표.항목) : [])];
    const 곳 = 자리들.flatMap((x) => (x && Array.isArray(x.올린곳) ? x.올린곳 : []))
      .filter((o) => o && o.단계 === '검수 질문' && typeof o.자리 === 'string' && /^tools\/낯선이시험\.js(?:\s|$)/.test(o.자리) && typeof o.할것 === 'string' && o.할것.trim());
    const 번호 = (o) => Number((/^tools\/낯선이시험\.js\s+(\d+)번/.exec(o.자리) || [])[1]) || Number.MAX_SAFE_INTEGER;
    return [...new Set(곳.sort((a, b) => 번호(a) - 번호(b) || a.자리.localeCompare(b.자리, 'ko')).map((o) => o.할것.trim().replace(/\s+/g, ' ')))];
  } catch {
    return [];
  }
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { 중간관문, 첫컷인자, 화면글먼저, 화면글언어, srtToLines, readSpeech, buildPrompt, buildWorthPrompt, parseCuts, cutShots, shotTimes, sceneTimes, addCutShots, detectCuts, 자동칸, pickPrevious, episodeOf, 시청자, 답처리줄, 다음글 };

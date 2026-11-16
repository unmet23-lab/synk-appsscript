'use strict';
/**
 * AI에게 물으면 SYNK가 나오는가 — 주 1회 재기(설계 4절).
 *
 * 11-16 기준선의 질문 세트(일반 24 · 브랜드 6)를 공식 API 두 곳에 묻는다.
 *  - Claude: 웹 검색 도구를 켠 claude-opus-5-5, 결제 수단 없는 조직의 무료 크레딧 키(tools/lib/클로드키.js).
 *    검색 도구는 기본 판 web_search_20250305를 쓴다. 새 판(web_search_20260209, 동적 거르기)은 답 글에 인용을 달지 않아
 *    synk.im이 검색에 걸려도 인용으로 셀 수 없었다(11-17 실측, 브랜드 질문 B01).
 *    거절되면 다른 모델로 넘기지 않는다(fallbacks를 켜지 않음) — 재는 대상이 바뀌면 회차끼리 견줄 수 없어서다. 거절은 「답 없음」.
 *  - Gemini: 구독 통로(tools/lib/제미나이구독호출.js, agy · Ultra 계정)로 gemini-3.8-flash에 묻는다. 그 통로는 도구 없이 바로 답하게 부르므로
 *    웹 검색 없이 모델이 아는 것만으로 답한 값이다(「기억으로 답한 값」). 무료 API 키는 구글 검색 근거를 켜면 429로 막히고(11-17 실측),
 *    유료 키는 만들지 않기로 했다(11-15 결정). 출처를 세려고 질문 뒤에 「출처 주소를 적어 달라」는 꼬리 한 줄을 붙이고, 판정에서 그 꼬리를 뺀다.
 * 브라우저로 소비자 화면(ChatGPT · 구글 · 네이버 따위)을 자동으로 묻지 않는다 — 그 서비스들의 약관과 robots가 자동 질문을 막는다.
 *
 * 세는 법(코드가 센다, 1회차와 같은 식): 일반 질문의 답에 SYNK가 나왔나(언급), 답이 단 출처에 synk.im이 있나(인용),
 * 브랜드 질문의 출처에 synk.im이 있나(브랜드 인용). 답이 비었거나 거절되면 「답 없음」으로 분모에서 뺀다.
 * 답 원문은 비공개 보관함 `PULSE_마케팅_내부검증/AI검색_기준선/정기/<날짜>/`에, 센 값만 장부(git 밖)에 남긴다.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const 보관함 = () => process.env.SYNK_VAULT || path.join(os.homedir(), 'Documents', 'SYNK-보관함');
const 기준선폴더 = () => path.join(보관함(), 'PULSE_마케팅_내부검증', 'AI검색_기준선');
const 질문세트자리 = () => process.env.SYNK_AI_QUESTIONS || path.join(기준선폴더(), '질문세트_v1.json');

const 클로드모델 = 'claude-opus-5-5';
const 제미나이모델 = 'gemini-3.8-flash';

/** 1회차 스크립트와 같은 언급 판정(질문 글을 뺀 답에서) */
const 언급식 = /synk|싱크\s?(펄스|월드|랩)/i;
const synk주소 = (h) => /(^|\.)synk\.im$/i.test(String(h || '').replace(/^www\./i, ''));

function 질문세트읽기(자리 = 질문세트자리()) {
  const j = JSON.parse(fs.readFileSync(자리, 'utf8'));
  const 질문 = Array.isArray(j.질문) ? j.질문 : [];
  if (!질문.length) throw new Error('질문 세트가 비었다');
  return { 판: j.판 || 'v1', 질문 };
}

const 브랜드인가 = (q) => q.묶음 === '브랜드' || /^B/.test(q.id);

function 호스트(u) {
  try { return new URL(u).hostname.toLowerCase(); } catch { return ''; }
}

/** Claude 응답 → { 답, 인용주소[], 검색주소[], 거절 } */
function 클로드읽기(응답) {
  const 블록 = Array.isArray(응답?.content) ? 응답.content : [];
  const 답 = 블록.filter((b) => b.type === 'text').map((b) => b.text || '').join('').trim();
  const 인용 = new Set(), 검색 = new Set();
  for (const b of 블록) {
    if (b.type === 'text' && Array.isArray(b.citations)) for (const c of b.citations) if (c?.url) 인용.add(c.url);
    // 검색 도구의 오류는 content가 목록이 아니라 객체다 — 목록일 때만 읽는다
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) for (const r of b.content) if (r?.url) 검색.add(r.url);
  }
  return { 답, 인용주소: [...인용], 검색주소: [...검색], 거절: 응답?.stop_reason === 'refusal', 모델: 응답?.model || null };
}

const 제미나이꼬리 = '\n\n답 끝에 참고한 출처 주소가 있으면 한 줄에 하나씩 적어 줘.';

/** 구독 통로의 답 글 → { 답, 인용주소[], 검색주소[] } — 출처는 답 글에 적힌 주소다(검색 결과가 아니라 모델이 적은 주소) */
function 제미나이읽기(기록) {
  const 답 = String(기록?.text || '').trim();
  const 주소 = (답.match(/https?:\/\/[^\s)<>\]\["'`]+/g) || []).map((u) => u.replace(/[.,;:]+$/, ''));
  return { 답, 인용주소: [...new Set(주소)], 검색주소: [], 거절: false, 모델: 기록?.selectedModel || 기록?.modelVersion || null };
}

/** 한 답을 판정한다 */
function 판정(q, 읽음) {
  const 본문 = String(읽음.답 || '').split(q.글).join('').split(제미나이꼬리.trim()).join('');
  const 답없음 = !!읽음.거절 || Buffer.byteLength(본문, 'utf8') < 200;
  const 인용 = 읽음.인용주소.some((u) => synk주소(호스트(u)));
  return {
    질문: q.id, 브랜드: 브랜드인가(q), 답없음,
    언급: !답없음 && !브랜드인가(q) && 언급식.test(본문),
    인용: !답없음 && 인용,
    검색에걸림: 읽음.검색주소.some((u) => synk주소(호스트(u))),
    출처수: new Set(읽음.인용주소.map(호스트).filter(Boolean)).size,
    모델: 읽음.모델,
  };
}

/** 판정들 → 서비스 하나의 센 값 */
function 셈(이름, 판정들) {
  const 일반 = 판정들.filter((p) => !p.브랜드), 브랜드 = 판정들.filter((p) => p.브랜드);
  const 받음 = (xs) => xs.filter((p) => !p.답없음);
  return {
    이름,
    일반질문: 일반.length, 답받음: 받음(일반).length,
    언급: 받음(일반).filter((p) => p.언급).length,
    인용: 받음(일반).filter((p) => p.인용).length,
    브랜드질문: 브랜드.length, 브랜드답받음: 받음(브랜드).length,
    브랜드인용: 받음(브랜드).filter((p) => p.인용).length,
  };
}

async function 클로드묻기(q, { 보내기 = require('../lib/클로드키.js').보내기 } = {}) {
  const { 응답 } = await 보내기({
    model: 클로드모델, max_tokens: 8000,
    output_config: { effort: 'low' },
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    messages: [{ role: 'user', content: q.글 }],
  }, { 용도: 'site-visits-ai-check', 시간제한: 300000 });
  return 클로드읽기(응답);
}

async function 제미나이묻기(q, { 부르기 = require('../lib/제미나이구독호출.js').부르기 } = {}) {
  const 기록 = await 부르기({ model: 제미나이모델, prompt: `${q.글}${제미나이꼬리}`, thinking: 'low', timeoutMs: 240000 });
  return 제미나이읽기(기록);
}

/** 서비스 이름은 요약과 솔리오에 그대로 보인다 */
const 서비스들 = Object.freeze({ Claude: 클로드묻기, Gemini: 제미나이묻기 });
const 서비스설명 = Object.freeze({ Claude: '웹 검색을 켠 답', Gemini: '검색 없이 기억으로 답한 값' });

/**
 * 한 회차를 잰다. 서비스마다 질문을 차례로 묻고, 한 서비스가 연달아 세 번 실패하면 그 서비스만 멈춘다(우회하지 않는다).
 * @returns { 날, 질문세트판, 서비스: [셈…], 멈춤: {서비스: 까닭} }
 */
async function 회차재기({ 날, 질문들, 묻기 = 서비스들, 원문쓰기 = null, 쉬기 = (ms) => new Promise((r) => setTimeout(r, ms)), 사이ms = 1500 }) {
  const 결과 = { 날, 서비스: [], 멈춤: {} };
  // 서비스끼리는 함께, 한 서비스 안에서는 질문을 차례로 묻는다(속도 제한을 건드리지 않게).
  const 한서비스 = async ([이름, 묻기함수]) => {
    const 판정들 = [];
    let 연달아 = 0;
    for (const q of 질문들) {
      try {
        const 읽음 = await 묻기함수(q);
        판정들.push(판정(q, 읽음));
        if (원문쓰기) 원문쓰기(이름, q, 읽음);
        연달아 = 0;
      } catch (e) {
        판정들.push({ 질문: q.id, 브랜드: 브랜드인가(q), 답없음: true, 언급: false, 인용: false, 검색에걸림: false, 출처수: 0, 오류: String(e.message || e).slice(0, 200) });
        연달아 += 1;
        if (연달아 >= 3 || e.http === 429) { 결과.멈춤[이름] = String(e.message || e).slice(0, 200); break; }
      }
      await 쉬기(사이ms);
    }
    return { ...셈(이름, 판정들), 설명: 서비스설명[이름] || null, 판정들 };
  };
  결과.서비스 = await Promise.all(Object.entries(묻기).map(한서비스));
  return 결과;
}

/** 원문을 보관함 회차 폴더에 남기는 함수를 만든다 */
function 원문쓰기만들기(날) {
  const 폴더 = path.join(기준선폴더(), '정기', 날);
  return (서비스, q, 읽음) => {
    const d = path.join(폴더, 서비스);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, `${q.id}.txt`), `# ${q.id} ${q.글}\n# 서비스 ${서비스} · 모델 ${읽음.모델 || '모름'} · 공식 API\n\n${읽음.답}\n\n# 답이 단 출처\n${읽음.인용주소.join('\n')}\n\n# 검색 결과 주소\n${읽음.검색주소.join('\n')}\n`, 'utf8');
  };
}

module.exports = { 질문세트자리, 질문세트읽기, 기준선폴더, 클로드모델, 제미나이모델, 클로드읽기, 제미나이읽기, 판정, 셈, 회차재기, 원문쓰기만들기, 서비스들, 서비스설명, 언급식, 제미나이꼬리 };

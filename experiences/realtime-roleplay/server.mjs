// 실시간 음성 상황극 시제품의 로컬 서버(2026-10-30) — 이 PC에서만 듣는다(127.0.0.1). 학생에게 여는 배포가 아니다.
// 화면(public/)을 주고, SDP 교환으로 공급사 세션을 열고(키는 서버만), 끝나면 장부에 값을 적고 전사로 글 피드백을 만든다.
//   node experiences/realtime-roleplay/server.mjs           → http://127.0.0.1:5250/
//   SYNK_ROLEPLAY_BUDGET_USD=50(기본) · SYNK_ROLEPLAY_RESET_DAY=1(예산 주기 시작 날, 구독 결제일에 맞춤) · SYNK_ROLEPLAY_LEDGER(장부 경로)
//   · SYNK_OPENAI_BASE(시험용 가짜 서버) · PORT
// 소리는 서버를 지나지 않고, 전사는 피드백을 만드는 동안만 메모리에 둔다. 콘솔에는 길 · 시간 · 어림 값만 찍는다.
import http from 'node:http';
import fs from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 팬사인회, 지시문, 첫인사지시, 마무리지시 } from './lib/장면.mjs';
import { 공급사들, 응답부르기 } from './lib/공급사.mjs';
import { 계량, 장부읽기, 장부적기, gptLive값, realtime값, 글값 } from './lib/예산.mjs';
import { 요청본문, 출력글, 검사, 피드백모델 } from './lib/피드백.mjs';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 저장소 = path.resolve(여기, '..', '..');
const 공개 = path.join(여기, 'public');
const 글꼴 = path.join(저장소, 'docs', '브랜드_폰트', 'SUIT', 'SUIT-Variable.woff2');
const 장면 = 팬사인회;
const 글모델 = 'gpt-6-luna';
const 최대몸 = 64 * 1024;
const 종류 = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

export function 서버만들기({ 장부 = process.env.SYNK_ROLEPLAY_LEDGER || path.join(저장소, '.tmp', 'realtime-roleplay', '예산장부.jsonl'), 예산USD = Number(process.env.SYNK_ROLEPLAY_BUDGET_USD || 50), 리셋날 = Number(process.env.SYNK_ROLEPLAY_RESET_DAY || 1), 기록 = console.log } = {}) {
  const 끝난세션 = new Set();
  const 진행중 = new Map(); // 세션 → {길, 시작} — 끝 보고 없이 새 연결이 오면(새로 고침 · 탭 닫힘) 지난 시간으로 닫는다
  const 지금계량 = () => 계량({ 줄들: 장부읽기(장부), 예산USD, 리셋날, 상한초: 장면.상한초 });
  const 남은세션닫기 = (까닭) => {
    for (const [세션, v] of 진행중) {
      const 초 = Math.min(Math.round((Date.now() - v.시작) / 1000), 장면.상한초 + 15);
      if (v.길 === 'gpt-live') 장부적기(장부, { 무엇: '세션', 길: v.길, 세션, 초, USD: Math.max(0, gptLive값(초) - gptLive값(0)), 끝확인: false, 까닭 });
      else 장부적기(장부, { 무엇: '세션', 길: v.길, 세션, 초, USD: (초 / 60) * 0.12, 끝확인: false, 까닭 }); // mini는 사용량을 못 받았으니 분당 $0.12로 넉넉히
      끝난세션.add(세션);
      진행중.delete(세션);
    }
  };
  const 공개장면 = { 이름: 장면.이름, 상황: 장면.상황, 나: 장면.나, 상대: { 이름: 장면.상대.이름, 누구: 장면.상대.누구 }, 미션: 장면.미션, 상한초: 장면.상한초 };

  function 몸읽기(req) {
    return new Promise((res, rej) => {
      let 길이 = 0;
      const 조각 = [];
      req.on('data', (c) => {
        길이 += c.length;
        if (길이 > 최대몸) { rej(Object.assign(new Error('너무 큰 요청'), { 상태: 413 })); req.destroy(); return; }
        조각.push(c);
      });
      req.on('end', () => {
        try { res(JSON.parse(Buffer.concat(조각).toString('utf8') || '{}')); } catch { rej(Object.assign(new Error('JSON이 아니다'), { 상태: 400 })); }
      });
      req.on('error', rej);
    });
  }
  const 답 = (res, 상태, 몸) => { res.writeHead(상태, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(몸)); };
  const 전사고르기 = (전사) => (Array.isArray(전사) ? 전사 : [])
    .filter((t) => t && (t.누가 === '나' || t.누가 === '상대') && typeof t.글 === 'string' && t.글.trim())
    .slice(0, 80).map((t) => ({ 누가: t.누가, 글: t.글.trim().slice(0, 400) }));

  async function 연결(몸) {
    if (typeof 몸.sdp !== 'string' || !/^v=0/m.test(몸.sdp) || 몸.sdp.length > 최대몸) return [400, { 오류: 'SDP 제안이 필요하다' }];
    const 계 = 지금계량();
    const 길 = 공급사들[몸.길] ? 몸.길 : 계.길; // 시험용 강제(이 서버는 127.0.0.1에서만 듣는다)
    if (길 === '글' || !공급사들[길]) return [409, { 길: '글', 계량: 계 }];
    남은세션닫기('새 연결로 닫음');
    const 시작 = Date.now();
    let 세션;
    try {
      세션 = await 공급사들[길].세션만들기({ sdp: 몸.sdp, 장면 });
    } catch (e) {
      if (e.코드 !== 'credit_balance_exhausted') throw e;
      // 크레딧이 바닥나면 장부와 상관없이 이번 주기는 글 상황극으로(돈 드는 길로 돌리지 않는다)
      장부적기(장부, { 무엇: '크레딧바닥', 길, USD: 0 });
      기록(`[상황극] 크레딧 바닥 — 글 상황극으로`);
      return [409, { 길: '글', 까닭: '크레딧 바닥', 계량: 지금계량() }];
    }
    if (세션.세션) 진행중.set(세션.세션, { 길, 시작: Date.now() });
    // GPT-Live WebRTC는 여는 순간 15초를 먼저 매긴다 — 끝을 못 받아도 그만큼은 장부에 남는다
    const 먼저 = 길 === 'gpt-live' ? gptLive값(0) : 0;
    장부적기(장부, { 무엇: '세션시작', 길, 세션: 세션.세션, USD: 먼저 });
    기록(`[상황극] 연결 ${길} ${Date.now() - 시작}ms 키 ${세션.키}`);
    return [201, { 길, 세션: 세션.세션, sdp: 세션.sdp, 첫인사: 첫인사지시(장면), 마무리: 마무리지시(장면), 계량: 지금계량() }];
  }

  async function 끝(몸) {
    const 길 = 몸.길;
    if (!공급사들[길] && 길 !== '글') return [400, { 오류: '길이 없다' }];
    const 전사 = 전사고르기(몸.전사);
    const 세션 = typeof 몸.세션 === 'string' ? 몸.세션.slice(0, 120) : null;
    if (세션 && 끝난세션.has(세션)) return [409, { 오류: '이미 끝난 세션' }];
    if (세션) { 끝난세션.add(세션); 진행중.delete(세션); }
    if (길 === 'gpt-live') {
      const 초 = Math.max(0, Math.min(Number(몸.초) || 0, 3600));
      장부적기(장부, { 무엇: '세션', 길, 세션, 초, USD: Math.max(0, gptLive값(초) - gptLive값(0)), 끝확인: !!몸.끝확인 });
    } else if (길 === 'realtime-mini') {
      const 사용 = 몸.사용 && typeof 몸.사용 === 'object' ? 몸.사용 : {};
      const 초 = Math.max(0, Math.min(Number(몸.초) || 0, 3600));
      // 학습자 받아쓰기(gpt-4o-mini-transcribe) 값은 응답 usage에 없어 세션 초로 어림한다(분당 $0.003)
      장부적기(장부, { 무엇: '세션', 길, 세션, 초, 사용, USD: realtime값(사용) + (초 / 60) * 0.003, 끝확인: !!몸.끝확인 });
    }
    let 피드백 = null;
    if (!몸.피드백없이 && 전사.some((t) => t.누가 === '나')) {
      const 시작 = Date.now();
      try {
        const { 답: r } = await 응답부르기(요청본문(장면, 전사));
        장부적기(장부, { 무엇: '피드백', 길: 피드백모델, 사용: r.usage || null, USD: 글값(피드백모델, r.usage) });
        피드백 = 검사(장면, JSON.parse(출력글(r) || '{}'), 전사);
        기록(`[상황극] 피드백 ${Date.now() - 시작}ms 버림 ${피드백.버림.length}`);
      } catch (e) {
        기록(`[상황극] 피드백 실패: ${String(e.message).slice(0, 120)}`);
        피드백 = { 실패: true };
      }
    }
    return [200, { 피드백, 계량: 지금계량() }];
  }

  async function 글차례(몸) {
    const 계 = 지금계량();
    if (계.막힘) return [429, { 오류: '이번 달 예산을 다 썼다', 계량: 계 }];
    const 대화 = 전사고르기(몸.대화).slice(-30);
    const 본문 = {
      model: 글모델,
      max_output_tokens: 300,
      input: [
        { role: 'developer', content: [{ type: 'input_text', text: `${지시문(장면)}\n이번에는 소리 대신 글로 대화한다. 한 번에 1~2문장.` }] },
        ...(대화.length ? [] : [{ role: 'developer', content: [{ type: 'input_text', text: 첫인사지시(장면) }] }]),
        ...대화.map((t) => ({ role: t.누가 === '나' ? 'user' : 'assistant', content: [{ type: t.누가 === '나' ? 'input_text' : 'output_text', text: t.글 }] })),
      ],
    };
    const { 답: r } = await 응답부르기(본문);
    장부적기(장부, { 무엇: '차례', 길: '글', 사용: r.usage || null, USD: 글값(글모델, r.usage) });
    return [200, { 답: 출력글(r).trim(), 계량: 지금계량() }];
  }

  return http.createServer(async (req, res) => {
    const 주소 = new URL(req.url, 'http://127.0.0.1');
    try {
      if (주소.pathname.startsWith('/api/')) {
        if (req.method === 'POST') {
          const 출처 = req.headers.origin;
          const 내주소 = `http://${req.headers.host}`;
          if (출처 !== 내주소) return 답(res, 403, { 오류: '다른 곳에서 온 요청' });
        }
        const 길 = decodeURIComponent(주소.pathname);
        if (req.method === 'GET' && 길 === '/api/상태') return 답(res, 200, { 장면: 공개장면, 계량: 지금계량(), 길들: Object.fromEntries(Object.entries(공급사들).map(([k, v]) => [k, v.이름])) });
        if (req.method !== 'POST') return 답(res, 405, { 오류: 'POST만' });
        const 몸 = await 몸읽기(req);
        const 처리 = { '/api/연결': 연결, '/api/끝': 끝, '/api/글차례': 글차례 }[길];
        if (!처리) return 답(res, 404, { 오류: '없는 길' });
        const [상태, 내용] = await 처리(몸);
        return 답(res, 상태, 내용);
      }
      const 경로 = decodeURIComponent(주소.pathname);
      let 파일 = 경로 === '/글꼴/SUIT-Variable.woff2' ? 글꼴 : path.resolve(공개, `.${경로}`);
      if (파일 !== 글꼴 && path.relative(공개, 파일).startsWith('..')) return 답(res, 403, { 오류: '밖' });
      if (fs.existsSync(파일) && (await stat(파일)).isDirectory()) 파일 = path.join(파일, 'index.html');
      const 형 = 종류[path.extname(파일)];
      if (!형 || !fs.existsSync(파일)) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': 형, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(await readFile(파일));
    } catch (e) {
      const 상태 = e.상태 && e.상태 >= 400 && e.상태 < 600 ? e.상태 : 500;
      기록(`[상황극] ${주소.pathname} 오류 ${상태}: ${String(e.message).slice(0, 160)}`);
      답(res, 상태 === 401 || 상태 === 403 ? 502 : 상태, { 오류: 상태 === 500 ? '서버 오류' : String(e.message).slice(0, 160) });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const 서버 = 서버만들기();
  서버.listen(Number(process.env.PORT || 5250), '127.0.0.1', () => process.stdout.write(`실시간 상황극 시제품: http://127.0.0.1:${서버.address().port}/\n`));
}

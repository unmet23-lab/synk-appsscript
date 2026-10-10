#!/usr/bin/env node
'use strict';
/**
 * 제품용 Gemini/Vertex 연결 설정. 번역·전사·음성·영상 도구가 공유한다.
 * GPT/Claude의 모델 선택·작업 배치·검수는 각 공식 앱/CLI와 AI 운영 원칙이 맡는다.
 * 기본은 기존 무료 API 경로이며, 유료 API는 명시 허용과 별도 OAuth 자격이 필요하다.
 * 계정·모델을 자동 대체하지 않는다. 직접 실행할 때는 --제미나이확인에서만 API를 호출한다.
 */
const fs = require('fs');

function 확인불가(msg) {
  const e = new Error(msg);
  e.확인불가 = true;
  return e;
}

// 기존 제품 모델과 사고 수준을 유지한다. 새 모델 도입은 실제 소비자의 검증과 함께 한다.
const 제미나이사고 = {
  'gemini-3.1-pro-preview': ['low', 'medium', 'high'],
  'gemini-3.6-flash': ['high'],
  'gemini-3.7-flash': ['high'],
  'gemini-3.8-flash': ['low', 'medium', 'high'],
};

const 제미나이 = {
  최상: { model: 'gemini-3.1-pro-preview', thinking_level: 'high', 무료등급: false },
  무료최상: { model: 'gemini-3.8-flash', thinking_level: 'high', 무료등급: true },
  기본: '무료최상',
  폴백허용: false,
};

// 키 파일과 URL은 이곳에서 관리하며, 출력에 키 값을 포함하지 않는다.
const 열쇠파일 = {
  글: { env: 'GEMINI_KEY_PATH_FREE', 기본: 'C:/Users/q1212/SYNK_보안/제미나이_무료.txt', 뭐냐: '글 API 키' },
  돈: { env: 'GEMINI_KEY_PATH', 기본: 'C:/Users/q1212/SYNK_보안/제미나이.txt', 뭐냐: '기존 유료 API 키(호환용 — Vertex 인증은 별도 OAuth)' },
};
const 기본용도 = () => '글';
function 용도고르기(용도) {
  const k = 용도 == null || 용도 === '' ? 기본용도() : String(용도);
  if (!열쇠파일[k]) throw 확인불가(`제미나이 열쇠 용도는 '글'·'돈' 둘뿐이다(받은 것: ${k})`);
  return k;
}
const 제미나이키경로 = (용도) => {
  const k = 용도고르기(용도);
  return process.env[열쇠파일[k].env] || 열쇠파일[k].기본;
};
function 제미나이키(용도) {
  const p = 제미나이키경로(용도);
  if (!fs.existsSync(p)) return null;
  const tokens = String(fs.readFileSync(p, 'utf8')).replace(/^\uFEFF/, '').trim().split(/\s+/).filter(Boolean);
  const known = tokens.find((t) => /^(AIza|AQ\.|sk-)/.test(t));
  if (known) return known;
  return tokens.length === 1 ? tokens[0] : null; // 모르는 토큰 여럿 = 아무거나 집어 조용히 401 내느니 null
}
function 제미나이키안내(용도) {
  const k = 용도고르기(용도);
  return `${열쇠파일[k].뭐냐} 파일이 없다: ${제미나이키경로(k)}\n`
    + `   만드는 법: aistudio.google.com/apikey → 「API 키 만들기」 → 열쇠 값을 그 파일에 한 줄로 붙여넣기(값은 유호님 손).\n`
    + `   경로를 바꾸려면 env ${열쇠파일[k].env}.`;
}

const 제미나이문들 = {
  글: {
    이름: 'AI Studio', base: 'https://generativelanguage.googleapis.com/v1beta', env: 'GEMINI_BASE_FREE',
    모델경로: (m) => `/models/${m}`, 목록가능: true,
    왜: '기존 무료 API 경로. 계정과 요금제는 별도로 확인한다.',
  },
  돈: {
    이름: 'Vertex AI', base: 'https://aiplatform.googleapis.com/v1', env: 'GEMINI_BASE_PAID',
    모델경로: (m) => `/projects/${벌텍스프로젝트()}/locations/${벌텍스위치()}/publishers/google/models/${m}`,
    목록가능: false, 인증: 'oauth',
    왜: '명시한 프로젝트와 OAuth 자격을 쓰는 종량제 경로.',
  },
};
function 붙인자격() {
  const os = require('os');
  const path = require('path');
  if (process.env.SYNK_VERTEX_OAUTH) return process.env.SYNK_VERTEX_OAUTH;
  return path.join(os.homedir(), '.synk-vertex-oauth.json');
}
function 붙인프로젝트() {
  try { return JSON.parse(fs.readFileSync(붙인자격(), 'utf8')).프로젝트 || null; } catch { return null; }
}
const 벌텍스프로젝트 = () => {
  const project = process.env.SYNK_VERTEX_PROJECT || 붙인프로젝트();
  if (!project) throw 확인불가('Vertex 프로젝트가 명시되지 않았다. 굽기 자격의 프로젝트 또는 SYNK_VERTEX_PROJECT를 확인한다. 배포 계정 프로젝트로 자동 이동하지 않는다.');
  return project;
};
const 벌텍스위치 = () => process.env.SYNK_VERTEX_LOCATION || 'global';

function 벌텍스자격확인(j, 프로젝트) {
  if (j && j.프로젝트 && j.프로젝트 !== 프로젝트) {
    throw 확인불가('Vertex 자격 파일의 프로젝트와 호출 프로젝트가 다르다. 계정·과금 대상을 명시적으로 맞춘 뒤 실행한다.');
  }
  const t = j && ((j.tokens && j.tokens.default) || j);
  if (!t || !t.refresh_token || !t.client_id || !t.client_secret) {
    throw 확인불가('Vertex OAuth 자격이 완전하지 않다. tools/구글계정붙이기.js로 굽기 계정을 다시 연결한다.');
  }
  return t;
}

function 벌텍스캐시식별자(파일, 프로젝트, t) {
  return require('crypto').createHash('sha256')
    .update(JSON.stringify([require('path').resolve(파일), 프로젝트, t.client_id, t.refresh_token]))
    .digest('hex').slice(0, 24);
}

async function 벌텍스토큰() {
  const os = require('os');
  const path = require('path');
  const 자격경로 = 붙인자격();
  if (!fs.existsSync(자격경로)) {
    throw 확인불가(`Vertex 토큰의 뿌리(구글 로그인)를 못 찾았다: ${자격경로}\n`
      + `   되살리는 법: node tools/구글계정붙이기.js --계정 <메일주소> — 브라우저가 한 번 열리고 그 뒤로는 자동이다.`);
  }
  const j = JSON.parse(fs.readFileSync(자격경로, 'utf8'));
  const 프로젝트 = 벌텍스프로젝트();
  const t = 벌텍스자격확인(j, 프로젝트);
  const 식별자 = 벌텍스캐시식별자(자격경로, 프로젝트, t);
  const 캐시경로 = path.join(os.tmpdir(), `synk_vertex_token_${식별자}.json`);
  try {
    const c = JSON.parse(fs.readFileSync(캐시경로, 'utf8'));
    if (c && c.identity === 식별자 && c.token && c.expiry > Date.now() + 120_000) return c.token;
  } catch { /* 없거나 깨졌으면 새로 만든다. 옛 전계정 공용 캐시는 읽지 않는다. */ }

  const 몸 = new URLSearchParams({
    client_id: t.client_id, client_secret: t.client_secret, refresh_token: t.refresh_token, grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 몸,
  });
  const 답 = await res.json().catch(() => ({}));
  if (!res.ok || !답.access_token) {
    throw 확인불가(`구글 토큰 갱신 실패 ${res.status}: ${답.error_description || 답.error || ''}\n`
      + `   되살리는 법: node tools/구글계정붙이기.js --계정 <굽기 계정>`);
  }
  try {
    fs.writeFileSync(캐시경로, JSON.stringify({ identity: 식별자, token: 답.access_token, expiry: Date.now() + (Number(답.expires_in) || 3600) * 1000 }), { mode: 0o600 });
  } catch { /* 캐시는 편의일 뿐 — 못 써도 매번 새로 받으면 된다 */ }
  return 답.access_token;
}

function 유료API허용(argv = process.argv.slice(2), env = process.env) {
  return argv.includes('--유료-api') || env.SYNK_ALLOW_PAID_API === '1';
}

function 유료API요구(무엇) {
  if (유료API허용()) return;
  const e = 확인불가(`${무엇}은 종량제 API라 기본 차단됐다. 실행할 때 --유료-api를 붙이거나, 의식적으로 관리하는 자동 작업에만 SYNK_ALLOW_PAID_API=1을 둔다.`);
  e.code = 'PAID_API_DISABLED';
  throw e;
}

async function 제미나이헤더(용도) {
  const 문 = 제미나이문(용도);
  if (문.인증 === 'oauth') {
    유료API요구('Gemini Vertex AI');
    return { authorization: `Bearer ${await 벌텍스토큰()}`, 'content-type': 'application/json' };
  }
  const key = 제미나이키(용도);
  if (!key) throw 확인불가(제미나이키안내(용도));
  return { 'x-goog-api-key': key, 'content-type': 'application/json' };
}
function 제미나이문(용도) {
  const k = 용도고르기(용도);
  const 문 = 제미나이문들[k];
  const 덮음 = process.env[문.env];
  return 덮음 ? { ...문, base: String(덮음).replace(/\/+$/, ''), 덮어씀: true } : 문;
}
function 제미나이URL(용도, 모델, 메서드 = 'generateContent') {
  const 문 = 제미나이문(용도);
  return `${문.base}${문.모델경로(모델)}:${메서드}`;
}

function 제미나이설정(이름) {
  const 키 = 이름 == null || 이름 === '' ? 제미나이.기본 : String(이름);
  const p = 제미나이[키];
  if (!p || !p.model) {
    throw 확인불가(`모르는 제미나이 픽 "${키}" — 가능: 최상 · 무료최상`);
  }
  const 지원 = 제미나이사고[p.model];
  if (!지원) throw 확인불가(`모르는 제미나이 모델 "${p.model}" — 제미나이사고 표에 먼저 적어야 한다`);
  if (!지원.includes(p.thinking_level)) {
    throw 확인불가(`"${p.model}" 은 사고 수준 "${p.thinking_level}" 을 지원하지 않는다 — 가능: ${지원.join(' · ')}`);
  }
  return { ...p, 이름: 키 };
}

// 명시한 API 점검의 응답·모델·오류 계약. HTTP 성공만으로 완료 처리하지 않는다.
async function 제미나이생존({ timeoutMs = 8000, 용도 = '글' } = {}) {
  let 머리;
  try {
    머리 = await 제미나이헤더(용도);
  } catch (e) {
    const 말 = String((e && e.message) || e);
    if (e && e.code === 'PAID_API_DISABLED') {
      return { 살았나: null, 종류: '유료차단', 용도, 사유: 말.split('\n')[0].slice(0, 240), 안내: 말 };
    }
    return { 살았나: null, 종류: '키없음', 용도, 사유: 말.split('\n')[0].slice(0, 200), 안내: 말 };
  }
  const 기본 = 제미나이설정();
  try {
    const r = await fetch(제미나이URL(용도, 기본.model), {
      method: 'POST',
      headers: 머리,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: '1+1=? 숫자만.' }] }],
        generationConfig: { thinkingConfig: { thinkingLevel: 기본.thinking_level } },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const j = await r.json().catch(() => ({}));
    const 사유 = String((j.error && j.error.message) || '').slice(0, 200);
    if (r.ok) {
      let 완료;
      try {
        완료 = require('./lib/제미나이호출.js').응답읽기(j, 기본.model);
      } catch (e) {
        return { 살았나: null, 용도, 종류: '응답불완전', 모델: 기본.model,
          사유: String((e && e.message) || e).slice(0, 200) };
      }
      const 사고 = j.usageMetadata && j.usageMetadata.thoughtsTokenCount;
      return { 살았나: true, 용도, 문: 제미나이문(용도).이름, 모델: 기본.model, 답한모델: 완료.modelVersion, 사고토큰: 사고 == null ? null : 사고 };
    }
    let 종류 = r.status === 429 ? '한도·결제'
      : (r.status === 401 || r.status === 403) ? '자격'
        : (r.status >= 500 && r.status <= 599) ? '서버·일시'
          : '기타';
    if (r.status === 403) {
      const 원인 = ((j.error && j.error.details) || []).map((d) => d && d.reason).filter(Boolean).join(' ');
      if (/API_KEY_SERVICE_BLOCKED/.test(원인)) 종류 = '문·열쇠제한';
      else if (/has not been used|is disabled/.test(사유)) 종류 = '문·안켜짐';
    }
    const 몫상한 = (() => { const m = /limit:\s*(\d+)/.exec(사유); return m ? Number(m[1]) : null; })();
    const 다시초 = (() => {
      const d = (j.error && j.error.details) || [];
      for (const x of d) if (x && typeof x.retryDelay === 'string') return Number(String(x.retryDelay).replace(/s$/, '')) || null;
      const m = /retry in ([\d.]+)s/i.exec(사유); return m ? Number(m[1]) : null;
    })();
    return { 살았나: false, 용도, 문: 제미나이문(용도).이름, 상태: r.status, 종류, 사유, 모델: 기본.model, 몫상한, 다시초 };
  } catch (e) {
    return { 살았나: null, 용도, 종류: '네트워크', 사유: String((e && e.message) || e).slice(0, 200) };
  }
}

async function 제미나이확인(용도 = 기본용도()) {
  const 문 = 제미나이문(용도);
  console.log(`■ 열쇠 「${용도}」 — ${열쇠파일[용도].뭐냐}`);
  console.log(`   문: ${문.이름} (${문.base})${문.덮어씀 ? ` · env ${문.env} 로 덮어씀` : ''} — ${문.왜}`);
  const key = 문.인증 === 'oauth' ? null : 제미나이키(용도);
  if (문.인증 !== 'oauth' && !key) {
    console.error('🔴 키를 못 읽었다 — 조회를 **안 돌린 것**이지 「모델이 없다」가 아니다.');
    console.error('   ' + 제미나이키안내(용도));
    return 2;
  }
  let 최악 = 0;
  if (!문.목록가능) {
    console.log(`   (모델 목록 조회는 ${문.이름} 문에 없다 — 「표에 있나」는 **안 재봤다**. 아래 프로브가 판정한다)`);
  } else {
    const res = await fetch(`${문.base}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
    if (!res.ok) {
      console.error(`🔴 조회 실패 ${res.status} — ${(await res.text()).slice(0, 300)}`);
      return 2;
    }
    const 살아있음 = new Set(((await res.json()).models || []).map((m) => String(m.name || '').replace(/^models\//, '')));
    for (const 키 of ['최상', '무료최상']) {
      const p = 제미나이[키];
      const ok = 살아있음.has(p.model);
      if (!ok) 최악 = 1;
      console.log(`${ok ? '✅' : '🔴'} ${키}: ${p.model} / thinking_level=${p.thinking_level}` +
        (ok ? '' : ' — 이 키로는 안 보인다(모델 ID 가 낡았거나 등급 밖)'));
    }
  }
  const 기본 = 제미나이설정();
  const 생존 = await 제미나이생존({ timeoutMs: 60000, 용도 });
  if (생존.살았나 !== true && 생존.살았나 !== false) {
    console.error(`🔴 프로브 확인 불가(${생존.종류 || '미확인'}): ${생존.사유 || '검증 가능한 응답이 없다'}`);
    if (생존.종류 === '유료차단') console.error('   유료 API 기본 차단은 유지된다. 실제로 잴 때만 --유료-api를 붙인다.');
    return 2;
  }
  if (생존.살았나 === false) {
    최악 = 1;
    console.log(`🔴 프로브 실패: ${기본.model}/${기본.thinking_level} → ${생존.상태} ${String(생존.사유).slice(0, 160)}`);
    if (생존.종류 === '문·열쇠제한') {
      console.log(`   처방: 이 열쇠에 걸린 「이 API 만」 제한이 ${문.이름} 을 안 받는다. 콘솔 → API 및 서비스 → 사용자 인증 정보 → 그 열쇠 → API 제한에 aiplatform.googleapis.com 을 더한다.`);
    } else if (생존.종류 === '문·안켜짐') {
      console.log(`   처방: 그 프로젝트에 ${문.이름} 문이 안 켜져 있다. ⚠ 켜면 결제가 따라오니 «공짜 열쇠 프로젝트»에는 켜지 않는다.`);
    }
  } else if (생존.살았나 === true) {
    console.log(`✅ 프로브: ${기본.model}/${기본.thinking_level} 응답 OK · 사고 토큰 ${생존.사고토큰 == null ? '(미보고)' : 생존.사고토큰}`
      + ` · 답한 모델 ${생존.답한모델 || '(안 알려준다)'}`);
  }
  if (최악) console.log('\n표가 낡았으면 tools/모델정책.js 의 제미나이 픽을 고친다 — 조용히 다른 모델로 돌지 않는다.');
  return 최악;
}

module.exports = {
  제미나이, 제미나이사고, 제미나이설정,
  제미나이키, 제미나이키경로, 제미나이키안내, 열쇠파일, 기본용도,
  제미나이문들, 제미나이문, 제미나이URL, 제미나이헤더,
  붙인자격, 벌텍스프로젝트, 벌텍스위치, 벌텍스자격확인, 벌텍스캐시식별자, 벌텍스토큰,
  유료API허용, 유료API요구, 제미나이생존, 제미나이확인,
};

if (require.main === module) {
  const argv = process.argv.slice(2);
  (async () => {
    try {
      if (!argv.length || (argv.length === 1 && argv[0] === '--help')) {
        console.log('제품 API 설정: 기본 글(AI Studio), 명시 유료 돈(Vertex OAuth).');
        console.log(JSON.stringify({ 기본용도: 기본용도(), 모델: 제미나이설정(), 자동대체: false }, null, 2));
        console.log('실제 API 확인: node tools/모델정책.js --제미나이확인 [글|돈] [--유료-api]');
        return;
      }
      if (!argv.includes('--제미나이확인') || argv.some(a => !['--제미나이확인', '글', '돈', '--유료-api'].includes(a))) {
        throw 확인불가('지원하지 않는 옵션이다. 작업 배치와 모델 선택은 공식 앱/CLI에서 한다.');
      }
      const index = argv.indexOf('--제미나이확인');
      const 용도 = ['글', '돈'].includes(argv[index + 1]) ? argv[index + 1] : 기본용도();
      process.exitCode = await 제미나이확인(용도);
    } catch (e) {
      console.error(String((e && e.message) || e));
      process.exitCode = 2;
    }
  })();
}

#!/usr/bin/env node
/**
 * 구글 계정 붙이기 — 굽기(제미나이·Vertex)가 쓸 «다른 계정»의 자격을 별도 파일로 받아 둔다.
 *
 * 🔴 왜 clasp login 을 안 쓰나:
 *   `npx clasp login` 은 언제나 `~/.clasprc.json` 을 통째로 덮어쓴다(clasp 3.4.1 에 --user 가 없다 · 실측).
 *   그 파일은 «라이브 배포 통로»의 자격이기도 하다. 덮어쓰면 배포가 죽는다.
 *   ⇒ 여기서는 같은 OAuth 클라이언트를 빌려 «새 계정»의 자격만 받아 다른 파일에 둔다. clasprc 는 안 건드린다.
 *
 * 쓰는 법:
 *   node tools/구글계정붙이기.js                      # 계정 고르기 화면이 브라우저에 뜬다
 *   node tools/구글계정붙이기.js --계정 a@b.com        # 그 계정이 미리 골라진 채로 뜬다
 *   node tools/구글계정붙이기.js --확인                # 지금 붙어 있는 계정이 누구인지만 본다
 *
 * 받은 자격이 사는 곳 = `~/.synk-vertex-oauth.json`(저장소 밖 · git 눈 밖).
 * 굽기 도구가 그 파일을 보게 하는 스위치 = env `SYNK_VERTEX_OAUTH`.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const CLASPRC = path.join(os.homedir(), '.clasprc.json');
const 자격파일 = process.env.SYNK_VERTEX_OAUTH || path.join(os.homedir(), '.synk-vertex-oauth.json');
const 토큰캐시 = path.join(os.tmpdir(), 'synk_vertex_token.json');
const 범위 = ['https://www.googleapis.com/auth/cloud-platform', 'openid', 'email'].join(' ');

function 죽는다(줄) { console.error(`\n🔴 ${줄}\n`); process.exit(1); }

/** clasp 가 쓰는 OAuth 클라이언트를 빌린다(그 앱은 이미 cloud-platform 권한을 청한다 · 09-04 실측). */
function 클라이언트빌리기() {
  if (!fs.existsSync(CLASPRC)) {
    죽는다(`OAuth 클라이언트를 빌릴 자리가 없다: ${CLASPRC}\n   먼저 npx clasp login 으로 지금 계정을 한 번 세운다.`);
  }
  const j = JSON.parse(fs.readFileSync(CLASPRC, 'utf8'));
  const t = (j.tokens && j.tokens.default) || j;
  if (!t.client_id || !t.client_secret) 죽는다(`${CLASPRC} 에 client_id/client_secret 이 없다.`);
  return { client_id: t.client_id, client_secret: t.client_secret };
}

/** id_token 한가운데 토막에 이메일이 들어 있다(서명은 안 본다 — 「누구인지」만 보려는 것이다). */
function 이메일읽기(id_token) {
  try {
    const 가운데 = String(id_token).split('.')[1];
    const j = JSON.parse(Buffer.from(가운데.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return j.email || j.sub || '(이메일 없음)';
  } catch { return '(못 읽음)'; }
}

async function 확인만() {
  if (!fs.existsSync(자격파일)) {
    console.log(`\n붙어 있는 계정이 없다. 파일이 아직 없다: ${자격파일}\n`);
    return;
  }
  const j = JSON.parse(fs.readFileSync(자격파일, 'utf8'));
  const t = (j.tokens && j.tokens.default) || j;
  console.log(`\n📌 자격 파일 = ${자격파일}`);
  console.log(`   계정   = ${t.id_token ? 이메일읽기(t.id_token) : '(id_token 없음)'}`);
  console.log(`   받은 때 = ${j.받은때 || '(안 적혔다)'}`);
  console.log(`   되살리는 표(refresh_token) = ${t.refresh_token ? '있다' : '🔴 없다'}\n`);
}

async function 붙이기(힌트) {
  const { client_id, client_secret } = 클라이언트빌리기();

  // 로컬 서버를 먼저 띄워 «빈 포트»를 확정한 뒤 그 주소를 동의 URL 에 넣는다(포트를 미리 찍으면 충돌한다).
  let redirect = null;
  const 서버받기 = new Promise((맺음, 깨짐) => {
    const 서버 = http.createServer((req, res) => {
      const u = new URL(req.url, `http://localhost`);
      const code = u.searchParams.get('code');
      const err = u.searchParams.get('error');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      if (code) {
        res.end('<h2 style="font-family:system-ui">다 됐습니다. 이 창을 닫으셔도 됩니다.</h2>');
        서버.close(); 맺음(code);
      } else {
        res.end(`<h2 style="font-family:system-ui">받지 못했습니다: ${err || '알 수 없음'}</h2>`);
        서버.close(); 깨짐(new Error(err || '코드가 안 왔다'));
      }
    });
    서버.on('error', 깨짐);
    서버.listen(0, '127.0.0.1', () => {
      const 포트 = 서버.address().port;
      redirect = `http://localhost:${포트}`;
      const 주소 = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
        client_id, redirect_uri: redirect, response_type: 'code', scope: 범위,
        access_type: 'offline', prompt: 'consent select_account',
        ...(힌트 ? { login_hint: 힌트 } : {}),
      });
      console.log('\n🌐 브라우저가 열립니다. 거기서 계정을 고르고 「허용」을 누르시면 끝입니다.');
      console.log(`   안 열리면 이 주소를 붙여 넣으세요:\n   ${주소}\n`);
      spawn('cmd', ['/c', 'start', '""', 주소], { detached: true, stdio: 'ignore' }).unref();
      setTimeout(() => { try { 서버.close(); } catch {} 깨짐(new Error('20분 안에 안 끝났다 — 다시 돌리면 새 주소가 나온다')); }, 1_200_000);
    });
  });

  const code = await 서버받기;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id, client_secret, code, grant_type: 'authorization_code', redirect_uri: redirect }),
  });
  const 답 = await res.json().catch(() => ({}));
  if (!res.ok || !답.refresh_token) {
    죽는다(`토큰을 못 받았다 ${res.status}: ${답.error_description || 답.error || ''}\n`
      + `   되살리는 표(refresh_token)가 안 왔으면, 그 계정이 이 앱을 이미 허용해 둔 것이다.\n`
      + `   myaccount.google.com/permissions 에서 clasp 접근을 지우고 다시 돌린다.`);
  }

  const 담을것 = {
    _왜: '굽기(Vertex)가 쓰는 다른 계정의 자격이다. clasp 배포 자격(~/.clasprc.json)과 «일부러» 따로 둔다.',
    받은때: new Date().toISOString(),
    tokens: { default: { client_id, client_secret, refresh_token: 답.refresh_token, access_token: 답.access_token, id_token: 답.id_token, token_type: 답.token_type, expiry_date: Date.now() + (Number(답.expires_in) || 3600) * 1000 } },
  };
  fs.writeFileSync(자격파일, JSON.stringify(담을것, null, 2), { mode: 0o600 });
  try { fs.unlinkSync(토큰캐시); } catch { /* 없으면 그만 */ }

  console.log(`\n✅ 붙였다 — ${이메일읽기(답.id_token)}`);
  console.log(`   자격 파일 = ${자격파일}`);
  console.log(`   옛 계정의 임시 열쇠(캐시)는 지웠다 — 안 지우면 옛 계정으로 계속 돈다.\n`);
}

(async () => {
  const 인자 = process.argv.slice(2);
  if (인자.includes('--확인')) return 확인만();
  const i = 인자.indexOf('--계정');
  await 붙이기(i >= 0 ? 인자[i + 1] : null);
})().catch((e) => 죽는다(e.message));

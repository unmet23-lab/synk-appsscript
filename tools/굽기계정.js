#!/usr/bin/env node
/**
 * 굽기가 «어느 지갑»을 태우나 — 보고, 바꾼다.
 *
 * 🔑 왜 필요한가:
 *   크레딧 시계가 둘인데 **먼저 죽는 것을 먼저 태워야 한다**(09-06 실측).
 *     · unmet23  ₩136,495 · 마감 **2026-11-13**  ← 22일 먼저 온다
 *     · 77yuhbs  ₩222,710 · 마감 2026-12-05
 *   안 태우고 11-13 을 넘기면 옛 것은 그냥 사라진다.
 *
 * 🔑 어떻게 갈리나 — `모델정책.js` 의 `붙인자격()` 이 이렇게 고른다:
 *     `~/.synk-vertex-oauth.json` **이 있으면** 그 계정(= 77yuhbs)
 *     **없으면** `~/.clasprc.json` 으로 되돌아간다(= unmet23 · 배포 자격과 같은 것)
 *   ⇒ 그래서 «파일을 넣었다 뺐다» 하는 것이 계정 스위치다. 지우지 않고 옆에 보관한다
 *      (지우면 다시 받을 때 브라우저 동의가 필요해 유호님 손이 든다).
 *   🔴 `~/.clasprc.json` 자체는 **라이브 배포 자격이라 절대 안 건드린다**(읽기만).
 *
 * ⚠ 토큰 캐시(`%TEMP%/synk_vertex_token.json`)를 같이 지워야 «지금부터» 바뀐다.
 *   안 지우면 캐시가 살아 있는 동안(최대 1시간) 옛 지갑이 계속 태워진다.
 *
 * 쓰는 법:
 *   node tools/굽기계정.js          # 지금 어느 지갑을 태우나(설정만 본다)
 *   node tools/굽기계정.js --옛      # unmet23 (마감 11-13 · 먼저 죽는 돈)
 *   node tools/굽기계정.js --새      # 77yuhbs (마감 12-05)
 *   node tools/굽기계정.js --확인    # 🔑 «진짜로» 어디서 구워지고 있나 — 지갑 둘을 분 단위로 대조
 *
 * 🔴 설정을 바꿔도 «도는 굽기»는 곧바로 안 넘어온다 — 09-06 실측 **2~3분** 걸렸다
 *   (옷굽기가 컷 사이를 쉬고, 그 뒤에야 토큰을 다시 읽기 때문으로 보인다).
 *   ⇒ 바꾼 직후의 「아직 옛 지갑에 안 잡힌다」를 «실패»로 읽지 않는다. `--확인` 으로 몇 분 뒤 다시 본다.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const 장부경로 = path.join(__dirname, '..', 'docs', '_ops', '돈장부.json');
const 활성 = path.join(os.homedir(), '.synk-vertex-oauth.json');
const 보관 = path.join(os.homedir(), '.synk-vertex-oauth.보관.json');
const 캐시 = path.join(os.tmpdir(), 'synk_vertex_token.json');
const 배포자격 = path.join(os.homedir(), '.clasprc.json');

const 지갑 = {
  옛: { 계정: 'unmet23@gmail.com', 결제: '0161FA-7C996C-F1B948', 프로: 'gen-lang-client-0106203750', 마감: '2026-11-13' },
  새: { 계정: '77yuhbs@gmail.com', 결제: '013A36-17619E-CE0D07', 프로: 'project-22fd10a3-c9c2-4b34-9f0', 마감: '2026-12-05' },
};

function 인자(이름) {
  const i = process.argv.indexOf(이름);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

function 이메일(id_token) {
  try {
    const g = String(id_token).split('.')[1];
    return JSON.parse(Buffer.from(g.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).email || '(모름)';
  } catch { return '(못 읽음)'; }
}

/** 파일 하나가 답을 쥔다 — 있으면 새 지갑, 없으면 옛 지갑. */
function 지금어디() {
  return fs.existsSync(활성) ? '새' : '옛';
}

/** 🔑 갈아 끼운 사실을 장부에 «스스로» 적는다 — 손으로 적으면 언젠가 빠진다(유호 09-06 「까먹지말고 전부 기록」). */
function 장부에적기(에서, 으로, 까닭) {
  try {
    if (!fs.existsSync(장부경로)) { console.log('   ⚠ 장부 파일이 없어 교체 이력을 못 적었다'); return; }
    const j = JSON.parse(fs.readFileSync(장부경로, 'utf8'));
    const 잔액 = {};
    for (const a of (j.계정 || [])) {
      if (!a.크레딧) continue;
      const 짧은 = a.이름.split('@')[0];
      잔액[짧은] = a.크레딧.잔액;
    }
    (j.교체이력 = j.교체이력 || []).push({
      때: new Date().toISOString(),
      에서, 으로,
      까닭: 까닭 || '(까닭이 안 적혔다 — 이 줄을 손으로 채운다)',
      '그때 잔액': 잔액,
      메모: '잔액은 «장부에 마지막으로 적힌 화면값»이다. 더 정확히 하려면 화면을 읽고 돈장부.json 의 잔액·확인때를 갱신한다.',
    });
    fs.writeFileSync(장부경로, JSON.stringify(j, null, 2) + '\n', 'utf8');
    console.log(`   📒 장부에 교체를 적었다 — docs/_ops/돈장부.json (이력 ${j.교체이력.length}번째)`);
  } catch (e) {
    console.log(`   ⚠ 장부에 못 적었다: ${e.message}`);
  }
}

function 캐시지우기() {
  try { if (fs.existsSync(캐시)) { fs.unlinkSync(캐시); return true; } } catch { /* 못 지워도 최대 1시간이면 만료된다 */ }
  return false;
}

/** 실제로 그 자격이 누구인지 열어서 읽는다(파일 이름만 믿지 않는다). */
function 누구인가(어디) {
  const 경로 = 어디 === '새' ? 활성 : 배포자격;
  if (!fs.existsSync(경로)) return '(자격 파일이 없다)';
  try {
    const j = JSON.parse(fs.readFileSync(경로, 'utf8'));
    const t = (j.tokens && j.tokens.default) || j;
    return t.id_token ? 이메일(t.id_token) : (j.계정 || '(id_token 없음)');
  } catch (e) { return `(못 읽음: ${e.message})`; }
}

function 보여주기() {
  const 어디 = 지금어디();
  const g = 지갑[어디];
  const 남은날 = Math.ceil((new Date(`${g.마감}T23:59:59+09:00`) - Date.now()) / 86400000);
  console.log(`\n🔥 굽기가 지금 태우는 지갑 = **${어디 === '옛' ? 'unmet23 (옛)' : '77yuhbs (새)'}**\n`);
  console.log(`   계정(파일에서 읽음) = ${누구인가(어디)}`);
  console.log(`   결제 계정 = ${g.결제}`);
  console.log(`   프로젝트 = ${g.프로}`);
  console.log(`   마감 = ${g.마감} (남은 날 ${남은날}일)`);
  console.log(`\n   자격 파일 = ${fs.existsSync(활성) ? `있다 → 새 지갑\n      ${활성}` : `없다 → 배포 자격으로 되돌아감(옛 지갑)\n      ${배포자격}`}`);
  console.log(`   보관해 둔 것 = ${fs.existsSync(보관) ? 보관 : '(없다)'}`);
  console.log(`   토큰 캐시 = ${fs.existsSync(캐시) ? '살아 있다(최대 1시간)' : '비었다'}`);
  console.log(`\n   바꾸려면: node tools/굽기계정.js ${어디 === '옛' ? '--새' : '--옛'}\n`);
}

/** 🔑 «설정»이 아니라 «실제»를 잰다 — 지갑 둘의 최근 1시간을 분 단위로 대조한다.
 *  받은 양이 한 번에 1,500 토큰을 넘으면 그림으로 본다(글은 수백이다). */
async function 진짜어디서(어디) {
  const 자격 = 어디 === '새' ? (fs.existsSync(활성) ? 활성 : 보관) : 배포자격;
  if (!fs.existsSync(자격)) return { 없음: true };
  const j = JSON.parse(fs.readFileSync(자격, 'utf8'));
  const t = (j.tokens && j.tokens.default) || j;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: t.client_id, client_secret: t.client_secret, refresh_token: t.refresh_token, grant_type: 'refresh_token' }),
  });
  const tok = (await r.json().catch(() => ({}))).access_token;
  if (!tok) return { 실패: '토큰을 못 받았다' };
  const 프로 = 지갑[어디].프로;
  const 끝 = new Date(), 시작 = new Date(Date.now() - 3600 * 1000);
  const q = new URLSearchParams({
    filter: 'metric.type="aiplatform.googleapis.com/publisher/online_serving/token_count" AND metric.labels.type="output"',
    'interval.startTime': 시작.toISOString(), 'interval.endTime': 끝.toISOString(),
    'aggregation.alignmentPeriod': '60s', 'aggregation.perSeriesAligner': 'ALIGN_SUM',
    'aggregation.crossSeriesReducer': 'REDUCE_SUM',
  });
  const m = await fetch(`https://monitoring.googleapis.com/v3/projects/${프로}/timeSeries?${q}`,
    { headers: { authorization: `Bearer ${tok}`, 'x-goog-user-project': 프로 } });
  const mj = await m.json().catch(() => ({}));
  if (!m.ok) return { 실패: `모니터링 ${m.코드 || m.status}` };
  const 분 = new Map();
  for (const ts of (mj.timeSeries || [])) for (const p of (ts.points || [])) {
    const k = new Date(p.interval.endTime).toLocaleString('sv', { timeZone: 'Asia/Seoul' }).slice(11, 16);
    분.set(k, (분.get(k) || 0) + Number(p.value.int64Value ?? p.value.doubleValue ?? 0));
  }
  const 그림들 = [...분.entries()].filter(([, v]) => v >= 1500).sort();
  return { 분, 마지막그림: 그림들.length ? 그림들[그림들.length - 1] : null, 그림수: 그림들.length };
}

(async () => {
  const 옛으로 = process.argv.includes('--옛') || process.argv.includes('--unmet23');
  const 새로 = process.argv.includes('--새') || process.argv.includes('--77yuhbs');

  if (process.argv.includes('--확인')) {
    console.log('\n🔬 «진짜로» 어디서 구워지고 있나 — 최근 1시간 · 분 단위\n');
    const 결과 = {};
    for (const 어디 of ['옛', '새']) {
      const r = await 진짜어디서(어디);
      결과[어디] = r;
      const 표 = 어디 === '옛' ? 'unmet23 (옛)' : '77yuhbs (새)';
      if (r.없음) { console.log(`■ ${표} — 자격 파일이 없어 못 쟀다`); continue; }
      if (r.실패) { console.log(`■ ${표} — 못 쟀다: ${r.실패}`); continue; }
      console.log(`■ ${표} · 그림으로 보이는 것 ${r.그림수}번`
        + (r.마지막그림 ? ` · 마지막 ${r.마지막그림[0]} (${r.마지막그림[1].toLocaleString()} 토큰)` : ' · 없음'));
    }
    const 옛끝 = 결과.옛?.마지막그림?.[0] || null;
    const 새끝 = 결과.새?.마지막그림?.[0] || null;
    console.log('\n판정:');
    if (옛끝 && (!새끝 || 옛끝 > 새끝)) console.log(`   ✅ **옛 지갑(unmet23)**에서 굽고 있다 — 옛 ${옛끝} > 새 ${새끝 || '없음'}`);
    else if (새끝 && (!옛끝 || 새끝 > 옛끝)) console.log(`   ✅ **새 지갑(77yuhbs)**에서 굽고 있다 — 새 ${새끝} > 옛 ${옛끝 || '없음'}`);
    else console.log('   ⏸ 최근 1시간에 그림을 구운 흔적이 양쪽 다 없다(굽기가 안 도는 것으로 보인다)');
    console.log(`\n   설정상으로는 «${지금어디() === '옛' ? 'unmet23 (옛)' : '77yuhbs (새)'}» 이다.`);
    console.log('   ⚠ 설정을 방금 바꿨다면 도는 굽기가 넘어오는 데 2~3분 걸린다(09-06 실측).\n');
    return;
  }

  if (옛으로 && 새로) { console.error('\n🔴 --옛 과 --새 를 같이 줄 수 없다\n'); process.exit(1); }

  if (옛으로) {
    if (!fs.existsSync(활성)) console.log('\n이미 옛 지갑이다(자격 파일이 없다).');
    else {
      if (fs.existsSync(보관)) fs.unlinkSync(보관); // 앞서 보관한 것이 있으면 새것으로 덮는다
      fs.renameSync(활성, 보관);
      console.log(`\n✅ 새 지갑 자격을 옆으로 치웠다 → ${보관}`);
      장부에적기('77yuhbs', 'unmet23', 인자('--까닭'));
    }
    console.log(캐시지우기() ? '✅ 토큰 캐시를 지웠다 — 지금부터 바뀐다' : 'ⓘ 토큰 캐시는 이미 비어 있었다');
  } else if (새로) {
    if (fs.existsSync(활성)) console.log('\n이미 새 지갑이다.');
    else if (!fs.existsSync(보관)) {
      console.error(`\n🔴 보관해 둔 자격이 없다: ${보관}`);
      console.error(`   다시 받는 법: node tools/구글계정붙이기.js --계정 ${지갑.새.계정}\n`);
      process.exit(1);
    } else {
      fs.renameSync(보관, 활성);
      console.log(`\n✅ 새 지갑 자격을 되돌렸다 → ${활성}`);
      장부에적기('unmet23', '77yuhbs', 인자('--까닭'));
    }
    console.log(캐시지우기() ? '✅ 토큰 캐시를 지웠다 — 지금부터 바뀐다' : 'ⓘ 토큰 캐시는 이미 비어 있었다');
  }

  보여주기();

  if (옛으로 || 새로) {
    console.log('⚠ 지금 «도는» 굽기가 있으면 그것도 다음 호출부터 이 지갑으로 넘어간다.');
    console.log('   도는지 보는 법: 작업 목록에서 `옷굽기.js`·`공방굽기.js` 같은 것을 찾는다.');
    console.log('📏 실제로 도는지 재는 법(글 한 번 · 값 거의 0):');
    console.log('   node tools/모델정책.js --제미나이확인 돈\n');
  }
})().catch((e) => { console.error(`\n🔴 ${e.message}\n`); process.exit(1); });

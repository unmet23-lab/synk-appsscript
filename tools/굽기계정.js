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
 *   node tools/굽기계정.js          # 지금 어느 지갑을 태우나
 *   node tools/굽기계정.js --옛      # unmet23 (마감 11-13 · 먼저 죽는 돈)
 *   node tools/굽기계정.js --새      # 77yuhbs (마감 12-05)
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const 활성 = path.join(os.homedir(), '.synk-vertex-oauth.json');
const 보관 = path.join(os.homedir(), '.synk-vertex-oauth.보관.json');
const 캐시 = path.join(os.tmpdir(), 'synk_vertex_token.json');
const 배포자격 = path.join(os.homedir(), '.clasprc.json');

const 지갑 = {
  옛: { 계정: 'unmet23@gmail.com', 결제: '0161FA-7C996C-F1B948', 프로: 'gen-lang-client-0106203750', 마감: '2026-11-13' },
  새: { 계정: '77yuhbs@gmail.com', 결제: '013A36-17619E-CE0D07', 프로: 'project-22fd10a3-c9c2-4b34-9f0', 마감: '2026-12-05' },
};

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

(async () => {
  const 옛으로 = process.argv.includes('--옛') || process.argv.includes('--unmet23');
  const 새로 = process.argv.includes('--새') || process.argv.includes('--77yuhbs');

  if (옛으로 && 새로) { console.error('\n🔴 --옛 과 --새 를 같이 줄 수 없다\n'); process.exit(1); }

  if (옛으로) {
    if (!fs.existsSync(활성)) console.log('\n이미 옛 지갑이다(자격 파일이 없다).');
    else {
      if (fs.existsSync(보관)) fs.unlinkSync(보관); // 앞서 보관한 것이 있으면 새것으로 덮는다
      fs.renameSync(활성, 보관);
      console.log(`\n✅ 새 지갑 자격을 옆으로 치웠다 → ${보관}`);
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

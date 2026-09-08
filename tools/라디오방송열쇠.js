#!/usr/bin/env node
/**
 * 유튜브 «방송 열쇠»(스트림 키)를 받아 서버에 넣는다.
 *
 * 🔴 자격증명 규율: 열쇠 값을 **화면에 안 찍는다**. 받아서 곧바로 서버 `.env` 로 흘려 넣고,
 *   확인은 「몇 글자인가」와 「들어갔나」로만 한다.
 *
 * 🔑 무엇을 만드나(유호 승인 09-06 「비공개로 만들어서 열쇠 받아줘」):
 *   ① `liveStream` — 열쇠가 사는 그릇. **재사용된다**(한 번 만들면 계속 쓴다).
 *   ② `liveBroadcast` — 방송 한 자리. **`private`(비공개)** 로 만든다 — 아무에게도 안 보인다.
 *   ③ 둘을 잇는다(bind).
 *
 * ⚠ 쿼터: list 1 + insert 50×2 + bind 50 = **151유닛**(하루 한도 10,000). 반복해 부르지 않는다.
 * ⚠ 이미 만들어 둔 것이 있으면 새로 만들지 않고 그것을 쓴다.
 *
 * 쓰는 법:
 *   node tools/라디오방송열쇠.js          # 지금 무엇이 있나만 본다(1유닛)
 *   node tools/라디오방송열쇠.js --받기    # 없으면 만들고, 열쇠를 서버에 넣는다
 *   node tools/라디오방송열쇠.js --갈기    # 🆕 09-08 열쇠만 새로 — 새 스트림 · 다시 묶기 · .env 두 칸 갈기 · 옛 스트림 삭제 · 단계 되돌리기
 *   node tools/라디오방송열쇠.js --다시켜기 # 🆕 09-08 «트는 곳»만 새로 — 방송 자리가 끝나 아무도 못 볼 때(.env 는 안 건드린다)
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const talk환경 = path.join(os.homedir(), 'Documents', 'SYNK-talk', '.env');
const ssh열쇠 = path.join(os.homedir(), '.ssh', 'synk_radio');
const 서버 = 'synk@34.71.111.97';
const 스트림이름 = 'SYNK 라디오24 상시';
/* 🆕 09-08 이름 교체(유호 지시 · 커밋 e3c5ac1c9) — 「24시간 한국어 라디오」·「SYNK FM」은 옛 이름이다.
   lofi 는 세계가 실제로 검색하는 낱말이고, K- 가 한국어를 로마자로 세워 준다. */
const 방송제목 = 'K-LOFI 24 · 한국어 공부할 때 켜 두는 라디오 🎧';
const 방송소개 = '한국어 공부할 때 켜 두는 로파이 라디오입니다. 24시간 꺼지지 않아요.\n\nSYNK LAB — 몽골 학생을 위한 한국어 학원';

function 환경읽기() {
  const 표 = {};
  for (const 줄 of fs.readFileSync(talk환경, 'utf8').split(/\r?\n/)) {
    const m = 줄.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (v) 표[m[1]] = v;
  }
  return 표;
}

async function 토큰(env) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.RADIO_YT_CLIENT_ID, client_secret: env.RADIO_YT_CLIENT_SECRET,
      refresh_token: env.RADIO_YT_REFRESH_TOKEN, grant_type: 'refresh_token',
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error(`유튜브 토큰 갱신 실패 ${r.status}: ${j.error_description || j.error || ''}`);
  return j.access_token;
}

async function yt(tok, 방법, 길, 몸) {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/${길}`, {
    method: 방법,
    headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
    body: 몸 ? JSON.stringify(몸) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`유튜브 ${방법} ${길.split('?')[0]} → ${r.status}: ${JSON.stringify(j.error?.message || j).slice(0, 300)}`);
  return j;
}

function ssh(명령, 넣을것) {
  return execFileSync('ssh', ['-i', ssh열쇠, '-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=20', 서버, 명령],
    { input: 넣을것 || '', encoding: 'utf8' });
}

/* 공개 범위 셋 — 뜻을 헷갈리면 사고가 난다.
 *   private   비공개   : 만든 사람만. 링크를 줘도 남은 못 본다.
 *   unlisted  일부공개 : **링크를 아는 사람은 누구나 본다.** 채널 목록·검색에는 안 뜬다.
 *   public    공개     : 채널에 뜨고 검색에도 걸린다.
 * ⚠ 「일부공개」는 «안전»이 아니라 «안 띄움»이다 — 링크가 퍼지면 누구나 본다. */
const 공개범위표 = { private: '비공개', unlisted: '일부공개', public: '공개' };

(async () => {
  const env = 환경읽기();
  const tok = await 토큰(env);
  const 받기 = process.argv.includes('--받기');

  const i = process.argv.indexOf('--공개범위');
  if (i > -1) {
    const 값 = process.argv[i + 1];
    if (!공개범위표[값]) { console.error(`\n🔴 모르는 값 "${값}" — private · unlisted · public 중 하나\n`); process.exit(1); }
    const 목 = await yt(tok, 'GET', 'liveBroadcasts?part=id,snippet,status&mine=true&maxResults=25');
    const 방송 = (목.items || []).find((b) => b.snippet?.title === 방송제목 && b.status?.lifeCycleStatus !== 'complete');
    if (!방송) { console.error('\n🔴 바꿀 방송을 못 찾았다\n'); process.exit(1); }
    console.log(`\n방송 「${방송.snippet.title}」 · 지금 ${공개범위표[방송.status.privacyStatus] || 방송.status.privacyStatus} → ${공개범위표[값]}`);
    const r = await yt(tok, 'PUT', 'liveBroadcasts?part=id,status', {
      id: 방송.id,
      status: { privacyStatus: 값, selfDeclaredMadeForKids: false },
    });
    console.log(`  ✅ 바뀌었다 · 지금 = ${공개범위표[r.status?.privacyStatus] || r.status?.privacyStatus}`);
    // 되읽기 — 응답이 아니라 목록으로 잰다
    const 다시 = await yt(tok, 'GET', `liveBroadcasts?part=id,status&id=${방송.id}`);
    const s = 다시.items?.[0]?.status;
    console.log(`  되읽기: ${공개범위표[s?.privacyStatus] || s?.privacyStatus} · 단계 ${s?.lifeCycleStatus}`);
    console.log(`\n  보는 곳 = https://www.youtube.com/watch?v=${방송.id}`);
    if (s?.lifeCycleStatus !== 'live') {
      console.log(`  🔴 아직 «시작 전»(${s?.lifeCycleStatus})이라 그 주소는 안 열린다 — 「라이브 시작」이 따로 필요하다.`);
      console.log(`     관제실 = https://studio.youtube.com/video/${방송.id}/livestreaming\n`);
    } else console.log('');
    return;
  }

  /* 🆕 09-08 `--갈기` — 열쇠가 어딘가에 찍혔을 때(09-07 · 내가 서버 일지를 가리지 않고 불러 대화에 찍혔다) 열쇠만 새로 받는다.
     방송 자리(id · 링크)는 그대로 두고 «열쇠가 사는 그릇»(스트림)만 새로 만든다 — 그래야 유호님께 드린 링크가 안 죽는다.
       ① 새 스트림을 만들고 ② 방송을 그 스트림에 다시 묶고 ③ 서버 .env 의 두 칸만 «갈아» 넣고(다른 칸은 그대로 —
          09-07 에 `cat >` 로 덮어써서 자격 세 칸이 사라진 사고가 있다) ④ 옛 스트림을 지운다(그래야 옛 값이 죽는다).
       옛 열쇠로 밀던 ffmpeg 은 끊기고, radio-live 가 5초 뒤 새 .env 로 되살아난다(Restart=always · 09-08 실측).
       ⑤ 다시 묶으면 방송 단계가 내려가므로(testing/live → ready), 새 스트림이 «active» 가 되길 기다려 옛 단계로 되돌린다.
     쿼터 ≈ 2 + 50(insert) + 50(bind) + 50(delete) + 50~100(transition) + 폴링 ≈ 230유닛. */
  /* 🆕 09-08 낮 `--다시켜기` — «트는 곳»만 새로 연다. 열쇠(.env)는 손도 안 댄다.
     왜 있나: 09-08 낮에 방송 자리 셋이 전부 complete 인데 스트림은 active·good 이라, 5시간 40분 동안
     아무도 못 보는 그림을 밀고 있었다. 끝난 자리는 되살릴 수 없어 «새 자리»를 열어 지금 스트림에 묶는 길이 필요했다.
     🔴 `--받기` 를 쓰면 안 된다 — 그 갈래는 `cat > .env` 로 환경 파일을 통째로 덮어써서
        09-07 에 자격 세 칸이 사라진 적이 있다. 이 갈래는 .env 를 읽지도 쓰지도 않는다.
     🔴 공개 범위는 «비공개»로 연다. 공개로 바꾸는 것은 밖으로 내보내는 일이라 유호님 자리다(--공개범위 로 따로).
     ⚠ 쿼터 ≈ insert 50 + bind 50 + transition 50×2 + 폴링 ≈ 210유닛(하루 한도 10,000). */
  if (process.argv.includes('--다시켜기')) {
    const 스트림들 = (await yt(tok, 'GET', 'liveStreams?part=id,snippet,status&mine=true&maxResults=25')).items || [];
    const 스트림 = 스트림들.find((x) => x.status?.streamStatus === 'active') || 스트림들[0];
    if (!스트림) throw new Error('스트림이 하나도 없다 — 먼저 --받기 로 만든다');
    console.log(`\n스트림 「${스트림.snippet.title}」 · 받는 중? ${스트림.status?.streamStatus} · 건강 ${스트림.status?.healthStatus?.status}`);
    if (스트림.status?.streamStatus !== 'active') {
      throw new Error('스트림이 active 가 아니다 — 그림이 안 들어오는데 방송을 열면 또 죽는다. 서버(radio-live)를 먼저 본다');
    }

    const 방송들 = (await yt(tok, 'GET', 'liveBroadcasts?part=id,status&broadcastStatus=all&broadcastType=all&maxResults=25')).items || [];
    const 살아있는 = 방송들.filter((b) => !['complete', 'revoked'].includes(b.status?.lifeCycleStatus));
    if (살아있는.length) {
      console.log(`\n이미 살아 있는 자리가 있다 — 새로 안 만든다: ${살아있는.map((b) => `${b.id}·${b.status.lifeCycleStatus}`).join(' / ')}`);
      console.log('   (죽은 줄 알았다면 node tools/라디오방송건강.js 로 다시 본다)\n');
      return;
    }

    console.log(`① 새 방송 자리를 만든다: ${방송제목}`);
    const 방송 = await yt(tok, 'POST', 'liveBroadcasts?part=snippet,status,contentDetails', {
      snippet: { title: 방송제목, description: 방송소개, scheduledStartTime: new Date(Date.now() + 60 * 1000).toISOString() },
      status: { privacyStatus: 'private', selfDeclaredMadeForKids: false },
      /* 🔴 자동 종료를 켜면 잠깐 끊길 때마다 자리가 죽고 채팅 방 번호가 새로 난다(트랙 §0-라디오). */
      contentDetails: { enableAutoStart: false, enableAutoStop: false, enableDvr: true, latencyPreference: 'normal' },
    });
    console.log(`   만들었다 · id ${방송.id} · ${공개범위표[방송.status?.privacyStatus]}`);

    console.log('② 지금 스트림에 묶는다');
    await yt(tok, 'POST', `liveBroadcasts/bind?id=${방송.id}&part=id,contentDetails&streamId=${스트림.id}`);

    const 단계보기 = async () => (await yt(tok, 'GET', `liveBroadcasts?part=status&id=${방송.id}`)).items?.[0]?.status?.lifeCycleStatus;
    const 잠깐 = (ms) => new Promise((r) => setTimeout(r, ms));
    console.log('③ 시험 단계로 올린다(testing — 아직 아무도 못 본다)');
    await yt(tok, 'POST', `liveBroadcasts/transition?id=${방송.id}&broadcastStatus=testing&part=id,status`);
    let 지금 = await 단계보기();
    for (let k = 0; k < 12 && 지금 !== 'testing'; k++) { await 잠깐(5000); 지금 = await 단계보기(); }
    console.log(`   단계 ${지금}`);

    console.log('④ 트는 단계로 올린다(live — 이제 링크가 있으면 보인다)');
    await yt(tok, 'POST', `liveBroadcasts/transition?id=${방송.id}&broadcastStatus=live&part=id,status`);
    지금 = await 단계보기();
    console.log(`   단계 ${지금}`);

    /* ⑤ 🔴 켜고 끝내지 않는다 — 앞의 세 자리가 39초·125초·246초 만에 죽었다.
          «켰다»가 아니라 «켜져 있나»를 재야 하므로, 15초마다 물어 몇 분을 지켜본다. */
    const 분 = Number(process.argv[process.argv.indexOf('--지켜보기') + 1]) || 10;
    console.log(`\n⑤ ${분}분 지켜본다(15초마다 · 죽으면 그 자리에서 멈춘다)`);
    const 시작 = Date.now();
    while (Date.now() - 시작 < 분 * 60 * 1000) {
      await 잠깐(15000);
      const 단계 = await 단계보기();
      const 산초 = Math.round((Date.now() - 시작) / 1000);
      if (단계 !== 'live') { console.log(`   🔴 ${산초}초 만에 죽었다 — 단계 ${단계}`); break; }
      if (산초 % 60 < 15) console.log(`   ${산초}초 · live`);
    }
    console.log(`\n최종 단계 = ${await 단계보기()}`);
    console.log(`보는 곳 = https://www.youtube.com/watch?v=${방송.id} (지금은 비공개 — 유호님 계정에서만 보인다)`);
    console.log('공개로 바꾸는 것은 밖으로 내보내는 일이라 따로 여쭙는다: node tools/라디오방송열쇠.js --공개범위 public\n');
    return;
  }

  if (process.argv.includes('--갈기')) {
    const 목록 = (await yt(tok, 'GET', 'liveStreams?part=id,snippet,cdn,status&mine=true&maxResults=25')).items || [];
    const 방송들 = await yt(tok, 'GET', 'liveBroadcasts?part=id,snippet,status,contentDetails&mine=true&maxResults=25');
    /* 방송 자리는 «제목»으로 안 찾는다 — 09-07 에 유호 지시로 제목이 바뀌었다(「SYNK 24 RADIO」). 끝나지 않은 자리 중
       지금 스트림에 묶인 것을 집고, 없으면 끝나지 않은 자리 하나만 있을 때 그것을 집는다. */
    const 안끝난 = (방송들.items || []).filter((b) => b.status?.lifeCycleStatus !== 'complete' && b.status?.lifeCycleStatus !== 'revoked');
    const 방송 = 안끝난.find((b) => 목록.some((s) => s.id === b.contentDetails?.boundStreamId))
      || (안끝난.length === 1 ? 안끝난[0] : null);
    if (!방송) throw new Error(`갈 방송 자리를 못 찾았다 (끝나지 않은 자리 ${안끝난.length}개: ${안끝난.map((b) => `${b.snippet?.title}·${b.status?.lifeCycleStatus}`).join(' / ') || '없음'})`);
    const 옛 = 목록.find((s) => s.id === 방송.contentDetails?.boundStreamId) || 목록[0];
    const 단계 = 방송.status?.lifeCycleStatus;
    console.log(`\n방송 「${방송.snippet.title}」 · 단계 ${단계} · ${공개범위표[방송.status.privacyStatus] || 방송.status.privacyStatus} · 묶인 스트림 = ${옛 ? 옛.snippet?.title : '없음'}`);
    const m = /^(.*?)\s*(\d+)?\s*$/.exec((옛 && 옛.snippet?.title) || 스트림이름);
    const 새이름 = `${(m[1] || 스트림이름).trim()} ${(Number(m[2]) || 1) + 1}`;
    console.log(`① 새 스트림을 만든다: ${새이름}`);
    const 새 = await yt(tok, 'POST', 'liveStreams?part=snippet,cdn,status', {
      snippet: { title: 새이름 }, cdn: { frameRate: '30fps', ingestionType: 'rtmp', resolution: '720p' },
    });
    const 열쇠 = 새.cdn?.ingestionInfo?.streamName;
    const 곳 = 새.cdn?.ingestionInfo?.ingestionAddress;
    if (!열쇠) throw new Error('새 스트림은 생겼는데 열쇠가 안 왔다 — 권한(youtube.force-ssl)을 의심한다');
    console.log(`   열쇠 받았다 (${열쇠.length}글자 · 값은 안 찍는다) · 밀어 넣는 곳 = ${곳}`);
    console.log('② 방송을 새 스트림에 다시 묶는다');
    await yt(tok, 'POST', `liveBroadcasts/bind?id=${방송.id}&part=id,contentDetails&streamId=${새.id}`);
    console.log('   묶었다');
    console.log('③ 서버 .env 의 두 칸만 갈아 넣는다(다른 칸은 그대로 · 값은 표준입력으로만)');
    ssh("f=/opt/synk-radio/송출/.env; n=$(cat); t=$(mktemp); grep -vE '^(YOUTUBE_STREAM_KEY|YOUTUBE_INGEST_URL)=' \"$f\" > \"$t\"; printf '%s\\n' \"$n\" >> \"$t\"; cat \"$t\" > \"$f\"; chmod 600 \"$f\"; rm -f \"$t\"",
      `YOUTUBE_STREAM_KEY=${열쇠}\nYOUTUBE_INGEST_URL=${곳}`);
    const 칸 = ssh("grep -oE '^[A-Z_]+' /opt/synk-radio/송출/.env | sort").trim().split(/\r?\n/);
    console.log(`   칸 ${칸.length}개: ${칸.join(' · ')}`);
    if (옛 && 옛.id !== 새.id) {
      console.log(`④ 옛 스트림을 지운다: ${옛.snippet?.title}`);
      await yt(tok, 'DELETE', `liveStreams?id=${옛.id}`);
      console.log('   지웠다 — 옛 열쇠는 죽었다. 송출은 끊기고 radio-live 가 5초 뒤 새 열쇠로 되살아난다.');
    }
    if (단계 === 'testing' || 단계 === 'live') {
      console.log(`⑤ 새 스트림이 «active» 가 되길 기다려 방송 단계를 ${단계} 로 되돌린다`);
      let 됐다 = false;
      for (let k = 0; k < 30; k++) {
        await new Promise((r) => setTimeout(r, 5000));
        const st = (await yt(tok, 'GET', `liveStreams?part=status&id=${새.id}`)).items?.[0]?.status?.streamStatus;
        process.stdout.write(`   ${k * 5 + 5}초 ${st}`);
        if (st === 'active') { 됐다 = true; break; }
      }
      console.log('');
      const 단계보기 = async () => (await yt(tok, 'GET', `liveBroadcasts?part=status&id=${방송.id}`)).items?.[0]?.status?.lifeCycleStatus;
      if (됐다) {
        let 지금 = await 단계보기();
        if (지금 === 'ready' || 지금 === 'created') { await yt(tok, 'POST', `liveBroadcasts/transition?id=${방송.id}&broadcastStatus=testing&part=id,status`); 지금 = await 단계보기(); }
        if (단계 === 'live' && (지금 === 'testing' || 지금 === 'testStarting')) {
          for (let k = 0; k < 12 && 지금 !== 'testing'; k++) { await new Promise((r) => setTimeout(r, 5000)); 지금 = await 단계보기(); }
          await yt(tok, 'POST', `liveBroadcasts/transition?id=${방송.id}&broadcastStatus=live&part=id,status`);
          지금 = await 단계보기();
        }
        console.log(`   방송 단계 = ${지금} (전 = ${단계})`);
      } else console.log('   ⚠ 150초 안에 새 스트림이 active 가 안 됐다 — 서버 일지(가림 sed 를 붙여서)를 본다. 단계 되돌리기는 안 했다.');
    }
    console.log(`\n✅ 열쇠를 갈았다 · 방송 자리 id 는 그대로(${방송.id}) · 보는 곳 = https://www.youtube.com/watch?v=${방송.id}\n`);
    return;
  }

  // ① 이미 있는 스트림을 먼저 본다(1유닛) — 겹쳐 만들지 않는다
  const 있는것 = await yt(tok, 'GET', 'liveStreams?part=id,snippet,cdn,status&mine=true&maxResults=25');
  const 목록 = 있는것.items || [];
  console.log(`\n📡 이미 있는 스트림 ${목록.length}개`);
  for (const s of 목록) console.log(`   · ${s.snippet?.title} · ${s.status?.streamStatus} · ${s.cdn?.resolution}/${s.cdn?.frameRate}`);

  if (!받기) { console.log('\n받으려면: node tools/라디오방송열쇠.js --받기\n'); return; }

  // ② 스트림 — 있으면 쓰고 없으면 만든다
  let 스트림 = 목록.find((s) => s.snippet?.title === 스트림이름) || 목록[0];
  if (스트림) console.log(`\n① 스트림을 이미 갖고 있다: ${스트림.snippet?.title}`);
  else {
    console.log(`\n① 스트림을 만든다: ${스트림이름}`);
    스트림 = await yt(tok, 'POST', 'liveStreams?part=snippet,cdn,status', {
      snippet: { title: 스트림이름 },
      cdn: { frameRate: '30fps', ingestionType: 'rtmp', resolution: '720p' },
    });
  }
  const 열쇠 = 스트림.cdn?.ingestionInfo?.streamName;
  const 밀어넣는곳 = 스트림.cdn?.ingestionInfo?.ingestionAddress;
  if (!열쇠) throw new Error('스트림은 있는데 열쇠가 안 왔다 — 권한(youtube.force-ssl)을 의심한다');
  console.log(`   열쇠 받았다 (${열쇠.length}글자 · 값은 안 찍는다)`);
  console.log(`   밀어 넣는 곳 = ${밀어넣는곳}`);

  // ③ 비공개 방송 — 있으면 쓰고 없으면 만든다
  const 방송들 = await yt(tok, 'GET', 'liveBroadcasts?part=id,snippet,status&mine=true&maxResults=25');
  let 방송 = (방송들.items || []).find((b) => b.snippet?.title === 방송제목 && b.status?.lifeCycleStatus !== 'complete');
  if (방송) console.log(`② 방송 자리가 이미 있다: ${방송.snippet?.title} · ${방송.status?.privacyStatus} · ${방송.status?.lifeCycleStatus}`);
  else {
    console.log(`② 비공개 방송 자리를 만든다: ${방송제목}`);
    const 시작 = new Date(Date.now() + 3600 * 1000).toISOString();
    방송 = await yt(tok, 'POST', 'liveBroadcasts?part=snippet,status,contentDetails', {
      snippet: { title: 방송제목, description: 'SYNK LAB 자습 라디오. 아직 준비 중입니다.', scheduledStartTime: 시작 },
      status: { privacyStatus: 'private', selfDeclaredMadeForKids: false },
      contentDetails: { enableAutoStart: false, enableAutoStop: false, latencyPreference: 'normal' },
    });
    console.log(`   만들었다 · ${방송.status?.privacyStatus} · id ${방송.id}`);
  }

  // ④ 잇기
  console.log('③ 방송과 스트림을 잇는다');
  await yt(tok, 'POST', `liveBroadcasts/bind?id=${방송.id}&part=id,contentDetails&streamId=${스트림.id}`);
  console.log('   이었다');

  // ⑤ 서버에 넣기 — 값은 표준입력으로만 흐른다
  const 몸 = `YOUTUBE_STREAM_KEY=${열쇠}\nYOUTUBE_INGEST_URL=${밀어넣는곳}\n`;
  ssh('cat > /opt/synk-radio/송출/.env && chmod 600 /opt/synk-radio/송출/.env', 몸);
  const 확인 = ssh("grep -oE '^[A-Z_]+' /opt/synk-radio/송출/.env | sort").trim();
  console.log('\n④ 서버 송출 환경에 들어간 칸:');
  확인.split(/\r?\n/).forEach((n) => console.log(`   · ${n}`));

  console.log(`\n✅ 방송 자리는 **비공개**다 — 아무에게도 안 보인다.`);
  console.log(`   공개로 바꾸는 것은 유호님이 정하실 때 따로 한다(이 도구는 안 바꾼다).\n`);
})().catch((e) => { console.error(`\n🔴 ${e.message}\n`); process.exit(1); });

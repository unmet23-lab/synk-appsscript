'use strict';
// 솔리오 백업 방의 받기 · 확인 길(src/solio-backup.cjs)을 Electron 본체 프로세스 안에서 돌린다(2026-11-23 T30).
// Node(OpenSSL)에서만 시험해 Electron(BoringSSL)에 blake2b512가 없다는 것을 놓쳤다. 그래서 이 파일은 node --test에서 자기 자신을
// Electron으로 다시 띄우고, 그 안에서 BLAKE2b · SHA-256 · Ed25519 열쇠 들이기 · minisign 서명 확인 · 피드 확인과 받기부터
// 관리자 확인 직전까지의 설치 길을 돌린다. 기대 값은 Node 쪽이 OpenSSL로 셈해 넘긴다(installations-asar.test.cjs와 같은 꼴).
// 기본은 합성 설치 파일과 시험 안에서 만든 minisign 열쇠다. 네트워크 · 계정 · PowerShell · 설치기 · 관리자 창을 쓰지 않는다.
// SYNK_SOLIO_BACKUP_LIVE=1이면 실제 피드와 게시된 설치 파일(37MB)을 받아 엔진의 운영 열쇠로 확인하고, 진짜 쥐기(PowerShell)까지 한다.
// 그때도 설치기는 띄우지 않는다(쥔 핸들에 RUN을 보내지 않고 놓는다).
const path = require('node:path');

const ACCOUNT = { synk_user_id: 'electron-probe-0001' };

async function electronProbe() {
  const { app } = require('electron');
  const fs = require('node:fs'), crypto = require('node:crypto'), { Readable } = require('node:stream');
  const root = process.argv[process.argv.length - 1];
  app.setPath('appData', path.join(root, 'Roaming')); app.setPath('userData', path.join(root, 'Roaming', 'Probe'));
  app.setPath('sessionData', path.join(root, 'Roaming', 'Probe', 'Session')); app.setPath('temp', path.join(root, 'Temp'));
  app.disableHardwareAcceleration();
  const result = { ok: false, electron: process.versions.electron, checks: [] };
  const write = () => fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify(result, null, 1));
  try {
    await app.whenReady();
    const assert = require('node:assert/strict');
    const B = require('../src/solio-backup.cjs'), { createBlake2b512 } = require('../src/blake2b.cjs');
    const input = JSON.parse(fs.readFileSync(path.join(root, 'input.json'), 'utf8'));
    const check = name => result.checks.push(name);

    // 이 실행 환경에 blake2b512가 있는지 적어 둔다(없어야 이 시험이 실제로 그 틈을 덮는다)
    try { crypto.createHash('blake2b512'); result.nativeBlake2b = true; } catch (error) { result.nativeBlake2b = false; result.nativeBlake2bError = error.message; }

    // 1. BLAKE2b-512 직접 셈이 OpenSSL과 같다(RFC 7693 「abc」, 0 · 127 · 128 · 129바이트)
    for (const v of input.vectors) assert.equal(createBlake2b512().update(Buffer.from(v.hex, 'hex')).digest('hex'), v.blake, `${v.hex.length / 2} bytes`);
    check('blake2b-vectors');

    // 2. 엔진에 박힌 두 열쇠를 BoringSSL이 Ed25519 열쇠로 들인다
    assert.deepEqual(B.ENGINE_KEYS.map(k => B.publicKey(k.pub).id.toString('hex')), input.engineKeyIds);
    check('engine-keys-import');

    if (!input.live) {
      // 3. 파일 스트림의 크기 · SHA-256 · BLAKE2b
      const file = path.join(root, 'fixture.exe');
      const digest = await B.digestFile(file, input.size);
      assert.deepEqual([digest.size, digest.sha256, digest.blake.toString('hex')], [input.size, input.sha256, input.blake]);
      check('digest-file');

      // 4. 피드 받기 · 꼴 확인과 minisign 서명 확인(맞는 열쇠는 operating, 바뀐 바이트는 null)
      const keys = [{ role: 'operating', pub: input.pub }];
      const feedBytes = Buffer.from(JSON.stringify(input.feed));
      const request = async url => {
        if (url === B.FEED_URL) return { status: 200, headers: {}, body: Readable.from([feedBytes]) };
        if (url.startsWith('https://github.com/')) return { status: 302, headers: { location: 'https://release-assets.githubusercontent.com/github-production-release-asset/1/setup' }, body: Readable.from([]) };
        if (url.startsWith('https://release-assets.githubusercontent.com/')) return { status: 200, headers: { 'content-length': String(input.size) }, body: fs.createReadStream(file) };
        return { status: 404, headers: {}, body: Readable.from([]) };
      };
      const feed = await B.fetchFeed({ request });
      assert.deepEqual([feed.version, feed.size, feed.sha256], [input.feed.version, input.size, input.sha256]);
      const parsed = B.parseSignature(feed.signature);
      assert.equal(B.verifySignature(digest.blake, parsed, keys), 'operating');
      const other = Buffer.from(digest.blake); other[0] ^= 1;
      assert.equal(B.verifySignature(other, parsed, keys), null);
      assert.equal(B.verifySignature(digest.blake, parsed, B.ENGINE_KEYS), null, 'a test key is not an engine key');
      check('feed-and-signature');

      // 5. 방의 설치 길: 피드 → 받기 → 쥐기(가짜) → 확인 → setup 요청 → 관리자 확인(거절). 거절까지 오면 그 앞이 모두 통과한 것이다
      const log = [];
      const hold = async held => {
        log.push('hold');
        const sha256 = crypto.createHash('sha256').update(fs.readFileSync(held)).digest('hex');
        return { finalPath: held, sha256, release() { log.push('release'); }, async run() { log.push('run'); return { outcome: 'declined' }; } };
      };
      const service = B.createSolioBackup({
        platform: 'win32', env: { APPDATA: path.join(root, 'appdata') }, cacheRoot: path.join(root, 'cache'), run: async () => '{}', request, hold, keys,
        previewAccounts: [crypto.createHash('sha256').update(B.PREVIEW_SALT + input.account).digest('hex')], wait: async () => {},
      });
      assert.deepEqual(await service.start({ synk_user_id: input.account }, 'protect'), { ok: true });
      await service.whenIdle();
      const snap = await service.snapshot({ synk_user_id: input.account });
      result.install = snap.install;
      assert.deepEqual([snap.install.phase, snap.install.code, log], ['error', 'DECLINED', ['hold', 'run']]);
      check('install-path-to-admin-prompt');
    } else {
      // 실제 게시본: 피드를 받아 확인하고, 방의 설치 길로 받기 · 진짜 쥐기 · 확인 · 요청 쓰기까지 간 뒤 관리자 확인 앞에서 놓는다
      const feed = await B.fetchFeed();
      result.feed = { version: feed.version, size: feed.size, sha256: feed.sha256 };
      check('live-feed');
      const log = [];
      const hold = async held => {
        log.push('hold');
        const real = await B.holdSetup(held);
        // 쥔 동안 같은 바이트를 운영 열쇠로 따로 견줘 역할을 적는다(방은 역할을 밖에 알리지 않는다). 방이 받은 판의 피드로 견주려고
        // 피드를 다시 받아 파일 이름의 판과 같은지 본다. 그사이 새 판이 올라왔으면 판이 바뀌었다고 멈춘다(GPT GA4)
        // 이 견주기가 실패하면 방에 쥐개를 넘기기 전이라 방이 놓을 수 없다. 여기서 놓고 던진다(GPT -c GA2)
        try {
          const now = await B.fetchFeed();
          assert.equal(path.basename(held), `SynkWorkBackup-${now.version}-setup.exe`, 'the feed changed during the live run; run it again');
          const digest = await B.digestFile(held, now.size);
          result.live = { version: now.version, size: digest.size, sha256: digest.sha256, feedSha256: now.sha256, heldSha256: real.sha256, role: B.verifySignature(digest.blake, B.parseSignature(now.signature)) };
        } catch (error) { await real.release(); throw error; }
        return { finalPath: real.finalPath, sha256: real.sha256, release: () => { log.push('release'); return real.release(); }, async run() { log.push('run'); await real.release(); return { outcome: 'declined' }; } };
      };
      const service = B.createSolioBackup({
        platform: 'win32', env: { APPDATA: path.join(root, 'appdata') }, cacheRoot: path.join(root, 'cache'), run: async () => '{}', hold,
        previewAccounts: [crypto.createHash('sha256').update(B.PREVIEW_SALT + input.account).digest('hex')],
      });
      assert.deepEqual(await service.start({ synk_user_id: input.account }, 'protect'), { ok: true });
      await service.whenIdle();
      const snap = await service.snapshot({ synk_user_id: input.account });
      result.install = snap.install;
      assert.deepEqual([snap.install.phase, snap.install.code, log], ['error', 'DECLINED', ['hold', 'run']]);
      assert.equal(result.live.role, 'operating');
      assert.equal(result.live.sha256, result.live.feedSha256);
      assert.equal(result.live.heldSha256, result.live.feedSha256);
      check('live-install-path-to-admin-prompt');
    }
    result.ok = true; write(); app.exit(0);
  } catch (error) {
    result.message = error.message; result.stack = error.stack; write(); app.exit(1);
  }
}

if (process.versions.electron) { void electronProbe(); }
else {
  const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), crypto = require('node:crypto'), { spawn } = require('node:child_process');
  const live = process.env.SYNK_SOLIO_BACKUP_LIVE === '1';
  const blake = data => crypto.createHash('blake2b512').update(data).digest('hex');

  /* minisign 열쇠와 서명(Tauri signer와 같은 「ED」 꼴). solio-backup.test.cjs의 것과 같다 */
  function minisignKey() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const id = crypto.randomBytes(8), raw = publicKey.export({ format: 'jwk' }).x;
    const line = Buffer.concat([Buffer.from('Ed', 'latin1'), id, Buffer.from(raw, 'base64url')]).toString('base64');
    const pub = Buffer.from(`untrusted comment: minisign public key: ${id.toString('hex').toUpperCase()}\n${line}\n`).toString('base64');
    return { pub, sign(data, comment) {
      const sig = crypto.sign(null, crypto.createHash('blake2b512').update(data).digest(), privateKey);
      const global = crypto.sign(null, Buffer.concat([sig, Buffer.from(comment, 'utf8')]), privateKey);
      return Buffer.from(`untrusted comment: signature from tauri secret key\n${Buffer.concat([Buffer.from('ED', 'latin1'), id, sig]).toString('base64')}\ntrusted comment: ${comment}\n${global.toString('base64')}\n`).toString('base64');
    } };
  }

  test(`Electron main process: BLAKE2b, engine keys, minisign and feed checks, and the install path up to the administrator prompt${live ? ' (live feed)' : ''}`, { skip: process.platform !== 'win32', timeout: live ? 600000 : 120000 }, async t => {
    const tempRoot = path.resolve(os.tmpdir()), root = fs.mkdtempSync(path.join(tempRoot, 'synk-solio-electron-'));
    t.after(() => {
      const relative = path.relative(tempRoot, path.resolve(root));
      assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    });
    for (const dir of ['Roaming', 'Temp', 'appdata', 'cache']) fs.mkdirSync(path.join(root, dir), { recursive: true });
    const vectors = [Buffer.from('abc'), Buffer.alloc(0), crypto.randomBytes(127), crypto.randomBytes(128), crypto.randomBytes(129)].map(data => ({ hex: data.toString('hex'), blake: blake(data) }));
    assert.equal(vectors[0].blake.slice(0, 16), 'ba80a53f981c4d0d', 'RFC 7693 Appendix A');
    const input = { live, vectors, account: ACCOUNT.synk_user_id, engineKeyIds: ['a906d76e18dc50e4', '6afbfdd8e4d59f4d'] };
    if (!live) {
      // 설치 파일과 같은 꼴의 합성 파일(블록 경계에 맞지 않는 3MB 남짓)
      const data = crypto.randomBytes(3 * 1024 * 1024 + 77), key = minisignKey(), version = '0.7.0', name = `SynkWorkBackup-${version}-setup.exe`;
      fs.writeFileSync(path.join(root, 'fixture.exe'), data);
      const entry = { signature: key.sign(data, `timestamp:1794880000\tfile:${name}\tversion:${version}`), url: `https://github.com/unmet23-lab/synk-policy/releases/download/workbackup-${version}/${name}`, size: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') };
      Object.assign(input, { size: data.length, sha256: entry.sha256, blake: blake(data), pub: key.pub, feed: { version, notes: '', pub_date: '2026-11-20T00:00:00Z', platforms: { 'windows-x86_64-nsis': entry, 'windows-x86_64': entry } } });
    }
    fs.writeFileSync(path.join(root, 'input.json'), JSON.stringify(input));
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.ELECTRON_NO_ASAR;
    const child = spawn(require('electron'), [__filename, root], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', killed = false;
    child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    // 바쁜 PC에서 Electron이 뜨다 멈추면 시험 기한에 걸려 까닭 없이 취소된다. 그 전에 끄고 받은 출력을 보인다
    const watchdog = setTimeout(() => { killed = true; try { child.kill(); } catch {} }, (live ? 600000 : 120000) - 10000);
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); }).finally(() => clearTimeout(watchdog));
    const resultFile = path.join(root, 'result.json');
    assert.ok(!killed || fs.existsSync(resultFile), `Electron did not finish in time\n${output.slice(-4000)}`);
    assert.ok(fs.existsSync(resultFile), output.slice(-4000));
    const result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
    if (live || process.env.SYNK_SOLIO_BACKUP_REPORT) t.diagnostic(JSON.stringify(result));
    assert.equal(code, 0, result.stack || output.slice(-4000));
    assert.equal(result.ok, true);
    assert.deepEqual(result.checks, live
      ? ['blake2b-vectors', 'engine-keys-import', 'live-feed', 'live-install-path-to-admin-prompt']
      : ['blake2b-vectors', 'engine-keys-import', 'digest-file', 'feed-and-signature', 'install-path-to-admin-prompt']);
  });
}

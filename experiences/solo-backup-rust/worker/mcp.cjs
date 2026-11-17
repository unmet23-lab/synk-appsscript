'use strict';
// MCP 보기 도구의 워커(STAGE1_DESIGN.md 4.16). WorkBackupRun.exe --mcp가 찾기에 처음 쓸 때 SWB_MODE=mcp로 띄운다.
// 클라우드 프로필의 엔진 하나(클라우드를 시작하지 않은 PC는 외장 드라이브 프로필)를 읽기 전용으로 연다: restic은 읽기 명령(snapshots · ls · cat config)만 `--no-lock`으로 돌아
// 저장소에 잠금 파일도 남기지 않고, 설정 · 자격 파일은 쓰지 않는다. 엔진 잠금은 쥐지 않는다(회차와 나란히 읽기만 한다).
// 부를 수 있는 메서드는 METHODS뿐이고, 앱의 메서드(contract/methods.json)는 이 모드에서 모두 거절된다(dispatcher.cjs).
const path = require('node:path');
const fs = require('node:fs/promises');
const engineRoot = process.env.SWB_ENGINE_ROOT || path.resolve(__dirname, '../engine');
const { BackupEngine, VERIFIED } = require(path.join(engineRoot, 'src/engine.cjs'));
const { appFolders } = require(path.join(engineRoot, 'src/profiles.cjs'));
const selection = require(path.join(engineRoot, 'src/restore-select.cjs'));

/** 이 모드의 짧은 허용 목록(Rust의 mcp.rs WORKER_METHODS와 같다). */
const METHODS = ['getState', 'findFiles'];
const RESULTS_MAX = 200;

/** `runner`: 시험이 restic 대신 쓰는 것. */
async function createMcp({ host, root, workRoot = null, resticPath, runner = null }) {
  const refuse = async () => { throw Object.assign(new Error('READ_ONLY'), { code: 'READ_ONLY' }); };
  const secretStore = { encrypt: refuse, decrypt: async bytes => host('secret.decrypt', [bytes.toString('base64')]) };
  const open = async (folder, providerType) => {
    const e = new BackupEngine({ stateDir: path.join(root, folder), workDir: workRoot ? path.join(workRoot, folder) : null, resticPath, secretStore,
      providerType, intervalMs: 3600000, forbiddenPaths: [root, ...(workRoot ? [workRoot] : []), ...appFolders(root)], ...(runner ? { runner } : {}) });
    // 읽기만 한다: 모든 restic 호출을 읽기 전용(읽기 명령만 · --no-lock)으로, 설정 · 자격 쓰기는 거절.
    const run = e.run.bind(e);
    e.run = (args, options = {}) => run(args, { ...options, readOnly: true });
    e.save = refuse; e.storeCredential = refuse; e.settingsStamp = async () => {};
    try { await e.open(); } catch (err) { if (err.code !== 'RECOVERY_REQUIRED') throw err; }
    return e;
  };
  const pick = async () => {
    const cloud = await open('cloud-vault', 'b2');
    if (cloud.config?.repositoryId) return cloud;
    let local;
    try { local = await open('vault', 'local'); } catch (e) { await cloud.stop().catch(() => {}); throw e; }
    if (local.config?.repositoryId) { await cloud.stop().catch(() => {}); return local; }
    await local.stop().catch(() => {}); return cloud;
  };
  // 이 워커는 MCP 세션 동안 떠 있다. 그사이 설정이나 자격이 바뀌면(보호 시작, 복구 키, 회차가 남긴 새 판) 다시 연다(카본 끝판 CC2).
  const stampOf = async () => (await Promise.all(['cloud-vault', 'vault'].flatMap(folder => ['settings.json', 'credential.bin']
    .map(name => fs.stat(path.join(root, folder, name)).then(s => `${s.size}:${s.mtimeMs}`, () => '-'))))).join('|');
  let stamp = await stampOf();
  let engine = await pick();
  const ready = () => { const c = engine.config; return !!c?.repositoryId && !!engine.secret; };
  const fresh = async () => {
    const now = await stampOf();
    if (now === stamp && ready()) return;
    // 새로 여는 데 성공한 뒤에 기록한다. 실패하면 다음 호출이 다시 연다(카본 다시 검수 A3).
    const next = await pick();
    await engine.stop().catch(() => {});
    engine = next; stamp = now;
  };
  return {
    METHODS,
    /** 이름 없는 요약: 설정을 마쳤는지, 가장 새 판의 시각. */
    async getState() {
      await fresh();
      const c = engine.config;
      return { configured: !!c?.repositoryId, credential: !!engine.secret, mode: c?.mode || null, lastBackupAt: c?.lastBackup?.at || null };
    },
    /**
     * 이름 일부로 가장 새 확인된 판 안의 파일을 찾는다(지금 「파일 되살리기」 목록과 같은 판). 전체 목록이 한도를 넘으면 폴더마다
     * 열어 본다(한도를 넘는 폴더는 건너뛰고 `cut`으로 알린다). `limit`개까지 원래 자리의 전체 경로 · 크기 · 고친 시각을 돌려준다.
     * `masks`(설정 서랍의 가리는 낱말, 소문자)가 든 경로는 결과에도 수(`total`)에도 넣지 않는다. 가리는 낱말이 든 낱말로는
     * 맞춰 보지 않되, 판은 똑같이 열어 답의 꼴과 걸리는 시간이 찾은 것이 없는 답과 같게 한다.
     */
    async findFiles(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw selection.issue('INVALID_REQUEST');
      const { query } = input;
      const limit = Number.isSafeInteger(input.limit) ? Math.max(1, Math.min(RESULTS_MAX, input.limit)) : 50;
      if (typeof query !== 'string' || !query.trim() || query.length > 100) throw selection.issue('QUERY_INVALID');
      const masks = input.masks === undefined ? [] : input.masks;
      if (!Array.isArray(masks) || masks.length > 20 || !masks.every(m => typeof m === 'string' && m.trim() && m.length <= 40)) throw selection.issue('INVALID_REQUEST');
      const hidden = text => { const t = text.toLowerCase(); return masks.some(m => t.includes(m.trim().toLowerCase())); };
      const skip = hidden(query);
      await fresh();
      if (!ready()) return { configured: false, results: [], total: 0, cut: false, snapshotAt: null };
      const results = [];
      let total = 0, cut = false, snapshotAt = null;
      const take = () => {
        const catalog = engine.fileCatalog;
        snapshotAt = catalog.snapshotAt;
        if (skip) return;
        for (const f of catalog.matches(query)) {
          const full = path.win32.join(catalog.plans[f.sourceIndex].original, ...f.path.split('/'));
          if (hidden(full)) continue;
          total++;
          if (results.length < limit) results.push({ path: full, size: f.size, mtime: f.mtime || null });
        }
      };
      try {
        try { await engine.openFileCatalog(); take(); }
        catch (e) {
          if (e.code !== 'CATALOG_TOO_LARGE') throw e;
          // 한 번에 다 못 여는 큰 판: 폴더마다 연다.
          const snapshot = (await engine.snapshots([VERIFIED], { host: engine.hostName }))[0];
          if (!snapshot) throw selection.issue('NO_SNAPSHOT');
          snapshotAt = snapshot.time; // 모든 폴더가 한도를 넘어도 판의 시각은 알린다(카본 끝판 CC4)
          for (const plan of selection.sourcePlans(snapshot)) {
            if (results.length >= limit) { cut = true; break; }
            try { await engine.openFileCatalog({ folder: plan.original }); take(); }
            catch (inner) { if (inner.code !== 'CATALOG_TOO_LARGE') throw inner; cut = true; }
            finally { engine.discardCatalog(); }
          }
        }
      } finally { engine.discardCatalog(); }
      return { configured: true, snapshotAt, results, total, cut };
    },
    async stop() { await engine.stop(); }
  };
}
module.exports = { createMcp, METHODS };

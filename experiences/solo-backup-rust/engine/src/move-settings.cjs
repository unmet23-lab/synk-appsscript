'use strict';
// 옮겨 오기 v2의 앱 설정 되돌리기 (STAGE1_DESIGN.md 4.6b 「앱 설정 고정 표」). After the programs are installed, each table
// file from the kit — already filtered on the old PC, filtered and checked once more here — goes in place, only when the
// app is installed and only when no file is there yet (never replaced). Otherwise, and for 「따로만」 entries, it goes into
// 「따로 둔 것\앱 설정」. The kit carries no originals (Fable 5.2 설계 검토 D1 · D2, 11-16).
const fs = require('node:fs/promises');
const path = require('node:path').win32;
const crypto = require('node:crypto');
const apps = require('./move-apps.cjs');
const plan = require('./move-plan.cjs');

/** Writes `bytes` as a new file `target` through the host: a temporary file in the same folder, then a name without
 *  replacing anything (src-tauri/src/files.rs). `{ result, path }` or `{ skip }`. */
async function putFile(ctx, target, bytes, mtimeMs = Date.now()) {
  const dir = path.dirname(target);
  const ready = await ctx.host('files.mkdirs', [dir]).catch(e => ({ ok: false, skip: e.message }));
  if (!ready?.ok) return { skip: ready?.skip || 'MOVE_MKDIR' };
  // Its own number range (900000000 +), so it never meets a file the move itself is writing under the same move id.
  const temp = path.join(dir, `~synk-${ctx.moveId}-${900000000 + ++ctx.n}.part`);
  await fs.writeFile(temp, bytes, { flag: 'wx', mode: 0o600 });
  const at = mtimeMs / 1000; await fs.utimes(temp, at, at);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  try { return await ctx.host('files.place', [{ temp, target, size: bytes.length, mtimeMs: Math.round(mtimeMs), sha256 }]); }
  catch (e) { await ctx.host('files.discard', [temp]).catch(() => {}); return { skip: e.message }; }
}
function where(now, entry, file) {
  const base = now.known?.[entry.base]?.path; if (!base) return null;
  const rel = entry.path.replace('*', file.version || '*');
  if (rel.includes('*')) return null;
  return file.rel ? path.join(base, rel, file.rel) : path.join(base, rel);
}
/**
 * Puts the kit's app settings back. `installed` is the set of winget ids now on this PC; `mapPath(oldPath)` gives where
 * the move put an old folder (Obsidian's vaults), or null. Returns one result per app for the 「결과」 screen.
 */
async function restoreSettings({ kit, host, now, installed = new Set(), moveId, mapPath = () => null }) {
  if (!/^[0-9a-f]{8,32}$/.test(moveId)) throw new Error('옮겨 오기 번호가 올바르지 않습니다.');
  const ctx = { host, moveId, n: 0 };
  const side = path.join(plan.places(now).side, '앱 설정');
  const out = [];
  const names = new Set([...(kit?.apps || []).map(a => a.app), ...(kit?.left || []).map(l => l.app)]);
  for (const name of names) {
    const setting = apps.TABLE.settings.find(s => s.app === name); if (!setting) continue;
    const app = (kit.apps || []).find(a => a.app === name) || { files: [] };
    const result = { app: setting.app, name: setting.name, restored: [], kept: [], side: [], notInstalled: false, dropped: 0, droppedProfiles: [], extensions: [], instructions: false, failed: [],
      // 「열쇠로 보이는 글이 있어 옮기지 않았습니다」 · 「읽지 못했습니다」 · 「파일이 너무 많아 옮기지 않았습니다」
      left: (kit.left || []).filter(l => l.app === name).map(l => ({ entry: l.entry, rel: l.rel, why: l.why })) };
    const ready = setting.program === null || installed.has(setting.program);
    for (const file of app.files) {
      const entry = setting.entries.find(e => e.id === file.entry); if (!entry) continue;
      const target = where(now, entry, file); if (!target) continue;
      const sideTarget = path.join(side, setting.name, entry.path.replace('*', file.version || ''), ...(file.rel ? [file.rel] : []));
      const aside = async bytes => { const put = await putFile(ctx, sideTarget, bytes, file.mtime ?? Date.now()); if (put.skip) { result.failed.push({ path: sideTarget, code: put.skip }); return null; } return put.path; };
      result.dropped += file.dropped || 0; result.droppedProfiles.push(...(file.droppedProfiles || []));
      if (entry.filter === 'extension-list') { const f = apps.filtered(entry, file.data); result.extensions.push(...(f?.list || []).map(id => ({ id, command: `${entry.command} ${id}` }))); continue; }
      // Obsidian: only vaults whose folder is on this PC now.
      let context = {};
      if (entry.filter === 'obsidian-vaults') {
        const value = (() => { try { return apps.parseJsonc(file.data.toString('utf8')); } catch { return null; } })();
        const olds = Object.values(value?.vaults || {}).map(v => v?.path).filter(p => typeof p === 'string');
        const mapped = olds.map(p => [p, mapPath(p)]).filter(([, q]) => q);
        const probe = await plan.probeAll(host, mapped.map(([, q]) => q));
        const there = new Map(mapped.filter((_, i) => probe[i]?.kind === 'dir'));
        context = { mapPath: p => there.get(p) || null };
      }
      const f = apps.filtered(entry, file.data, context);
      if (!f) continue;
      if (f.left) { result.left.push({ entry: entry.id, rel: file.rel, why: f.left }); continue; }
      if (f.side) { const p = await aside(f.bytes); if (p) result.side.push(p); continue; }
      if (!f.bytes) continue;
      if (!ready) { result.notInstalled = true; const p = await aside(f.bytes); if (p) result.side.push(p); continue; }
      const [seen] = await host('files.probe', [[target]]);
      if (seen?.kind !== 'missing') { result.kept.push(target); const p = await aside(f.bytes); if (p) result.side.push(p); continue; } // 새 PC에 이미 있어 덮지 않았습니다
      const placed = await putFile(ctx, target, f.bytes);
      if (placed.skip) { result.failed.push({ path: target, code: placed.skip }); continue; }
      result.restored.push(placed.path);
      if (f.droppedProfiles) result.droppedProfiles.push(...f.droppedProfiles);
      if (entry.note === 'instructions') result.instructions = true;
    }
    out.push(result);
  }
  return out;
}
module.exports = { restoreSettings, putFile };

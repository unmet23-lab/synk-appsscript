import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createImportOperations } from '../operations.mjs';

const source = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
const commitSource = source.slice(source.indexOf('async function commit('), source.indexOf('function stopRecording('));
const clickSource = source.slice(source.indexOf("document.addEventListener('click',async event=>"), source.indexOf("document.addEventListener('change',async event=>"));
function fixture() {
  const changes = [], notices = [], operations = createImportOperations(), operation = operations.begin(''); let click;
  const c = {
    album: { pages: ['original account album'] }, imported: { album: { pages: ['file album'] }, operation }, accountVersion: 1,
    busy: false, importSaving: false, renderVersion: 1, location: { hash: '' }, importOperations: operations,
    notebook: { active: true, canEdit: false, change: value => { changes.push(value); return false; } },
    validateAlbum: value => structuredClone(value), document: { addEventListener: (_name, callback) => { click = callback; } },
    hasUnsaved: () => false, setImportSaving: value => { c.importSaving = value; },
    formDrafts: { clearAll() {} }, go() { c.imported = null; }, message: text => notices.push(text),
  };
  vm.createContext(c); vm.runInContext(commitSource + clickSource, c);
  const button = { id: 'confirm-import', dataset: {} };
  return { c, changes, notices, confirm: () => click({ target: { closest: selector => selector === 'button' ? button : null } }) };
}

test('the outside-main import dialog cannot replace the album while account editing is paused', async () => {
  const f = fixture(); await f.confirm();
  assert.deepEqual(f.c.album.pages, ['original account album']); assert.deepEqual(f.changes, []);
  assert.deepEqual(f.c.imported.album.pages, ['file album']); assert.equal(f.c.busy, false); assert.equal(f.c.importSaving, false);
  assert.match(f.notices.at(-1), /계정|로그인/);
});

test('the selected import remains available after the same account is verified again', async () => {
  const f = fixture(); await f.confirm(); f.c.notebook.canEdit = true; await f.confirm();
  assert.deepEqual(f.c.album.pages, ['file album']); assert.equal(f.changes.length, 1); assert.equal(f.c.imported, null);
});

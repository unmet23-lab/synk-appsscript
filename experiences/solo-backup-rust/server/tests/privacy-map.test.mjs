// The privacy map (privacy-map.json) names, for every table and column the server keeps, the group of
// the synk.im privacy policy that discloses it (Fable 5.2 설계 검토 2026-11-17). A new table or column
// in store.mjs that the map does not name fails here, so the policy is updated the same day.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from '../store.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const source = fs.readFileSync(here('../store.mjs'), 'utf8');
const map = JSON.parse(fs.readFileSync(here('../privacy-map.json'), 'utf8'));

// The real tables and columns: a fresh database made by Store itself (schema and every migration),
// read back from SQLite — not a pattern over the source text (GPT GA1: an upper-case type or a digit
// in a column name slipped past the pattern).
function schemaColumns(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-privacy-map-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = new Store(path.join(dir, 'wb.sqlite'));
  try {
    const out = new Map();
    for (const { name } of store.all("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'")) {
      out.set(name, new Set(store.all(`pragma table_info(${name})`).map((c) => c.name)));
    }
    return out;
  } finally { store.close(); }
}

test('every table and column the server keeps has a privacy group, and the map names nothing that is gone', (t) => {
  const schema = schemaColumns(t);
  assert.ok(schema.size >= 15, 'the schema was read');
  assert.deepEqual([...schema.keys()].sort(), Object.keys(map.tables).sort(), 'tables in store.mjs = tables in the map');
  for (const [table, cols] of schema) {
    const entry = map.tables[table];
    assert.ok(map.groups[entry.group], `${table}: a known group`);
    if (entry.group === 'none') assert.ok(entry.why?.length > 5, `${table}: why it is not in the policy`);
    assert.deepEqual([...cols].sort(), Object.keys(entry.columns).sort(), `${table}: columns in store.mjs = columns in the map`);
    for (const [col, v] of Object.entries(entry.columns)) {
      const text = typeof v === 'string' ? v : v.text;
      assert.ok(typeof text === 'string' && text.length > 1, `${table}.${col}: described`);
      if (typeof v === 'object') {
        assert.ok(map.groups[v.group], `${table}.${col}: a known group`);
        // The 90-day group and the «not in the policy» group are whole-table groups: the 90-day test and the «why»
        // check read the table's group, so a column may not move into either of them (카본 끝판 A2).
        assert.ok(!['status', 'none'].includes(v.group), `${table}.${col}: a column cannot take the ${v.group} group`);
      }
    }
  }
});

test('the closed «only fixed words and numbers, 90 days» group holds exactly the tables the server prunes after 90 days', () => {
  const pruned = /pruneTelemetry\(\)\s*\{[\s\S]*?\[([^\]]*)\]/.exec(source)[1].match(/'(\w+)'/g).map((s) => s.slice(1, -1)).sort();
  const status = Object.entries(map.tables).filter(([, e]) => e.group === 'status').map(([t]) => t).sort();
  assert.deepEqual(status, pruned);
});

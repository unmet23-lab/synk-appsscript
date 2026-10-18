const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
test('reads the completed fixture count from JSON', () => {
  const settings = JSON.parse(fs.readFileSync(path.join(__dirname, '../settings.json'), 'utf8'));
  assert.equal(settings.completed, 1);
});

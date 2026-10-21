'use strict';
// Preserve the verified personal Platform installer in desktop/artifacts.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../..'), qa = __dirname;
const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const result = JSON.parse(fs.readFileSync(path.join(qa, 'package-result.json'))), verification = JSON.parse(fs.readFileSync(path.join(qa, 'verification.json')));
if (!verification.ok || verification.installer.sha256 !== result.installer.sha256) throw Error('Verified installer required');
const source = path.join(root, result.installer.path), destination = path.join(root, 'desktop/artifacts/platform-pulse-20261011');
if (fs.existsSync(destination)) throw Error('Preserve previous delivery folder');
if (hash(source) !== result.installer.sha256) throw Error('Installer changed');
fs.mkdirSync(destination, { recursive: true });
const target = path.join(destination, path.basename(source)); fs.linkSync(source, target);
if (hash(target) !== result.installer.sha256) throw Error('Delivery bytes differ');
const manifest = { createdAt: new Date().toISOString(), version: result.version, purpose: 'PULSE client catalog and sidebar benefits cleanup, personal PC reinstall',
  localPersonalUseOnly: true, installerExecuted: false, publicUpload: false, files: [{ clientId: 'platform', deliveryPath: target, bytes: result.installer.bytes, sha256: result.installer.sha256, linkType: 'HardLink' }] };
for (const file of [path.join(destination, 'delivery-manifest.json'), path.join(qa, 'delivery-manifest.json')]) fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, target, bytes: result.installer.bytes }));

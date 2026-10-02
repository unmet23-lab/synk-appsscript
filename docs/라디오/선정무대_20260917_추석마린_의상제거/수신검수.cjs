'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const dir = __dirname;
const root = path.resolve(dir, '..', '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
if (!manifest.broadcast?.videoId) throw new Error('manifest에 현재 방송 ID가 없다.');

const source = path.join(root, 'tools/라디오수신검수.cjs');
const anchor = "const out=path.resolve(__dirname,'../docs/_ops/라디오생동_20260909/'+version);";
const oldUrl = 'https://www.youtube.com/watch?v=eI-5vSy5mjY';
const newUrl = 'https://www.youtube.com/watch?v=' + manifest.broadcast.videoId;
let code = fs.readFileSync(source, 'utf8');
if (code.split(anchor).length !== 2) throw new Error('공통 수신 검수 통로가 바뀌었다.');
if (code.split(oldUrl).length !== 2) throw new Error('공통 수신 검수의 URL 지점이 바뀌었다.');
code = code.replace(anchor, 'const out=' + JSON.stringify(dir) + ';').replace(oldUrl, newUrl);
const runner = new Module(source, module);
runner.filename = source;
runner.paths = Module._nodeModulePaths(path.dirname(source));
runner._compile(code, source);

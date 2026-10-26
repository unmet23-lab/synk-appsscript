// 인스타 올리기(시험용 가짜): node 올리기.mjs <글 파일> — 올린 글은 올린기록.txt에 남는다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const file = process.argv[2];
if (!file || !fs.existsSync(file)) { console.error('사용: node 올리기.mjs <글 파일>'); process.exit(2); }
const log = path.join(path.dirname(fileURLToPath(import.meta.url)), '올린기록.txt');
fs.appendFileSync(log, `[${new Date().toISOString()}] 올림: ${path.basename(file)}\n${fs.readFileSync(file, 'utf8')}\n---\n`);
console.log('인스타에 올렸어요: ' + path.basename(file));

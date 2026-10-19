// 작업본 여행 서버(experiences/path-travel/server.mjs)를 이 프로세스 안에서 잠깐 띄우고, 받은 명령들을 차례로 돌린 뒤 끈다.
// 오래 띄워 둔 서버는 띄울 때의 공개 파일 목록·CSP를 들고 있어 나중에 더한 파일(워커)을 404로 준다 — 확인·측정은 새로 띄워서 한다.
// 사용: node with-server.mjs <포트> '<JSON: [["node","도구.cjs","{url}","출력폴더", …], …]>'  — {url}은 http://127.0.0.1:<포트>/
import { spawn } from 'node:child_process';
const { createServer } = await import(new URL('../../../server.mjs', import.meta.url));
const server = createServer({ port: Number(process.argv[2]) });
await server.start();
const url = `http://127.0.0.1:${server.address().port}/`;
console.log('server', url);
for (const command of JSON.parse(process.argv[3])) {
  const [file, ...args] = command.map(part => part.replaceAll('{url}', url));
  const code = await new Promise(resolve => spawn(file, args, { stdio: 'inherit' }).once('exit', resolve));
  console.log('exit', code, command.slice(1, 2).join(' '));
}
await server.stop();
process.exit(0);

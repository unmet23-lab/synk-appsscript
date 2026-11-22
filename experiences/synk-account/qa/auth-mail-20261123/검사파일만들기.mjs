// 몽골어 검사용 파일을 만든다. 틀의 자리 값은 보기 값으로 바꿔 검사한다.
import { writeFileSync } from 'node:fs';
import { 글 } from './틀.mjs';
const 보기 = (s) => s.replace(/\{\{ if eq \.Provider "google" \}\}Google\{\{ else \}\}\{\{ \.Provider \}\}\{\{ end \}\}/g, 'Google')
  .replaceAll('{{ .OldEmail }}', 'old@example.com').replaceAll('{{ .Email }}', 'name@example.com');
for (const [이름, g] of Object.entries(글)) writeFileSync(new URL(`./몽골어검사/${이름}.txt`, import.meta.url), `${보기(g.ko.join(' '))}\n---\n${보기(g.mn)}\n`);

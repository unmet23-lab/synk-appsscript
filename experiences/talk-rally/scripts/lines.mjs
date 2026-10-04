// 음성으로 구울 몽글의 말 목록(연습 + 원고)을 JSON으로 내보낸다. generate-voice.py가 읽는다.
import { ITEMS, PRACTICE } from '../content.mjs';
process.stdout.write(JSON.stringify([PRACTICE, ...ITEMS].map((x) => ({ id: x.id, text: x.line }))));

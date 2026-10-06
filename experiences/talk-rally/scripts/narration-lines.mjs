// 안내 음성(나레이션)으로 구울 문장 목록(narration.mjs)을 JSON으로 내보낸다. generate-narration.py가 읽는다.
import { NARRATION_LINES } from '../narration.mjs';
process.stdout.write(JSON.stringify(NARRATION_LINES.map((x) => ({ id: x.id, text: x.text }))));

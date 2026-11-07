import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// 판 1b Fable 다시 검수(pulse-room-1b-20261107-s3) 후속: 다시 고르기에 붙어 가는 말 보이기 · 휴대폰 오류 상자 여백 · 사진 상품 「제품만」 접수증.
const read=name=>readFileSync(new URL('./public/pulse-app/'+name,import.meta.url),'utf8');
test('다시 고르기: 앞서 덧붙인 말이 접혀 있어도 한 줄로 보이고 단추가 「덧붙인 말 고치기」가 된다',()=>{
  const src=read('film-views.mjs');
  // 판 3(판 2 Fable FA1): 「덧붙인 말 고치기」를 열면 같은 말을 입력 칸이 보이므로 이 줄은 숨는다.
  assert.match(src,/keep\?`<p class="sx-small sx-dp-kept" \$\{noteOpen\?'hidden':''\}>덧붙이신 말 · \$\{esc\(keep\)\}<\/p>`:''/);
  assert.match(src,/if\(act==='note'\)\{toggle\('note',\$\('\[data-dp-note\]'\),what,\[\]\);const kept=\$\('\.sx-dp-kept'\);if\(kept\)kept\.hidden=!!ui\.note;/);
  assert.match(src,/\$\{keep\?'덧붙인 말 고치기':'한마디 덧붙이기'\}/);
});
test('휴대폰 방향 화면: 오류 상자가 앞서면 제목 위 여백을 한 번만 둔다',()=>{
  assert.match(read('film.css'),/\.sx-dp-sheet>\.sx-alert\+\.sx-dp-top\{padding-top:14px\}/);
});
test('사진 상품 접수증: 「사람 없이 제품만」이면 첫 장도 제품만',()=>{
  assert.match(read('request-flow.mjs'),/\(a\.modelChoice==='none'\?'제품만 담은 첫 장':'모델이 제품을 든 첫 장'\)\+'으로 방향을 맞춰요\./);
});

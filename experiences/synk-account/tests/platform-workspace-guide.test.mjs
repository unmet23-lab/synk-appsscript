// 웹 계정 화면의 Workspace 안내(PC 0.5.0 최종 화면 검수 후속 F5, 11-20).
// 0.5.0이 PC 앱 안의 Workspace 설치 화면을 거뒀고 synk.im에는 Workspace 설치 파일을 받는 곳이 없다.
// 그래서 웹 계정 화면의 안내는 모두 「회사에서 안내받은 Workspace 주소로 브라우저에서 열어요」로 맞추고, PC 미설치 안내(desktop/renderer/launcher.mjs)도 같은 말을 쓴다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const platform = fs.readFileSync(new URL('../src/platform.mjs', import.meta.url), 'utf8');
const launcher = fs.readFileSync(new URL('../../../desktop/renderer/launcher.mjs', import.meta.url), 'utf8');
const SAY = '회사에서 안내받은 Workspace 주소로 브라우저에서 열';

test('no web account words point at the Workspace installer that 0.5.0 removed from the PC app', () => {
  for (const old of ['설치 파일 준비', '설치 시작', 'Workspace는 그 안에서 골라 설치', 'PC 앱 안에서 설치하는 앱', 'Workspace는 PC 앱 안에서 설치', 'SYNK PC 앱 안에서 골라 설치'])
    assert.ok(!platform.includes(old), old);
});

test('PC 앱 받기, the help page, the 여는 법 window and the PC toast say the same way to open Workspace', () => {
  assert.match(platform, /heading\('PC 앱 받기','SYNK PC 앱을 받아 설치해요\. Workspace는 회사에서 안내받은 Workspace 주소로 브라우저에서 열어요\./);
  assert.match(platform, /<h2>2\. Workspace는 브라우저에서 열어요\.<\/h2><p>Workspace는 회사에서 안내받은 Workspace 주소로 브라우저에서 열어요\./);
  assert.match(platform, /modal\('Workspace 여는 법','Workspace는 회사에서 안내받은 Workspace 주소로 브라우저에서 열어요\. Workspace 앱을 이미 설치한 PC에서는 SYNK PC 앱에서 열 수 있어요\.'\)/);
  assert.match(platform, /button\('여는 법','install-info',app\.id,'plain'\)/);
  // 휴대폰에서 열어도 맞게 「이 PC」라고 가리키지 않는다(카본 B2)
  assert.ok(!/이 PC에 Workspace/.test(platform));
  // PC 0.5.9부터 「작업실 열기」는 설치한 앱을 찾지 않고 창 안 Workspace를 연다(4단계 구현설계 14.1). 앱이 없을 때 · 못 띄울 때의 알림도 함께 사라졌다
  assert.equal(launcher.split(SAY).length - 1, 0, 'the PC opens Workspace inside its window, so no toast sends people to the browser');
  assert.ok(!/Workspace 앱을 (설치|찾지)/.test(launcher));
  assert.ok(!launcher.includes('다시 설치해 주세요'));
});

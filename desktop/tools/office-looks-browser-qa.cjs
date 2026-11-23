'use strict';
// 사무실 꾸미기(docs/디자인/솔리오_사무실스킨_20261123/PC앱_설계.md)의 실제 화면 흐름. orb-face-browser-qa.cjs 안에서 합성 다리로 돈다.
//   ORB_QA_ONLY=office-looks node desktop/tools/orb-face-browser-qa.cjs <결과 폴더>
// 스킨 바꾸기, 직원 고르기, 모자 씌우기와 벗기기, 이름 바꾸기와 되돌리기를 누르고, 본체에 간 값과 줄 · 그림을 본다. 캡처는 1440 × 900과 420 × 760이다.
module.exports = async function checkOfficeLooks({ open, boot, signedIn, subsNone, until, wait, click, capture, check, calls }) {
  const MKT = 'C:\\qa\\문서\\마케팅', SHOP = 'C:\\qa\\코드\\shop';
  const depts = [{ id: 'qmkt', name: '마케팅부', folder: MKT }, { id: 'qdev', name: '개발부', folder: SHOP }, { id: 'qlaw', name: '법무부', folder: 'C:\\qa\\문서\\계약' }];
  const sessions = [
    { id: 'sess-qa-mkt-01', cwd: MKT, kind: 'work', ago: 20e3, toolName: 'Write', detail: '블로그_11월.md' },
    { id: 'sess-qa-mkt-02', cwd: MKT + '\\보고서', kind: 'work', ago: 50e3, toolName: 'Edit', detail: '보고서.md' },
    { id: 'sess-qa-mkt-03', cwd: MKT, kind: 'done', ago: 90e3, toolName: 'Read', detail: '메모.md' },
    { id: 'sess-qa-dev-01', cwd: SHOP, kind: 'ask', ago: 180e3, toolName: 'Bash', detail: 'npm' },
    { id: 'sess-qa-dev-02', cwd: SHOP + '\\api', kind: 'work', ago: 30e3, toolName: 'Edit', detail: 'server.js' },
    { id: 'sess-qa-lob-01', cwd: 'C:\\qa\\회의록', kind: 'work', ago: 40e3, toolName: 'Read', detail: '회의록_1118.txt', helpers: 2 },
  ];
  const board = settings => ({ available: true, departments: JSON.parse(JSON.stringify(depts)), sessions, assignments: {}, settings: { view: 'tilted', manualCap: null, skin: 'black', looks: {}, ...settings }, roots: { claude: ['C:\\Users\\qa\\.claude'], codex: [], added: [] }, pc: { cores: 16, totalMemGb: 31.7, freeMemGb: 19, cpuPercent: 38 } });
  const ROOM = "document.querySelector('#portal-entry [data-room=solio-office]')";
  const LOOK = '#portal-entry [data-off-rows] button.row[data-key="look"]';
  const press = (w, sel) => w.js(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)return false;el.focus({preventScroll:true});el.click();return true;})()`);
  const saved = w => w.js('window.__orbFixture.office()?.settings||null');
  // 꾸미기 줄이 접혀 있을 때만 누른다(위쪽 줄을 열면 아래 줄은 접힌다)
  const openLook = async w => { if (!(await w.js(`!!document.querySelector(${JSON.stringify(LOOK)})?.classList.contains('opened')`))) await press(w, LOOK); await wait(700); };
  const lookRow = w => w.js("(()=>{const r=" + ROOM + ",b=r.querySelector('[data-off-rows] button.row[data-key=look]'),m=b?.nextElementSibling;return {mid:b?.querySelector('.mid')?.textContent||'',open:b?.classList.contains('opened'),picks:m?[...m.querySelectorAll('[data-pick]')].map(p=>p.getAttribute('aria-label')+':'+[...p.querySelectorAll('[aria-pressed=true]')].map(q=>q.textContent).join(',')):[],field:m?.querySelector('input')?.value??null,hint:m?.querySelector('.fld .hint')?.textContent||'',live:m?.querySelector('.more-live')?.textContent||''};})()");
  const staffLines = w => w.js("[..." + ROOM + ".querySelectorAll('.row.staff')].map(r=>r.dataset.staff+'|'+r.querySelector('.nm').firstChild.textContent+'|'+(r.querySelector('.nm small')?.textContent||''))");
  const lit = w => w.js("(()=>{const c=" + ROOM + ".querySelector('[data-off-floor]'),x=c.getContext('2d'),d=x.getImageData(0,0,c.width,c.height).data;let warm=0,lit=0;for(let i=0;i<d.length;i+=4){if(d[i]>20)lit++;if(d[i]>d[i+2]+12&&d[i]>28)warm++;}return {lit,warm};})()");
  const sizes = [[1440, 900], [420, 760]];
  const shoot = async (w, name) => { for (const [W, Hh] of sizes) { w.win.setContentSize(W, Hh); for (let i = 0; i < 40 && (await w.js('innerWidth')) !== W; i++) await wait(50); await wait(520); await w.js(ROOM + '.scrollTop=0'); await wait(120); await capture(w, `${name}-${W}x${Hh}`); } w.win.setContentSize(1440, 900); await wait(400); };

  const w = await open();
  await boot(w, { subs: subsNone, office: board() }, { restore: signedIn('none') });
  await until(w, s => s.mode === 'app' && s.ui === 'app', { timeout: 12000 });
  await wait(1200);
  await click(w, '#portal-entry [data-orb-prog="office"]');
  await wait(1400);
  const black = await lit(w);
  const r0 = await lookRow(w);
  check('looks: the 꾸미기 row stands with the black skin and no hats', r0.mid === '검정' && !r0.open, r0);
  // 자리는 부서마다 시작 시각 차례다: 마케팅부 1번은 가장 먼저 연 sess-qa-mkt-03이다. 꾸밀 직원은 부서 줄 차례이고 첫 직원이 골라져 있다
  await shoot(w, 'looks-black');

  // 스킨: 호두나무 서재. 그림이 따뜻한 색으로 바뀌고 본체에 저장된다
  await openLook(w);
  await press(w, LOOK + ' + .more [data-pv="walnut"]'); await wait(1400);
  const s1 = await saved(w), warm = await lit(w);
  check('looks: picking 호두나무 서재 saves the skin and the floor turns warm', s1?.skin === 'walnut' && (await calls(w)).includes('office-settings:{"skin":"walnut"}') && warm.warm > black.warm + 5000, { s1, black, warm });

  // 모자: 마케팅부 1번에게 니트 비니, 개발부 1번에게 갓, 부서 없는 일 1번에게 새싹
  await press(w, LOOK + ' + .more [data-pv="d:qmkt:0|beanie"]'); await wait(900);
  await press(w, LOOK + ' + .more [data-pv="d:qdev:0"]'); await wait(700);
  await press(w, LOOK + ' + .more [data-pv="d:qdev:0|gat"]'); await wait(900);
  await press(w, LOOK + ' + .more [data-pv="lobby:0"]'); await wait(700);
  await press(w, LOOK + ' + .more [data-pv="lobby:0|sprout"]'); await wait(900);
  await press(w, LOOK + ' + .more [data-pv="d:qmkt:1"]'); await wait(700);
  await press(w, LOOK + ' + .more [data-pv="d:qmkt:1|phones"]'); await wait(900);
  const s2 = await saved(w), r2 = await lookRow(w);
  check('looks: hats go to the seat that was picked, one by one', JSON.stringify(s2?.looks) === JSON.stringify({ 'd:qmkt:0': { hat: 'beanie' }, 'd:qdev:0': { hat: 'gat' }, 'lobby:0': { hat: 'sprout' }, 'd:qmkt:1': { hat: 'phones' } }) && r2.mid === '호두나무 서재 · 모자 쓴 직원 넷', { looks: s2?.looks, r2 });
  check('looks: the hat line follows the picked staff and the say line names them', r2.picks.includes('모자:헤드폰') && r2.picks.includes('마케팅부:2번') && r2.live === '마케팅부 2에게 헤드폰을 씌웠습니다.', r2);
  await capture(w, 'looks-row-open');

  // 이름: 마케팅부 1번을 「서진」으로. 줄의 칸은 비어 있고 처음 이름은 작은 글이다
  await press(w, LOOK + ' + .more [data-pv="d:qmkt:0"]'); await wait(700);
  const r3 = await lookRow(w);
  check('looks: a staff without a name has an empty field and the first name as the hint', r3.field === '' && r3.hint === '비우면 「마케팅부 1」 · 12자까지', r3);
  await w.js("(()=>{const i=" + ROOM + ".querySelector('[data-off-rows] button.row[data-key=look] + .more input');i.focus();i.value='서진';i.dispatchEvent(new Event('input',{bubbles:true}));return true;})()");
  await press(w, LOOK + ' + .more [data-room-act="look-rename"]'); await wait(1000);
  const s3 = await saved(w), r4 = await lookRow(w);
  check('looks: renaming saves the name on that seat only and says so', s3?.looks?.['d:qmkt:0']?.name === '서진' && s3?.looks?.['d:qmkt:0']?.hat === 'beanie' && r4.live === '이름을 「서진」으로 바꿨습니다.' && r4.field === '서진' && r4.picks.includes('마케팅부:서진'), { looks: s3?.looks, r4 });
  await press(w, '#portal-entry [data-off-rows] button.row[data-key="d:qmkt"]'); await wait(900);
  const lines = await staffLines(w);
  check('looks: the department row calls the renamed staff by the name, with the tool small', lines.includes('sess-qa-mkt-03|서진|Claude Code') && lines.includes('sess-qa-mkt-02|Claude Code|'), { lines });
  await shoot(w, 'looks-walnut-hats');

  // 되돌리기: 칸을 비우고 누르면 처음 이름으로. 모자 벗기기
  await openLook(w);
  await press(w, LOOK + ' + .more [data-pv="d:qmkt:0"]'); await wait(600);
  await w.js("(()=>{const i=" + ROOM + ".querySelector('[data-off-rows] button.row[data-key=look] + .more input');i.focus();i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));return true;})()");
  await press(w, LOOK + ' + .more [data-room-act="look-rename"]'); await wait(1000);
  await press(w, LOOK + ' + .more [data-pv="d:qmkt:1"]'); await wait(600);
  await press(w, LOOK + ' + .more [data-pv="d:qmkt:1|none"]'); await wait(900);
  const s4 = await saved(w), r5 = await lookRow(w);
  check('looks: clearing the name goes back to the first name, and taking off a hat empties the seat', JSON.stringify(s4?.looks) === JSON.stringify({ 'd:qmkt:0': { hat: 'beanie' }, 'd:qdev:0': { hat: 'gat' }, 'lobby:0': { hat: 'sprout' } }) && r5.live === '마케팅부 2의 모자를 벗겼습니다.', { looks: s4?.looks, r5 });

  // 다시 열기: 저장된 스킨과 모자로 바로 그린다(겹쳐 넘어가지 않는다)
  w.win.destroy();
  const v = await open();
  await boot(v, { subs: subsNone, office: board({ skin: 'walnut', looks: s4.looks }) }, { restore: signedIn('none') });
  await until(v, s => s.mode === 'app' && s.ui === 'app', { timeout: 12000 });
  await wait(1200);
  await click(v, '#portal-entry [data-orb-prog="office"]');
  await wait(300);
  const early = await lit(v);
  await wait(1200);
  const later = await lit(v);
  check('looks: reopening draws the saved walnut room at once', early.warm > 5000 && Math.abs(later.warm - early.warm) < Math.max(4000, early.warm * 0.15), { early, later });
  // 위에서 보기에서도 모자와 등이 그려진다
  await press(v, '#portal-entry [data-off-rows] button.row[data-key="cfg"]'); await wait(600);
  await press(v, '#portal-entry [data-off-rows] button.row[data-key="cfg"] + .more [data-pv="top"]'); await wait(1400);
  await capture(v, 'looks-walnut-top');
  v.win.destroy();
};

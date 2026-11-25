'use strict';
// 부서별 책상(docs/디자인/솔리오_사무실책상_20261125/README.md)의 실제 화면 흐름. orb-face-browser-qa.cjs 안에서 합성 다리로 돈다.
//   ORB_QA_ONLY=office-desks node desktop/tools/orb-face-browser-qa.cjs <결과 폴더>
// 직원이 늘어 책상이 느는지, 「책상」 줄에서 크기 · 수 · 재질을 누르면 본체에 그 값만 가고 그림이 바뀌는지, 다른 부서에 번지지 않는지, 다시 열어도 그대로인지 본다.
module.exports = async function checkOfficeDesks({ open, boot, signedIn, subsNone, until, wait, click, capture, check, calls }) {
  const NAMES = [['qmkt', '마케팅부'], ['qdev', '개발부'], ['qlaw', '법무부'], ['qdsn', '디자인부'], ['qacc', '회계부'], ['qcs', '고객지원부']];
  const folder = id => 'C:\\qa\\' + id;
  const depts = NAMES.map(([id, name]) => ({ id, name, folder: folder(id) }));
  const people = (id, n, kind = 'work') => Array.from({ length: n }, (_, i) => ({ id: `sess-${id}-${String(i).padStart(3, '0')}`, cwd: folder(id), kind: typeof kind === 'function' ? kind(i) : kind, ago: 20e3 + i * 1000, toolName: 'Edit', detail: '파일' + i + '.md' }));
  const board = (counts, patch = {}) => ({ available: true, departments: JSON.parse(JSON.stringify(depts)), sessions: Object.entries(counts).flatMap(([id, n]) => people(id, n, i => (i % 5 === 4 ? 'done' : 'work'))), assignments: {}, settings: { view: 'tilted', manualCap: null, skin: 'black', looks: {} }, roots: { claude: ['C:\\Users\\qa\\.claude'], codex: [], added: [] }, pc: { cores: 16, totalMemGb: 31.7, freeMemGb: 19, cpuPercent: 38 }, ...patch });
  const ROOM = "document.querySelector('#portal-entry [data-room=solio-office]')";
  const press = (w, sel) => w.js(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)return false;el.focus({preventScroll:true});el.click();return true;})()`);
  const chat = (w, key) => press(w, `#portal-entry [data-off-chats] > [data-chat="${key}"]`);
  const setBoard = async (w, b) => { await w.js('window.__orbFixture.setOffice(' + JSON.stringify(b) + ')'); await wait(1300); };
  const row = w => w.js("(()=>{const r=" + ROOM + ",b=r.querySelector('[data-off-rows] [data-room-act=grp][data-room-arg=desk]'),g=b?.nextElementSibling;return {mid:b?.querySelector('.mid')?.textContent||'',open:b?.getAttribute('aria-expanded')||'',shown:g?.dataset.grp==='desk'&&!g.hidden,picks:g?[...g.querySelectorAll('[data-pick]')].map(p=>p.getAttribute('aria-label')+':'+[...p.querySelectorAll('[aria-pressed=true]')].map(q=>q.textContent).join(',')):[],live:[...r.querySelectorAll('[data-off-rows] .more-live')].map(n=>n.textContent).filter(Boolean).join('|'),dense:r.querySelector('[data-off-slot]').classList.contains('dense'),slot:Math.round(r.querySelector('[data-off-slot]').getBoundingClientRect().height)};})()");
  const saved = w => w.js('window.__orbFixture.office()?.departments||null');
  const settings = async w => (await calls(w)).filter(c => c.startsWith('office-settings:'));
  // 그림에서 따뜻한 점(호두나무)과 켜진 점을 센다
  const pixels = w => w.js("(()=>{const c=" + ROOM + ".querySelector('[data-off-floor]'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let warm=0,lit=0;for(let i=0;i<d.length;i+=4){if(d[i]>20)lit++;if(d[i]>d[i+2]+18&&d[i]>34)warm++;}return {lit,warm,w:c.width,h:c.height};})()");
  const overflow = w => w.js("(()=>{const r=" + ROOM + ",vis=n=>!n.closest('[hidden]')&&n.getClientRects().length>0;return Math.max(document.documentElement.scrollWidth-innerWidth,r.scrollWidth-r.clientWidth,...[...r.querySelectorAll('.ofc-list,.ofc-center,.ofc-side')].filter(vis).map(n=>n.scrollWidth-n.clientWidth));})()");
  const shoot = async (w, name, sizes = [[1440, 900], [1180, 860], [960, 680], [1920, 1080], [420, 760]]) => {
    const over = [], thread = [];
    for (const [W, H] of sizes) {
      w.win.setContentSize(W, H);
      for (let i = 0; i < 40 && (await w.js('innerWidth')) !== W; i++) await wait(50);
      await wait(600);
      const o = await overflow(w);
      if (o > 0) over.push({ W, H, o });
      const t = await w.js("(()=>{const r=" + ROOM + ",c=r.querySelector('.ofc-center'),n=r.querySelector('[data-off-thread]'),s=r.querySelector('[data-off-offsay]'),b=c.getBoundingClientRect();return {thread:Math.round(n.getBoundingClientRect().height),off:s.hidden||s.getBoundingClientRect().bottom<=b.bottom+1};})()");
      thread.push({ W, H, ...t });
      await capture(w, `${name}-${W}x${H}`);
    }
    w.win.setContentSize(1440, 900); await wait(400);
    check(`desks ${name}: nothing runs over sideways, and the talk below the picture keeps its place`, over.length === 0 && thread.every(t => t.thread >= 70 && t.off), { over, thread });
  };

  const w = await open();
  await boot(w, { subs: subsNone, office: board({ qmkt: 3, qdev: 2, qlaw: 1 }) }, { restore: signedIn('none') });
  await until(w, s => s.mode === 'app' && s.ui === 'app', { timeout: 12000 });
  await wait(1200);
  await click(w, '#portal-entry [data-orb-prog="office"]');
  await wait(1400);
  await chat(w, 'd:qmkt'); await wait(700);
  const r0 = await row(w);
  check('desks: a department that nothing was chosen for says one desk for three, folded', r0.mid === '3인 책상 하나' && r0.open === 'false' && !r0.shown, r0);
  await capture(w, 'desks-before-1440');

  // 직원이 늘면 책상이 는다(유호님 11-25 「마케팅부서에 인원 많이 투입되면 책상이 더 늘어나고」)
  const before = await pixels(w);
  await setBoard(w, board({ qmkt: 7, qdev: 2, qlaw: 1 }));
  const r1 = await row(w), after = await pixels(w);
  // 맡긴 일의 대화가 없으면 직원 줄은 맨 위부터 보인다(0.5.12 공개 후보 카본 B3)
  const tops = [];
  for (const key of ['all', 'd:qmkt']) { await chat(w, key); await wait(700); tops.push(await w.js("(()=>{const r=" + ROOM + ",t=r.querySelector('[data-off-thread]');return {top:t.scrollTop,over:t.scrollHeight>t.clientHeight+4,new:!r.querySelector('[data-off-new]').hidden};})()")); }
  check('desks: the staff list opens at its top, without 새 답 보기', tops.every(t => t.top === 0 && !t.new) && tops.some(t => t.over), { tops });
  check('desks: seven staff in 마케팅부 bring two more desks, and the line and the picture say so', r1.mid === '3인 책상 셋 · 직원이 늘어 둘 더 놓음' && after.lit !== before.lit, { r1, before, after });
  await shoot(w, 'desks-grown');
  // 떠나도 바로 빼지 않는다
  await setBoard(w, board({ qmkt: 2, qdev: 2, qlaw: 1 }));
  const r2 = await row(w);
  check('desks: right after they leave the desks still stand', r2.mid === '3인 책상 셋 · 빈 책상 둘은 잠시 뒤 치움', r2);

  // 「책상」 줄: 크기 · 수 · 재질
  await press(w, '#portal-entry [data-off-rows] [data-room-act="grp"][data-room-arg="desk"]'); await wait(600);
  const r3 = await row(w);
  check('desks: the row opens with size, count and finish, the present ones pressed', r3.open === 'true' && r3.shown && JSON.stringify(r3.picks) === JSON.stringify(['책상 크기:3인', '책상 수:1', '재질:사무실과 같게']), r3);
  await capture(w, 'desks-row-open-1440');
  await press(w, '#portal-entry [data-off-rows] [data-pv="qmkt|1"][data-room-act="desk-size"]'); await wait(900);
  const r4 = await row(w);
  check('desks: 1인 saves the size of this department only, and the picture follows at once', JSON.stringify(await settings(w)) === JSON.stringify(['office-settings:{"desk":{"department":"qmkt","size":1}}']) && r4.mid === '1인 책상 둘 · 직원이 늘어 하나 더 놓음' && r4.live === '1인 책상으로 바꿨습니다.' && r4.shown, { r4, calls: await settings(w) });
  await press(w, '#portal-entry [data-off-rows] [data-pv="qmkt|5"][data-room-act="desk-count"]'); await wait(900);
  const r5 = await row(w);
  check('desks: the base count is saved on its own', (await settings(w)).at(-1) === 'office-settings:{"desk":{"department":"qmkt","count":5}}' && r5.mid === '1인 책상 다섯' && r5.live === '책상을 다섯으로 정했습니다.', r5);
  const cold = await pixels(w);
  await press(w, '#portal-entry [data-off-rows] [data-pv="qmkt|walnut"][data-room-act="desk-finish"]'); await wait(1000);
  // PC가 바쁘면 프레임이 늦게 온다. 겹쳐 넘어가기가 끝난 그림을 기다린다
  let wood = await pixels(w);
  for (let i = 0; i < 12 && !(wood.warm > cold.warm + 300); i++) { await wait(300); wood = await pixels(w); }
  const r6 = await row(w);
  check('desks: 호두나무 is saved and the desks of this department turn to wood', (await settings(w)).at(-1) === 'office-settings:{"desk":{"department":"qmkt","finish":"walnut"}}' && wood.warm > cold.warm + 300 && r6.live === '호두나무 책상으로 바꿨습니다.', { r6, cold, wood });
  check('desks: the row keeps the focus on what was pressed', await w.js("document.activeElement?.dataset?.pv==='qmkt|walnut'"));
  await capture(w, 'desks-wood-1440');
  const own = await saved(w);
  check('desks: the other departments keep theirs', JSON.stringify(own.find(d => d.id === 'qmkt').desk) === JSON.stringify({ size: 1, count: 5, finish: 'walnut' }) && own.filter(d => d.desk).length === 1, own.map(d => [d.id, d.desk]));
  await chat(w, 'd:qdev'); await wait(800);
  const r7 = await row(w);
  check('desks: 개발부 has its own row, folded, unchanged', r7.mid === '3인 책상 하나' && !r7.shown, r7);
  await press(w, '#portal-entry [data-off-rows] [data-room-act="grp"][data-room-arg="desk"]'); await wait(500);
  await press(w, '#portal-entry [data-off-rows] [data-pv="qdev|2"][data-room-act="desk-size"]'); await wait(800);
  await press(w, '#portal-entry [data-off-rows] [data-pv="qdev|3"][data-room-act="desk-count"]'); await wait(800);
  await chat(w, 'd:qlaw'); await wait(700);
  await press(w, '#portal-entry [data-off-rows] [data-room-act="grp"][data-room-arg="desk"]'); await wait(500);
  await press(w, '#portal-entry [data-off-rows] [data-pv="qlaw|4"][data-room-act="desk-size"]'); await wait(1600);
  await shoot(w, 'desks-mixed');

  await chat(w, 'all'); await wait(900);
  // 그림에서 눌러 부서를 고르면 그 부서의 줄이 선다. 늘어난 호두나무 책상 가운데 맨 오른쪽을 실제 마우스로 누른다(카본 B1)
  const spot = await w.js("(()=>{const c=" + ROOM + ".querySelector('[data-off-floor]'),b=c.getBoundingClientRect(),k=c.width/b.width,d=c.getContext('2d').getImageData(0,0,c.width,c.height).data,at=[];for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(d[i]>d[i+2]+34&&d[i]>60)at.push([x,y]);}if(!at.length)return null;const xs=at.map(p=>p[0]).sort((m,n)=>m-n),right=xs[Math.floor(xs.length*0.97)],near=at.filter(p=>p[0]>right-14*k&&p[0]<right);if(!near.length)return null;const n=near.length;return {x:Math.round(b.left+near.reduce((s,p)=>s+p[0],0)/n/k),y:Math.round(b.top+near.reduce((s,p)=>s+p[1],0)/n/k)};})()");
  if (spot) { for (const type of ['mouseMove', 'mouseDown', 'mouseUp']) w.win.webContents.sendInputEvent({ type, x: spot.x, y: spot.y, button: 'left', clickCount: 1 }); await wait(900); }
  const pr = await row(w), chosen = await w.js(ROOM + ".querySelector('[data-off-chats] > [aria-current=\"true\"]')?.dataset.chat||''");
  check('desks: a press on one of the added desks in the picture picks its department', !!spot && chosen === 'd:qmkt' && pr.mid === '1인 책상 다섯', { spot, chosen, pr });
  await chat(w, 'all'); await wait(700);
  const look = await w.js("(()=>{const r=" + ROOM + ";return [...r.querySelectorAll('[data-off-rows] > button.row')].map(b=>b.dataset.key);})()");
  check('desks: 사무실 keeps its own side rows', JSON.stringify(look) === JSON.stringify(['cap', 'cfg', 'look']), { look });
  await press(w, '#portal-entry [data-off-rows] button.row[data-key="look"]'); await wait(700);
  check('desks: 꾸미기 says where desks are changed', (await w.js(ROOM + ".querySelector('[data-off-rows] button.row[data-key=look] + .more')?.textContent||''")).includes('책상은 왼쪽에서 부서를 고르면 부서마다 바꿀 수 있습니다.'));

  // 저장이 안 되면 앞 값으로
  await chat(w, 'd:qdsn'); await wait(700);
  await press(w, '#portal-entry [data-off-rows] [data-room-act="grp"][data-room-arg="desk"]'); await wait(500);
  await w.js("window.__orbFixture.failOffice('WRITE')");
  await press(w, '#portal-entry [data-off-rows] [data-pv="qdsn|4"][data-room-act="desk-size"]'); await wait(900);
  const r8 = await row(w);
  check('desks: a save that fails goes back to what stood before and says why', r8.mid === '3인 책상 하나' && r8.picks[0] === '책상 크기:3인' && r8.live === '저장하지 못했습니다. 잠시 뒤 다시 해 주세요.', r8);

  // 다시 열기: 저장된 책상으로 바로 선다
  const kept = await saved(w);
  w.win.destroy();
  const v = await open();
  await boot(v, { subs: subsNone, office: board({ qmkt: 2, qdev: 2, qlaw: 1 }, { departments: kept }) }, { restore: signedIn('none') });
  await until(v, s => s.mode === 'app' && s.ui === 'app', { timeout: 12000 });
  await wait(1200);
  await click(v, '#portal-entry [data-orb-prog="office"]');
  await wait(350);
  const early = await pixels(v);
  await wait(1300);
  const later = await pixels(v);
  check('desks: reopening stands the saved desks at once, without a fade', early.warm > 200 && Math.abs(early.warm - later.warm) < Math.max(160, later.warm * 0.15), { early, later });
  await chat(v, 'd:qmkt'); await wait(700);
  check('desks: the row says the saved desks', (await row(v)).mid === '1인 책상 다섯', await row(v));

  // 호두나무 서재 스킨, 부서 여섯에 직원 쉰과 부서 없는 일 서른셋
  const lobby = Array.from({ length: 33 }, (_, i) => ({ id: 'sess-lob-' + String(i).padStart(3, '0'), cwd: 'C:\\qa\\밖', kind: i < 17 ? 'work' : 'done', ago: i < 17 ? 30e3 : 700e3, toolName: 'Read', detail: '메모.md' }));
  const big = patch => { const b = board({ qmkt: 14, qdev: 9, qlaw: 7, qdsn: 6, qacc: 5, qcs: 9 }, { departments: kept, ...patch }); b.sessions.push(...lobby); return b; };
  await chat(v, 'all'); await wait(400);
  await setBoard(v, big({}));
  const dense = await row(v);
  check('desks: many seats make the picture taller', dense.dense && dense.slot > 231, dense);
  await shoot(v, 'desks-crowd');
  await setBoard(v, big({ settings: { view: 'tilted', manualCap: null, skin: 'walnut', looks: {} } }));
  await wait(900);
  await shoot(v, 'desks-crowd-walnut', [[1440, 900], [960, 680]]);
  await setBoard(v, big({ settings: { view: 'top', manualCap: null, skin: 'black', looks: {} } }));
  await wait(1200);
  await shoot(v, 'desks-crowd-top', [[1440, 900], [960, 680]]);
  // 한 프레임을 그리는 시간(직원 여든쯤): 그림을 다시 그리게 하며 잰다
  const ms = await v.js("(async()=>{const c=" + ROOM + ".querySelector('[data-off-floor]'),x=c.getContext('2d');const t=[];const orig=x.clearRect.bind(x);let at=0;x.clearRect=(...a)=>{at=performance.now();return orig(...a);};await new Promise(r=>{let n=0;const f=()=>{if(at){t.push(performance.now()-at);at=0;}if(++n<90)requestAnimationFrame(f);else r();};requestAnimationFrame(f);});delete x.clearRect;t.sort((a,b)=>a-b);return {n:t.length,mid:Math.round(t[Math.floor(t.length/2)]*10)/10,max:Math.round((t.at(-1)||0)*10)/10};})()");
  check('desks: the crowded picture is drawn fast enough', ms.n > 10 && ms.mid < 40, ms);
  // 부서 없이 서른셋(유호님 11-25 화면): 일하는 열일곱이 모두 보인다
  await setBoard(v, { ...board({}), departments: [], sessions: lobby });
  await shoot(v, 'desks-lobby33', [[1440, 900], [960, 680]]);
  v.win.destroy();
};

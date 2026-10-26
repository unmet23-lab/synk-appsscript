// 라운드 5: 시크릿 대화를 끝내고 새 시크릿 채팅을 연다 — 빈 화면인지 확인하고 파일을 붙인다.
const step = logger("r05");
watchdog(step, 150_000);
step("시작");
const task = await taskSpace("yuhobuilds Y9 v2 채팅 실험 1027");
const page = task.page("p1");
await phone(page);
await page.click("button[aria-label='시크릿 모드 종료']", { label: "end incognito chat" });
await page.waitForTimeout(3000);
step("종료 " + (await page.url()));
await page.goto("https://claude.ai/new");
await page.waitForLoadState();
await page.waitForTimeout(3000);
await page.click("button[aria-label='시크릿 모드 사용']", { label: "start incognito chat" });
await page.waitForTimeout(3000);
const body = await page.evaluate(() => document.body.innerText);
const fresh = body.includes("시크릿 모드입니다") && !body.includes("Claude 응답") && !body.includes("입력 내용");
step("fresh " + fresh + " " + (await page.url()));
if (!fresh) { console.log("NOT FRESH", body.slice(0, 600)); process.exit(4); }
await page.setInputFiles("input[type=file][data-testid=file-upload]", ["C:/Users/q1212/ego/y9v2-20261027/files/인스타_올리기.py"]);
await page.waitForTimeout(4000);
await shot(page, `${ROOT}/r05_fresh.jpg`);
console.log("FRESH", await page.url());
step("끝");
process.exit(0);

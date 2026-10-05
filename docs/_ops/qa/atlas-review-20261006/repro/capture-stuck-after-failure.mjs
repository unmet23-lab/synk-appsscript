// 검수 재현 스크립트(2026-10-06). 한 사례가 실패로 닫히면 캡처 도구가 그 폴더에서 30건을 끝내지 못하는 것(모의 제공자, 새로 지은 전송용 문장). 끝에 quote 또는 http 를 붙인다.
// 저장소·네트워크·유료 호출을 건드리지 않는다. 실행: node <이 파일>
// Read-only review repro: capture tool + real service, wired in-process.
// No HTTP server and no network. Dataset is a NEW synthetic transport fixture
// written by the reviewer. The frozen heldout file is never read (paths are explicit).
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const repo = fileURLToPath(new URL("../../../../../", import.meta.url)).replace(/\\/g, "/").replace(/\/$/, "");
const company = repo + "/docs/마케팅/온라인마케팅지도/engagement/company/";
const scratch = mkdtempSync(join(tmpdir(), "synk-atlas-review-"));
const { createComputerInterpretationService } = await import(pathToFileURL(company + "computer-interpretation-service.mjs").href);
const { Store } = await import(pathToFileURL(company + "store.mjs").href);
const { captureEvaluation } = await import(pathToFileURL(repo + "/tools/capture-atlas-interpretation-evaluation.mjs").href);

const dir = mkdtempSync(join(scratch, "cap-"));
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const sentence = n => "저는 웹 AI로 문서를 작성해요. (검토자 전송 시험 " + n + ")";
const dataset = { id: "computer-ko-heldout", version: "1", kind: "authored-synthetic-sources", description: "Reviewer transport fixture only.",
  fields: [{ id: "uses.web", kind: "boolean" }], cases: Array.from({ length: 30 }, (_, i) => ({
    id: "transport-" + (i + 1), tags: ["transport-only"], source: { id: "transport-source-" + (i + 1), at: "2026-10-06T00:00:00.000Z", actor: "self", text: sentence(i + 1) },
    expected: { facts: { "uses.web": true }, permittedFacts: {}, unknownFields: [], mustNotAssert: [] }, rationale: "Transport test, not accuracy evidence." })) };
const datasetBytes = JSON.stringify(dataset), datasetSha = sha(datasetBytes);
const datasetPath = join(dir, "dataset.json"), sealPath = join(dir, "seal.json"), freezePath = join(dir, "freeze.json");
writeFileSync(datasetPath, datasetBytes);
writeFileSync(sealPath, JSON.stringify({ manifestVersion: 1, frozenAt: "2026-10-06T00:00:00.000Z", dataset: { id: dataset.id, version: dataset.version, sha256: datasetSha, caseCount: 30 } }));
const freeze = JSON.parse(readFileSync(repo + "/docs/_ops/qa/atlas-model-20261005/freeze.json", "utf8"));
freeze.dataset.sha256 = datasetSha; writeFileSync(freezePath, JSON.stringify(freeze));

const store = new Store(join(dir, "company"));
const env = { SYNK_COMPUTER_AI_ENABLED: "1", SYNK_COMPUTER_AI_MODEL: "gpt-6-luna", SYNK_COMPUTER_AI_MAX_OUTPUT_TOKENS: "3000",
  SYNK_COMPUTER_AI_INPUT_PER_MILLION_MICRO_USD: "125000", SYNK_COMPUTER_AI_OUTPUT_PER_MILLION_MICRO_USD: "500000",
  SYNK_COMPUTER_AI_REQUEST_LIMIT_MICRO_USD: "10000", SYNK_COMPUTER_AI_TOTAL_LIMIT_MICRO_USD: "250000", OPENAI_API_KEY: "mock-key-not-real" };
let providerCalls = 0;
const BAD = process.argv[2] || "quote";
const provider = async (_url, options) => {
  providerCalls++;
  const source = JSON.parse(JSON.parse(options.body).input[0].content[0].text).source_text;
  const third = source === sentence(3);
  // Case 3 only: the mocked model copies the quotation loosely (drops one space).
  const quote = third && BAD === "quote" ? source.replace(". (", ".(") : source;
  if (third && BAD === "http") return new Response("{}", { status: 500 });
  return new Response(JSON.stringify({ status: "completed", model: "gpt-6-luna", usage: { input_tokens: 1200, output_tokens: 200, total_tokens: 1400 },
    output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify({
      proposals: [{ field: "uses.web", value: true, subject: "self", stance: "current", evidence: [{ quote, occurrence: 1 }] }], held: [] }) }] }] }), { status: 200 });
};
const service = createComputerInterpretationService({ store, getEnv: name => env[name], fetchImpl: provider });
const admin = store.createUser({ name: "Repro admin", email: "repro-admin@example.test", role: "admin" });

let hostPosts = 0; const hostStatuses = [];
const reply = (status, value) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(value) });
const hostFetch = async (_url, request) => {
  if (request.method === "GET") return reply(200, service.state(admin));
  hostPosts++;
  try { const result = await service.interpret(admin, JSON.parse(request.body)); hostStatuses.push("200"); return reply(200, result); }
  catch (e) { hostStatuses.push(String(e.status || 400) + ":" + String(e.code || "none")); return reply(e.status || 400, { error: e.message, code: e.code }); }
};
const captureEnv = { SYNK_COMPUTER_EVALUATION_APPROVED: "1", SYNK_COMPUTER_EVALUATION_ORIGIN: "http://127.0.0.1:4999",
  SYNK_COMPUTER_EVALUATION_SESSION_COOKIE: "in-process-stub", SYNK_COMPUTER_EVALUATION_CSRF: "in-process-stub" };
const options = { dataset: datasetPath, datasetManifest: sealPath, freezeManifest: freezePath, outputDir: join(dir, "capture"), maxCalls: 30 };

console.log("mode: case 3 fails by " + BAD);
let shown = 0, previousKey = "start";
for (let run = 1; run < 41; run++) {
  const before = hostStatuses.length;
  const r = await captureEvaluation(options, { env: captureEnv, fetchImpl: hostFetch });
  const key = "status=" + r.status + " stop=" + (r.stopCategory || "-") + " recorded=" + r.counts.recordedRuns + " missing=" + r.counts.missingRuns
    + " postsThisRun=" + r.counts.postsThisInvocation + " hostReplies=[" + hostStatuses.slice(before).join(",") + "]";
  if (key !== previousKey || run < 4) { console.log("run " + run + ": " + key + " lifetimeAttempts=" + r.counts.lifetimePostAttempts); shown++; }
  previousKey = key;
  if (r.status !== "stopped") { console.log("(loop ended at run " + run + ", lifetimeAttempts=" + r.counts.lifetimePostAttempts + ")"); break; }
}
const manifest = JSON.parse(readFileSync(join(options.outputDir, "request-manifest.json"), "utf8"));
const tally = list => JSON.stringify(list.reduce((m, q) => { m[q.status] = (m[q.status] || 0) + 1; return m; }, {}));
console.log("manifest statuses: " + tally(manifest.requests));
console.log("request 3: " + JSON.stringify({ status: manifest.requests[2].status, attempts: manifest.requests[2].attempts }) + ", request 4: " + JSON.stringify({ status: manifest.requests[3].status, attempts: manifest.requests[3].attempts }));
console.log("provider calls=" + providerCalls + ", host POSTs=" + hostPosts);
const rows = store.all("computerAIRequests");
console.log("server ledger: " + tally(rows) + ", accounted total=" + rows.reduce((n, q) => n + q.accountedMicroUSD, 0));
await service.stop(); store.close();

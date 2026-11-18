'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { 가져오기, 보고서읽기 } = require('./lib/grok-contests.cjs');
const { 클로드지도갱신 } = require('./lib/공모지도-클로드.cjs');

const 기본보관함 = path.join(os.homedir(), 'Documents', 'SYNK-보관함', '지원사업');

function 읽기(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function 브라우저수신(config, importedIds) {
  if (!/^https:\/\/grok\.com\/bot\/[0-9a-f-]{36}$/i.test(config?.botUrl) ||
      typeof config.detailsName !== 'string' || typeof config.pageTitle !== 'string' || !path.isAbsolute(config.downloadLock || '') ||
      path.basename(config.downloadLock) !== 'ego_받기.lock') {
    throw Error('공모지도.json의 비공개 그록 수집 페이지 설정을 확인해 주세요.');
  }
  const browserExe = path.join(os.homedir(), '.local', 'share', 'ego', 'active_version_dir', 'ego-browser.exe');
  const source = fs.readFileSync(path.join(__dirname, 'grok-contest-source.mjs'), 'utf8');
  const command = 'const contestSource = ' + JSON.stringify({
    botUrl: config.botUrl, detailsName: config.detailsName, pageTitle: config.pageTitle, downloadLock: config.downloadLock, importedIds,
    profileId: config.egoProfile,
  }) + ';\n' + source;
  const run = (input, timeout) => spawnSync(browserExe, ['nodejs'], {
    input, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024,
  });
  const result = run(command, 240000);
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
  const data = /^SYNKGROKDATA=([^\r\n]+)$/m.exec(output)?.[1];
  if (result.status !== 0 || !data) {
    throw Error('Ego에서 그록 수집본을 읽지 못했습니다. 로그인과 비공개 페이지를 확인해 주세요.' +
      (result.error ? ' ' + result.error.code : ''));
  }
  return JSON.parse(data);
}

function PC지도생성(folder, map) {
  const rendered = spawnSync(process.execPath, [
    path.join(__dirname, '공모지도.js'), '--보관함', folder, '--출력', map,
  ], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (rendered.status !== 0 || !fs.existsSync(map)) {
    throw Error('PC 공모 지도를 만들지 못했습니다. ' + (rendered.error?.message || rendered.stderr || '').trim());
  }
}

async function 지도동기화(folder, config, { 수신 = 브라우저수신, 웹갱신 = 클로드지도갱신 } = {}) {
  const map = path.join(folder, '공모지도.html');
  const summary = { map, reports: null, imported: 0, candidates: 0, failedReports: [] };
  try {
    const feed = await 수신(config.grok, 보고서읽기(folder).map(report => report.reportId));
    if (!(feed.receipts > 0) || !Array.isArray(feed.reports) || feed.reports.length > 24 ||
        (feed.failures != null && !Array.isArray(feed.failures))) {
      throw Error('그록 수집 페이지의 회차 목록 형식이 맞지 않습니다.');
    }
    summary.reports = feed.receipts;
    summary.failedReports = [...(feed.failures || [])];
    for (const report of feed.reports) {
      try {
        const result = await 가져오기(folder, report);
        if (!result.already) {
          summary.imported++;
          summary.candidates += result.items.length;
        }
      } catch (error) {
        const reportId = report?.reportId || '회차 미상';
        summary.failedReports.push(reportId);
        (summary.importErrors ??= []).push({ reportId, message: error.message });
      }
    }
  } catch (error) {
    summary.grokError = error.message;
  }
  try {
    PC지도생성(folder, map);
    summary.pc = 'rendered';
  } catch (error) {
    summary.pc = 'error';
    summary.pcError = error.message;
  }
  if (config.artifact_sync) {
    if (fs.existsSync(map)) {
      summary.artifactSource = summary.pcError ? 'previous-pc-map' : 'rendered-pc-map';
      try {
        summary.artifact = await 웹갱신(config, map);
      } catch (error) {
        summary.artifact = { status: 'error', message: error.message };
      }
    } else {
      summary.artifact = { status: 'skipped', message: '게시할 PC 공모 지도가 없습니다.' };
    }
  }
  const failed = summary.grokError || summary.pcError || summary.failedReports.length ||
    ['skipped', 'error'].includes(summary.artifact?.status);
  summary.exitCode = failed ? 1 : summary.artifact?.status === 'deferred' ? 2 : 0;
  return summary;
}

async function main(argv) {
  const folder = argv[0] ? path.resolve(argv[0]) : 기본보관함;
  const summary = await 지도동기화(folder, 읽기(path.join(folder, '공모지도.json')));
  console.log(JSON.stringify(summary));
  process.exitCode = summary.exitCode;
}

if (require.main === module) main(process.argv.slice(2)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

module.exports = { 지도동기화 };

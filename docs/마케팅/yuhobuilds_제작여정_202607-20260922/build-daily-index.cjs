'use strict';
// A dated source index, not a claim that commits measure work or product success.
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const dir = __dirname;
const repo = path.resolve(dir, '../../..');
const git = args => execFileSync('git', args, {cwd: repo, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024}).trim();
const head = git(['rev-parse', 'HEAD']);
const scrub = s => s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[이메일 제외]').replace(/\b01[016789][- ]?\d{3,4}[- ]?\d{4}\b/g, '[전화번호 제외]');
const commits = git(['log', 'HEAD', '--since=2026-06-30T00:00:00+09:00', '--until=2026-09-23T00:00:00+09:00', '--format=%H%x09%cI%x09%s']).split('\n').filter(Boolean).map(line => {
  const [hash, time, ...rest] = line.split('\t');
  return {hash, time, day: new Date(new Date(time).getTime() + 9 * 3600000).toISOString().slice(0, 10), subject: scrub(rest.join('\t'))};
});
const days = [];
for (let date = new Date('2026-07-01T00:00:00Z'); date <= new Date('2026-09-22T00:00:00Z'); date.setUTCDate(date.getUTCDate() + 1)) {
  const day = date.toISOString().slice(0, 10);
  const records = commits.filter(c => c.day === day).reverse();
  days.push({day, status: records.length ? '현재 HEAD 이력에 커밋 있음; 실제 사건은 본문·결과 대조 필요' : '현재 HEAD 이력에 해당일 커밋 없음; 작업하지 않았다는 뜻이 아님', commits: records});
}
fs.mkdirSync(dir, {recursive: true});
fs.writeFileSync(path.join(dir, '일별_기록색인.json'), JSON.stringify({generatedAt: new Date().toISOString(), head, timezone: 'Asia/Seoul', scope: 'Current HEAD ancestry only. Uncommitted work, other repositories and conversations are not exhaustive.', days}, null, 2));
const rows = days.map(d => `| ${d.day} | ${d.commits.length ? `${d.commits.length}개 기록` : '미확인'} | ${d.commits.slice(0, 3).map(c => `\`${c.hash.slice(0, 9)}\` ${c.subject.replace(/\|/g, '/').replace(/\n/g, ' ')}`).join('<br>') || '별도 원대화·산출물 확인 필요'} |`);
fs.writeFileSync(path.join(dir, '일별_기록색인.md'), '# 7월 1일~9월 22일 기록 찾기\n\n영상 원고가 아닌 내부 탐색용 색인이다. 커밋 수는 작업량·완성도·성과가 아니다. 현재 저장소 HEAD의 조상 이력만 포함하므로 다른 저장소, 미커밋 결과와 대화는 월별 조사에서 보완한다. 커밋이 없는 날을 쉰 날로 말하지 않는다. 날짜는 커밋 시각을 한국 시간으로 바꾼 값이며 실제 작업 시작일과 다를 수 있다.\n\n7월 8일 첫 저장본은 이미 v5.3이며 코드 머리말에 7월 7일 기록이 있다. 최초 저장을 Claude 첫 사용일로 바꾸지 않는다.\n\n| 날짜 | 찾기용 수량 | 이른 기록 일부 |\n|---|---|---|\n' + rows.join('\n') + '\n');
console.log(JSON.stringify({days: days.length, daysWithRecords: days.filter(d => d.commits.length).length, firstRecordDay: days.find(d => d.commits.length)?.day, head: head.slice(0, 9)}));

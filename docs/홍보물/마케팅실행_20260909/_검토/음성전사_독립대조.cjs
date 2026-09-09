// 새 외부 전사를 실행하지 않는다. 기존 로컬 ASR 결과·공개 원고·WAV 지문만 대조한다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const bundle = path.resolve(__dirname, '..');
const voice = path.join(bundle, '공개수업/음성');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const manuscriptPath = path.join(bundle, '원고/콘텐츠원고.json');
const manuscript = read(manuscriptPath);
const entries = [];
for (const name of fs.readdirSync(voice).filter(name => /^전사-(?:\d{2}|클리닉\d{2})\.json$/.test(name)).sort()) {
  const source = path.join(voice, name);
  const data = read(source);
  const clinicMatch = name.match(/^전사-클리닉(\d{2})/);
  const expected = clinicMatch
    ? manuscript.extras[0].scenes[Number(clinicMatch[1]) - 1]?.narration
    : manuscript.lectures[0].chapters.find(item => item.id === data.id)?.narration;
  const audioPath = path.join(voice, data.input);
  entries.push({
    file: name, transcriptFileSha256: sha(source), input: data.input,
    audioSha256: data.audioSha256,
    audioExists: fs.existsSync(audioPath),
    audioHashMatches: fs.existsSync(audioPath) && sha(audioPath) === data.audioSha256,
    expectedNarrationMatchesCurrent: expected === data.expectedNarration,
    differenceCount: data.comparison.differences.length,
    differences: data.comparison.differences,
  });
}
const out = {
  checkedAt: new Date().toISOString(), manuscriptSha256: sha(manuscriptPath),
  method: '기존 로컬 ASR 파일의 원고·음성 지문 대조, 차이 텍스트 독립 의미 검토. 새 전사 호출 없음.',
  humanListening: false, audioUploaded: false,
  counts: {files: entries.length, differences: entries.reduce((n, x) => n + x.differenceCount, 0)},
  review: '가상/실제 구분, 성과 미보장, 개인정보·댓글 불필요의 핵심 반전 발견 없음. ASR 철자·동음 표현과 실제 오발음을 구분하지 못하므로 음성 청취 합격이 아님. ASR 원문을 공개 자막으로 직접 사용하지 말 것.',
  targetedListeningCandidates: ['04 첫 칸·수공예', '08 세 칸·수공예', '13 세 줄', '18 적어두세요', '클리닉02 가상 초안'],
  entries,
};
fs.writeFileSync(path.join(__dirname, '음성전사_독립대조.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({counts: out.counts, mismatches: entries.filter(x => !x.audioHashMatches || !x.expectedNarrationMatchesCurrent)}, null, 2));

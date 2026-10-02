// 음성 구간 받아쓰기(문장별 시작·끝 초). 사용: node transcribe-ts.cjs a.wav --유료-api
const fs = require('node:fs'), path = require('node:path');
const 정책 = require(path.join(__dirname, '../../../tools/모델정책.js'));
(async () => {
  for (const f of process.argv.slice(2).filter((a) => !a.startsWith('--'))) {
    const res = await fetch(정책.제미나이URL('돈', 'gemini-2.5-flash'), {
      method: 'POST', headers: await 정책.제미나이헤더('돈'),
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: '이 음성을 한국어로 받아써. 문장마다 한 줄로, 줄 맨 앞에 [시작초-끝초]를 소수점 한 자리로 붙여. 배경음악이 있으면 마지막 줄에 "배경음악 있음"이라고 적어.' }, { inline_data: { mime_type: 'audio/wav', data: fs.readFileSync(f).toString('base64') } }] }] }),
    });
    const j = await res.json();
    console.log('== ' + path.basename(f) + '\n' + (j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || JSON.stringify(j).slice(0, 300)));
  }
})();

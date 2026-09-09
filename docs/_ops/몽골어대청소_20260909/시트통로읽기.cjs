'use strict';
// 읽기 전용. 설치된 공식 clasp 인증을 그대로 재사용한다. 자격증명은 출력/별도 저장하지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname, '../../..');
(async () => {
  const authPath = 'C:/Users/q1212/AppData/Roaming/npm/node_modules/@google/clasp/build/src/auth/auth.js';
  const {initAuth} = await import(pathToFileURL(authPath).href);
  const {credentials} = await initAuth({authFilePath: 'C:/Users/q1212/.clasprc.json', userKey: 'default'});
  if (!credentials) throw new Error('clasp 기존 로그인 없음');
  const {scriptId} = JSON.parse(fs.readFileSync(path.join(root, '.clasp.json'), 'utf8'));
  const project = await credentials.request({url: `https://script.googleapis.com/v1/projects/${encodeURIComponent(scriptId)}`, params: {fields: 'scriptId,parentId,title'}, timeout: 30000});
  const {parentId, title} = project.data;
  const result = {checkedAt: new Date().toISOString(), claspLoginRead: true, scriptTitle: title, parentId: parentId || null, writes: 0};
  if (parentId) {
    try {
      const meta = await credentials.request({url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(parentId)}`, params: {fields: 'spreadsheetId,sheets.properties'}, timeout: 30000});
      const contents = meta.data.sheets.find(row => row.properties.title === 'contents');
      result.sheetsRead = true;
      result.contents = contents ? contents.properties : null;
    } catch (error) {
      result.sheetsRead = false;
      result.sheetsError = {status: error.response?.status || null, message: error.response?.data?.error?.message || String(error.message).replace(/ya29\.[\w.-]+/g, '[REDACTED]')};
    }
  }
  fs.writeFileSync(path.join(__dirname, '시트통로결과.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
})().catch(error => {
  console.error(JSON.stringify({status: error.response?.status || null, message: error.response?.data?.error?.message || String(error.message).replace(/ya29\.[\w.-]+/g, '[REDACTED]')}));
  process.exitCode = 1;
});

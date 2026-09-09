'use strict';
// Finite, loopback-only diagnostic. No live URL, credentials, or service mutation.
const net = require('node:net');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
async function trial(protocol, timeoutUs) {
  const sockets = [];
  const server = net.createServer(socket => { sockets.push(socket); socket.on('error', () => {}); socket.pause(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `${protocol}://127.0.0.1:${server.address().port}` + (protocol === 'rtmp' ? '/local/test' : '');
  const args = ['-hide_banner', '-loglevel', 'warning', '-f', 'lavfi', '-i', protocol === 'rtmp' ? 'anullsrc=r=48000:cl=stereo' : 'anullsrc=r=192000:cl=stereo', '-t', '600', '-c:a', protocol === 'rtmp' ? 'aac' : 'pcm_s16le', '-f', protocol === 'rtmp' ? 'flv' : 's16le'];
  if (timeoutUs) args.push('-rw_timeout', String(timeoutUs));
  args.push(url);
  const start = performance.now();
  const child = cp.spawn('ffmpeg', args, {stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true});
  let stderr = '', safetyKilled = false;
  child.stderr.on('data', chunk => { stderr += chunk; });
  const safety = setTimeout(() => { safetyKilled = true; child.kill('SIGKILL'); }, 6500);
  const {code, signal} = await new Promise(resolve => child.on('exit', (code, signal) => resolve({code, signal})));
  clearTimeout(safety);
  for (const socket of sockets) socket.destroy();
  await new Promise(resolve => server.close(resolve));
  return {protocol, timeoutUs, elapsedMs: Math.round(performance.now() - start), code, signal, safetyKilled, stderr: stderr.replace(/(?:rtmp|tcp):\/\/\S+/g, '[LOOPBACK]')};
}
(async () => {
  const report = {timeUTC: new Date().toISOString(), ffmpeg: cp.execFileSync('ffmpeg', ['-version'], {encoding: 'utf8'}).split('\n')[0], results: await Promise.all([trial('tcp', 2_000_000), trial('tcp', 0), trial('rtmp', 2_000_000), trial('rtmp', 0)])};
  fs.writeFileSync(path.join(__dirname, 'stream-timeout-proof.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (!report.results.filter(r => r.timeoutUs).every(r => !r.safetyKilled && r.code !== 0 && r.elapsedMs < 5000)) process.exitCode = 1;
  if (!report.results.filter(r => !r.timeoutUs).every(r => r.safetyKilled)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });

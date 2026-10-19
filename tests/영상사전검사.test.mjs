import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, realpath, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { inspectFrameTimes, compareText, inspectMedia, parseInspectionArgs, uploadQualityIssues } from '../tools/영상사전검사.mjs';
import { stagePublicationDelivery } from '../tools/완성본등록.mjs';
import { Store } from '../docs/마케팅/온라인마케팅지도/engagement/company/store.mjs';
import { createStudioService } from '../docs/마케팅/온라인마케팅지도/engagement/company/studio-service.mjs';
import { createPublicationInboxService } from '../docs/마케팅/온라인마케팅지도/engagement/company/publication-inbox.mjs';

async function fixture(t) {
  const parent = await realpath(tmpdir()), root = await mkdtemp(path.join(parent, 'synk-media-inspection-')), cleanup = [];
  t.after(async () => { for (const close of cleanup) await close(); assert.equal(path.dirname(await realpath(root)), parent); assert.ok(path.basename(root).startsWith('synk-media-inspection-')); await rm(root, { recursive: true, force: true }); });
  const video = path.join(root, '의심 구간 $(not-a-command).mp4');
  execFileSync(process.env.SYNK_FFMPEG_EXE || 'ffmpeg', ['-v','error','-nostdin','-f','lavfi','-i','testsrc2=size=160x240:rate=25:duration=3','-f','lavfi','-i','sine=frequency=440:duration=1','-vf','setpts=if(gte(N\\,25)\\,PTS+0.16/TB\\,PTS)','-fps_mode','vfr','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',video], { windowsHide: true });
  return { root, video, cleanup };
}

test('frame inspection uses decoded display order and marks true gaps without treating normal B frames as gaps', () => {
  const normal = inspectFrameTimes([0, .04, .08, .12], 25); assert.deepEqual(normal.issues, []);
  assert.equal(inspectFrameTimes([0,.04,.12,.16],25).issues[0].code, 'frame-gap');
  assert.equal(inspectFrameTimes([0,.04,.04,.08],25).issues[0].severity, 'error');
  assert.equal(inspectFrameTimes([0,'N/A',.08],25).missingTimestamps,1);
});

test('upload quality flags low-bitrate, full-range and untagged 1080p finals but leaves small previews alone', () => {
  const stereo = (bit_rate) => [{ codec_type: 'audio', sample_rate: '48000', channels: 2, bit_rate: String(bit_rate) }];
  assert.deepEqual(uploadQualityIssues({ width: 160, height: 240, pix_fmt: 'yuvj420p', bit_rate: '200000' }, stereo(64000)), []);
  // 10-18 나라별 올림본: 1.6Mbps · yuvj420p · 색 표시 없음 · 소리 132kbps
  const low = uploadQualityIssues({ width: 1080, height: 1920, codec_name: 'h264', pix_fmt: 'yuvj420p', avg_frame_rate: '30/1', bit_rate: '1561319' }, stereo(132502)).map(issue => issue.code);
  assert.deepEqual(low, ['upload-video-bitrate', 'upload-pixel-format', 'upload-color', 'upload-audio-bitrate']);
  // 10-19 새 렌더: 10.8Mbps · yuv420p · BT.709 · 48kHz 342kbps
  assert.deepEqual(uploadQualityIssues({ width: 1080, height: 1920, codec_name: 'h264', pix_fmt: 'yuv420p', color_space: 'bt709', color_primaries: 'bt709', color_transfer: 'bt709', avg_frame_rate: '30/1', bit_rate: '10785598' }, stereo(342451)), []);
  const sixty = uploadQualityIssues({ width: 1920, height: 1080, codec_name: 'h264', pix_fmt: 'yuv420p', color_space: 'bt709', color_primaries: 'bt709', color_transfer: 'bt709', avg_frame_rate: '60/1', bit_rate: '10000000' }, stereo(384000));
  assert.deepEqual(sixty.map(issue => issue.code), ['upload-video-bitrate']);
  assert.ok(sixty.every(issue => issue.severity === 'warning' && issue.at === null));
  const fromFormat = uploadQualityIssues({ width: 1080, height: 1920, codec_name: 'h264', pix_fmt: 'yuv420p', color_space: 'bt709', color_primaries: 'bt709', color_transfer: 'bt709', avg_frame_rate: '30/1' }, [{ sample_rate: '44100', channels: 2, bit_rate: '384000' }], { bit_rate: '4384000' });
  assert.deepEqual(fromFormat.map(issue => issue.code), ['upload-video-bitrate', 'upload-audio-rate']);
});

test('script comparison preserves order and repetitions while ignoring punctuation and spacing', () => {
  assert.equal(compareText('안녕하세요, 유호입니다.', '안녕하세요 유호 입니다').similarity, 1);
  assert.ok(compareText('하나 둘 셋', '셋 둘 하나').similarity < .8);
  assert.ok(compareText('오늘 시작해요', '오늘 오늘 시작해요').similarity < .95);
  assert.throws(() => compareText('가'.repeat(12001), ''), /12,000/);
  assert.deepEqual(parseInspectionArgs(['--영상','한글.mp4','--출력','검사']), { video:'한글.mp4', out:'검사' });
});

test('real defective media yields audio length, subtitle end, script warnings and actual review clips', async t => {
  const { root, video } = await fixture(t), subtitle = path.join(root,'자막.srt'), script = path.join(root,'대본.txt'), transcript = path.join(root,'받아쓰기.json');
  await writeFile(subtitle,'1\n00:00:02,000 --> 00:00:04,000\n틀린 대사입니다.\n');
  await writeFile(script,'이것은 실제로 읽어야 하는 원문입니다.');
  await writeFile(transcript,JSON.stringify({segments:[{start:0,end:1,text:'다른 문장을 두 번 두 번 읽었습니다.'}]}));
  const report = await inspectMedia({ video, out:path.join(root,'out'), subtitle, script, transcript });
  assert.equal(report.status,'blocked');
  for (const code of ['frame-gap','av-duration','subtitle-after-video','script-subtitles','script-provided-transcript']) assert.ok(report.issues.some(row=>row.code===code), code);
  assert.equal(report.frames.count,75);
  assert.ok(report.artifacts.length>0);
  const clip = path.join(path.dirname(report.reportPath),report.artifacts[0].clip);
  assert.ok((await readFile(clip)).length>100);
  assert.match(await readFile(report.reviewPath,'utf8'), /의심 구간/);
  await assert.rejects(stagePublicationDelivery({video,subtitle,inbox:path.join(root,'inbox'),title:'합성 시험',confirmed:true,inspection:report.reportPath,reviewNote:'강제로 통과 불가'}),/오류를 고치고/);
});

test('inspected finalization reaches the existing inbox and draft; repeats stay one version and changed inputs fail', async t => {
  const { root, video, cleanup } = await fixture(t), directory = path.join(root,'company'); await mkdir(directory);
  const report = await inspectMedia({ video, out:path.join(root,'out') });
  assert.equal(report.status,'needs-review');
  const store = new Store(directory), studio = createStudioService({store}), inbox = createPublicationInboxService({store,studio,enabled:true});
  cleanup.push(async()=>{await inbox.stop();store.close();});
  const owner = store.createUser({name:'합성 검증 담당',email:'media-finalization@example.test'});
  const configuration = await inbox.configure(owner,{active:true});
  const options = {video,inbox:configuration.inboxPath,title:'합성 시험 · 외부 게시 없음',body:'시험 게시문',confirmed:true,inspection:report.reportPath};
  await assert.rejects(stagePublicationDelivery(options),/직접 확인한 뒤/);
  const first = await stagePublicationDelivery({...options,reviewNote:'합성 영상의 끝 2초 무음은 시험 의도임'});
  const second = await stagePublicationDelivery({...options,reviewNote:'합성 영상의 끝 2초 무음은 시험 의도임'});
  assert.equal(first.deliveryId,second.deliveryId);assert.equal(second.reused,true);
  await inbox.scan();await inbox.scan();
  const draft = inbox.readDraft(owner,first.deliveryId);
  assert.equal(draft.draft.title,options.title);assert.equal(draft.draft.body,options.body);
  assert.equal(draft.production.versions.length,1);assert.equal(store.all('studioProductions').length,1);
  assert.equal(store.all('studioPublicationPackages').length,0);assert.equal(store.all('socialPublishJobs').length,0);
  const manifest = JSON.parse(await readFile(first.manifestPath,'utf8'));assert.equal(manifest.inspection.issueCount,report.issues.length);
  const changed = Buffer.from(await readFile(video));changed[changed.length-1]^=1;await writeFile(video,changed);
  await assert.rejects(stagePublicationDelivery({...options,reviewNote:'앞서 확인'}),/검사한 영상/);
});

test('finalization rejects changed or missing script and transcript sources, including repeated deliveries', async t => {
  const { root, video } = await fixture(t), script = path.join(root,'대본.txt'), transcript = path.join(root,'받아쓰기.json'), subtitle = path.join(root,'자막.srt');
  const originals = new Map([[script,'같은 문장입니다.'],[transcript,JSON.stringify({text:'같은 문장입니다.'})],[subtitle,'1\n00:00:00,000 --> 00:00:01,000\n같은 문장입니다.\n']]);
  for (const [file, body] of originals) await writeFile(file,body);
  const report = await inspectMedia({video,script,transcript,subtitle,out:path.join(root,'out')});
  assert.equal(report.status,'needs-review');
  assert.equal(report.comparisons.length,2);
  assert.ok(report.comparisons.every(row=>row.similarity===1));
  const options = {video,subtitle,inbox:path.join(root,'inbox'),title:'입력 현재성 시험',confirmed:true,inspection:report.reportPath,reviewNote:'합성 영상의 프레임 간격과 짧은 음성은 시험 의도임'};
  const first = await stagePublicationDelivery(options);
  await assert.rejects(stagePublicationDelivery({...options,subtitle:undefined}),/검사한 자막/);
  for (const [file, label] of [[script,'대본'],[transcript,'받아쓰기']]) {
    await writeFile(file, originals.get(file) + ' 변경');
    await assert.rejects(stagePublicationDelivery(options),new RegExp(`검사한 ${label}이 변경`));
    await assert.rejects(stagePublicationDelivery({...options,deliveryId:'10000000-0000-4000-8000-000000000001'}),new RegExp(`검사한 ${label}이 변경`));
    await rm(file);
    await assert.rejects(stagePublicationDelivery(options),new RegExp(`검사한 ${label} 파일을 다시 읽을 수 없습니다`));
    await assert.rejects(stagePublicationDelivery({...options,deliveryId:'10000000-0000-4000-8000-000000000001'}),new RegExp(`검사한 ${label} 파일을 다시 읽을 수 없습니다`));
    await writeFile(file,originals.get(file));
  }
  const repeated = await stagePublicationDelivery(options);
  assert.equal(repeated.deliveryId,first.deliveryId);assert.equal(repeated.reused,true);
});

test('provided comparison inputs cannot silently produce zero comparisons or match empty text', async t => {
  const { root, video } = await fixture(t), script = path.join(root,'대본.txt'), transcript = path.join(root,'받아쓰기.json');
  await writeFile(script,'대조할 원문입니다.');await writeFile(transcript,JSON.stringify({text:'대조할 원문입니다.'}));
  const scriptOnly = await inspectMedia({video,script,out:path.join(root,'script-only')});
  assert.equal(scriptOnly.status,'needs-review');assert.equal(scriptOnly.comparisons.length,0);
  assert.ok(scriptOnly.issues.some(row=>row.code==='script-comparison-missing' && row.severity==='warning'));
  const transcriptOnly = await inspectMedia({video,transcript,out:path.join(root,'transcript-only')});
  assert.equal(transcriptOnly.status,'needs-review');assert.equal(transcriptOnly.comparisons.length,0);
  assert.ok(transcriptOnly.issues.some(row=>row.code==='transcript-script-missing' && row.severity==='warning'));
  await writeFile(script,' \n...');await writeFile(transcript,JSON.stringify({segments:[]}));
  const empty = await inspectMedia({video,script,transcript,out:path.join(root,'empty')});
  assert.equal(empty.status,'blocked');assert.equal(empty.comparisons.length,0);
  for (const code of ['script-empty','transcript-empty']) assert.ok(empty.issues.some(row=>row.code===code && row.severity==='error'));
  await assert.rejects(stagePublicationDelivery({video,inbox:path.join(root,'inbox'),title:'빈 원문 시험',confirmed:true,inspection:empty.reportPath,reviewNote:'빈 원문 강제 통과 불가'}),/오류를 고치고/);
});

test('inspection CLI distinguishes review warnings, blocked input and execution failure', async t => {
  const { root, video } = await fixture(t), script = path.join(root,'대본.txt');
  const command = fileURLToPath(new URL('../tools/영상사전검사.mjs',import.meta.url));
  const inspect = args => spawnSync(process.execPath,[command,...args],{encoding:'utf8',windowsHide:true});
  await writeFile(script,'대조할 원문입니다.');
  const warning = inspect(['--video',video,'--script',script,'--out',path.join(root,'warning')]);
  assert.equal(warning.status,0,warning.stderr);assert.equal(JSON.parse(warning.stdout).status,'needs-review');
  await writeFile(script,' \n');
  const blocked = inspect(['--video',video,'--script',script,'--out',path.join(root,'blocked')]);
  assert.equal(blocked.status,2,blocked.stderr);assert.equal(JSON.parse(blocked.stdout).status,'blocked');
  const failed = inspect(['--video',path.join(root,'없는영상.mp4'),'--out',path.join(root,'failed')]);
  assert.equal(failed.status,1);assert.match(failed.stderr,/ENOENT/);
});

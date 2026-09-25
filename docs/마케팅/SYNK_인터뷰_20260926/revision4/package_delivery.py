"""Package only a hash-matched, validated v4 render. Preserve all prior outputs."""
from fractions import Fraction
import argparse, json, shutil, subprocess, time, zipfile
from delivery_common_v4 import (REV,PROJECT,OUT,MP4,MASTER,SRT,LUT_SOURCES,
    verified_final_source,probe,stream,stream_hash,sha256,validate_dimensions,safe_copy,preflight,read_plan,read_srt)

PREVIEW=OUT/'SYNK_인터뷰_구성개선_미리보기_1080p_v4.mp4'
MOV=OUT/'SYNK_인터뷰_구성개선_음질우선_v4.mov'
DRP=OUT/'SYNK_인터뷰_구성개선_프로젝트_v4.drp'
DRT=OUT/'SYNK_인터뷰_구성개선_타임라인_v4.drt'
PCM=OUT/'SYNK_인터뷰_구성개선_PCM24_v4.wav'
MIB=1024*1024
SPACE_RESERVE=256*MIB

def essential_copy_bytes():
    pairs=[(MASTER,PCM),(SRT,OUT/'SYNK_인터뷰_구성개선_한국어_v4.srt')]
    pairs.extend((p,OUT/'SYNK_Premium_20260926_v2'/p.name) for p in LUT_SOURCES)
    return sum(source.stat().st_size for source,target in pairs if not target.exists())+MIB

def output_estimates(plan,skip_mov):
    # Preview remains the same quality setting. Reserve a conservative estimate,
    # then monitor actual free space while encoding; do not cap/truncate its size.
    preview=0 if PREVIEW.exists() else int(max(MP4.stat().st_size*.45,plan['duration_seconds']*12000000/8))+32*MIB
    mov=0 if skip_mov or MOV.exists() else int(MP4.stat().st_size*1.05)+MASTER.stat().st_size+8*MIB
    return {'preview_bytes':preview,'mov_bytes':mov,'essential_copy_bytes':essential_copy_bytes()}

def ensure_space(needed,stage):
    free=shutil.disk_usage(OUT).free
    observation={'stage':stage,'free_bytes':free,'estimated_write_bytes':int(needed),'reserve_bytes':SPACE_RESERVE}
    if free<int(needed)+SPACE_RESERVE:
        raise OSError(f'Insufficient disk space before {stage}: {free/MIB:.1f} MiB free; '
            f'{needed/MIB:.1f} MiB estimated plus {SPACE_RESERVE/MIB:.0f} MiB reserve required. '
            'No existing files were deleted. Use --skip-mov explicitly if the additional MOV is not required.')
    return observation

def run_space_guarded(command,stage,remaining_copies):
    process=subprocess.Popen(command)
    try:
        while process.poll() is None:
            free=shutil.disk_usage(OUT).free
            if free<128*MIB+remaining_copies:
                raise OSError(f'Disk headroom fell below the protected floor during {stage}; '
                    'encoding stopped and its partial output was preserved for inspection.')
            time.sleep(1)
        if process.returncode: raise subprocess.CalledProcessError(process.returncode,command)
    except BaseException:
        if process.poll() is None:
            process.terminate()
            try: process.wait(timeout=10)
            except subprocess.TimeoutExpired: process.kill(); process.wait()
        raise

def write_new_or_identical(path,text):
    if path.exists():
        if path.read_text(encoding='utf-8')!=text: raise FileExistsError(f'Preserving different text: {path}')
    else:
        with path.open('x',encoding='utf-8') as f: f.write(text)

def zip_check(path):
    with zipfile.ZipFile(path) as archive:
        names=archive.namelist()
        if not names or archive.testzip() is not None: raise ValueError(f'Invalid archive: {path}')
        return {'integrity':'pass','entry_count':len(names)}

def verify_pcm(meta,samples):
    audio=stream(meta,'audio'); count=round(int(audio['duration_ts'])*Fraction(audio['time_base'])*48000)
    if audio['codec_name']!='pcm_s24le' or int(audio['sample_rate'])!=48000 or audio['channels']!=2 or count!=samples:
        raise ValueError(f'Expected stereo PCM24, 48kHz, exactly {samples} samples.')
    if abs(float(audio.get('start_time',0)))>1e-8: raise ValueError('PCM track is not at zero.')
    return count

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--prepare-only',action='store_true')
    parser.add_argument('--plans-only',action='store_true')
    parser.add_argument('--skip-mov',action='store_true',help='Explicitly omit the additional MOV; preserve 4K MP4 and unchanged separate PCM24 WAV.')
    args=parser.parse_args()
    prepared=preflight(require_audio=not args.plans_only)
    if args.prepare_only or args.plans_only:
        prepared['package_outputs']=[str(p) for p in [MP4,PREVIEW,*([] if args.skip_mov else [MOV]),PCM,DRP,DRT]]
        prepared['skip_mov']=args.skip_mov
        prepared['lut_relative_folder']='SYNK_Premium_20260926_v2'
        print(json.dumps(prepared,ensure_ascii=False,indent=2)); return
    plan,validated,meta=verified_final_source(); frames=plan['duration_frames']; samples=frames*800
    manifest_path=REV/'delivery_v4_validation.json'
    if manifest_path.exists(): raise FileExistsError(f'Preserving completed package report: {manifest_path}')
    for path in [DRP,DRT,MASTER,SRT,*LUT_SOURCES]:
        if not path.is_file() or path.stat().st_size==0: raise FileNotFoundError(f'Not ready: {path}')
    drp=zip_check(DRP); drt=zip_check(DRT); cues=read_srt(plan); verify_pcm(probe(MASTER),samples)
    estimates=output_estimates(plan,args.skip_mov)
    space_checks=[ensure_space(sum(estimates.values()),'delivery package')]
    reference_aac=validated['audio_validation']['aac_sha256']; preview_report=REV/'preview_v4_validation.json'
    if PREVIEW.exists():
        if not preview_report.is_file(): raise FileExistsError(f'Preserving unverified preview: {PREVIEW}')
        pr=json.loads(preview_report.read_text(encoding='utf-8'))
        if pr['source_sha256']!=validated['sha256'] or pr['sha256']!=sha256(PREVIEW) or pr['full_decode']!='pass':
            raise ValueError('Existing preview differs from this validated render.')
    else:
        space_checks.append(ensure_space(estimates['preview_bytes']+essential_copy_bytes(),'1080p preview'))
        print('Creating 1080p60 viewing copy...',flush=True)
        run_space_guarded(['ffmpeg','-hide_banner','-nostdin','-loglevel','warning','-n','-threads','4','-filter_threads','2',
            '-i',str(MP4),'-map','0:v:0','-map','0:a:0','-vf','scale=1920:1080:flags=lanczos,format=nv12',
            '-fps_mode','passthrough','-c:v','h264_qsv','-global_quality','19','-preset','medium','-c:a','copy',
            '-movflags','+faststart','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',
            '-progress',str(REV/'preview_v4_progress.txt'),str(PREVIEW)],'1080p preview',essential_copy_bytes())
        pm=probe(PREVIEW); validate_dimensions(pm,plan,(1920,1080),'h264','yuv420p')
        if stream_hash(PREVIEW,'a','copy')!=reference_aac: raise ValueError('Preview AAC differs from native AAC.')
        if abs(float(stream(pm,'audio').get('start_time',0)))>1e-8: raise ValueError('Preview audio start shifted.')
        with (REV/'preview_v4_decode.log').open('wb') as log:
            subprocess.run(['ffmpeg','-hide_banner','-nostdin','-loglevel','error','-xerror','-threads','4',
                '-i',str(PREVIEW),'-map','0:v:0','-map','0:a:0','-f','null','NUL'],stdout=subprocess.DEVNULL,stderr=log,check=True)
        pr={'output':str(PREVIEW),'source_sha256':validated['sha256'],'sha256':sha256(PREVIEW),
            'full_decode':'pass','aac_sha256':reference_aac,'audio_bitstream_unchanged':True,'metadata':pm}
        with preview_report.open('x',encoding='utf-8') as f: json.dump(pr,f,ensure_ascii=False,indent=2)
    pcm_hash=stream_hash(MASTER,'a','pcm_s24le'); mov_report=REV/'mov_v4_validation.json'; mr=None
    if args.skip_mov:
        print('Additional MOV explicitly omitted; unchanged PCM24 WAV will be delivered separately.',flush=True)
    elif MOV.exists():
        if not mov_report.is_file(): raise FileExistsError(f'Preserving unverified MOV: {MOV}')
        mr=json.loads(mov_report.read_text(encoding='utf-8'))
        if mr['source_sha256']!=validated['sha256'] or mr['sha256']!=sha256(MOV) or mr['pcm_sha256']!=pcm_hash:
            raise ValueError('Existing MOV differs from the validated render/mix.')
    else:
        space_checks.append(ensure_space(output_estimates(plan,False)['mov_bytes']+essential_copy_bytes(),'PCM24 MOV'))
        video_hash=stream_hash(MP4,'v','copy')
        print('Creating video-copy / PCM24 MOV...',flush=True)
        run_space_guarded(['ffmpeg','-hide_banner','-nostdin','-loglevel','error','-n','-i',str(MP4),'-i',str(MASTER),
            '-map','0:v:0','-map','1:a:0','-map_metadata','0','-c:v','copy','-tag:v','hvc1','-c:a','pcm_s24le',
            '-movflags','+faststart',str(MOV)],'PCM24 MOV',essential_copy_bytes())
        mm=probe(MOV); validate_dimensions(mm,plan); count=verify_pcm(mm,samples)
        if stream_hash(MOV,'v','copy')!=video_hash: raise ValueError('MOV video is not an unchanged bitstream copy.')
        if stream_hash(MOV,'a','pcm_s24le')!=pcm_hash: raise ValueError('MOV PCM differs from final mix.')
        mr={'output':str(MOV),'source_sha256':validated['sha256'],'sha256':sha256(MOV),
            'video_bitstream_unchanged':True,'video_sha256':video_hash,'pcm_sha256':pcm_hash,
            'lossless_pcm_equals_mix_master':True,'pcm_samples':count,'metadata':mm}
        with mov_report.open('x',encoding='utf-8') as f: json.dump(mr,f,ensure_ascii=False,indent=2)
    space_checks.append(ensure_space(essential_copy_bytes(),'PCM24/subtitle/LUT copies'))
    pcm_file_hash=safe_copy(MASTER,PCM); srt_out=OUT/'SYNK_인터뷰_구성개선_한국어_v4.srt'; subtitle_hash=safe_copy(SRT,srt_out)
    lut_folder=OUT/'SYNK_Premium_20260926_v2'
    luts=[{'file':str(lut_folder/p.name),'sha256':safe_copy(p,lut_folder/p.name)} for p in LUT_SOURCES]
    chapters='\n'.join(f"- {int(c['output_start']//60):02d}:{int(c['output_start']%60):02d} — {c['question']}" for c in plan['cuts'] if c['kind']=='question')
    mov_line=f'- **{MOV.name}** — 같은 영상에 무손실 PCM24 음성을 담은 편집·보관용 파일.\n' if mr is not None else ''
    guide=f'''# SYNK 인터뷰 구성 개선 v4

먼저 **{PREVIEW.name}**를 여세요. 1080p·60fps H.264로 만든 감상용 파일입니다.

- **{MP4.name}** — 4K·60fps·10비트 HEVC와 AAC 음성.
{mov_line}- **{PCM.name}** — 최종 스테레오 음성·음악·효과음 믹스, 48kHz PCM24. 4K 영상과 같은 0초 위치에 맞춰 사용할 수 있습니다.
- **{DRP.name} / {DRT.name}** — Resolve 프로젝트와 완성 타임라인.
- **{srt_out.name}** — 한국어 대사 자막 {len(cues)}개. 영상에 자막이 이미 표시되므로 별도 자막을 켜면 겹칠 수 있습니다.

길이는 {int(frames/3600)}분 {(frames/60)%60:.3f}초, {frames:,}프레임입니다. 네 질문을 기준으로 기존 발언을 재배열하고 반복되는 문장을 덜었습니다. 검은 질문 카드에 은은한 타이핑 효과음을 넣었습니다. 새 대사나 새 음성을 만들지 않았고, 기존 음성을 보존하며 새 절단 경계만 짧게 정리했습니다. 원본과 이전 완성본은 보존했습니다.

{chapters}

## Resolve에서 다시 열기

1. DRP를 가져와 **01_FINAL_4K60_v4** 타임라인을 여세요. DRP·DRT에는 원본 영상이 내장되어 있지 않습니다.
2. 작업 폴더 `{PROJECT}` 전체를 함께 보존하세요. 다른 컴퓨터에서는 작업 폴더를 복사한 뒤 Media Pool의 오프라인 미디어를 다시 연결하세요. 원본 비교 타임라인은 `C:\\Users\\q1212\\OneDrive\\Desktop\\kkkk_4K60_원음우선_보정.mov`도 참조합니다.
3. 동봉한 **SYNK_Premium_20260926_v2** 폴더를 Resolve의 LUT 폴더에 복사하고 목록을 새로 고치세요. 기존 Bright A/B LUT를 사용하므로 이 폴더 이름을 유지해야 연결됩니다.

대사·음악·타이핑 소리를 따로 조절하려면 작업 폴더의 `revision4/audio/dialogue_stem.wav`, `music_stem.wav`, `sfx_stem.wav`를 사용하세요. 세 파일을 같은 0초 위치에서 기본 음량으로 합치면 최종 PCM 믹스가 됩니다.
'''
    write_new_or_identical(OUT/'읽어주세요_v4.md',guide)
    report={'output_folder':str(OUT),'native_mp4':str(MP4),'native_sha256':validated['sha256'],'preview':pr,'lossless_mov':mr,
        'skip_mov_explicit':args.skip_mov,'disk_space_estimates':estimates,'disk_space_checks':space_checks,
        'free_bytes_after_packaging':shutil.disk_usage(OUT).free,
        'drp_archive':drp,'drt_archive':drt,'drp_sha256':sha256(DRP),'drt_sha256':sha256(DRT),
        'subtitle_cues':len(cues),'subtitle_file':str(srt_out),'subtitle_sha256':subtitle_hash,'luts':luts,
        'pcm_file':str(PCM),'pcm_file_sha256':pcm_file_hash,'pcm_sha256':pcm_hash,
        'total_frames':frames,'duration_seconds':frames/60,'audio_reference':str(MASTER),
        'prior_outputs_modified_by_packaging':False,'originals_modified_by_packaging':False}
    with manifest_path.open('x',encoding='utf-8') as f: json.dump(report,f,ensure_ascii=False,indent=2)
    print('V4 DELIVERY PACKAGE VERIFIED',flush=True)

if __name__=='__main__': main()

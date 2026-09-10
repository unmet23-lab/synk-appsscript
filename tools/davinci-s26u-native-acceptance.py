"""Run ONLY inside licensed Resolve Studio 21.1. NOT yet native-validated.

The two tiny input files must first be generated in the explicit QA folder.
Invoke from the Studio Scripts menu. Python is unavailable in Free 21.1.
Creates clearly labelled QA projects, tests the production entry point, writes
evidence, and leaves the camera base project open when all checks succeed.
"""
from pathlib import Path
import datetime as dt
import json
import runpy
import time
import traceback

HERE = Path(__file__).resolve().parent
ROOT = Path('C:/Users/q1212/Videos/SYNK_DAVINCI_QA_20260910')
BASE_NAME = 'SYNK_STUDIO_BASE_4K24'
w = runpy.run_path(str(HERE / 'davinci-s26u-one-video.py'), run_name='synk_native_acceptance')
w['require_python_edition'](resolve)
PM = resolve.GetProjectManager()
results = {'started_at': dt.datetime.now().astimezone().isoformat(), 'complete': False,
           'synthetic_only': True, 'cases': [], 'resolve': resolve.GetVersionString()}


def record():
    w['atomic_report'](ROOT / 'native-acceptance.json', results)


def render_and_verify(project, label, width, height):
    if not project.LoadRenderPreset(w['MASTER_PRESET']):
        raise RuntimeError('Cannot reload master render preset')
    stem = label + '_' + dt.datetime.now().strftime('%H%M%S_%f')
    if not project.SetRenderSettings({'TargetDir':str(ROOT), 'CustomName':stem,
                                     'UseUniqueFilenames':False, 'ReplaceExistingFilesInPlace':False}):
        raise RuntimeError('Cannot set QA output filename')
    job = project.AddRenderJob()
    if not job:
        raise RuntimeError('AddRenderJob failed')
    jobs = project.GetRenderJobList()
    job_info = next(j for j in jobs if j['JobId'] == job)
    if int(job_info['FormatWidth']) != width or int(job_info['FormatHeight']) != height:
        raise RuntimeError('Actual render-job dimensions mismatch')
    if not project.StartRendering([job]):
        raise RuntimeError('StartRendering failed')
    deadline = time.monotonic() + 180
    while project.IsRenderingInProgress() and time.monotonic() < deadline:
        time.sleep(0.5)
    status = project.GetRenderJobStatus(job)
    if status.get('JobStatus') != 'Complete':
        raise RuntimeError('QA render did not complete: ' + repr(status))
    path = ROOT / (stem + '.mov')
    probe = w['probe_video'](path)
    video = probe['primary_video']
    audio = [s for s in probe['streams'] if s.get('codec_type') == 'audio']
    if (video['width'], video['height']) != (width, height):
        raise RuntimeError('Encoded output dimensions mismatch')
    if video['codec_name'] != 'dnxhd' or not w['is_ten_bit'](video):
        raise RuntimeError('Encoded output not DNxHR 10-bit')
    if abs(float(video.get('duration') or probe['format']['duration']) - 2) > 0.05:
        raise RuntimeError('Encoded output duration mismatch')
    if not audio or audio[0].get('codec_name') != 'pcm_s24le' or audio[0].get('sample_rate') != '48000':
        raise RuntimeError('Encoded master audio mismatch')
    return {'path':str(path), 'sha256':w['file_sha256'](path), 'job':job_info,
            'status':status, 'probe':probe}


try:
    for label, filename, color, dims in (
        ('WIDE_APV_LOG_PIPELINE', 'apv24_720_test.mov', 'Samsung Log', (3840,2160)),
        ('PORTRAIT_ROTATION', 'portrait24_720_test.mp4', 'Rec.709 Gamma 2.4', (2160,3840)),
    ):
        print('[SYNK QA] ' + label, flush=True)
        report_path = w['setup_resolve'](resolve, ROOT / filename, fusion,
            input_color_space=color, work_base=ROOT, project_prefix='SYNK_QA_' + label)
        setup = json.loads(report_path.read_text(encoding='utf-8'))
        if not setup['ready'] or not setup['reopen_verified']:
            raise RuntimeError('Production setup not verified')
        project = PM.GetCurrentProject()
        result = {'label':label, 'setup_report':str(report_path), 'setup':setup,
                  'render':render_and_verify(project, label, *dims)}
        results['cases'].append(result)
        record()
    w['save_checked'](PM)
    base = PM.LoadProject(BASE_NAME)
    if not base:
        raise RuntimeError('Camera base project missing')
    base_root = Path('C:/Users/q1212/Videos/SYNK_DAVINCI_BASE')
    for child in ('cache','exports','project_backups'):
        (base_root / child).mkdir(parents=True, exist_ok=True)
    settings = w['build_project_settings']({'width':3840,'height':2160,'avg_frame_rate':'24/1'}, base_root)
    results['base_settings'] = w['apply_project_settings'](base, settings)
    results['base_preset_saved'] = w['_save_project_preset'](base)
    results['base_render_preset'] = w['_save_master_render_preset'](base, base_root, 3840,2160,24.0)
    w['save_checked'](PM)
    backup = base_root / 'project_backups' / ('SYNK_STUDIO_BASE_' + dt.datetime.now().strftime('%Y%m%d_%H%M%S') + '.drp')
    if not PM.ExportProject(BASE_NAME,str(backup)) or not backup.is_file():
        raise RuntimeError('Base project export backup failed')
    results['base_backup'] = str(backup)
    results['complete'] = bool(results['base_preset_saved'] and results['base_render_preset']['saved'])
    resolve.OpenPage('edit')
    print('[SYNK QA] COMPLETE=' + str(results['complete']), flush=True)
except Exception as exc:
    results['error'] = repr(exc)
    traceback.print_exc()
finally:
    record()

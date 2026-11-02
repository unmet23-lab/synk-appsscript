"""tools/허깅페이스.py 블렌더렌더가 로컬로 넘긴 장을 그린다 — cpuai/blender-render-studio(render_worker.py)와 같은 설정으로
(2026-11-02, 허깅페이스 먼저 · 남은 장만 로컬). 두 쪽에서 그린 장이 한 묶음에 섞여도 같은 그림이 되게, Space가 장면에 거는
해상도 · 샘플 · 디노이즈 · 적응 샘플링 · 시드 · 출력 꼴을 그대로 건다. 파일 이름도 Space와 같은 frame_000001.png.

blender -b <장면.blend> -P tools/lib/블렌더로컬렌더.py -- '<설정 JSON>'
설정: {"출력": 폴더, "프레임": [1, 2, …], "가로", "세로", "비율", "샘플", "denoise", "adaptive_threshold", "seed",
       "투명", "fps", "엔진": "CYCLES|EEVEE", "장치": "OPTIX|CUDA|CPU", "camera": 이름 또는 null}
"""
import json
import os
import sys

import bpy

cfg = json.loads(sys.argv[sys.argv.index('--') + 1])
scene = bpy.context.scene
if cfg.get('camera'):
    scene.camera = bpy.data.objects[cfg['camera']]
if not scene.camera:
    raise SystemExit('장면에 활성 카메라가 없다')

엔진 = cfg.get('엔진', 'CYCLES')
if 엔진 == 'CYCLES':
    scene.render.engine = 'CYCLES'
else:
    engines = scene.render.bl_rna.properties['engine'].enum_items.keys()
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else 'BLENDER_EEVEE'
scene.render.resolution_x = int(cfg['가로'])
scene.render.resolution_y = int(cfg['세로'])
scene.render.resolution_percentage = int(cfg.get('비율', 100))
scene.render.film_transparent = bool(cfg.get('투명', False))
scene.render.fps = int(cfg.get('fps', 24))
scene.render.fps_base = 1.0
scene.render.use_file_extension = True
scene.render.use_overwrite = True
scene.render.use_placeholder = False
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
if hasattr(scene.render, 'use_motion_blur'):
    scene.render.use_motion_blur = False

if 엔진 == 'CYCLES':
    scene.cycles.samples = int(cfg['샘플'])
    scene.cycles.use_denoising = bool(cfg.get('denoise', True))
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = float(cfg.get('adaptive_threshold', 0.02))
    scene.cycles.seed = int(cfg.get('seed', 0))
    scene.cycles.shading_system = False
    장치 = cfg.get('장치', 'OPTIX')
    if 장치 == 'CPU':
        scene.cycles.device = 'CPU'
    else:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 장치
        prefs.refresh_devices() if hasattr(prefs, 'refresh_devices') else prefs.get_devices()
        쓴것 = 0
        for d in prefs.devices:
            d.use = d.type == 장치     # Space처럼 CPU를 섞지 않는다
            쓴것 += d.use
        if not 쓴것:
            raise SystemExit(f'{장치} 장치가 없다')
        scene.cycles.device = 'GPU'
else:
    scene.eevee.taa_render_samples = int(cfg['샘플'])

os.makedirs(cfg['출력'], exist_ok=True)
for f in cfg['프레임']:
    scene.frame_set(int(f))
    scene.render.filepath = os.path.join(cfg['출력'], f'frame_{int(f):06d}.png')
    bpy.ops.render.render(write_still=True)
    print(f'[로컬렌더] frame {f} 끝', flush=True)

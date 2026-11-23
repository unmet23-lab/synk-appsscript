"""공간 비우기 2판 4주 시험의 「보기만」 2주(SPACE_DESIGN 12.6 A): 엔진 공간 보고서의 2판 후보와 공간 지킴이의 지울 판단을 견준다.

읽기만 한다. 아무것도 지우지 않는다. 경로가 든 자세한 결과는 공용 작업본 `.tmp/공간시험/<날짜>.json`에 두고,
저장소 문서에는 이 도구가 화면에 찍는 수와 크기만 옮긴다.

  python -X utf8 test-support/space-compare.py [--보고서 <space.json>] [--지킴이 <폴더>] [--결과 <폴더>] [--작업사본]

누르지 않은 날은 먼저 `node test-support/space-preview.cjs --실행`으로 미리 보기를 받는다. 엔진 장부(spacereed.jsonl)에
미리 보기 누름이 있으면 그 「지울 것」도 지킴이와 견준다(빌드 폴더는 경로로, 임시는 맨 위 항목으로).

--작업사본을 주면 지킴이의 작업 사본 판단도 센다(git을 사본마다 불러 오래 걸린다).
"""
import importlib
import json
import os
import sys
import time
from pathlib import Path

FREE_KINDS = ('node_modules', 'target', 'venv', 'pycache', 'temp', 'temp-profile')  # 2판이 비우는 종류(12.1)
BUILD_KINDS = ('node_modules', 'target', 'venv', 'pycache')
GB = 1024 ** 3


def arg(name, default):
    a = sys.argv[1:]
    return Path(a[a.index(name) + 1]) if name in a and a.index(name) + 1 < len(a) else default


def key(p):
    return os.path.normcase(os.path.normpath(str(p))).rstrip('\\')


def gb(n):
    return f'{n / GB:.1f}GB'


def load_report(file):
    try:
        v = json.loads(file.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None
    return v if isinstance(v, dict) and isinstance(v.get('candidates'), list) else None


def last_preview(state):
    """장부의 마지막 미리 보기 누름의 「지울 것」. 없으면 None"""
    try:
        with open(state / 'space' / 'freed.jsonl', 'rb') as f:
            f.seek(0, 2); size = f.tell(); f.seek(max(0, size - 1048576))
            text = f.read().decode('utf-8', 'replace')
    except OSError:
        return None
    rows = []
    for line in text.splitlines():
        try:
            r = json.loads(line)
        except ValueError:
            continue
        if isinstance(r, dict) and r.get('stage') == 'would' and isinstance(r.get('at'), str) and isinstance(r.get('report'), str):
            rows.append(r)
    if not rows:
        return None
    last = rows[-1]
    same = [r for r in rows if r['at'] == last['at'] and r['report'] == last['report']]
    temp = []
    for r in same:
        if r.get('kind') == 'temp' and isinstance(r.get('list'), str):
            try:
                for line in (state / 'space' / r['list']).read_text(encoding='utf-8').splitlines():
                    b, _, p = line.partition('\t')
                    if p:
                        temp.append({'path': p, 'bytes': int(b or 0)})
            except (OSError, ValueError):
                pass
    return {'at': last['at'], 'build': [r for r in same if r.get('kind') in BUILD_KINDS],
            'profiles': [r for r in same if r.get('kind') == 'temp-profile'], 'temp': temp}


def compare_preview(prev, guard):
    e_build = {key(r['path']): r for r in prev['build'] if isinstance(r.get('path'), str)}
    g_build = {key(r['path']): r for r in guard['modules']}
    e_temp = {key(r['path']): r for r in prev['temp'] + [x for x in prev['profiles'] if isinstance(x.get('path'), str)]}
    g_temp = {key(r['path']): r for r in guard['temp']}
    def split(e, g):
        both, e_only, g_only = sorted(set(e) & set(g)), sorted(set(e) - set(g)), sorted(set(g) - set(e))
        size = lambda d, ks: sum(int(d[k].get('bytes') or 0) for k in ks)
        return {'both': {'n': len(both), 'bytes': size(e, both)}, 'engineOnly': {'n': len(e_only), 'bytes': size(e, e_only)},
                'guardOnly': {'n': len(g_only), 'bytes': size(g, g_only)}, 'paths': {'both': both, 'engineOnly': e_only, 'guardOnly': g_only}}
    return {'at': prev['at'], 'build': split(e_build, g_build), 'temp': split(e_temp, g_temp)}


def guard_rows(folder, now):
    """지킴이의 판단(go=False 길만). 지킴이 모듈을 그 폴더에서 읽는다 — 지킴이 쪽 파일은 바꾸지 않는다."""
    sys.path.insert(0, str(folder))
    g = importlib.import_module('공간지킴이')
    commands = g.process_commands()
    talks = g.session_talks()
    temp, kept = g.temp_targets(now, commands or '', talks=talks)
    modules = g.render_modules(now)
    copies = g.release_copies(now)
    worktrees = g.worktree_targets(now, commands or '')[0] if '--작업사본' in sys.argv else []
    cache_bytes, caches = g.clear_caches(go=False)
    return {'commandsRead': commands is not None, 'temp': temp, 'tempKept': kept, 'modules': modules,
            'copies': copies if isinstance(copies, list) else [], 'worktrees': worktrees or [], 'cacheBytes': cache_bytes, 'caches': caches,
            'renderRoot': key(g.RENDER_ROOT), 'tempDir': key(g.TEMP_DIR)}


def compare(report, guard):
    auto = [c for c in report['candidates'] if c.get('grade') == 'auto']
    mine = [c for c in auto if c.get('kind') in FREE_KINDS]
    out = {'reportAt': report.get('createdAt'), 'lapFinishedAt': (report.get('lap') or {}).get('finishedAt'),
           'engineAutoOutside2': sorted({c.get('kind') for c in auto if c.get('kind') not in FREE_KINDS})}
    # 빌드 산출물: 경로로 맞댄다. 지킴이는 영상 프로젝트(docs/마케팅 아래 remotion)의 node_modules만 본다.
    e_build = {key(c['path']): c for c in mine if c.get('kind') in BUILD_KINDS}
    g_build = {key(r['path']): r for r in guard['modules']}
    both = sorted(set(e_build) & set(g_build))
    e_only = sorted(set(e_build) - set(g_build))
    g_only = sorted(set(g_build) - set(e_build))
    seen_by_guard = [p for p in e_only if p.startswith(guard['renderRoot'] + '\\')]
    out['build'] = {
        'both': {'n': len(both), 'bytes': sum(e_build[p]['bytes'] for p in both)},
        'engineOnly': {'n': len(e_only), 'bytes': sum(e_build[p]['bytes'] for p in e_only),
                       'guardLooksThere': len(seen_by_guard), 'guardDoesNotLook': len(e_only) - len(seen_by_guard)},
        'guardOnly': {'n': len(g_only), 'bytes': sum(g_build[p]['bytes'] for p in g_only)},
        'paths': {'both': both, 'engineOnly': e_only, 'guardOnly': g_only, 'engineOnlyWhereGuardLooks': seen_by_guard},
    }
    # 임시: 엔진은 %TEMP%의 「이틀 넘은 것」을 한 후보로 묶고 자동화 임시 프로필만 따로 낸다. 지킴이는 맨 위 항목마다 낸다.
    e_temp = [c for c in mine if c.get('kind') == 'temp']
    e_prof = {key(c['path']): c for c in mine if c.get('kind') == 'temp-profile'}
    g_temp = [r for r in guard['temp'] if r.get('kind') == 'temp']
    g_session = [r for r in guard['temp'] if r.get('kind') == 'session-temp']
    prof_both = [p for p in e_prof if p in {key(r['path']) for r in g_temp}]
    out['temp'] = {
        'engineOldBytes': sum(c['bytes'] for c in e_temp), 'engineProfiles': {'n': len(e_prof), 'bytes': sum(c['bytes'] for c in e_prof.values()), 'alsoGuard': len(prof_both)},
        'guardTop': {'n': len(g_temp), 'bytes': sum(r['bytes'] for r in g_temp)},
        'guardSession': {'n': len(g_session), 'bytes': sum(r['bytes'] for r in g_session)},
        'guardKept': guard['tempKept'], 'commandsRead': guard['commandsRead'],
    }
    # 지킴이만 다루는 갈래(2판 밖): 수와 크기만.
    out['guardOnlyKinds'] = {
        'worktrees': {'n': len(guard['worktrees']), 'bytes': sum(int(r.get('bytes') or 0) for r in guard['worktrees'])},
        'releaseCopies': {'n': len(guard['copies']), 'bytes': sum(int(r.get('bytes') or 0) for r in guard['copies'])},
        'caches': {'names': guard['caches'], 'bytes': guard['cacheBytes']},
    }
    return out


def main():
    now = time.time()
    report_file = arg('--보고서', Path(os.environ.get('APPDATA', '')) / 'SynkWorkBackup' / 'solio' / 'space.json')
    guard_dir = arg('--지킴이', Path.home() / 'Documents' / 'SYNK_원본창고')
    out_dir = arg('--결과', Path(__file__).resolve().parents[3] / '.tmp' / '공간시험')
    report = load_report(report_file)
    if report is None:
        print('엔진 공간 보고서가 아직 없습니다. 엔진 창에서 보호를 시작한 다음 날부터 생깁니다.')
        return 2
    if not report.get('lap'):
        print('엔진이 아직 드라이브를 한 바퀴 다 훑지 않아 후보가 없습니다. 다 훑은 다음 날 다시 돌려 주세요.')
        return 2
    guard = guard_rows(guard_dir, now)
    result = compare(report, guard)
    prev = last_preview(report_file.parent.parent)
    result['preview'] = compare_preview(prev, guard) if prev else None
    out_dir.mkdir(parents=True, exist_ok=True)
    day = time.strftime('%Y-%m-%d', time.localtime(now))
    (out_dir / f'{day}.json').write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding='utf-8')
    b, t, o = result['build'], result['temp'], result['guardOnlyKinds']
    print(f'보고서 {result["reportAt"]} · 바퀴 끝 {result["lapFinishedAt"]}')
    print(f'빌드 폴더: 둘 다 {b["both"]["n"]}개 {gb(b["both"]["bytes"])} · 엔진만 {b["engineOnly"]["n"]}개 {gb(b["engineOnly"]["bytes"])}'
          f'(지킴이가 보는 자리 {b["engineOnly"]["guardLooksThere"]}) · 지킴이만 {b["guardOnly"]["n"]}개 {gb(b["guardOnly"]["bytes"])}')
    print(f'임시: 엔진 이틀 넘은 것 {gb(t["engineOldBytes"])} · 자동화 프로필 {t["engineProfiles"]["n"]}개 · '
          f'지킴이 맨 위 {t["guardTop"]["n"]}개 {gb(t["guardTop"]["bytes"])} · 세션 임시 {t["guardSession"]["n"]}개 {gb(t["guardSession"]["bytes"])}'
          f'{"" if t["commandsRead"] else " · 명령줄을 못 읽어 지킴이는 오늘 임시를 지우지 않는 날"}')
    print(f'지킴이만 다루는 것: 작업 사본 {o["worktrees"]["n"]}개 {gb(o["worktrees"]["bytes"])} · 릴리스 사본 {o["releaseCopies"]["n"]}개 · '
          f'캐시 {", ".join(o["caches"]["names"]) or "없음"} {gb(o["caches"]["bytes"])}')
    pv = result['preview']
    if pv:
        pb, pt = pv['build'], pv['temp']
        print(f'미리 보기({pv["at"]})의 지울 것: 빌드 폴더 둘 다 {pb["both"]["n"]} · 엔진만 {pb["engineOnly"]["n"]}개 {gb(pb["engineOnly"]["bytes"])} · 지킴이만 {pb["guardOnly"]["n"]} / '
              f'임시 둘 다 {pt["both"]["n"]} · 엔진만 {pt["engineOnly"]["n"]}개 {gb(pt["engineOnly"]["bytes"])} · 지킴이만 {pt["guardOnly"]["n"]}')
        print('「엔진만」은 하나씩 읽어 정말 쉬는 것인지 판정한다(12.6).')
    else:
        print('장부에 미리 보기 누름이 아직 없습니다. 누르지 않은 날은 space-preview.cjs --실행을 먼저 돌립니다.')
    if result['engineAutoOutside2']:
        print(f'엔진 가 등급이지만 2판이 비우지 않는 종류: {", ".join(result["engineAutoOutside2"])}')
    print(f'자세한 경로: {out_dir / (day + ".json")}')
    return 0


if __name__ == '__main__':
    sys.exit(main())

"""Import and exercise pure helpers only. Never call execute/write_verified_zip."""
import importlib.util
import json
from pathlib import Path
import sys

tool = Path(__file__).resolve().parent.parent / '출고도구.py'
spec = importlib.util.spec_from_file_location('synk_export_independent_readonly', tool)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
plan = module.ExportPlan()
results = []

def check(name, condition):
    if not condition:
        raise AssertionError(name)
    results.append(name)

for bad in ['_검토/실물_독립검수.md', '공개수업/음성/_runtime/a.py', '공개수업/음성/전사-01.json', '브랜드킷/생성로그.json', 'assets/master-test.png', 'packages/x.zip', '.env', '../private.txt']:
    check('exclude:' + bad, not plan.allowed(bad))
check('keep upload guide', plan.allowed('_검토/업로드조건.md'))
for url in ['../outside.txt', '/absolute/file.pdf', 'file:///C:/private.txt', '../%2e%2e/private.txt']:
    try:
        module.target_of('index.html', url)
    except ValueError:
        results.append('refuse:' + url)
    else:
        raise AssertionError('accepted nonportable URL:' + url)
check('local spaces/query', module.target_of('index.html', '제공자료/a%20b.pdf?download=1#p1') == '제공자료/a b.pdf')
check('external bypass', module.target_of('index.html', 'https://example.org/file.pdf') is None)
html = '앞 글자\n<a class="zip" href="packages/01-lab-youtube.zip?download=1">꾸러미 <b>받기</b></a>\n<a href="제공자료/01_소개문.pdf">PDF</a><button>남길 버튼</button>'
expected = '앞 글자\n\n<a href="제공자료/01_소개문.pdf">PDF</a><button>남길 버튼</button>'
output, removed = module.PortableButtons(html, 'index.html', plan.zip_paths).result()
check('only exact ZIP anchor removed', output.decode('utf-8') == expected and removed == 1)
check('all nine required videos', len(plan.video_paths) == 9)
print(json.dumps({'mode': 'pure-functions-no-artifact-write', 'checks': len(results), 'passed': results}, ensure_ascii=False, indent=2))

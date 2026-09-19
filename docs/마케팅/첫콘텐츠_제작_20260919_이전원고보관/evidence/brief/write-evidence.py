import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone
from PIL import Image
from pypdf import PdfReader

base = Path(__file__).resolve().parents[2]
folder = Path(__file__).resolve().parent
run = json.loads((folder / 'demo-run.json').read_text(encoding='utf-8'))
files = []
for p in sorted(folder.iterdir()):
    if p.suffix not in {'.pdf', '.png', '.html', '.txt', '.json', '.cjs'}:
        continue
    row = {'path': p.relative_to(base).as_posix(), 'bytes': p.stat().st_size,
           'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
    if p.suffix == '.png':
        row['pixels'] = list(Image.open(p).size)
    if p.suffix == '.pdf':
        row['pages'] = len(PdfReader(p).pages)
    files.append(row)

data = {
    'version': 1,
    'verified_at': datetime.now(timezone.utc).isoformat(),
    'content_ids': ['S4', 'S5'],
    'subject': 'Playwright HTML-to-PDF export followed by visual inspection of actual PDF page rasters',
    'tool': {'name':'Playwright', 'repository':'https://github.com/microsoft/playwright',
             'executed_version':'1.62.1', 'license':'Apache-2.0',
             'license_source':'https://github.com/microsoft/playwright/blob/main/LICENSE'},
    'supporting_tools': ['Installed Google Chrome 153 PDF export', 'Poppler pdftoppm 26.07.0 PDF rasterization', 'pypdf text extraction'],
    'sources': [
        {'url':'https://playwright.dev/docs/api/class-page#page-pdf', 'supports':'PDF export and print-media behavior'},
        {'url':'https://playwright.dev/docs/library', 'supports':'Library and browser setup'},
        {'url':'https://github.com/microsoft/playwright', 'supports':'Official public repository'},
        {'url':'https://github.com/microsoft/playwright/blob/main/LICENSE', 'supports':'Apache-2.0 license'},
        {'url':'https://github.com/openai/skills', 'supports':'Original proposed repository is deprecated; not recommended for a new install in this content'},
    ],
    'synthetic_example': True,
    'intentional_error': 'Before HTML forces a long table cell to nowrap + overflow:hidden, deliberately reproducing text clipping.',
    'observed_result': 'Before PDF visibly clips the 02 row. After enables wrapping and displays the full sentence. Final footer and body do not overlap.',
    'fix': 'white-space:normal; word-break:keep-all; overflow-wrap:anywhere; naturally sized rows; final footer whitespace verified.',
    'visual_review': {'before_full_page':True,'after_full_page':True,'both_table_crops':True,'final_after_no_unintended_clipping':True},
    'quality_boundary': 'Synthetic illustration; no real customer data, no AI failure-rate claim, no timing/engagement claim, no automatic quality guarantee.',
    'voice_status': 'Not generated in this task; root will choose a fresh/clear Typecast voice after account access is ready.',
    'publication_status':'not_published',
    'run':run,
    'files':files,
}
(base / 'brief-evidence.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
md = (base / 'copy/S4.md').read_text(encoding='utf-8')
narration = md.split('## 내레이션',1)[1].split('## 컷 구성',1)[0].strip()
(base / 'copy/S4-narration.txt').write_text(narration+'\n',encoding='utf-8')
print(json.dumps({'files':len(files),'narration_characters':len(narration),'evidence':'brief-evidence.json'},ensure_ascii=False))

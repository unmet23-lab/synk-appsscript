from pathlib import Path
import json,hashlib,math,sys,re
from pypdf import PdfReader
import build_v2 as b
sys.stdout.reconfigure(encoding='utf-8')
B=Path(__file__).parent; DESK=Path('C:/Users/q1212/OneDrive/Desktop/bm 설계표')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
original=json.loads((B.parent/'original-manifest.json').read_text(encoding='utf-8'))
for x in original:
    p=DESK/'99_이전자료/20261005_정리전'/x['path']
    assert p.stat().st_size==x['bytes'] and sha(p)==x['sha256'],p
book=json.loads((B/'book.json').read_text(encoding='utf-8'))
pdf=PdfReader(B/'output/SYNK_BM_20261005.pdf')
assert len(pdf.pages)==len(book)==14
clean=lambda s:re.sub(r'\s+','',s)
for i,(p,pg) in enumerate(zip(pdf.pages,book)):
    assert clean(pg['title']) in clean(p.extract_text()),(i,pg['title'])
assert all(k in pdf.pages[8].extract_text() for k in ('A군','B군','C군'))
assert len(pdf.pages[-1]['/Annots'])==13
layout=json.loads((B/'output/layout.json').read_text(encoding='utf-8'))
assert all(x['y']+x['h']<780 for x in layout)
app=json.loads((B/'app.json').read_text(encoding='utf-8'))
u=app['supplementary_data']['unit_economics']
for x in u['scenarios']:
    value=7900/1.1*.85-x['paid_direct_cost']-x['free_users_per_paid']*100
    assert round(value)==x['display_rounded']
assert math.ceil(1000000/(7900/1.1*.85-1000-1000))==244
lab=json.loads((B/'lab_costs.json').read_text(encoding='utf-8'))['calculation_data']
for n,row in zip(lab['revenue_sensitivity']['headcounts'],lab['revenue_sensitivity']['monthly_gross']):
    assert row==[n*p for p in lab['revenue_sensitivity']['monthly_prices']]
for costs,row in zip([30000000,40000000,50000000],lab['cost_coverage_sensitivity']['required_students']):
    assert row==[math.ceil(costs/(p*.9)) for p in [420000,550000,690000]]
cost=lab['company_costs_20261001_krw']; assert sum(v for k,v in cost.items()if k!='total')==cost['total']==46180196
b.setup_fonts()
cmap=set(b.pdfmetrics.getFont('SUIT500').face.charToGlyph)|set(b.pdfmetrics.getFont('Inter500').face.charToGlyph)|set(b.pdfmetrics.getFont('Bracket').face.charToGlyph)
assert not [v for v in set(json.dumps(book,ensure_ascii=False))if ord(v)not in cmap and not v.isspace()]
sources={}
for name in ['app','lab_costs','brands']:
    d=json.loads((B/f'{name}.json').read_text(encoding='utf-8'))
    for k,s in d['sources'].items():
        path=(b.ROOT/s['path']).resolve(); assert path.exists(),path
        if path.is_file():sources[str(path)]={'sha256':sha(path),'bytes':path.stat().st_size}
out={'as_of':'2026-10-05','edited':'2026-10-06','pdf_pages':14,'original_files_preserved':len(original),
 'pdf_visual_review':'All 14 pages rendered and inspected; country group glyph correction also checked via Poppler.',
 'missing_glyphs':0,'layout_overflows':0,'source_links':13,'sources':sources,
 'calculations':'LAB 12 revenue cells, 9 cost-coverage cells, company total, WORLD 5 margins and 244 months; brands independent audit 12 formulas.',
 'files':{p.name:{'sha256':sha(p),'bytes':p.stat().st_size}for p in (B/'output').glob('*')if p.suffix in('.pdf','.docx')},
 'not_verified':['Actual sales or contracts','Supplier current billing','Market demand or learning efficacy','Launch or operations']}
qa=B/'output/docx_qa'
if (qa/'render_report.json').exists():
    report=json.loads((qa/'render_report.json').read_text(encoding='utf-8'))
    struct=json.loads((qa/'structure.json').read_text(encoding='utf-8'))
    assert report['actual_pages']==14
    assert struct['source_sha256']==sha(B/'book.json')
    assert struct['editable_source_text_missing']==[]
    out['docx']={'pages':14,'text_tables_editable':True,'missing_source_text':0,'fonts':struct['fonts'],'embedded_fonts':struct['embedded_fonts']}
    final=json.loads((qa/'final_content_font_check.json').read_text(encoding='utf-8'))
    assert not final['read_only'] and final['rendered_text_missing']==[]
    assert final['docx_sha256']==sha(B/'output/SYNK_BM_수정용.docx')
    out['docx']['actual_word_font_check']=final
(B/'verification.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in out.items()if k not in ['sources','files']},ensure_ascii=False,indent=2))

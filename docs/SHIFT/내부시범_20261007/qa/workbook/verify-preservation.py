import json
import zipfile
import hashlib
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
manifest = json.loads((HERE / 'manifest.json').read_text(encoding='utf-8-sig'))
changes = json.loads((HERE / 'changes.json').read_text(encoding='utf-8-sig'))
allowed_values = {(x['sheet'], x['cell']) for x in changes}
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def canonical(node):
    if node is None:
        return None
    return (node.tag.split('}')[-1], sorted(node.attrib.items()), node.text or '', [canonical(child) for child in node])

def read_book(file):
    with zipfile.ZipFile(file) as archive:
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        styles = ET.fromstring(archive.read('xl/styles.xml'))
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            for item in ET.fromstring(archive.read('xl/sharedStrings.xml')):
                strings.append(''.join(x.text or '' for x in item.findall('.//m:t', NS)))
        custom_formats = {int(x.attrib['numFmtId']): x.attrib['formatCode'] for x in styles.findall('m:numFmts/m:numFmt', NS)}
        fonts, fills, borders = [list(styles.find(f'm:{kind}', NS)) for kind in ('fonts', 'fills', 'borders')]
        formats = []
        for style in styles.findall('m:cellXfs/m:xf', NS):
            fmt_id = int(style.attrib.get('numFmtId', 0))
            formats.append({
                'font': canonical(fonts[int(style.attrib.get('fontId', 0))]),
                'fill': canonical(fills[int(style.attrib.get('fillId', 0))]),
                'border': canonical(borders[int(style.attrib.get('borderId', 0))]),
                'numberFormat': custom_formats.get(fmt_id, f'builtin:{fmt_id}'),
                'alignment': canonical(style.find('m:alignment', NS)),
                'protection': canonical(style.find('m:protection', NS)),
            })
        sheets = {}
        for index, item in enumerate(workbook.findall('m:sheets/m:sheet', NS), 1):
            sheet = ET.fromstring(archive.read(f'xl/worksheets/sheet{index}.xml'))
            cells = {}
            for cell in sheet.findall('m:sheetData/m:row/m:c', NS):
                formula = cell.find('m:f', NS)
                value = cell.find('m:v', NS)
                text = None if value is None else value.text
                if cell.attrib.get('t') == 's' and text is not None:
                    text = strings[int(text)]
                elif cell.attrib.get('t') == 'inlineStr':
                    text = ''.join(x.text or '' for x in cell.findall('.//m:t', NS))
                cells[cell.attrib['r']] = {'formula': None if formula is None else formula.text, 'value': text, 'style': formats[int(cell.attrib.get('s', 0))]}
            sheets[item.attrib['name']] = {
                'cells': cells,
                'validations': [canonical(x) for x in sheet.findall('m:dataValidations/m:dataValidation', NS)],
                'conditionalFormatting': [canonical(x) for x in sheet.findall('m:conditionalFormatting', NS)],
                'views': [canonical(x) for x in sheet.findall('m:sheetViews/m:sheetView', NS)],
                'mergeCells': canonical(sheet.find('m:mergeCells', NS)),
                'tableParts': canonical(sheet.find('m:tableParts', NS)),
            }
        return {'sheetNames': list(sheets), 'sheets': sheets, 'names': canonical(workbook.find('m:definedNames', NS))}

before = read_book(manifest['template'])
after = read_book(manifest['output'])
checks = []
def check(name, expected, actual):
    checks.append({'name': name, 'passed': expected == actual})
    if expected != actual:
        raise RuntimeError(name)

check('6개 시트 이름과 순서 보존', before['sheetNames'], after['sheetNames'])
check('기존 이름 정의 보존', before['names'], after['names'])
formula_count = style_checks = preserved_values = 0
style_exceptions = {('요약', f'{col}10') for col in 'DEF'}
style_exceptions |= {('요약', f'{col}11') for col in 'DEF'}
style_exceptions |= {('요약', 'F9')}
style_exceptions |= {('시행기록', f'{col}{row}') for col in 'ABCDEFGHIJKLMNOP' for row in (7, 8) if col in 'ABCDEFGHIJKLMP'}
for name in before['sheetNames']:
    old, new = before['sheets'][name], after['sheets'][name]
    for feature in ('validations', 'conditionalFormatting', 'views', 'mergeCells', 'tableParts'):
        check(f'{name} {feature} 보존', old[feature], new[feature])
    for address, cell in old['cells'].items():
        updated = new['cells'].get(address)
        if updated is None:
            raise RuntimeError(f'Cell missing after export: {name}!{address}')
        if cell['formula'] is not None:
            check(f'{name}!{address} 수식 보존', cell['formula'], updated['formula'])
            formula_count += 1
        elif (name, address) not in allowed_values:
            check(f'{name}!{address} 허용 외 값 보존', cell['value'], updated['value'])
            preserved_values += 1
        if (name, address) not in style_exceptions:
            check(f'{name}!{address} 서식 보존', cell['style'], updated['style'])
            style_checks += 1

report = {
    'status': 'saved-xlsx-formulas-values-styles-and-native-features-preserved',
    'checks': len(checks), 'passed': sum(x['passed'] for x in checks),
    'preservedFormulaCells': formula_count, 'preservedValues': preserved_values, 'preservedCellStyles': style_checks,
    'authorizedStyleExceptions': sorted(f'{sheet}!{address}' for sheet, address in style_exceptions),
    'changedValueCells': len(allowed_values), 'sheets': before['sheetNames'],
    'templateSha256': hashlib.sha256(Path(manifest['template']).read_bytes()).hexdigest(),
    'outputSha256': hashlib.sha256(Path(manifest['output']).read_bytes()).hexdigest(),
}
(HERE / 'saved-preservation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))

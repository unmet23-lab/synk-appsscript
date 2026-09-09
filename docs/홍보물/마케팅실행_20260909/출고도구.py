"""Curated, portable ZIP export. Default is read-only planning; --출고 is explicit final execution."""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import html
from html.parser import HTMLParser
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from urllib.parse import unquote, urlsplit
import zipfile

BASE = Path(__file__).resolve().parent
AGGREGATE = BASE.parent / f'{BASE.name}_업로드꾸러미.zip'
ACCOUNT_VIDEO_NUMBERS = {'01', '03', '04', '05', '06', '07', '09'}
COPY_NAMES = {'제목.txt', '게시문안.txt', '본문.md', '대체텍스트.txt', '댓글답변.md', '업로드안내.md'}
ROOT_REQUIRED = {
    'index.html', 'execution.css', '읽어주세요.md', '실행적용.md', '실행적용.html',
    '원고/후속운영.md', '원고/후속운영.html', '자료실/index.html',
    '브랜드킷/index.html', '브랜드킷/사용규칙.md', '_검토/업로드조건.md',
    '브랜드킷/SYNK-Ink-정밀.svg', '브랜드킷/SYNK-Paper-정밀.svg',
    '브랜드킷/SYNK-Ink.png', '브랜드킷/SYNK-Paper.png',
    '공개수업/index.html', '공개수업/수업.mp4', '공개수업/클리닉.mp4',
    '공개수업/수업.srt', '공개수업/클리닉.srt',
    '공개수업/영상제작범위_읽어주세요.md',
    '공개수업/표지.jpg', '공개수업/클리닉-표지.jpg',
    '제공자료/소통_후속도움.md', '제공자료/소통_후속도움.html',
}
TEXT_TYPES = {'.html', '.htm', '.css', '.md', '.svg', '.js'}


def load(relative: str):
    return json.loads((BASE / relative).read_text(encoding='utf-8-sig'))


def digest_file(path: Path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def target_of(source: str, value: str):
    """Return a base-relative local file; external/data/fragment URLs need no packaged member."""
    value = html.unescape(value.strip()).replace('\\', '/')
    if not value or value.startswith(('#', '//')):
        return None
    parsed = urlsplit(value)
    if parsed.scheme:
        if parsed.scheme.lower() in {'http', 'https', 'mailto', 'tel', 'data', 'blob', 'javascript'}:
            return None
        raise ValueError(f'portable URL이 아닌 scheme: {parsed.scheme}')
    raw_path = unquote(parsed.path)
    if not raw_path:
        return None
    if raw_path.startswith('/'):
        raise ValueError('기계/사이트 루트 절대 경로')
    resolved = ((BASE / source).parent / raw_path).resolve()
    try:
        relative = resolved.relative_to(BASE.resolve()).as_posix()
    except ValueError:
        raise ValueError('꾸러미 바깥 파일 참조') from None
    if resolved.is_dir() or raw_path.endswith('/'):
        relative = str(PurePosixPath(relative) / 'index.html')
    return relative


class LinkReader(HTMLParser):
    def __init__(self, text: str):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if not value:
                continue
            if key in {'href', 'src', 'poster', 'data-src', 'xlink:href'}:
                self.links.append(value)
            elif key == 'srcset' and not value.startswith('data:'):
                self.links.extend(piece.strip().split()[0] for piece in value.split(',') if piece.strip())


def references(source: str, content: bytes):
    suffix = PurePosixPath(source).suffix.lower()
    if suffix not in TEXT_TYPES:
        return []
    text = content.decode('utf-8-sig')
    found = []
    if suffix in {'.html', '.htm', '.svg'}:
        found.extend(LinkReader(text).links)
    if suffix == '.md':
        # Fenced example code is not a navigable Markdown link.
        cleaned = re.sub(r'^```.*?^```\s*$', '', text, flags=re.M | re.S)
        found.extend(m.group(1).strip('<>') for m in re.finditer(r'!?\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)', cleaned))
    if suffix in {'.css', '.html', '.htm', '.svg'}:
        found.extend(m.group(2).strip() for m in re.finditer(r'url\(\s*([\"\']?)(.*?)\1\s*\)', text, flags=re.S))
        found.extend(m.group(1) for m in re.finditer(r'@import\s+[\"\']([^\"\']+)[\"\']', text))
    if suffix in {'.html', '.htm', '.js'}:
        found.extend(m.group(2) for m in re.finditer(r'\b(?:fetch|import|importScripts)\s*\(\s*([\"\'])(.*?)\1', text))
    return found


class PortableButtons(HTMLParser):
    """Remove only complete anchors targeting the 19 account ZIPs; preserve all other source bytes."""
    def __init__(self, text: str, source: str, zip_paths: set[str]):
        super().__init__(convert_charrefs=False)
        self.text, self.source, self.zip_paths = text, source, zip_paths
        self.offsets = [0]
        for line in text.splitlines(keepends=True):
            self.offsets.append(self.offsets[-1] + len(line))
        self.stack, self.spans = [], []
        self.feed(text)
        if any(remove for _, remove in self.stack):
            raise ValueError(f'{source}: 닫히지 않은 ZIP 다운로드 링크')

    def at(self):
        line, column = self.getpos()
        return self.offsets[line - 1] + column

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            href = dict(attrs).get('href', '')
            try:
                remove = target_of(self.source, href) in self.zip_paths
            except ValueError:
                remove = False
            self.stack.append((self.at(), remove))

    def handle_endtag(self, tag):
        if tag == 'a' and self.stack:
            start, remove = self.stack.pop()
            if remove:
                end = self.text.find('>', self.at()) + 1
                self.spans.append((start, end))

    def result(self):
        text = self.text
        for start, end in sorted(self.spans, reverse=True):
            text = text[:start] + text[end:]
        return text.encode('utf-8'), len(self.spans)


@dataclass
class Entry:
    relative: str
    source: Path
    source_sha256: str
    output_sha256: str
    size: int
    data: bytes | None = None
    removed_zip_buttons: int = 0


class ExportPlan:
    def __init__(self):
        self.content = load('원고/콘텐츠원고.json')
        self.items = self.content['items']
        self.ids = [x['id'] for x in self.items]
        if len(self.ids) != 19 or len(set(self.ids)) != 19:
            raise ValueError('계정은 고유한 19개여야 합니다')
        if sorted(x[:2] for x in self.ids) != [f'{n:02}' for n in range(1, 20)]:
            raise ValueError('계정 번호는 01~19여야 합니다')
        if any(not re.fullmatch(r'\d{2}-[a-z0-9-]+', x) for x in self.ids):
            raise ValueError('안전하지 않은 계정 폴더 이름')
        self.resources = load('제공자료/제공자료.json')['materials']
        if len(self.resources) != 6:
            raise ValueError('완결 제공자료 6종이 필요합니다')
        self.resource_map = {}
        for material in self.resources:
            name = material['sourceFile']
            if not re.fullmatch(r'0[1-6]_[^/\\]+\.md', name):
                raise ValueError('제공자료 원본 경로를 확인하세요')
            self.resource_map[material['id']] = PurePosixPath(name).stem
        self.zip_paths = {f'packages/{item_id}.zip' for item_id in self.ids}
        self.brandkit = load('브랜드킷/배치명세.json')['items']
        if len(self.brandkit) != 8 or any(not re.fullmatch(r'배치용/SYNK(?:-(?:LAB|SHIFT|PULSE))?-(?:Ink|Paper)\.png', item['file']) for item in self.brandkit):
            raise ValueError('승인된 브랜드 배치 PNG 8종 계약을 확인하세요')
        self.entries, self.errors, self.packages = {}, [], {}
        self.whole = set()
        self.video_paths = {f'{x}/video.mp4' for x in self.ids if x[:2] in ACCOUNT_VIDEO_NUMBERS}
        self.video_paths |= {'공개수업/수업.mp4', '공개수업/클리닉.mp4'}

    def allowed(self, relative: str):
        p = PurePosixPath(relative)
        if p.is_absolute() or '..' in p.parts or any(x.startswith('.') for x in p.parts):
            return False
        if any(x in {'_runtime', '_검토', 'packages', 'node_modules', '__pycache__'} for x in p.parts):
            return relative == '_검토/업로드조건.md'
        if p.name.startswith('master-') or p.name.endswith('.source.wav'):
            return False
        if relative in ROOT_REQUIRED:
            return True
        if p.parts[0] in self.ids and len(p.parts) == 2:
            return p.name in COPY_NAMES | {'index.html', 'cards.html', 'cover.jpg', 'video.mp4', '자막.srt'} or bool(re.fullmatch(r'upload-\d{2}\.jpg', p.name))
        if p.parts[0] == 'assets':
            return p.suffix.lower() in {'.png', '.jpg', '.jpeg', '.webp', '.svg', '.woff', '.woff2', '.ttf', '.css', '.js'}
        if p.parts[0] == '제공자료' and len(p.parts) == 2:
            return any(p.name in {f'{stem}.md', f'{stem}.pdf', f'{stem}.html', f'{stem}_실습.html'} for stem in self.resource_map.values()) or p.name in {'소통_후속도움.md', '소통_후속도움.html'}
        if p.parts[0] == '브랜드킷':
            return len(p.parts) == 3 and p.parts[1] == '배치용' and p.suffix.lower() == '.png'
        if p.parts[0] == '공개수업' and len(p.parts) == 2:
            return p.suffix.lower() in {'.html', '.mp4', '.srt', '.vtt', '.txt', '.md'} and not re.search(r'검증|검수|보고|생성|제작|원고|prompt|job', p.name, re.I)
        if p.parts[:2] == ('공개수업', '음성') and len(p.parts) == 3:
            return p.suffix.lower() in {'.mp3', '.wav'} and bool(re.fullmatch(r'(?:sample-kevin|chapter-\d{2}(?:-r\d+)?|clinic-\d{2})\.(?:mp3|wav)', p.name))
        return False

    def entry(self, relative: str):
        if relative in self.entries:
            return self.entries[relative]
        if not self.allowed(relative):
            self.errors.append({'kind': 'excluded-dependency', 'path': relative})
            return None
        path = BASE / relative
        if path.is_symlink() or not path.is_file():
            self.errors.append({'kind': 'missing-or-symlink', 'path': relative})
            return None
        if not path.resolve().is_relative_to(BASE.resolve()):
            self.errors.append({'kind': 'outside-package', 'path': relative})
            return None
        source_hash = digest_file(path)
        data, removed = None, 0
        if path.suffix.lower() in {'.html', '.htm'}:
            raw = path.read_bytes()
            data, removed = PortableButtons(raw.decode('utf-8'), relative, self.zip_paths).result()
            if not removed:
                data = raw
        output_hash = hashlib.sha256(data).hexdigest() if data is not None else source_hash
        entry = Entry(relative, path, source_hash, output_hash, len(data) if data is not None else path.stat().st_size, data, removed)
        if entry.size == 0:
            self.errors.append({'kind': 'empty-file', 'path': relative})
        self.entries[relative] = entry
        return entry

    def closure(self, seeds: set[str], web: bool):
        selected, pending = set(), list(seeds)
        while pending:
            relative = pending.pop()
            if relative in selected:
                continue
            selected.add(relative)
            entry = self.entry(relative)
            if entry is None:
                continue
            suffix = PurePosixPath(relative).suffix.lower()
            if suffix not in TEXT_TYPES or (not web and suffix != '.md'):
                continue
            content = entry.data if entry.data is not None else entry.source.read_bytes()
            for url in references(relative, content):
                try:
                    target = target_of(relative, url)
                except ValueError as exc:
                    self.errors.append({'kind': 'nonportable-link', 'source': relative, 'target': url, 'reason': str(exc)})
                    continue
                if target:
                    if target in self.zip_paths:
                        self.errors.append({'kind': 'zip-button-not-removed', 'source': relative, 'target': target})
                    else:
                        pending.append(target)
        return selected

    def build(self):
        whole_seeds = set(ROOT_REQUIRED)
        for item in self.brandkit:
            relative = f"브랜드킷/{item['file']}"
            whole_seeds.add(relative)
            entry = self.entry(relative)
            if entry and entry.source_sha256 != item['sha256']:
                self.errors.append({'kind': 'brand-placement-hash-mismatch', 'path': relative})
        for stem in self.resource_map.values():
            whole_seeds.update(f'제공자료/{stem}{suffix}' for suffix in ('.md', '.pdf', '.html', '_실습.html'))
        # Root may finish these public pages after this tool is written; inspect the current files each run.
        for page in (BASE / '공개수업').glob('*.html'):
            whole_seeds.add(page.relative_to(BASE).as_posix())
        for item in self.items:
            item_id = item['id']
            seeds = {f'{item_id}/{name}' for name in COPY_NAMES}
            seeds.add(f'{item_id}/cover.jpg')
            count = len(item.get('cards') or [])
            if count < 1:
                self.errors.append({'kind': 'missing-card-contract', 'path': item_id})
            seeds.update(f'{item_id}/upload-{number:02}.jpg' for number in range(1, count + 1))
            if item_id[:2] in ACCOUNT_VIDEO_NUMBERS:
                seeds |= {f'{item_id}/video.mp4', f'{item_id}/자막.srt'}
            elif item.get('format') == 'video':
                self.errors.append({'kind': 'unexpected-video-contract', 'path': item_id})
            seeds.add('_검토/업로드조건.md')
            for resource_id in item.get('resourceIds') or []:
                if resource_id not in self.resource_map:
                    self.errors.append({'kind': 'unknown-resource', 'account': item_id, 'id': resource_id})
                    continue
                stem = self.resource_map[resource_id]
                seeds |= {f'제공자료/{stem}.md', f'제공자료/{stem}.pdf'}
            self.packages[item_id] = self.closure(seeds, web=False)
            whole_seeds |= self.packages[item_id] | {f'{item_id}/index.html', f'{item_id}/cards.html'}
        self.whole = self.closure(whole_seeds, web=True)
        self.check_videos()
        # De-duplicate diagnostics without hiding their source paths.
        self.errors = list({json.dumps(x, ensure_ascii=False, sort_keys=True): x for x in self.errors}.values())
        return self

    def check_videos(self):
        executable = shutil.which('ffprobe')
        if not executable:
            self.errors.append({'kind': 'ffprobe-unavailable'})
            return
        for relative in sorted(self.video_paths):
            path = BASE / relative
            if not path.is_file():
                continue  # already recorded as a missing required member
            result = subprocess.run([executable, '-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', str(path)], capture_output=True, text=True, timeout=30)
            try:
                info = json.loads(result.stdout)
                valid = result.returncode == 0 and float(info['format']['duration']) > 0 and any(x.get('codec_type') == 'video' for x in info['streams'])
            except (ValueError, KeyError, TypeError):
                valid = False
            if not valid:
                self.errors.append({'kind': 'video-not-readable', 'path': relative})

    def summary(self, include_files=False):
        result = {'mode': 'dry-run-no-files-written', 'ready': not self.errors, 'accounts': len(self.packages), 'requiredVideos': len(self.video_paths), 'wholeFiles': len(self.whole), 'wholeBytes': sum(self.entries[x].size for x in self.whole if x in self.entries), 'portableZipButtonsRemoved': sum(self.entries[x].removed_zip_buttons for x in self.whole if x in self.entries), 'aggregateTarget': str(AGGREGATE), 'accountTargets': [f'packages/{x}.zip' for x in self.ids], 'errors': self.errors}
        if include_files:
            result['files'] = sorted(self.whole)
            result['accountFiles'] = {key: sorted(value) for key, value in self.packages.items()}
        return result


def write_verified_zip(target: Path, selected: set[str], plan: ExportPlan, prefix: str):
    expected = {}
    file_index = []
    with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
        for relative in sorted(selected):
            entry = plan.entries[relative]
            if digest_file(entry.source) != entry.source_sha256:
                raise RuntimeError(f'출고 준비 중 원본이 바뀜: {relative}')
            name = f'{prefix}{relative}'
            if entry.data is None:
                archive.write(entry.source, name)
            else:
                archive.writestr(name, entry.data)
            expected[name] = entry.output_sha256
            file_index.append({'path': name, 'bytes': entry.size, 'sourceSha256': entry.source_sha256, 'exportSha256': entry.output_sha256, 'removedAccountZipButtons': entry.removed_zip_buttons})
        index_name = f'{prefix}출고목록.json'
        index = json.dumps({'version': 1, 'encoding': 'UTF-8', 'files': file_index, 'accountZipButtonsRemovedInPortableHtml': True, 'sourceFilesEdited': False}, ensure_ascii=False, indent=2).encode('utf-8')
        archive.writestr(index_name, index)
        expected[index_name] = hashlib.sha256(index).hexdigest()
    with zipfile.ZipFile(target, 'r') as archive:
        names = archive.namelist()
        windows_names = {unicodedata.normalize('NFC', name).casefold() for name in names}
        if len(names) != len(set(names)) or len(names) != len(windows_names) or set(names) != set(expected):
            raise RuntimeError(f'{target.name}: ZIP 항목이 계획과 다름')
        checked_links = 0
        for item in archive.infolist():
            path = PurePosixPath(item.filename)
            if path.is_absolute() or '..' in path.parts or '\\' in item.filename:
                raise RuntimeError('안전하지 않은 ZIP 멤버 이름')
            if any(ord(char) > 127 for char in item.filename) and not item.flag_bits & 0x800:
                raise RuntimeError(f'{item.filename}: UTF-8 이름 플래그 없음')
            h = hashlib.sha256()
            with archive.open(item) as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                    h.update(chunk)
            if h.hexdigest() != expected[item.filename]:
                raise RuntimeError(f'{item.filename}: 재개봉 SHA-256 불일치')
            relative = item.filename[len(prefix):]
            if PurePosixPath(relative).suffix.lower() in TEXT_TYPES:
                for url in references(relative, archive.read(item)):
                    local = target_of(relative, url)
                    if local:
                        checked_links += 1
                        if f'{prefix}{local}' not in expected:
                            raise RuntimeError(f'{target.name}: ZIP 내부 링크 누락 {relative} → {local}')
    return {'zip': target.name, 'entries': len(expected), 'bytes': target.stat().st_size, 'sha256': digest_file(target), 'utf8AndReopenedSha256': 'passed', 'localLinksCheckedInsideZip': checked_links, 'missingLocalLinks': 0}


def execute(plan: ExportPlan):
    if plan.errors:
        raise RuntimeError('출고 거부: 필수 파일·영상·휴대판 링크 검사를 먼저 해결하세요')
    # All archives must pass before replacing any prior delivery archive.
    results = []
    packages_path = BASE / 'packages'
    if packages_path.is_symlink() or (packages_path.exists() and packages_path.resolve().parent != BASE.resolve()):
        raise RuntimeError('packages 출력 경로가 의도한 폴더 밖입니다')
    if AGGREGATE.is_symlink() or AGGREGATE.parent.resolve() != BASE.parent.resolve():
        raise RuntimeError('전체 ZIP 출력 경로를 확인하세요')
    with tempfile.TemporaryDirectory(prefix='마케팅출고-', dir=BASE.parent) as staging_name:
        staging = Path(staging_name).resolve()
        if staging.parent != BASE.parent.resolve() or not staging.name.startswith('마케팅출고-'):
            raise RuntimeError('임시 출고 경로가 의도한 폴더 안인지 확인하지 못했습니다')
        for item_id in plan.ids:
            target = staging / f'{item_id}.zip'
            results.append(write_verified_zip(target, plan.packages[item_id], plan, ''))
        full = staging / AGGREGATE.name
        results.append(write_verified_zip(full, plan.whole, plan, f'{BASE.name}/'))
        for entry in plan.entries.values():
            if digest_file(entry.source) != entry.source_sha256:
                raise RuntimeError(f'출고 도중 원본 변경: {entry.relative}')
        packages_path.mkdir(exist_ok=True)
        for item_id in plan.ids:
            os.replace(staging / f'{item_id}.zip', BASE / 'packages' / f'{item_id}.zip')
        os.replace(full, AGGREGATE)
    report_path = BASE / '출고검증.md'
    old_report = report_path.read_text(encoding='utf-8') if report_path.exists() else '# 출고 검증\n'
    old_report = old_report.split('\n## 최종 출고 실행 결과\n')[0]
    old_report = old_report.replace('**ZIP 생성은 아직 실행하지 않음**', '**최종 출고 실행 완료 — 상세 결과는 마지막 절**')
    old_report = old_report.replace('최종 출고 실행이 이 증거를 남겨야 한다.', '최종 출고 증거는 아래 실행 결과 절에 별도로 기록한다.')
    output = '\n## 최종 출고 실행 결과\n\n'
    output += f'- 실행 시각: {datetime.now(timezone.utc).isoformat()}\n- 계정 ZIP 19개 + 전체 ZIP 1개, 총 20개 재개봉 검증 통과.\n'
    output += f'- 전체 수록 파일: {len(plan.whole)}개 + 출고목록. 필수 영상 9개 읽힘 확인.\n- 휴대판 ZIP 다운로드 버튼 제거: {sum(e.removed_zip_buttons for e in plan.entries.values())}개. 원본 HTML은 수정하지 않음.\n- 전체 ZIP 안에 계정 ZIP·master PNG·생성 로그·실행 환경·원천 WAV·ASR JSON·검수 화면·제작 스크립트를 넣지 않음.\n\n'
    output += '| ZIP | 항목 | 바이트 | SHA-256 |\n|---|---:|---:|---|\n'
    output += ''.join(f"| {r['zip']} | {r['entries']} | {r['bytes']} | {r['sha256']} |\n" for r in results)
    report_path.write_text(old_report + output, encoding='utf-8')
    return {'mode': 'export-completed', 'archives': results, 'report': str(report_path)}


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--출고', action='store_true', help='ROOT 최종 요청 뒤에만 실제 ZIP 20개 생성')
    parser.add_argument('--dry-run', action='store_true', help='파일을 쓰지 않는 계획 점검(기본값)')
    parser.add_argument('--list', action='store_true', help='수록 예정 파일 목록까지 출력')
    args = parser.parse_args()
    if args.출고 and args.dry_run:
        parser.error('--출고와 --dry-run은 함께 사용할 수 없습니다')
    plan = ExportPlan().build()
    print(json.dumps(execute(plan) if args.출고 else plan.summary(args.list), ensure_ascii=False, indent=2))
    return 0 if not plan.errors else 2


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (ValueError, RuntimeError, OSError, subprocess.TimeoutExpired) as exc:
        print(json.dumps({'status': 'refused', 'error': str(exc)}, ensure_ascii=False))
        raise SystemExit(2)

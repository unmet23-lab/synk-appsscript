"""Materialize archived mascot originals only when a production tool needs them.

The Drive archive owns immutable historical bytes. Existing local files always win,
so current edits are never overwritten by an automatic restore.
"""
from pathlib import Path
import importlib.util


ROOT = Path(__file__).resolve().parent.parent
ARCHIVE_TOOL = ROOT / 'tools' / 'drive-mascot-archive.py'
_MODULE = None
_ROWS = None


def _archive():
    global _MODULE
    if _MODULE is not None:
        return _MODULE
    spec = importlib.util.spec_from_file_location('synk_drive_mascot_archive', ARCHIVE_TOOL)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _MODULE = module
    return _MODULE


def _rows():
    global _ROWS
    if _ROWS is None:
        _ROWS = list(_archive().archive_rows())
    return _ROWS


def ensure_files(paths):
    """Restore managed missing files; leave present or unmanaged paths untouched."""
    module = _archive()
    wanted = {Path(path).resolve() for path in paths}
    rows = []
    for number, row in _rows():
        if module.source_path(row['path']).resolve() in wanted:
            rows.append((number, row))
    result = module.restore_rows(rows)
    if result['restored_files']:
        print('■ Drive에서 필요한 마스코트 원본 '
              f"{result['restored_files']}개를 기존 경로로 복원했다.")
    return result


def ensure_folder(folder, include=None):
    """Restore all managed originals below one input folder before enumeration."""
    module = _archive()
    absolute = Path(folder).resolve()
    try:
        relative = absolute.relative_to(module.SOURCE.resolve()).as_posix()
    except ValueError:
        return {'restored_files': 0, 'restored_bytes': 0, 'requested_files': 0}
    rows = [(number, row) for number, row in _rows()
            if (row['path'] == relative or row['path'].startswith(relative + '/'))
            and (include is None or include(Path(row['path']).name))]
    result = module.restore_rows(rows)
    if result['restored_files']:
        print('■ Drive에서 필요한 마스코트 원본 '
              f"{result['restored_files']}개를 {relative}에 복원했다.")
    return result

"""파생 화소·알파·계약 시험. 대량 자산을 만들거나 원본을 수정하지 않는다."""
import importlib.util
import json
import tempfile
import unittest
from contextlib import contextmanager
from types import SimpleNamespace
from unittest import mock
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location('radio_outfits', ROOT/'tools/라디오차림굽기.py')
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)


class RadioOutfitsTest(unittest.TestCase):
    @contextmanager
    def candidate_fixture(self):
        with tempfile.TemporaryDirectory() as temp:
            root, key = Path(temp), '앞치마+한달출석새싹'
            output, inputs = root/'output', root/'candidate'
            (output/'까몽').mkdir(parents=True); inputs.mkdir()
            item = {'key': key, 'parts': ['앞치마', '한달출석새싹'], '의상': '앞치마', '악세': '한달출석새싹',
                    'source': {cut: f'docs/Loom_자산/옷/GPT_표정_누끼/까몽_{key}_{cut}.png' for cut in M.EXPRESSIONS.values()}}
            files = {}
            for i, cut in enumerate(M.EXPRESSIONS.values()):
                Image.new('RGBA', (4, 4), (20+i, 80, 120, 128)).save(inputs/Path(item['source'][cut]).name)
                target = output/'까몽'/f'{key}_{cut}.webp'
                target.write_bytes(f'previous-{cut}'.encode())
                files[cut] = {'결과': target.relative_to(output).as_posix()}
            sentinel = output/'까몽'/'다른차림.webp'
            sentinel.write_bytes(b'untouched')
            data = {'까몽': {'의상': ['앞치마'], '악세': ['한달출석새싹'], '차림': [item]}}
            transform = {'k': 1, 'dx': 0, 'dy': 0}
            with mock.patch.object(M, 'ROOT', root), mock.patch.object(M, 'OUTPUT', output):
                M.write_json(M.record_path(key), {'key': key, '파일': files})
                M.manifest(data)
                before = {p: p.read_bytes() for p in output.rglob('*') if p.is_file()}
                draft = {'key': key, '파일': {}, '변환': transform}
                yield item, draft, data, inputs, SimpleNamespace(투명틀에앉히기=None), before, output

    def test_translucent_alpha_is_not_squared(self):
        image = Image.new('RGBA', (2, 2), (91, 130, 200, 128))
        result, clipped = M.derive_rgba(image, {'k': 1, 'dx': 1, 'dy': 1}, size=4)
        self.assertEqual(result.getpixel((1, 1)), (91, 130, 200, 128))
        self.assertEqual(result.getpixel((0, 0)), (0, 0, 0, 0))
        self.assertEqual(clipped['알파0초과_잘린픽셀'], 0)

    def test_actual_crop_not_only_edge_contact(self):
        image = Image.new('RGBA', (4, 4), (91, 130, 200, 255))
        _, clipped = M.derive_rgba(image, {'k': 1, 'dx': -2, 'dy': 0}, size=4)
        self.assertEqual(clipped['알파128초과_잘린픽셀'], 8)

    def test_source_contact_and_derivative_crop_are_separate(self):
        image = Image.new('RGBA', (4, 4), (91, 130, 200, 255))
        self.assertEqual(M.source_edges(image), {'상': 4, '하': 4, '좌': 4, '우': 4})
        _, clipped = M.derive_rgba(image, {'k': 1, 'dx': 1, 'dy': 1}, size=6)
        self.assertEqual(clipped['알파128초과_잘린픽셀'], 0)

    def test_lossless_preserves_all_rgba_including_transparent_rgb(self):
        rng = np.random.default_rng(9409)
        array = rng.integers(0, 256, (16, 16, 4), dtype=np.uint8)
        array[0, :, 3] = 0
        with tempfile.TemporaryDirectory() as temp:
            result = M.encode_checked(Image.fromarray(array), Path(temp)/'frame.webp')
        self.assertEqual(result['RGBA_재조회차이'], 0)
        self.assertEqual(result['알파_재조회차이'], 0)

    def test_official_catalog_exact_requested_combinations(self):
        data = M.catalog()
        k = data['까몽']
        self.assertEqual((len(k['의상']), len(k['악세']), len(k['차림'])), (9, 12, 129))
        self.assertEqual(len({v['key'] for v in k['차림']}), 129)
        for item in k['차림']:
            self.assertLessEqual(len(item['parts']), 2)
            if len(item['parts']) == 2:
                self.assertTrue(item['의상'] and item['악세'])
            self.assertNotIn(' ', item['key'])

    def test_expression_contract_does_not_duplicate_output_for_alias(self):
        self.assertEqual(len(set(M.EXPRESSIONS.values())), 8)
        self.assertEqual(M.EXPRESSIONS['기본'], '본체')
        self.assertEqual(M.EXPRESSIONS['깜빡'], '눈감음')
        self.assertEqual(M.ALIASES, {'기쁨': '눈웃음'})

    def test_source_path_cannot_escape_approved_source_directory(self):
        with self.assertRaises(ValueError):
            M.source_files({'source': {'본체': 'docs/캐릭터/정본_4K/까몽_본체.png'}})

    def test_candidate_keeps_filenames_and_never_falls_back(self):
        item = {'source': {cut: f'docs/Loom_자산/옷/GPT_표정_누끼/까몽_앞치마+한달출석새싹_{cut}.png'
                           for cut in M.EXPRESSIONS.values()}}
        folder = ROOT/'docs/_ops/test_candidate'
        actual = M.source_files(item, folder)
        self.assertEqual(set(actual), set(M.EXPRESSIONS.values()))
        self.assertTrue(all(path.parent == folder for path in actual.values()))
        self.assertTrue(all(path.name == Path(item['source'][cut]).name for cut, path in actual.items()))
        self.assertTrue(all('GPT_표정_누끼' in path for path in item['source'].values()))

    def test_same_bytes_from_new_candidate_still_require_new_provenance(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            approved, candidate, dest = root/'old.png', root/'candidate.png', root/'out.webp'
            approved.write_bytes(b'original'); candidate.write_bytes(b'original'); dest.write_bytes(b'output')
            with mock.patch.object(M, 'ROOT', root):
                old = {'원본': 'old.png', '원본_sha256': M.sha(approved), '결과_sha256': M.sha(dest)}
                self.assertTrue(M.reusable_file(old, approved, M.sha(approved), dest))
                self.assertFalse(M.reusable_file(old, candidate, M.sha(candidate), dest))

    def test_candidate_cli_requires_exactly_one_selected_outfit(self):
        for args in [['--입력', 'docs'], ['--입력', 'docs', '--차림', '앞치마,조끼']]:
            with mock.patch('sys.stderr'), self.assertRaises(SystemExit) as raised:
                M.main(args)
            self.assertEqual(raised.exception.code, 2)

    def test_candidate_preflight_requires_all_eight_rgba_frames_at_anchor_size(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            folder = root/'candidate'
            folder.mkdir()
            item = {'key': '앞치마+한달출석새싹', 'source': {
                cut: f'docs/Loom_자산/옷/GPT_표정_누끼/까몽_앞치마+한달출석새싹_{cut}.png'
                for cut in M.EXPRESSIONS.values()}}
            with mock.patch.object(M, 'ROOT', root):
                with self.assertRaisesRegex(ValueError, '표정 원본이 없다'):
                    M.validate_source_set(item, folder, (4, 4))
                for path in M.source_files(item, folder).values():
                    Image.new('RGBA', (4, 4), (12, 34, 56, 128)).save(path)
                self.assertEqual(len(M.validate_source_set(item, folder, (4, 4))), 8)
                final = M.source_files(item, folder)['놀람']
                Image.new('RGBA', (4, 5)).save(final)
                with self.assertRaisesRegex(ValueError, '같은 크기의 RGBA'):
                    M.validate_source_set(item, folder, (4, 4))
                Image.new('RGB', (4, 4)).save(final)
                with self.assertRaisesRegex(ValueError, '같은 크기의 RGBA'):
                    M.validate_source_set(item, folder, (4, 4))

    def test_selected_inspection_preserves_other_outfit_rows(self):
        old = [{'차림': '앞치마', '원본': 'keep.png'}, {'차림': '앞치마+한달출석새싹', '원본': 'old.png'}]
        new = [{'차림': '앞치마+한달출석새싹', '원본': 'candidate.png'}]
        result = M.merge_inspection_rows(old, new)
        self.assertEqual(result, [old[0], new[0]])
        self.assertEqual(old[1]['원본'], 'old.png')

    def test_second_encode_failure_keeps_all_previous_images_record_and_manifest(self):
        with self.candidate_fixture() as (item, draft, data, inputs, fitter, before, output):
            original, calls = M.encode_checked, 0
            def fail_second(image, destination):
                nonlocal calls
                calls += 1
                if calls == 2:
                    raise OSError('injected second encode failure')
                return original(image, destination)
            with mock.patch.object(M, 'encode_checked', side_effect=fail_second), self.assertRaisesRegex(OSError, 'second encode'):
                M.bake_candidate(draft, item, draft['변환'], (4, 4), fitter, inputs, None, data)
            self.assertEqual(calls, 2)
            self.assertEqual({p: p.read_bytes() for p in output.rglob('*') if p.is_file()}, before)

    def test_manifest_failure_rolls_back_metadata_and_keeps_previous_images(self):
        with self.candidate_fixture() as (item, draft, data, inputs, fitter, before, output):
            with mock.patch.object(M, 'manifest', side_effect=OSError('injected publication failure')), self.assertRaisesRegex(OSError, 'publication'):
                M.bake_candidate(draft, item, draft['변환'], (4, 4), fitter, inputs, None, data)
            self.assertTrue(all(path.read_bytes() == content for path, content in before.items()))
            old_manifest = json.loads((output/'목록.json').read_text(encoding='utf-8'))
            self.assertTrue(all('/_후보/' not in path for path in old_manifest['캐릭터']['까몽']['차림'][item['key']]['표정'].values()))

    def test_success_publishes_eight_complete_version_paths_and_preserves_old_images(self):
        with self.candidate_fixture() as (item, draft, data, inputs, fitter, before, output):
            M.bake_candidate(draft, item, draft['변환'], (4, 4), fitter, inputs, None, data)
            current = json.loads((output/'목록.json').read_text(encoding='utf-8'))
            entry = current['캐릭터']['까몽']['차림'][item['key']]
            paths = set(entry['표정'].values())
            self.assertEqual((entry['상태'], len(paths)), ('검수후보', 8))
            self.assertTrue(all('/_후보/' in path and (output/path).is_file() for path in paths))
            self.assertTrue(all(path.read_bytes() == content for path, content in before.items() if path.suffix == '.webp'))
            self.assertTrue(all(frame['원본'].startswith('candidate/') for frame in entry['출처']['파일'].values()))


if __name__ == '__main__':
    unittest.main()

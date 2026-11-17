"""최근 기준이 바뀌면 예전 확인이 무효가 되는지, 두 내기 도구가 실제 다음 제출 전에 멈추는지 본다."""
import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import ExitStack, redirect_stdout
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(ROOT / "docs/마케팅/PULSE_포트폴리오_제작준비_20261012/시댄스무제한"))
import 첫컷검사
import 크레딧내기


class 확인시험(unittest.TestCase):
    def test_종류를_준_옛_컷순서의_승인_사례가_바뀌면_다시_검토한다(self):
        with tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
            편 = Path(tmp)
            영상, 컷순서 = 편 / "시험.mp4", 편 / "컷순서.json"
            영상.write_bytes(b"unchanged")
            def 기준(대상, 종류=None):
                self.assertEqual((대상, 종류), (편, "LAB"))
                사례 = 첫컷검사.json읽기(대상 / "컷순서.json")["가까운사례"]
                선택 = [{"id": 사례, "제목": 사례, "적용": []}]
                return {"기준판": 사례, "최근지적": [], "이력": {"길": 종류}, "만족사례": {"선택": 선택}}
            stack.enter_context(patch.object(첫컷검사, "기준읽기", side_effect=기준))
            stack.enter_context(patch.object(첫컷검사, "프레임시트", return_value=b"frames"))
            stack.enter_context(patch.object(첫컷검사.받은뒤검사, "살피기", return_value={"초": 2}))
            stack.enter_context(redirect_stdout(io.StringIO()))
            for 사례 in ("S01", "S02"):
                컷순서.write_text(json.dumps({"가까운사례": 사례}), encoding="utf-8")
                if 사례 == "S02":
                    with self.assertRaisesRegex(ValueError, "지금과 다르다"):
                        첫컷검사.검사(편, 영상, 종류="LAB", 확인파일=확인)
                self.assertEqual(첫컷검사.검사(편, 영상, 종류="LAB"), 2)
                답 = next(x for p in 편.rglob("확인용.json") if 사례 in (x := 첫컷검사.json읽기(p))["질문"])
                답["판정"] = {k: {"결과": "충족", "관찰": "회귀시험의 움직이는 도형을 확인"} for k in 답["질문"]}
                확인 = 편 / f"{사례}.json"
                확인.write_text(json.dumps(답), encoding="utf-8")
                self.assertEqual(첫컷검사.검사(편, 영상, 종류="LAB", 확인파일=확인), 0)

    def test_옛_꾸러미도_지시문에_사람이_있으면_대표_사람판부터_잰다(self):
        with tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
            편 = Path(tmp)
            꾸러미, 받음 = 편 / "꾸러미", 편 / "받음"
            꾸러미.mkdir()
            판들 = []
            for 이름, 글 in [("A", "A blue cup"), ("B", "WHO: a young woman\nACTION: At 0s she raises her arm. At 2s she turns her head.")]:
                (꾸러미 / 이름).mkdir()
                (꾸러미 / 이름 / "지시문.txt").write_text(글, encoding="utf-8")
                판들.append({"id": 이름, "폴더": 이름, "파일": []})
            (꾸러미 / "_순서.json").write_text(json.dumps(판들), encoding="utf-8")
            stack.enter_context(patch.object(첫컷검사, "기준읽기", return_value={"기준판": "1" * 64, "최근지적": []}))
            stack.enter_context(redirect_stdout(io.StringIO()))
            제출, 자료 = 크레딧내기.첫판계획(꾸러미, 받음, 판들)
            self.assertEqual([b["id"] for b in 제출], ["B"])
            호출 = stack.enter_context(patch("subprocess.call", return_value=0))
            크레딧내기.첫판확인(자료, 받음 / "B.mp4")
            self.assertIn("--사람", 호출.call_args.args[0])

    def test_제출중에는_같은_받을곳의_다른_제출을_막는다(self):
        with tempfile.TemporaryDirectory() as tmp:
            with 크레딧내기.첫판잠금(tmp):
                with self.assertRaises(SystemExit), 크레딧내기.첫판잠금(tmp):
                    self.fail("같은 받을곳을 두 작업이 함께 잠갔다")
            with 크레딧내기.첫판잠금(tmp):
                pass

    def test_기준_영상_구간_시트_질문을_모두_대조한다(self):
        with tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
            편 = Path(tmp)
            영상 = 편 / "연습.mp4"
            영상.write_bytes(b"first")
            기준 = {"기준판": "1" * 64, "최근지적": [], "이력": {"길": "LAB"}, "만족사례": {"선택": []}}
            기준["점검표"] = [{"번호": 1, "이름": "첫 주의 장면"}]
            stack.enter_context(patch.object(첫컷검사, "기준읽기", return_value=기준))
            stack.enter_context(patch.object(첫컷검사, "프레임시트", return_value=b"frames-from-video"))
            stack.enter_context(patch.object(첫컷검사.받은뒤검사, "살피기", return_value={"초": 2, "fps": 24}))
            stack.enter_context(redirect_stdout(io.StringIO()))
            self.assertEqual(첫컷검사.검사(편, 영상), 2)
            양식 = next(편.rglob("확인용.json"))
            답 = 첫컷검사.json읽기(양식)
            self.assertIn("LAB 뜻풀이", 답["판정"])
            self.assertIn("#1 첫 주의 장면", 답["질문"]["종전 지적"])
            답["판정"] = {k: {"결과": "충족", "관찰": "0.5초에 얼굴이 문에서 객차로 돌아선다"} for k in 답["판정"]}
            확인 = 편 / "검수.json"
            답["판정"]["종전 지적"] = {"결과": "다시", "관찰": "0.5초에 기존 1번 지적이 되풀이된다"}
            확인.write_text(json.dumps(답), encoding="utf-8")
            self.assertEqual(첫컷검사.검사(편, 영상, 확인파일=확인), 1)
            답["판정"]["종전 지적"] = {"결과": "충족", "관찰": "0.5초에 기존 1번에서 요구한 동작이 보인다"}
            확인.write_text(json.dumps(답), encoding="utf-8")
            self.assertEqual(첫컷검사.검사(편, 영상, 확인파일=확인), 0)
            시트 = 양식.with_name("프레임.jpg")
            시트.write_bytes(b"wrong-sheet")
            self.assertEqual(첫컷검사.검사(편, 영상), 0)
            self.assertEqual(시트.read_bytes(), b"frames-from-video")
            self.assertEqual(첫컷검사.검사(편, 영상, 시작=0.5), 2)
            기준["기준판"] = "2" * 64
            with self.assertRaisesRegex(ValueError, "지금과 다르다"):
                첫컷검사.검사(편, 영상, 확인파일=확인)
            기준["기준판"] = "1" * 64
            영상.write_bytes(b"other")
            self.assertEqual(첫컷검사.검사(편, 영상), 2)

    def test_두_제출경로에서_첫컷_확인뒤에만_나머지를_낸다(self):
        for 경로 in ("크레딧", "드리미나"):
            with self.subTest(경로=경로), tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
                편 = Path(tmp)
                꾸러미, 받음 = 편 / "꾸러미", 편 / "받음"
                받음.mkdir()
                꾸러미.mkdir()
                판들 = []
                for i, 인물 in enumerate(([], ["둘", "셋"], ["한"]), 1):
                    이름 = f"C{i}"
                    (꾸러미 / 이름).mkdir()
                    (꾸러미 / 이름 / "지시문.txt").write_text("action", encoding="utf-8")
                    판들.append({"순서": i, "id": 이름, "폴더": 이름, "파일": [], "길이": 5, "소리": "끔",
                               "인물": 인물, "비율": "9:16", "판 수": 1})
                (꾸러미 / "_순서.json").write_text(json.dumps(판들), encoding="utf-8")
                if 경로 == "크레딧":
                    도구 = 크레딧내기
                    stack.enter_context(patch.object(도구, "hf", side_effect=lambda 계정, 기능, *args: {"credits": 1 if 기능 == "generate" else 1000}))
                else:
                    가짜홈 = 편 / ".ai-tools/dreamina-canvas"
                    가짜홈.mkdir(parents=True)
                    (가짜홈 / "캔버스.txt").write_text("fixture", encoding="utf-8")
                    stack.enter_context(patch.dict(os.environ, {"USERPROFILE": tmp, "HOME": tmp}))
                    import 드리미나내기 as 도구
                    stack.enter_context(patch.object(도구, "balance", return_value=10000))
                제출 = []
                def 내기(*args, **kwargs):
                    판 = next(a for a in args if isinstance(a, dict))
                    제출.append(판["id"])
                    (받음 / (판["id"] + ".mp4")).write_bytes(b"fixture")
                확인됨 = False
                def 판단(자료, 파일=None):
                    if not 확인됨:
                        raise SystemExit(2)
                stack.enter_context(redirect_stdout(io.StringIO()))
                stack.enter_context(patch.object(도구, "run_one", side_effect=내기))
                stack.enter_context(patch.object(도구, "굽기전", return_value={}))
                stack.enter_context(patch.object(첫컷검사, "기준읽기", return_value={"기준판": "1" * 64, "최근지적": []}))
                stack.enter_context(patch.object(도구, "받은뒤", return_value=0))
                stack.enter_context(patch.object(크레딧내기, "첫판확인", side_effect=판단))
                if 경로 == "드리미나":
                    stack.enter_context(patch.object(도구, "첫판확인", side_effect=판단))
                stack.enter_context(patch.object(sys, "argv", ["내기", str(꾸러미), "--실행"]))
                with self.assertRaises(SystemExit):
                    도구.main()
                self.assertEqual(제출, ["C2"])
                with self.assertRaises(SystemExit):
                    도구.main()
                self.assertEqual(제출, ["C2"])
                확인됨 = True
                도구.main()
                self.assertCountEqual(제출, ["C2", "C1", "C3"])


if __name__ == "__main__":
    unittest.main()

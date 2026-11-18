"""최근 기준이 바뀌면 예전 확인이 무효가 되는지, 두 내기 도구가 실제 다음 제출 전에 멈추는지 본다."""
import io
import json
import os
import subprocess
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
    def test_입력창은_되돌린_시각과_교체_생성_삭제를_구별한다(self):
        with tempfile.TemporaryDirectory() as tmp:
            편 = Path(tmp)
            표, 옛표 = 편 / "컷표.json", 편 / "컷순서.json"
            옛표.write_bytes(b'{"v":1}')
            창 = 첫컷검사.입력창(첫컷검사.편입력(편, None))
            이전 = 옛표.stat()
            옛표.write_bytes(b'{"v":2}')
            os.utime(옛표, ns=(이전.st_atime_ns, 이전.st_mtime_ns))
            with self.assertRaises(첫컷검사.입력변경):
                창.확인()
            for 이름, 크기 in (("ref.png", 64), ("ref.jpg", 32), ("sample.mp4", 1024 * 1024 + 1)):
                참고 = 편 / 이름
                참고.write_bytes(b"a" * 크기)
                창 = 첫컷검사.입력창([참고])
                처음 = 참고.stat()
                참고.write_bytes(b"b" * 크기)
                os.utime(참고, ns=(처음.st_atime_ns, 처음.st_mtime_ns))
                self.assertEqual((참고.stat().st_size, 참고.stat().st_mtime_ns), (처음.st_size, 처음.st_mtime_ns))
                with self.assertRaises(첫컷검사.입력변경):
                    창.확인()
            for 변경 in (lambda: 표.write_bytes(b"{}"), lambda: 표.unlink(),
                        lambda: 옛표.replace(표)):
                창 = 첫컷검사.입력창(첫컷검사.편입력(편, None))
                변경()
                with self.assertRaises(첫컷검사.입력변경):
                    창.확인()
            창 = 첫컷검사.입력창(첫컷검사.편입력(편, None))
            옛표.write_text("미선택", encoding="utf-8")
            창.확인()
            with patch.object(첫컷검사, "파일지문", side_effect=PermissionError), self.assertRaises(PermissionError):
                창.확인()
        시도 = []
        def 변경한번():
            시도.append(1)
            if len(시도) == 1:
                raise 첫컷검사.입력변경("수정 중")
            return 0
        self.assertEqual(첫컷검사.변경재검(변경한번), 0)
        self.assertEqual(len(시도), 2)
        with patch.object(첫컷검사, "검사", side_effect=첫컷검사.입력변경("계속 수정")) as 작업:
            with self.assertRaises(첫컷검사.입력변경):
                첫컷검사.변경재검(작업)
            self.assertEqual(작업.call_count, 2)

    def test_기획서는_마감_메모와_여러_표기의_주문까지_원문_전체를_대조한다(self):
        with tempfile.TemporaryDirectory() as tmp:
            편 = Path(tmp)
            기획 = 편 / "기획.md"
            (편 / "컷표.json").write_text('{"행동":"인사"}', encoding="utf-8")
            기획.write_bytes(b" \n")
            공백지문 = 첫컷검사.편지시(편, None)[0]
            기획.write_bytes(b"\n")
            self.assertNotEqual(첫컷검사.편지시(편, None)[0], 공백지문)
            for 제목 in ("## 새 연출", "  ## 최종 연출", "새 연출\n------", "```md\n## 예시\n```"):
                앞 = "제작 기획\n## 마감 기록\n전달 완료\n" + 제목 + "\n"
                기획.write_text(앞 + "서서 인사", encoding="utf-8")
                첫지문 = 첫컷검사.편지시(편, None)[0]
                기획.write_text(앞 + "앉아서 인사", encoding="utf-8")
                self.assertNotEqual(첫컷검사.편지시(편, None)[0], 첫지문)

    def test_같은_영상도_편과_현재_장면_주문에_승인을_묶는다(self):
        with tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
            A, B = (Path(tmp) / 이름 for 이름 in ("A", "B"))
            A.mkdir()
            B.mkdir()
            영상 = A / "시험.mp4"
            영상.write_bytes(b"same")
            stack.enter_context(patch.object(첫컷검사, "기준읽기", return_value={
                "기준판": "1" * 64, "최근지적": [], "만족사례": {"선택": []}}))
            stack.enter_context(patch.object(첫컷검사.받은뒤검사, "살피기", return_value={"초": 2}))
            프레임 = stack.enter_context(patch.object(첫컷검사, "프레임시트", return_value=b"frames"))
            stack.enter_context(redirect_stdout(io.StringIO()))
            확인 = A / "관찰.json"
            def 확인받기():
                self.assertEqual(첫컷검사.검사(A, 영상), 2)
                양식 = next(p for p in A.rglob("확인용.json") if not p.with_name("확인.json").exists())
                답 = 첫컷검사.json읽기(양식)
                답["판정"]["컷"] = {"결과": "충족", "관찰": "0.5초에 서서 손을 흔든다"}
                확인.write_text(json.dumps(답), encoding="utf-8")
                self.assertEqual(첫컷검사.검사(A, 영상, 확인파일=확인), 0)
                return 답
            확인받기()
            self.assertEqual(첫컷검사.검사(B, 영상), 2)
            with self.assertRaisesRegex(ValueError, "지금과 다르다"):
                첫컷검사.검사(B, 영상, 확인파일=확인)
            기획 = A / "기획.md"
            글 = "## 한 장면 먼저\n서서 손을 흔든다.\n\n## 마감\n"
            기획.write_text(글, encoding="utf-8")
            답 = 확인받기()
            self.assertIn("기획.md", 답["질문"]["컷"])
            기획.write_text(글 + "최종 파일을 확인했다.\n", encoding="utf-8")
            답 = 확인받기()
            def 수정중(*_):
                기획.write_text(글.replace("서서", "앉아서"), encoding="utf-8")
                return b"frames"
            프레임.side_effect = 수정중
            with self.assertRaisesRegex(ValueError, "검사하는 동안"):
                첫컷검사.검사(A, 영상, 확인파일=확인)
            프레임.side_effect = None
            with self.assertRaisesRegex(ValueError, "지금과 다르다"):
                첫컷검사.검사(A, 영상, 확인파일=확인)
            self.assertEqual(첫컷검사.검사(A, 영상), 2)
            with self.assertRaisesRegex(ValueError, "꾸러미가 시작한 뒤"):
                첫컷검사.검사(A, 영상, 예상편지시=답["편지시지문"])
            # 확인이 내보이는 것은 읽어 본 판이다. 그 뒤 저장한 새 주문은 다음 실행이 다시 대조한다.
            기획.write_text(글, encoding="utf-8")
            실제상태 = 첫컷검사.입력창.상태
            def 대조직후저장(창):
                상태 = 실제상태(창)
                if hasattr(창, "원본"):
                    기획.write_text(글.replace("서서", "걸으며"), encoding="utf-8")
                return 상태
            with patch.object(첫컷검사.입력창, "상태", 대조직후저장):
                self.assertEqual(첫컷검사.검사(A, 영상), 0)
            self.assertEqual(첫컷검사.검사(A, 영상), 2)

    def test_공식표와_옛표와_직접_고른_표에서_주문만_바뀌어도_첫컷을_다시_본다(self):
        for 이름 in ("컷표.json", "컷순서.json", "이편의표.json"):
            with self.subTest(이름=이름), tempfile.TemporaryDirectory() as tmp:
                편 = Path(tmp)
                표 = 편 / 이름
                선택 = 표 if 이름 == "이편의표.json" else None
                if 선택:
                    with self.assertRaisesRegex(ValueError, "지정한 컷표"):
                        첫컷검사.편지시(편, 선택)
                주문 = {"detail": [{"cut": "C01", "행동": "서서 손을 흔든다"}]}
                표.write_text(json.dumps(주문), encoding="utf-8")
                이전, 원문 = 첫컷검사.편지시(편, 선택)
                self.assertIn(이름, 원문)
                표.write_text(json.dumps(주문, indent=2, ensure_ascii=False), encoding="utf-8-sig")
                self.assertEqual(첫컷검사.편지시(편, 선택)[0], 이전)
                주문["detail"][0]["행동"] = "앉아서 손을 흔든다"
                표.write_text(json.dumps(주문), encoding="utf-8")
                self.assertNotEqual(첫컷검사.편지시(편, 선택)[0], 이전)
                if 선택:
                    (편 / "컷순서.json").write_text("broken old json", encoding="utf-8")
                    (편 / "기획.md").write_text("## 한 장면의 주문\n서서 인사한다", encoding="utf-8")
                    처음 = 첫컷검사.편지시(편, 선택)[0]
                    (편 / "기획.md").write_text("## 한 장면의 주문\n앉아서 인사한다", encoding="utf-8")
                    self.assertNotEqual(첫컷검사.편지시(편, 선택)[0], 처음)
                    예시 = "\n```md\n## 한 장면의 주문\n예시만 있다.\n```\n"
                    기획 = 편 / "기획.md"
                    기획.write_text("## 연출 지시\n서서 인사한다." + 예시, encoding="utf-8")
                    처음 = 첫컷검사.편지시(편, 선택)[0]
                    기획.write_text("## 연출 지시\n앉아서 인사한다." + 예시, encoding="utf-8")
                    self.assertNotEqual(첫컷검사.편지시(편, 선택)[0], 처음)

    def test_같은_저장소의_두_작업본은_같은_편과_원문일_때만_확인을_이어받는다(self):
        시험환경 = {k: v for k, v in os.environ.items() if not k.upper().startswith("GIT_")}
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, 시험환경, clear=True):
            본, 사본 = Path(tmp).resolve() / "main", Path(tmp).resolve() / "work"
            def git(*args):
                subprocess.run(["git", *map(str, args)], check=True, capture_output=True)
            git("init", 본)
            git("-C", 본, "-c", "user.name=Test", "-c", "user.email=test@example.invalid",
                "-c", "commit.gpgsign=false", "commit", "--allow-empty", "-m", "fixture")
            git("-C", 본, "worktree", "add", "--detach", 사본)
            def 지문(자리, 지시=None):
                편 = 자리 / "편"
                편.mkdir(exist_ok=True)
                if 지시 is not None:
                    (편 / "컷표.json").write_text(json.dumps({"행동": 지시}), encoding="utf-8")
                return 첫컷검사.편지시(편, None)[0]
            self.assertNotEqual(지문(본), 지문(사본))
            for 작업본 in (본, 사본):
                (작업본 / "편" / "기획.md").write_bytes(b" \n")
            self.assertNotEqual(지문(본), 지문(사본), "공백뿐인 편은 작업본별로 확인한다")
            self.assertEqual(지문(본, "서서 인사"), 지문(사본, "서서 인사"))
            하위표 = []
            for 작업본 in (본, 사본):
                하위 = 작업본 / "편" / "자료"
                하위.mkdir()
                표 = 하위 / "이번표.json"
                표.write_text('{"cut":"C01"}', encoding="utf-8")
                하위표.append(첫컷검사.편지시(작업본 / "편", 표)[0])
            self.assertEqual(*하위표)
            다른편 = 본 / "다른편"
            다른편.mkdir()
            (다른편 / "컷표.json").write_bytes((본 / "편" / "컷표.json").read_bytes())
            with patch.dict(os.environ, {"GIT_DIR": str(본 / ".git")}):
                self.assertNotEqual(지문(본), 첫컷검사.편지시(다른편, None)[0])
            self.assertNotEqual(지문(본), 지문(사본, "앉아서 인사"))
            with patch.object(첫컷검사.subprocess, "run", side_effect=FileNotFoundError):
                self.assertNotEqual(지문(본), 지문(사본, "서서 인사"))
            조회 = subprocess.run
            def 조회중(*args, **kwargs):
                (본 / "편" / "컷표.json").write_text('{"행동":"새로 바뀐 행동"}', encoding="utf-8")
                return 조회(*args, **kwargs)
            with patch.object(subprocess, "run", side_effect=조회중), self.assertRaisesRegex(ValueError, "바뀌었다"):
                지문(본)

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
            표 = 편 / "이번주문.json"
            표.write_text('{"detail":[]}', encoding="utf-8")
            _, 자료 = 크레딧내기.첫판계획(꾸러미, 받음, 판들, 표)
            def 검사중(*_):
                (꾸러미 / "B" / "지시문.txt").write_text("changed action", encoding="utf-8")
                return 0
            호출.side_effect = 검사중
            with self.assertRaisesRegex(SystemExit, "확인하는 동안"):
                크레딧내기.첫판확인(자료, 받음 / "B.mp4")
            명령 = 호출.call_args.args[0]
            self.assertEqual(명령[명령.index("--컷표") + 1], str(표.resolve()))
            self.assertEqual(명령[명령.index("--예상편지시") + 1], 첫컷검사.편지시(편, 표)[0])
            호출.side_effect = None
            지시문 = 꾸러미 / "B" / "지시문.txt"
            원래읽기 = 첫컷검사.파일지문
            for 읽을때, 바꿀곳 in [(표, 지시문), (지시문, 표)]:
                표.write_text('{"detail":[]}', encoding="utf-8")
                호출.reset_mock()
                def 다른파일수정(경로):
                    if 호출.called and 경로 == 읽을때:
                        바꿀곳.write_bytes(b"changed during final verification")
                    return 원래읽기(경로)
                with patch.object(첫컷검사, "파일지문", 다른파일수정), self.assertRaisesRegex(SystemExit, "바뀌"):
                    크레딧내기.첫판확인(자료, 받음 / "B.mp4")

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

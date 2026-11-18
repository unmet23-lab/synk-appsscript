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

가짜눈 = Path(__file__).with_name("가짜눈.py")


def 눈붙이기(stack, 답=None, 꼴=""):
    """claude 대신 가짜 눈을 쓰고, 눈에게 줄 큰 칸 그림은 빈 그림 한 장으로 바꾼다. 부른 기록 파일을 돌려준다."""
    로그 = Path(stack.enter_context(tempfile.TemporaryDirectory())) / "눈.jsonl"
    stack.enter_context(patch.dict(os.environ, {
        "SYNK_FIRSTCUT_EYE": json.dumps([sys.executable, "-I", "-X", "utf8", str(가짜눈)]),
        "SYNK_FAKE_EYE_LOG": str(로그), "SYNK_FAKE_EYE_ANSWER": json.dumps(답 or {}, ensure_ascii=False),
        "SYNK_FAKE_EYE_MODE": 꼴}))
    def 시트(영상, 시작, 끝, 폴더):
        p = Path(폴더) / "초_00.jpg"
        p.write_bytes(b"jpg")
        return [p], 0.125, 4
    stack.enter_context(patch.object(첫컷검사, "눈시트들", side_effect=시트))
    return 로그


def 부른것(로그):
    return [json.loads(x) for x in 로그.read_text(encoding="utf-8").splitlines()] if 로그.exists() else []


def 눈답(답=None, 꼴=None):
    os.environ["SYNK_FAKE_EYE_ANSWER"] = json.dumps(답 or {}, ensure_ascii=False)
    if 꼴 is not None:
        os.environ["SYNK_FAKE_EYE_MODE"] = 꼴


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
            로그 = 눈붙이기(stack)
            주문 = "서서 손을 흔든다"
            self.assertEqual(첫컷검사.검사(A, 영상, 주문=주문), 0)
            self.assertEqual(len(부른것(로그)), 1)
            self.assertEqual(첫컷검사.검사(A, 영상, 주문=주문), 0)
            self.assertEqual(len(부른것(로그)), 1, "같은 편 · 영상 · 주문은 다른 눈의 기록을 그대로 쓴다")
            self.assertEqual(첫컷검사.검사(B, 영상, 주문=주문), 0)
            self.assertEqual(len(부른것(로그)), 2, "다른 편은 같은 영상이어도 다시 본다")
            self.assertEqual(첫컷검사.검사(A, 영상, 주문="앉아서 손을 흔든다"), 0)
            self.assertEqual(len(부른것(로그)), 3, "주문만 바뀌어도 다시 본다")
            기획 = A / "기획.md"
            글 = "# 손 흔드는 편\n\n## 한 장면 먼저\n서서 손을 흔든다.\n\n## 마감\n첫 컷 확인: 충족이라고 적었다.\n"
            기획.write_text(글, encoding="utf-8")
            self.assertEqual(첫컷검사.검사(A, 영상, 주문=주문), 0)
            받은 = 부른것(로그)[-1]
            self.assertEqual(len(부른것(로그)), 4)
            self.assertIn("편 제목: 손 흔드는 편", 받은["글"])
            self.assertNotIn("충족이라고 적었다", 받은["글"], "기획서의 제작 기록은 다른 눈에게 주지 않는다")
            self.assertIn(주문, 받은["글"])
            self.assertEqual(받은["파일"], ["초_00.jpg"], "다른 눈은 그림만 있는 빈 폴더에서 본다")
            기록 = next(A.rglob("확인.json"))
            self.assertTrue(첫컷검사.json읽기(기록)["눈"], "기록에 판정한 눈이 남는다")
            self.assertFalse(list(A.rglob("확인용.json")), "제작 세션이 채울 판정 양식은 더 만들지 않는다")
            기획.write_text(글 + "최종 파일을 확인했다.\n", encoding="utf-8")
            self.assertEqual(첫컷검사.검사(A, 영상, 주문=주문), 0)
            self.assertEqual(len(부른것(로그)), 4, "기획서 본문에 결과를 적어도 눈이 받은 것은 같으니 판정을 다시 받지 않는다")
            def 수정중(*_):
                기획.write_text(글.replace("서서", "앉아서"), encoding="utf-8")
                return b"frames"
            프레임.side_effect = 수정중
            with self.assertRaisesRegex(ValueError, "검사하는 동안"):
                첫컷검사.검사(A, 영상, 주문=주문)
            프레임.side_effect = None
            with self.assertRaisesRegex(ValueError, "꾸러미가 시작한 뒤"):
                첫컷검사.검사(A, 영상, 주문=주문, 예상편지시="0" * 64)
            with self.assertRaisesRegex(ValueError, "주문이 없다"):
                첫컷검사.검사(A, 영상)
            # 예전에 제작 세션이 스스로 적은 기록이나 손으로 고친 판정은 인정하지 않는다
            기획.write_text(글 + "최종 파일을 확인했다.\n", encoding="utf-8")
            기록 = max(A.rglob("확인.json"), key=lambda p: p.stat().st_mtime_ns)
            for 고침 in (lambda x: x.pop("눈"),
                       lambda x: x["판정"]["컷"].update(관찰="손으로 바꾼 관찰"),
                       lambda x: x["눈"][0].update(답지문="0" * 64)):
                옛 = 첫컷검사.json읽기(기록)
                고침(옛)
                기록.write_text(json.dumps(옛, ensure_ascii=False), encoding="utf-8")
                앞수 = len(부른것(로그))
                self.assertEqual(첫컷검사.검사(A, 영상, 주문=주문), 0)
                self.assertEqual(len(부른것(로그)), 앞수 + 1, "눈의 답과 맞지 않는 기록은 다른 눈에게 새로 묻는다")
            # 시험 눈의 기록은 시험 변수가 없는 실제 검사에서 쓰지 않는다
            옛 = 첫컷검사.json읽기(기록)
            동일성 = {k: 옛[k] for k in ("편자리", "영상지문", "기준판", "쓰는구간", "범위", "질문지문", "주문지문", "판정자")}
            with patch.dict(os.environ, {"SYNK_FIRSTCUT_EYE": ""}), self.assertRaisesRegex(ValueError, "시험 눈"):
                첫컷검사.확인결과(옛, 동일성, 옛["질문"], 기록.parent)
            첫컷검사.확인결과(옛, 동일성, 옛["질문"], 기록.parent)
            # 기록의 「시험」 칸과 눈 이름만 바꿔도 답 파일 첫 줄의 시험 표시가 지문에 묶여 있어 쓰지 않는다(GA6)
            위조 = json.loads(json.dumps(옛))
            위조["눈"][0].update(시험=False, 눈="GPT")
            with patch.dict(os.environ, {"SYNK_FIRSTCUT_EYE": ""}), self.assertRaisesRegex(ValueError, "시험 눈"):
                첫컷검사.확인결과(위조, 동일성, 옛["질문"], 기록.parent)
            self.assertTrue((기록.parent / 옛["눈"][0]["답"]).read_text(encoding="utf-8").startswith(첫컷검사.시험표시))
            # 같은 편 · 영상 · 구간이면 주문이 달라도 한 실행씩 판정한다(반박 한 번 제한을 지키려고)
            잠금이름 = 첫컷검사.hashlib.sha256(json.dumps([옛["편자리"], 옛["영상지문"], 옛["쓰는구간"]]).encode()).hexdigest()[:16]
            with 첫컷검사.판정잠금(기록.parent.parent, 잠금이름):
                for 이번주문 in (주문, "다른 주문으로 다시 본다"):
                    with self.assertRaisesRegex(ValueError, "진행 중"):
                        첫컷검사.검사(A, 영상, 주문=이번주문)
            # 편 폴더를 첫컷검사 기록째 복사한 새 편은 원래 편의 판정을 쓰지 않는다(GA5)
            import shutil
            복사 = Path(tmp) / "A복사"
            shutil.copytree(A, 복사)
            앞수 = len(부른것(로그))
            self.assertEqual(첫컷검사.검사(복사, 복사 / "시험.mp4", 주문=주문), 0)
            self.assertEqual(len(부른것(로그)), 앞수 + 1, "복사한 편은 다른 눈에게 새로 묻는다")

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
            로그 = 눈붙이기(stack)
            for 차례, 사례 in enumerate(("S01", "S02"), 1):
                컷순서.write_text(json.dumps({"가까운사례": 사례}), encoding="utf-8")
                self.assertEqual(첫컷검사.검사(편, 영상, 종류="LAB", 주문="움직이는 도형"), 0)
                self.assertEqual(len(부른것(로그)), 차례, "승인 사례가 바뀌면 다른 눈이 다시 본다")
                self.assertIn(사례, 부른것(로그)[-1]["글"])

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
            받음.mkdir(exist_ok=True)
            def 낸기록():
                (받음 / "_받음.json").write_text(json.dumps({"j1": {"판": "B", "파일": "B.mp4", "소스": 크레딧내기.판소스(꾸러미, 판들[1])}}), encoding="utf-8")
            # 낼 때의 지시문 지문이 없는 파일(웹 · 11-18 앞)은 지금 지시문으로 판정하지 않는다(GA4)
            with self.assertRaisesRegex(SystemExit, "지문이 없다"):
                크레딧내기.첫판확인(자료, 받음 / "B.mp4")
            self.assertFalse(호출.called)
            낸기록()
            크레딧내기.첫판확인(자료, 받음 / "B.mp4")
            self.assertIn("--사람", 호출.call_args.args[0])
            명령 = 호출.call_args.args[0]
            self.assertEqual(명령[명령.index("--주문파일") + 1], str(꾸러미 / "B" / "지시문.txt"), "다른 눈은 영상 지시문을 주문으로 받는다")
            self.assertNotIn("--컷들", 명령)
            # 낼 때의 지시문 지문이 받기 기록에 있으면, 그 뒤 지시문을 고친 판은 판정하지 않는다(GA1)
            지시B = 꾸러미 / "B" / "지시문.txt"
            원글 = 지시B.read_text(encoding="utf-8")
            지시B.write_text(원글 + "\nAt 3s she sits down.", encoding="utf-8")
            호출.reset_mock()
            with self.assertRaisesRegex(SystemExit, "낸 뒤 지시문"):
                크레딧내기.첫판확인(자료, 받음 / "B.mp4")
            self.assertFalse(호출.called, "바뀐 지시문으로는 다른 눈을 부르지 않는다")
            지시B.write_text(원글, encoding="utf-8")
            틀둘 = 편 / "틀둘.json"
            틀둘.write_text(json.dumps({"틀": 2, "detail": [{"cut": "B", "in": 0.5, "out": 2.5, "인물": ["한"]}]}), encoding="utf-8")
            _, 자료 = 크레딧내기.첫판계획(꾸러미, 받음, 판들, 틀둘)
            크레딧내기.첫판확인(자료, 받음 / "B.mp4")
            명령 = 호출.call_args.args[0]
            self.assertEqual(명령[명령.index("--컷들") + 1], "B", "컷표 틀 2면 이 판의 컷 줄을 주문으로 준다")
            self.assertEqual(명령[명령.index("--시작") + 1], "0.5")
            표 = 편 / "이번주문.json"
            표.write_text('{"detail":[]}', encoding="utf-8")
            _, 자료 = 크레딧내기.첫판계획(꾸러미, 받음, 판들, 표)
            def 검사중(*_, **__):
                (꾸러미 / "B" / "지시문.txt").write_text("changed action", encoding="utf-8")
                return 0
            호출.side_effect = 검사중
            # 검사 중에 지시문이 바뀌면 다시 시도할 때 낼 때 지문과도 달라 멈춘다
            with self.assertRaisesRegex(SystemExit, "확인하는 동안|낸 뒤 지시문"):
                크레딧내기.첫판확인(자료, 받음 / "B.mp4")
            명령 = 호출.call_args.args[0]
            self.assertEqual(명령[명령.index("--컷표") + 1], str(표.resolve()))
            self.assertEqual(명령[명령.index("--예상편지시") + 1], 첫컷검사.편지시(편, 표)[0])
            호출.side_effect = None
            지시문 = 꾸러미 / "B" / "지시문.txt"
            원래읽기 = 첫컷검사.파일지문
            for 읽을때, 바꿀곳 in [(표, 지시문), (지시문, 표)]:
                표.write_text('{"detail":[]}', encoding="utf-8")
                낸기록()   # 마지막 대조 중의 변경을 본다 — 낼 때 지문은 지금 지시문과 같게 둔다
                호출.reset_mock()
                def 다른파일수정(경로):
                    if 호출.called and 경로 == 읽을때:
                        바꿀곳.write_bytes(b"changed during final verification")
                    return 원래읽기(경로)
                with patch.object(첫컷검사, "파일지문", 다른파일수정), self.assertRaisesRegex(SystemExit, "확인하는 동안|바뀌었다\\. 현재|낸 뒤 지시문"):
                    크레딧내기.첫판확인(자료, 받음 / "B.mp4")
                self.assertTrue(호출.called, "낼 때 지문은 맞았고, 마지막 대조에서 멈췄다")

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
            로그 = 눈붙이기(stack, {"종전 지적": "다시"})
            주문 = "문 앞에 선 승객이 객차 쪽으로 돌아선다"
            self.assertEqual(첫컷검사.검사(편, 영상, 주문=주문), 1, "다른 눈이 '다시'라 하면 재제작이다")
            받은 = 부른것(로그)[-1]["글"]
            self.assertIn('"LAB 뜻풀이"', 받은)
            self.assertIn("#1 첫 주의 장면", 받은)
            기록 = next(편.rglob("확인.json"))
            self.assertEqual(첫컷검사.json읽기(기록)["판정"]["종전 지적"]["결과"], "다시")
            self.assertEqual(첫컷검사.검사(편, 영상, 주문=주문), 1, "같은 판은 기록대로 재제작이다")
            self.assertEqual(len(부른것(로그)), 1)
            # 판정이 틀렸다고 보면 근거를 붙여 반박하고, 그 열쇠만 새 눈이 다시 본다
            with self.assertRaisesRegex(ValueError, "시각"):
                첫컷검사.검사(편, 영상, 주문=주문, 반박=["종전 지적=틀림, 이 판정은 충족으로 해야 한다"])
            with self.assertRaisesRegex(ValueError, "'다시'가 아니"):
                첫컷검사.검사(편, 영상, 주문=주문, 반박=["컷=0.5초 칸에 이미 돌아서 있다"])
            with self.assertRaisesRegex(ValueError, "열쇠가 아니"):
                첫컷검사.검사(편, 영상, 주문=주문, 반박=["없는열쇠=0.5초 칸에 이미 돌아서 있다"])
            눈답({"종전 지적": "충족"})
            self.assertEqual(첫컷검사.검사(편, 영상, 주문=주문, 반박=["종전 지적=0.5초 칸에 1번이 요구한 동작이 보인다"]), 0)
            self.assertEqual(len(부른것(로그)), 2)
            반박글 = 부른것(로그)[-1]["글"]
            self.assertIn("## 다툼", 반박글)
            self.assertNotIn('"컷"', 반박글, "반박은 그 열쇠만 묻는다")
            self.assertIn("0.5초", 반박글)
            self.assertNotIn("요구한 동작이 보인다", 반박글, "만든 사람의 주장은 주지 않고 다시 볼 시각만 준다")
            남은 = 첫컷검사.json읽기(기록)
            self.assertEqual(len(남은["눈"]), 2)
            self.assertEqual(남은["반박"]["종전 지적"]["새눈"]["결과"], "충족")
            self.assertEqual(첫컷검사.검사(편, 영상, 주문=주문), 0)
            with self.assertRaisesRegex(ValueError, "'다시'가 아니"):
                첫컷검사.검사(편, 영상, 주문=주문, 반박=["종전 지적=0.5초 칸에 1번이 요구한 동작이 보인다"])
            # 주문을 바꿔 판정을 새로 받아도 같은 영상 · 같은 구간의 앞 '다시'와 이미 쓴 반박이 따라온다
            눈답({"종전 지적": "다시"})
            self.assertEqual(첫컷검사.검사(편, 영상, 주문=주문 + " 고개를 든다"), 1)
            self.assertNotIn("앞서 본 검사관", 부른것(로그)[-1]["글"], "반박으로 뒤집힌 앞 '다시'는 참고로 주지 않는다")
            with self.assertRaisesRegex(ValueError, "이미 두 눈"):
                첫컷검사.검사(편, 영상, 주문=주문 + " 고개를 든다", 반박=["종전 지적=0.5초 칸을 다시 본다"])
            # 작은 흠은 기록하되 막지 않는다. 같은 영상 · 구간의 앞 '다시'는 새 눈에게 참고로 준다
            눈답({"컷": "흠"})
            self.assertEqual(첫컷검사.검사(편, 영상, 주문=주문 + " 손을 든다"), 0)
            self.assertIn("앞서 본 검사관", 부른것(로그)[-1]["글"])
            시트 = 기록.with_name("프레임.jpg")
            시트.write_bytes(b"wrong-sheet")
            앞수 = len(부른것(로그))
            self.assertEqual(첫컷검사.검사(편, 영상, 주문=주문), 0)
            self.assertEqual(시트.read_bytes(), b"frames-from-video")
            self.assertEqual(len(부른것(로그)), 앞수, "사람용 시트가 바뀌어도 눈의 판정은 다시 받지 않는다")
            for 바꿈 in (lambda: 첫컷검사.검사(편, 영상, 시작=0.5, 주문=주문),
                       lambda: (기준.update(기준판="2" * 64), 첫컷검사.검사(편, 영상, 주문=주문))[1],
                       lambda: (영상.write_bytes(b"other"), 첫컷검사.검사(편, 영상, 주문=주문))[1]):
                앞수 = len(부른것(로그))
                눈답({})
                self.assertEqual(바꿈(), 0)
                self.assertEqual(len(부른것(로그)), 앞수 + 1, "구간 · 기준 · 영상이 바뀌면 다른 눈이 다시 본다")

    def test_반박_한_번은_주문을_바꾼_기록끼리도_지키고_시험_기록은_세지_않는다(self):
        with tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
            편 = Path(tmp)
            영상 = 편 / "연습.mp4"
            영상.write_bytes(b"first")
            stack.enter_context(patch.object(첫컷검사, "기준읽기", return_value={"기준판": "1" * 64, "최근지적": [], "만족사례": {"선택": []}}))
            stack.enter_context(patch.object(첫컷검사, "프레임시트", return_value=b"frames"))
            stack.enter_context(patch.object(첫컷검사.받은뒤검사, "살피기", return_value={"초": 2, "fps": 24}))
            stack.enter_context(redirect_stdout(io.StringIO()))
            로그 = 눈붙이기(stack, {"컷": "다시"})
            # 같은 영상 · 구간을 두 주문으로 미리 판정해 둔 뒤 한쪽에서 반박하면, 다른 쪽에서는 같은 열쇠를 다시 다툴 수 없다(GA7)
            self.assertEqual(첫컷검사.검사(편, 영상, 주문="주문 하나"), 1)
            self.assertEqual(첫컷검사.검사(편, 영상, 주문="주문 둘"), 1)
            self.assertEqual(첫컷검사.검사(편, 영상, 주문="주문 하나", 반박=["컷=0.5초 칸에 손이 보인다"]), 1)
            with self.assertRaisesRegex(ValueError, "이미 두 눈"):
                첫컷검사.검사(편, 영상, 주문="주문 둘", 반박=["컷=0.5초 칸에 손이 보인다"])
            # 시험 눈이 남긴 '다시' · 반박은 실제 검사의 앞 기록으로 세지 않는다(GA8)
            기록 = next(편.rglob("확인.json"))
            x = 첫컷검사.json읽기(기록)
            동일성 = {k: x[k] for k in ("편자리", "영상지문", "쓰는구간")}
            self.assertEqual(첫컷검사.앞기록들(편, 동일성)[1], ["컷"])
            with patch.dict(os.environ, {"SYNK_FIRSTCUT_EYE": ""}):
                self.assertEqual(첫컷검사.앞기록들(편, 동일성), ({}, []))
            # 답 파일과 맞지 않게 고친 기록도 세지 않는다
            for p in 편.rglob("확인.json"):
                y = 첫컷검사.json읽기(p)
                y["판정"]["컷"]["관찰"] = "손으로 고친 관찰"
                p.write_text(json.dumps(y, ensure_ascii=False), encoding="utf-8")
            self.assertEqual(첫컷검사.앞기록들(편, 동일성), ({}, []))

    def test_필수_질문을_확인_못_했으면_흠이_아니라_다시다(self):
        with tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
            편 = Path(tmp)
            영상 = 편 / "연습.mp4"
            영상.write_bytes(b"first")
            stack.enter_context(patch.object(첫컷검사, "기준읽기", return_value={
                "기준판": "1" * 64, "최근지적": [], "이력": {"길": "LAB"}, "만족사례": {"선택": []},
                "점검표": [{"번호": 1, "이름": "옛 지적", "확인": "작은 글자가 뭉개지지 않는다"}]}))
            stack.enter_context(patch.object(첫컷검사, "프레임시트", return_value=b"frames"))
            stack.enter_context(patch.object(첫컷검사.받은뒤검사, "살피기", return_value={"초": 2, "fps": 24}))
            stack.enter_context(redirect_stdout(io.StringIO()))
            로그 = 눈붙이기(stack, {"LAB 뜻풀이": {"결과": "흠", "관찰": "확인 못 함 — 화면 글이 작아 읽을 수 없다"}})
            with self.assertRaisesRegex(ValueError, "받지 못했다"):
                첫컷검사.검사(편, 영상, 주문="설명 글이 바뀐다")
            self.assertIn("흠을 쓰지 않는다", 부른것(로그)[-1]["글"], "꼴이 틀린 까닭을 알리고 한 번 더 묻는다")
            self.assertIn("'흠'이 아니라 '다시'", 부른것(로그)[0]["글"])
            # 「확인 못 함」으로 시작하지 않아도, 멈춤 · LAB 뜻풀이에는 흠을 쓸 수 없다(GA6)
            눈답({"LAB 뜻풀이": {"결과": "흠", "관찰": "0.5초 칸의 글자가 작아 뜻을 가렸을 때를 비교하기 어렵다"}})
            with self.assertRaisesRegex(ValueError, "받지 못했다"):
                첫컷검사.검사(편, 영상, 주문="설명 글이 바뀐다")
            self.assertIn("흠을 쓰지 않는다", 부른것(로그)[-1]["글"])
            # 컷 · 연기의 흠도 확인하지 못했다는 말이 있으면 돌려보낸다
            눈답({"컷": {"결과": "흠", "관찰": "0.5초 칸의 손이 흐려 무엇을 드는지 읽을 수 없다"}})
            with self.assertRaisesRegex(ValueError, "받지 못했다"):
                첫컷검사.검사(편, 영상, 주문="설명 글이 바뀐다")
            self.assertIn("확인하지 못했는데 흠", 부른것(로그)[-1]["글"])
            눈답({"LAB 뜻풀이": {"결과": "다시", "관찰": "확인 못 함 — 화면 글이 작아 읽을 수 없다"}})
            self.assertEqual(첫컷검사.검사(편, 영상, 주문="설명 글이 바뀐다"), 1)
            눈답({"컷": {"결과": "흠", "관찰": "0.5초 칸에 컵을 왼손에 들어 주문의 오른손과 다르다"}})
            self.assertEqual(첫컷검사.검사(편, 영상, 시작=0.25, 주문="설명 글이 바뀐다"), 0, "세부 차이의 흠은 막지 않는다")
            눈답({"종전 지적": {"결과": "흠", "관찰": "확인 못 함 — 작은 글자"}})
            self.assertEqual(첫컷검사.검사(편, 영상, 시작=0.5, 주문="설명 글이 바뀐다"), 0, "필수가 아닌 질문의 확인 못 함은 흠으로 둔다")

    def test_시험용_눈_변수는_대소문자와_관계없이_뺀다(self):
        환경 = {"codex_bin": "가짜", "Synk_Firstcut_Eye": "[]", "SYNK_CODEX_ROTATE": "1", "CODEX_BAKE_DIR": "계정", "PATH": "p"}
        self.assertEqual(첫컷검사.눈변수뺀환경(환경), {"CODEX_BAKE_DIR": "계정", "PATH": "p"})
        with patch.dict(os.environ, {"node_options": "--require 가짜.js", "NODE_PATH": "x", "SYNK_FIRSTCUT_EYE": "[]"}):
            실제 = 첫컷검사.실제눈환경()
        self.assertFalse({k.upper() for k in 실제} & {"NODE_OPTIONS", "NODE_PATH", "SYNK_FIRSTCUT_EYE"},
                         "실제 눈의 Node에는 미리 불러올 모듈을 넘기지 않는다(GA5)")

    def test_반박_한_번은_같은_저장소의_다른_작업_사본까지_센다(self):
        with tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
            공용 = Path(tmp) / "git공용"
            공용.mkdir()
            사본들 = [Path(tmp) / 이름 / "편" for 이름 in ("본", "사본")]
            for 편 in 사본들:
                편.mkdir(parents=True)
                (편 / "연습.mp4").write_bytes(b"same")
            stack.enter_context(patch.object(첫컷검사, "공용자리", return_value=공용))
            stack.enter_context(patch.object(첫컷검사, "편위치", return_value=["공용", "docs/편"]))
            stack.enter_context(patch.object(첫컷검사, "기준읽기", return_value={"기준판": "1" * 64, "최근지적": [], "만족사례": {"선택": []}}))
            stack.enter_context(patch.object(첫컷검사, "프레임시트", return_value=b"frames"))
            stack.enter_context(patch.object(첫컷검사.받은뒤검사, "살피기", return_value={"초": 2, "fps": 24}))
            stack.enter_context(redirect_stdout(io.StringIO()))
            눈붙이기(stack, {"컷": "다시"})
            for 편 in 사본들:
                self.assertEqual(첫컷검사.검사(편, 편 / "연습.mp4", 주문="손을 흔든다"), 1)
            self.assertEqual(첫컷검사.검사(사본들[0], 사본들[0] / "연습.mp4", 주문="손을 흔든다", 반박=["컷=0.5초 칸에 손이 보인다"]), 1)
            with self.assertRaisesRegex(ValueError, "이미 두 눈"):
                첫컷검사.검사(사본들[1], 사본들[1] / "연습.mp4", 주문="손을 흔든다", 반박=["컷=0.5초 칸에 손이 보인다"])
            self.assertTrue(list(공용.glob("*_반박.jsonl")), "반박 장부는 작업 사본들이 함께 보는 자리에 있다")
            with patch.dict(os.environ, {"SYNK_FIRSTCUT_EYE": ""}):
                self.assertEqual(첫컷검사.장부반박(공용, next(공용.glob("*_반박.jsonl")).name[:-len("_반박.jsonl")]), set(),
                                 "시험 눈의 반박은 실제 검사에서 세지 않는다")

    def test_다른_눈의_답이_꼴에_안_맞거나_못_받으면_통과시키지_않는다(self):
        with tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
            편 = Path(tmp)
            영상 = 편 / "연습.mp4"
            영상.write_bytes(b"first")
            stack.enter_context(patch.object(첫컷검사, "기준읽기", return_value={"기준판": "1" * 64, "최근지적": [], "만족사례": {"선택": []}}))
            stack.enter_context(patch.object(첫컷검사, "프레임시트", return_value=b"frames"))
            stack.enter_context(patch.object(첫컷검사.받은뒤검사, "살피기", return_value={"초": 2, "fps": 24}))
            stack.enter_context(redirect_stdout(io.StringIO()))
            로그 = 눈붙이기(stack, 꼴="빠짐")
            stack.enter_context(patch.dict(os.environ, {"SYNK_FIRSTCUT_EYE_NAME": "시험 눈 A"}))
            with self.assertRaisesRegex(ValueError, "받지 못했다"):
                첫컷검사.검사(편, 영상, 주문="손을 흔든다")
            self.assertEqual(len(부른것(로그)), 2, "꼴이 틀린 답은 한 번 더 묻는다")
            self.assertIn("앞 답이 꼴에 맞지 않았다", 부른것(로그)[-1]["글"])
            self.assertFalse(list(편.rglob("확인.json")), "받지 못한 판정은 기록하지 않는다")
            눈답({}, "실패")
            with self.assertRaisesRegex(ValueError, "받지 못했다"):
                첫컷검사.검사(편, 영상, 주문="손을 흔든다")
            self.assertEqual(len(부른것(로그)), 3, "막힌 눈(계정 · 한도)은 같은 눈에게 다시 묻지 않는다")
            눈답({"컷": "무관"}, "")
            with self.assertRaisesRegex(ValueError, "받지 못했다"):
                첫컷검사.검사(편, 영상, 주문="손을 흔든다")
            눈답({}, "")
            self.assertEqual(첫컷검사.검사(편, 영상, 주문="손을 흔든다"), 0)
            기록 = 첫컷검사.json읽기(next(편.rglob("확인.json")))
            self.assertEqual((기록["눈"][0]["눈"], 기록["눈"][0]["시험"]), ("시험 눈 A", True))
            with patch.dict(os.environ, {"SYNK_FIRSTCUT_EYE": ""}):
                self.assertEqual([x[0] for x in 첫컷검사.눈들()], ["GPT"], "실제 눈은 GPT 하나이고, 막히면 판정 없이 멈춘다")
            with patch.object(sys, "argv", ["첫컷검사", str(편), str(영상), "--확인파일", str(편 / "x.json")]), \
                    redirect_stdout(io.StringIO()), patch("sys.stderr", io.StringIO()) as 오류:
                self.assertEqual(첫컷검사.main(), 2)
            self.assertIn("다른 눈", 오류.getvalue())

    def test_기계가_잰_인물_멈춤은_바로_막지_않고_다른_눈에게_묻는다(self):
        with tempfile.TemporaryDirectory() as tmp, ExitStack() as stack:
            편 = Path(tmp)
            영상 = 편 / "연습.mp4"
            영상.write_bytes(b"first")
            stack.enter_context(patch.object(첫컷검사, "기준읽기", return_value={"기준판": "1" * 64, "최근지적": [], "만족사례": {"선택": []}}))
            stack.enter_context(patch.object(첫컷검사, "프레임시트", return_value=b"frames"))
            stack.enter_context(patch.object(첫컷검사.받은뒤검사, "살피기", return_value={"초": 8, "fps": 24}))
            stack.enter_context(patch.object(첫컷검사.받은뒤검사, "사람재기", return_value={
                "사람검출": True, "멎은1.5초": [5.98], "판정": "멈춤", "사람": 0.0}))
            stack.enter_context(redirect_stdout(io.StringIO()))
            로그 = 눈붙이기(stack, {"멈춤": "충족"})
            self.assertEqual(첫컷검사.검사(편, 영상, 사람=True, 주문="맛보고 찡그린다"), 0, "다른 눈이 굳지 않았다고 보면 통과한다")
            받은 = 부른것(로그)[-1]["글"]
            self.assertIn('"멈춤"', 받은)
            self.assertIn("5.98초", 받은)
            눈답({"멈춤": "다시"})
            self.assertEqual(첫컷검사.검사(편, 영상, 시작=0.5, 사람=True, 주문="맛보고 찡그린다"), 1)
            눈답({"멈춤": "무관"})
            with self.assertRaisesRegex(ValueError, "받지 못했다"):
                첫컷검사.검사(편, 영상, 시작=1, 사람=True, 주문="맛보고 찡그린다")

    def test_컷표_틀2는_이_컷과_앞뒤_컷_줄을_경로_없이_눈에게_준다(self):
        표 = {"틀": 2, "한문장": "빈 반찬 칸이 사랑이 된다", "detail": [
            {"cut": "1-1", "in": 0, "out": 1, "소품": {"도시락": "손에"}},
            {"cut": "1-2", "in": 0.8, "out": 1.5, "시작그림": "C:/x/1-2.png", "목소리견본": ["C:/x/a.mp3"],
             "참고그림": "정지/1-2_참고.jpg", "끝그림": "끝/1-2",
             "소품행동": {"도시락": "책상에 내려놓는다 — 다음 컷에서 책상 위"}},
            {"cut": "1-2", "in": 2.0, "out": 3.0, "소품": {"도시락": "책상 위"}, "시작그림": "정지/1-2b.png"},
            {"cut": "1-3", "in": 0, "out": 2, "소품": {"도시락": "책상 위"}}]}
        글 = 첫컷검사.컷주문(표, ["1-2"], 0.8, 1.5)
        이번, _, 뒤글 = 글.partition("### 바로 뒤 컷")
        self.assertIn("책상에 내려놓는다", 이번)
        self.assertNotIn('"in": 2.0', 이번, "같은 판의 다른 구간 줄은 이 영상의 컷으로 주지 않는다")
        self.assertIn("바로 앞 컷", 이번)
        self.assertIn('"1-1"', 이번)
        self.assertIn('"in": 2.0', 뒤글, "같은 컷이 이어 나오면 편집 순서로 바로 다음 구간이 뒤 컷이다(GA10)")
        self.assertNotIn('"1-3"', 글)
        self.assertNotIn("C:/x", 글, "눈이 열 수 없는 로컬 경로는 뺀다")
        for 파일 in ("정지/", "끝/1-2", "시작그림", "참고그림"):
            self.assertNotIn(파일, 글, "상대 경로와 파일 칸도 뺀다(GA13)")
        문장 = {"틀": 2, "detail": [{"cut": "9-1", "in": 0, "out": 2, "움직임": "내보내기 화면에 표시할 파일명은 final.mp4"}]}
        self.assertIn("final.mp4", 첫컷검사.컷주문(문장, ["9-1"], 0, 2), "파일 이름이 든 문장은 주문이라 남긴다(재검수 GA2)")
        self.assertIn("빈 반찬 칸이 사랑이 된다", 글)
        self.assertIn('"in": 2.0', 첫컷검사.컷주문(표, ["1-2"], 5, 6), "구간이 안 맞으면 그 판의 컷 줄을 모두 준다")
        self.assertIsNone(첫컷검사.컷주문(표, ["9-9"], 0, 1))
        with tempfile.TemporaryDirectory() as tmp:
            편 = Path(tmp)
            (편 / "컷표.json").write_text(json.dumps({"detail": []}), encoding="utf-8")
            창 = 첫컷검사.입력창(첫컷검사.편입력(편, None))
            with self.assertRaisesRegex(ValueError, "틀 2"):
                첫컷검사.주문만들기(편, None, 창, 0, 1, ["1-2"], "", None)
            (편 / "컷표.json").write_text(json.dumps(표, ensure_ascii=False), encoding="utf-8")
            창 = 첫컷검사.입력창(첫컷검사.편입력(편, None))
            with self.assertRaisesRegex(ValueError, "--컷들"):
                첫컷검사.주문만들기(편, None, 창, 0, 1, [], "영상을 보고 쓴 주문", None)
            self.assertIn("구간 밖일 수 있음", 첫컷검사.주문만들기(편, None, 창, 0.8, 1.5, ["1-2"], "", None))
            (편 / "컷표.json").write_text(json.dumps({"detail": []}), encoding="utf-8")
            지시 = 편 / "지시문.txt"
            지시.write_text("WHO: a man\nACTION: At 0s he puts the box down.", encoding="utf-8")
            창 = 첫컷검사.입력창([*첫컷검사.편입력(편, None), 지시])
            self.assertIn("puts the box down", 첫컷검사.주문만들기(편, None, 창, 0, 1, [], "", 지시))

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

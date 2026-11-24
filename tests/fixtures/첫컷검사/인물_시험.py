"""첫컷검사의 「인물」 질문(11-23) — 컷표 「인물」 기준 그림의 얼굴과 이 구간 칸의 얼굴판(11-24)을 눈에게 보이고,
실제 사람 배역은 빼고, 기준이 바뀌면 다시 본다."""
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
import 첫컷검사
import 받은뒤검사

가짜눈 = Path(__file__).with_name("가짜눈.py")


def 눈붙이기(stack, 답=None):
    로그 = Path(stack.enter_context(tempfile.TemporaryDirectory())) / "눈.jsonl"
    stack.enter_context(patch.dict(os.environ, {
        "SYNK_FIRSTCUT_EYE": json.dumps([sys.executable, "-I", "-X", "utf8", str(가짜눈)]),
        "SYNK_FAKE_EYE_LOG": str(로그), "SYNK_FAKE_EYE_ANSWER": json.dumps(답 or {}, ensure_ascii=False), "SYNK_FAKE_EYE_MODE": ""}))

    def 시트(영상, 시작, 끝, 폴더, 좌우=False):
        p = Path(폴더) / "초_00.jpg"
        p.write_bytes(b"jpg")
        return [p], 0.125, 4
    stack.enter_context(patch.object(첫컷검사, "눈시트들", side_effect=시트))
    return 로그


def 부른것(로그):
    return [json.loads(x) for x in 로그.read_text(encoding="utf-8").splitlines()] if 로그.exists() else []


def 눈답(답):
    os.environ["SYNK_FAKE_EYE_ANSWER"] = json.dumps(답, ensure_ascii=False)


def 질문들(글):
    return json.loads(글.split("## 질문\n```json\n", 1)[1].split("\n```", 1)[0])


표 = {"틀": 2, "인물": {
    "하린": {"묘사": "Harin is 22 years old.", "기준그림": "ref/하린.jpg"},
    "유호": {"묘사": "The same man as in the reference image.", "기준그림": "synk-vendor/yuho-motion-20261101/selected/a.jpg"},
    "슬레이트손": {"묘사": "A crew member seen only as two adult hands.", "기준그림": "ref/거친판.jpg"},
    "로지": {"묘사": "Rosie is 25.", "기준그림": "ref/로지.jpg"}},
    "detail": [{"cut": "C1", "in": 0, "out": 1, "인물": ["하린", "유호", "슬레이트손"]},
               {"cut": "C2", "in": 0, "out": 1, "인물": ["로지"]}]}


class 인물시험(unittest.TestCase):
    def 편만들기(self, stack, 표=표):
        편 = Path(stack.enter_context(tempfile.TemporaryDirectory()))
        stack.enter_context(patch.object(첫컷검사, "편위치", return_value=[str(편)]))
        stack.enter_context(patch.object(첫컷검사, "공용자리", return_value=편))
        stack.enter_context(patch.object(첫컷검사, "기준읽기", return_value={"기준판": "1" * 64, "최근지적": [], "만족사례": {"선택": []}}))
        stack.enter_context(patch.object(첫컷검사.받은뒤검사, "살피기", return_value={"초": 1, "fps": 24}))
        stack.enter_context(patch.object(첫컷검사, "프레임시트", return_value=b"frames"))
        # 얼굴 검출(cv2 · YuNet)은 시험에서 돌리지 않는다 — 원본 바이트에서 바로 「얼굴」을 만들고, 「얼굴없음」이 든 그림은 얼굴을 못 찾은 것으로 한다
        stack.enter_context(patch.object(첫컷검사, "얼굴자르기", side_effect=lambda b: (None, "기준 그림에서 얼굴을 찾지 못했다")
                                         if "얼굴없음".encode() in b else (b"face:" + b, None)))
        stack.enter_context(patch.object(첫컷검사, "구간얼굴판", return_value=(b"board", None)))
        stack.enter_context(redirect_stdout(io.StringIO()))
        (편 / "ref").mkdir()
        for 이름 in ("하린", "거친판", "로지"):
            (편 / "ref" / f"{이름}.jpg").write_bytes(이름.encode())
        (편 / "컷표.json").write_text(json.dumps(표, ensure_ascii=False), encoding="utf-8")
        영상 = 편 / "C1.mp4"
        영상.write_bytes(b"video")
        return 편, 영상

    def test_AI_배역의_기준_얼굴을_보이고_실제_사람과_손만_나오는_단역은_뺀다(self):
        with ExitStack() as stack:
            편, 영상 = self.편만들기(stack)
            로그 = 눈붙이기(stack)
            self.assertEqual(첫컷검사.검사(편, 영상, 컷들=["C1"]), 0)
            부름 = 부른것(로그)[-1]
            self.assertIn("기준_하린.jpg", 부름["파일"], "기준 얼굴을 눈의 빈 폴더에 넣는다")
            self.assertFalse([f for f in 부름["파일"] if f.startswith("기준_") and f != "기준_하린.jpg"],
                             "실제 사람(승인 얼굴 세트 · yuho- 자료)과 손만 나오는 단역의 그림은 넣지 않는다")
            self.assertNotIn("기준_로지.jpg", 부름["파일"], "이 컷 줄에 없는 배역은 넣지 않는다")
            질문 = 질문들(부름["글"])
            self.assertIn("기준_하린.jpg = 「하린」", 질문["인물"])
            self.assertNotIn("유호", 질문["인물"])
            self.assertIn("'흠'으로 한다", 질문["인물"])
            self.assertIn("기준_하린.jpg", 부름["글"].split("## 주문", 1)[0], "그림 목록에 기준 얼굴이 든다")
            기록 = 첫컷검사.json읽기(next(편.rglob("확인.json")))
            self.assertEqual(list(기록["기준얼굴"]), ["하린"])
            self.assertTrue((next(편.rglob("확인.json")).parent / "기준_하린.jpg").is_file(), "눈이 본 기준 얼굴을 기록 옆에 남긴다")
            self.assertNotIn("얼굴판.jpg", 부름["파일"], "실제 사람 배역이 든 컷 줄은 칸의 얼굴을 원본 크기로 잘라 보내지 않는다")
            self.assertNotIn("얼굴판", 질문["인물"])

    def test_AI_배역만_나오는_컷은_칸의_얼굴판을_함께_보인다(self):
        with ExitStack() as stack:
            편, 영상 = self.편만들기(stack)
            로그 = 눈붙이기(stack)
            self.assertEqual(첫컷검사.검사(편, 영상, 컷들=["C2"]), 0)
            부름 = 부른것(로그)[-1]
            self.assertEqual([f for f in 부름["파일"] if not f.startswith("초_")], ["기준_로지.jpg", "얼굴판.jpg"])
            self.assertIn("얼굴판.jpg는 이 구간 칸에서", 질문들(부름["글"])["인물"])
            self.assertEqual((next(편.rglob("확인.json")).parent / "얼굴판.jpg").read_bytes(), b"board", "눈이 본 얼굴판을 기록 옆에 남긴다")
            첫컷검사.구간얼굴판.return_value = (None, "이 구간 칸에서 얼굴을 찾지 못했다")
            self.assertEqual(첫컷검사.검사(편, 영상, 컷들=["C2"], 주문="로지가 웃는다"), 0)
            self.assertNotIn("얼굴판.jpg", 부른것(로그)[-1]["파일"])
            self.assertNotIn("얼굴판", 질문들(부른것(로그)[-1]["글"])["인물"], "얼굴판이 없으면 칸 그림으로 대조하라고 묻는다")

    def test_실제_사람만_나오는_컷과_얼굴_없는_기준은_질문을_더하지_않는다(self):
        with ExitStack() as stack:
            편, 영상 = self.편만들기(stack, {**표, "detail": [{"cut": "C1", "in": 0, "out": 1, "인물": ["유호"]},
                                                         {"cut": "C2", "in": 0, "out": 1, "인물": ["로지"]}]})
            로그 = 눈붙이기(stack)
            self.assertEqual(첫컷검사.검사(편, 영상, 컷들=["C1"]), 0)
            self.assertNotIn("인물", 질문들(부른것(로그)[-1]["글"]))
            self.assertFalse([f for f in 부른것(로그)[-1]["파일"] if f.startswith("기준_")])
            self.assertNotIn("기준얼굴", 첫컷검사.json읽기(next(편.rglob("확인.json"))))
            (편 / "ref" / "로지.jpg").write_bytes("얼굴없음".encode())
            self.assertEqual(첫컷검사.검사(편, 영상, 컷들=["C2"]), 0)
            self.assertNotIn("인물", 질문들(부른것(로그)[-1]["글"]), "기준 그림에서 얼굴을 못 찾으면 묻지 않는다")
        self.assertTrue(첫컷검사.실제사람({"기준그림": "C:\\Users\\x\\Desktop\\HappyGangster_20260930\\얼굴세트\\정면.png"}))
        self.assertFalse(첫컷검사.실제사람({"기준그림": "docs/마케팅/yuhobuilds_제출55초_20261110/ref/인물_A.jpg"}))

    def test_기준_그림이_바뀌면_다시_보고_그_앞_인물_다시는_참고로_주지_않는다(self):
        with ExitStack() as stack:
            편, 영상 = self.편만들기(stack)
            로그 = 눈붙이기(stack, {"인물": {"결과": "다시", "관찰": "0.5초 칸의 하린은 턱이 갸름하고 앞머리가 없어 기준과 다른 사람이다"}})
            self.assertEqual(첫컷검사.검사(편, 영상, 컷들=["C1"]), 1)
            self.assertEqual(첫컷검사.검사(편, 영상, 컷들=["C1"]), 1)
            self.assertEqual(len(부른것(로그)), 1, "같은 기준이면 기록을 다시 쓴다")
            # 기준 그림만 고쳐도 지문이 달라 눈이 다시 본다. 옛 기준과 견준 「인물: 다시」는 참고로 주지 않는다
            (편 / "ref" / "하린.jpg").write_bytes("하린 새 뿌리".encode())
            눈답({})
            self.assertEqual(첫컷검사.검사(편, 영상, 컷들=["C1"]), 0)
            self.assertEqual(len(부른것(로그)), 2)
            self.assertNotIn("- 인물:", 부른것(로그)[-1]["글"])
            # 같은 기준으로 주문만 바뀐 새 판정에는 그 기준의 앞 「인물: 다시」가 참고로 따라온다
            (편 / "ref" / "하린.jpg").write_bytes("하린".encode())
            self.assertEqual(첫컷검사.검사(편, 영상, 컷들=["C1"], 주문="하린이 고개를 든다"), 0)
            self.assertIn("- 인물: 0.5초 칸의 하린은", 부른것(로그)[-1]["글"])
            지문들 = {json.dumps(첫컷검사.json읽기(p)["기준얼굴"]) for p in 편.rglob("확인.json")}
            self.assertEqual(len(지문들), 2)

    def test_인물을_확인하지_못했으면_다시가_아니라_흠이다(self):
        with ExitStack() as stack:
            편, 영상 = self.편만들기(stack)
            로그 = 눈붙이기(stack, {"인물": {"결과": "다시", "관찰": "확인 못 함 — 얼굴이 작아 이목구비를 가릴 수 없다"}})
            with self.assertRaisesRegex(ValueError, "받지 못했다"):
                첫컷검사.검사(편, 영상, 컷들=["C1"])
            self.assertIn("다시가 아니라 흠", 부른것(로그)[-1]["글"], "꼴이 틀린 까닭을 알리고 한 번 더 묻는다")
            눈답({"인물": {"결과": "흠", "관찰": "확인 못 함 — 얼굴이 작아 이목구비를 가릴 수 없다"}})
            self.assertEqual(첫컷검사.검사(편, 영상, 컷들=["C1"]), 0, "인물의 확인 못 함은 막지 않는 흠이다")
            눈답({"인물": {"결과": "무관", "관찰": "판정 못 함 — 이 구간에는 뒷모습만 나온다"}})
            self.assertEqual(첫컷검사.검사(편, 영상, 컷들=["C1"], 주문="뒷모습"), 0, "인물은 필수 질문이 아니라 무관을 쓸 수 있다")

    def test_눈판을_올려_앞_눈판_기록은_받은_뒤_검사가_다시_잰다(self):
        self.assertGreaterEqual(받은뒤검사.눈판, 2)
        self.assertFalse(받은뒤검사.조건맞음({"컷": "C1", "눈": 1}, {"컷": "C1", "눈": 받은뒤검사.눈판}))


if __name__ == "__main__":
    unittest.main()

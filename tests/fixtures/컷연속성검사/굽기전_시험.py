# 내기 도구(크레딧내기.py · 드리미나내기.py)의 굽기 전 지시문 검사를 계정 · 잔액 · 네트워크 없이 시험한다(2026-11-10, tests/컷연속성검사.test.js가 부른다).
#   python -I -X utf8 굽기전_시험.py 함수 <꾸러미 폴더> [--무시 "<까닭>"] [--컷표 <컷순서.json>] [--검사기없음]
#       크레딧내기.굽기전(판목록, 무시까닭, 컷표)만 부른다. 지나가면 마지막 줄에 「결과: {판 id: 까닭}」(JSON), 걸림이면 SystemExit(끝 코드 1 · 멈춤 글은 stderr).
#   python -I -X utf8 굽기전_시험.py 장부 <임시 폴더>                  크레딧내기.record()를 임시 장부에 불러 「걸림무시」 칸이 그 판 줄에 남는지 본다.
#   python -I -X utf8 굽기전_시험.py 크레딧 <크레딧내기.py 인자…>      main()을 미리 보기로 돈다 — hf()를 가짜로 바꾼다.
#   python -I -X utf8 굽기전_시험.py 드리미나 <드리미나내기.py 인자…>  main()을 미리 보기로 돈다 — 홈을 임시 폴더로 돌려 실제 CLI · 캔버스 id를 못 찾게 하고 cli() · balance()를 가짜로 바꾼다.
# 이 도구들은 실제 크레딧을 쓴다 — 여기서는 --실행을 받지 않고, 계정을 부르는 함수 · subprocess를 모두 막은 채로만 돈다.
import json, os, shutil, sys, tempfile
from pathlib import Path

도구폴더 = Path(__file__).resolve().parents[3] / "docs" / "마케팅" / "PULSE_포트폴리오_제작준비_20261012" / "시댄스무제한"
sys.path.insert(0, str(도구폴더))


class 막힌subprocess:
    """내기 도구가 바깥 프로그램을 부르면 시험이 깨지게 한다."""
    CalledProcessError = TimeoutExpired = RuntimeError

    @staticmethod
    def run(*a, **k):
        raise AssertionError(f"시험에서 바깥 프로그램을 부르려 했다: {a[:1]}")


def 함수(argv):
    import 크레딧내기
    크레딧내기.subprocess = 막힌subprocess
    if "--검사기없음" in argv:   # 검사 도구를 못 부르는 때(문법 오류 · 경로)를 흉내 낸다
        def 못부름():
            raise ImportError("시험 — 검사기를 못 부름")
        크레딧내기.검사기 = 못부름
    무시 = argv[argv.index("--무시") + 1] if "--무시" in argv else None
    컷표 = argv[argv.index("--컷표") + 1] if "--컷표" in argv else None
    pack = os.path.abspath(argv[0])
    판목록 = [(pack, b) for b in 크레딧내기.boards(pack)]
    out = 크레딧내기.굽기전(판목록, 무시, 컷표)
    print("결과: " + json.dumps(out, ensure_ascii=False))


def 장부(argv):
    """record()가 장부(_크레딧내기.json) 그 판 줄에 「걸림무시」 칸을 남기는지 — 장부 자리를 임시 폴더로 돌리고 가짜 작업 결과로 부른다(계정을 부르지 않는다)."""
    import 크레딧내기
    크레딧내기.subprocess = 막힌subprocess
    임시 = argv[0]
    크레딧내기.LEDGER = os.path.join(임시, "_크레딧내기.json")
    크레딧내기.IGNORED.update({"C1": "정지 컷 시험"})
    for 판 in ("C1", "C2"):   # C1은 걸림을 넘겨 낸 판, C2는 걸림 없던 판 — 둘 다 받지 못한 판(파일 없음)으로 적는다
        크레딧내기.record(os.path.join(임시, "받음"), f"job-{판}", {"id": 판, "순서": 1}, None, {"status": "failed", "created_at": "2026-11-10T00:00:00Z"}, [], "시험계정", 10)
    print("결과: " + json.dumps(json.load(open(크레딧내기.LEDGER, encoding="utf-8")), ensure_ascii=False))


def 크레딧(argv):
    import 크레딧내기

    def 가짜hf(acct, *args):
        if args[:2] == ("generate", "cost"): return {"credits": 10}
        if args[:2] == ("account", "status"): return {"email": "test@example.invalid", "credits": 99999}
        raise AssertionError(f"시험에서 계정을 부르려 했다: {args[:2]}")
    크레딧내기.hf = 가짜hf
    크레딧내기.subprocess = 막힌subprocess
    sys.argv = ["크레딧내기.py", *argv]
    크레딧내기.main()


def 드리미나(argv):
    홈 = tempfile.mkdtemp(prefix="synk-dreamina-home-")   # 실제 로그인 칸 · 캔버스 id · CLI가 있는 진짜 홈을 보지 않게
    os.environ["USERPROFILE"] = os.environ["HOME"] = 홈
    캔버스 = Path(홈) / ".ai-tools" / "dreamina-canvas"
    캔버스.mkdir(parents=True)
    (캔버스 / "캔버스.txt").write_text("test-canvas", encoding="utf-8")
    import 드리미나내기
    assert 드리미나내기.HOME.startswith(홈), 드리미나내기.HOME

    def 막힌cli(*a, **k):
        raise AssertionError(f"시험에서 드리미나 CLI를 부르려 했다: {a[:2]}")
    드리미나내기.cli = 막힌cli
    드리미나내기.balance = lambda: 99999
    드리미나내기.subprocess = 막힌subprocess
    sys.argv = ["드리미나내기.py", *argv]
    try:
        드리미나내기.main()
    finally:
        shutil.rmtree(홈, ignore_errors=True)   # 임시 홈은 남기지 않는다(걸림으로 멈춰도)


if __name__ == "__main__":
    방식, 나머지 = sys.argv[1], sys.argv[2:]
    if "--실행" in 나머지:
        raise SystemExit("이 시험 스크립트는 --실행을 받지 않는다(실제 크레딧이 나가는 길).")
    {"함수": 함수, "장부": 장부, "크레딧": 크레딧, "드리미나": 드리미나}[방식](나머지)

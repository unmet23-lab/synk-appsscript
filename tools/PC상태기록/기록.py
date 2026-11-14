"""PC 상태 기록 — Windows 예약 작업 「SYNK PC 상태 기록」이 1분마다 pythonw로 부른다(AI 없음, 2026-11-14).

왜: 11-14 07:42~17:23에 이 PC가 켜진 채 9시간 40분쯤 응답하지 않았다. 그동안 예약이 하나도 돌지 못했는데,
무엇이 PC를 굶겼는지 남은 기록이 없어 원인을 짐작으로만 말했다(메모리 고갈 이벤트는 없었다).
다음에 멈추면 마지막 몇 분의 줄로 원인을 본다. 줄이 끊긴 구간 자체도 멈춤의 증거다.

  pythonw.exe -X utf8 -B tools/PC상태기록/기록.py            한 줄 남긴다
  python -X utf8 tools/PC상태기록/기록.py --보기 [줄 수]      최근 줄을 읽기 좋게 보인다(기본 30줄)
  python -X utf8 tools/PC상태기록/기록.py --끊김 [분]         줄 사이가 그 분(기본 5분)보다 벌어진 구간을 보인다

남기는 곳: %LOCALAPPDATA%\\synk\\pc-state\\YYYY-MM-DD.tsv (git 밖, 14일 지나면 지운다).
한 줄의 칸: 시각 · 늦음(초, 정각 분에서 얼마나 늦게 떴나) · CPU % · 메모리 쓴 GB/전체 GB · 커밋 쓴 GB/한도 GB ·
프로세스 수 · 스레드 수 · 핸들 수 · C: 쓰기 ms(작은 파일을 쓰고 디스크에 내리는 데 걸린 시간) · C: 여유 GB · D: 여유 GB ·
메모리 큰 프로그램 다섯(이름 × 개수 = GB).
파이썬 표준 모듈만 쓴다(예약 작업의 파이썬에는 psutil이 없다).
"""
import ctypes
import datetime
import os
import pathlib
import shutil
import sys
import time
from ctypes import wintypes

보관일 = 14


class MEMORYSTATUSEX(ctypes.Structure):
    _fields_ = [("dwLength", wintypes.DWORD), ("dwMemoryLoad", wintypes.DWORD), ("ullTotalPhys", ctypes.c_ulonglong),
                ("ullAvailPhys", ctypes.c_ulonglong), ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong), ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]


class PERFORMANCE_INFORMATION(ctypes.Structure):
    _fields_ = [("cb", wintypes.DWORD), ("CommitTotal", ctypes.c_size_t), ("CommitLimit", ctypes.c_size_t), ("CommitPeak", ctypes.c_size_t),
                ("PhysicalTotal", ctypes.c_size_t), ("PhysicalAvailable", ctypes.c_size_t), ("SystemCache", ctypes.c_size_t),
                ("KernelTotal", ctypes.c_size_t), ("KernelPaged", ctypes.c_size_t), ("KernelNonpaged", ctypes.c_size_t),
                ("PageSize", ctypes.c_size_t), ("HandleCount", wintypes.DWORD), ("ProcessCount", wintypes.DWORD), ("ThreadCount", wintypes.DWORD)]


class PROCESS_MEMORY_COUNTERS(ctypes.Structure):
    _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD), ("PeakWorkingSetSize", ctypes.c_size_t),
                ("WorkingSetSize", ctypes.c_size_t), ("QuotaPeakPagedPoolUsage", ctypes.c_size_t), ("QuotaPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t), ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                ("PagefileUsage", ctypes.c_size_t), ("PeakPagefileUsage", ctypes.c_size_t)]


def 폴더():
    base = os.environ.get("LOCALAPPDATA") or str(pathlib.Path.home() / "AppData" / "Local")
    return pathlib.Path(base) / "synk" / "pc-state"


def gb(바이트):
    return 바이트 / (1024 ** 3)


def cpu사용률(쉼=1.0):
    k = ctypes.windll.kernel32
    def 읽기():
        idle, kern, user = wintypes.FILETIME(), wintypes.FILETIME(), wintypes.FILETIME()
        k.GetSystemTimes(ctypes.byref(idle), ctypes.byref(kern), ctypes.byref(user))
        f = lambda t: (t.dwHighDateTime << 32) | t.dwLowDateTime
        return f(idle), f(kern) + f(user)
    i0, t0 = 읽기()
    time.sleep(쉼)
    i1, t1 = 읽기()
    전체 = t1 - t0
    return 0.0 if 전체 <= 0 else max(0.0, min(100.0, 100.0 * (1 - (i1 - i0) / 전체)))


def 메모리():
    m = MEMORYSTATUSEX()
    m.dwLength = ctypes.sizeof(m)
    ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m))
    p = PERFORMANCE_INFORMATION()
    p.cb = ctypes.sizeof(p)
    ctypes.windll.psapi.GetPerformanceInfo(ctypes.byref(p), p.cb)
    return {"쓴": gb(m.ullTotalPhys - m.ullAvailPhys), "전체": gb(m.ullTotalPhys), "커밋": gb(p.CommitTotal * p.PageSize),
            "커밋한도": gb(p.CommitLimit * p.PageSize), "프로세스": p.ProcessCount, "스레드": p.ThreadCount, "핸들": p.HandleCount}


def 큰프로그램(개수=5):
    k, ps = ctypes.windll.kernel32, ctypes.windll.psapi
    k.OpenProcess.restype = wintypes.HANDLE
    k.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    k.CloseHandle.argtypes = [wintypes.HANDLE]
    k.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
    ps.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(PROCESS_MEMORY_COUNTERS), wintypes.DWORD]
    ids = (wintypes.DWORD * 8192)()
    받은 = wintypes.DWORD()
    if not ps.EnumProcesses(ctypes.byref(ids), ctypes.sizeof(ids), ctypes.byref(받은)):
        return []
    합 = {}
    for pid in ids[: 받은.value // ctypes.sizeof(wintypes.DWORD)]:
        if not pid:
            continue
        h = k.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not h:
            continue
        try:
            c = PROCESS_MEMORY_COUNTERS()
            c.cb = ctypes.sizeof(c)
            if not ps.GetProcessMemoryInfo(h, ctypes.byref(c), c.cb):
                continue
            buf = ctypes.create_unicode_buffer(1024)
            n = wintypes.DWORD(1024)
            이름 = os.path.basename(buf.value) if k.QueryFullProcessImageNameW(h, 0, buf, ctypes.byref(n)) else "?"
            a = 합.setdefault(이름.lower(), [0, 0])
            a[0] += 1
            a[1] += c.WorkingSetSize
        finally:
            k.CloseHandle(h)
    return sorted(((이름, 수, gb(바이트)) for 이름, (수, 바이트) in 합.items()), key=lambda x: -x[2])[:개수]


def 쓰기시간(자리):
    """작은 파일을 쓰고 디스크에 내리는 데 걸린 ms. 디스크가 굶으면 이 값이 먼저 커진다."""
    f = 자리 / ".쓰기재기"
    t = time.perf_counter()
    try:
        with open(f, "wb") as h:
            h.write(b"x" * 4096)
            h.flush()
            os.fsync(h.fileno())
        return (time.perf_counter() - t) * 1000
    except OSError:
        return -1.0


def 여유(드라이브):
    try:
        return gb(shutil.disk_usage(드라이브).free)
    except OSError:
        return -1.0


def 한줄(자리):
    뜬때 = datetime.datetime.now()
    늦음 = 뜬때.second + 뜬때.microsecond / 1e6
    쓰기 = 쓰기시간(자리)
    cpu = cpu사용률()
    m = 메모리()
    큰 = " ".join(f"{이름}×{수}={크기:.1f}" for 이름, 수, 크기 in 큰프로그램())
    return "\t".join([
        뜬때.strftime("%Y-%m-%d %H:%M:%S"), f"{늦음:.1f}", f"{cpu:.0f}", f"{m['쓴']:.1f}/{m['전체']:.1f}", f"{m['커밋']:.1f}/{m['커밋한도']:.1f}",
        str(m["프로세스"]), str(m["스레드"]), str(m["핸들"]), f"{쓰기:.0f}", f"{여유('C:/'):.1f}", f"{여유('D:/'):.1f}", 큰,
    ])


def 옛것지우기(자리, 오늘):
    for f in 자리.glob("????-??-??.tsv"):
        try:
            날 = datetime.date.fromisoformat(f.stem)
        except ValueError:
            continue
        if (오늘 - 날).days > 보관일:
            try:
                f.unlink()
            except OSError:
                pass


def 기록():
    자리 = 폴더()
    자리.mkdir(parents=True, exist_ok=True)
    줄 = 한줄(자리)
    오늘 = datetime.date.today()
    with open(자리 / f"{오늘.isoformat()}.tsv", "a", encoding="utf-8", newline="\n") as h:
        h.write(줄 + "\n")
        h.flush()
        os.fsync(h.fileno())
    if datetime.datetime.now().minute == 0:
        옛것지우기(자리, 오늘)
    return 0


def 줄들(자리, 날수=3):
    모음 = []
    for f in sorted(자리.glob("????-??-??.tsv"))[-날수:]:
        모음 += [x for x in f.read_text(encoding="utf-8").splitlines() if x.strip()]
    return 모음


def 보기(수):
    제목 = "시각\t늦음초\tCPU%\t메모리GB\t커밋GB\t프로세스\t스레드\t핸들\tC쓰기ms\tC여유\tD여유\t메모리 큰 프로그램"
    print(제목)
    for 줄 in 줄들(폴더())[-수:]:
        print(줄)
    return 0


def 끊김(분):
    앞 = None
    찾음 = 0
    for 줄 in 줄들(폴더(), 보관일 + 1):
        try:
            t = datetime.datetime.strptime(줄.split("\t")[0], "%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue
        if 앞 and (t - 앞).total_seconds() > 분 * 60:
            print(f"{앞:%Y-%m-%d %H:%M} ~ {t:%Y-%m-%d %H:%M} ({(t - 앞).total_seconds() / 60:.0f}분 동안 줄 없음)")
            찾음 += 1
        앞 = t
    if not 찾음:
        print(f"줄 사이가 {분}분 넘게 벌어진 구간이 없다.")
    return 0


def main(argv):
    if sys.platform != "win32":
        print("Windows에서만 돈다.")
        return 2
    if "--보기" in argv:
        i = argv.index("--보기")
        return 보기(int(argv[i + 1]) if len(argv) > i + 1 and argv[i + 1].isdigit() else 30)
    if "--끊김" in argv:
        i = argv.index("--끊김")
        return 끊김(int(argv[i + 1]) if len(argv) > i + 1 and argv[i + 1].isdigit() else 5)
    return 기록()


if __name__ == "__main__":
    try:
        if sys.stdout and hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    sys.exit(main(sys.argv[1:]))

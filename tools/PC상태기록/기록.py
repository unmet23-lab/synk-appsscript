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
메모리 큰 프로그램 다섯(이름 × 개수 = GB) · 커널 비페이징 풀 GB · 비페이징 풀을 가장 많이 쓴 태그 셋(태그=MB) ·
NVIDIA GPU의 엔진별 사용률과 그 GPU를 많이 쓴 프로그램 셋(엔진=% / 프로그램=%, 쉬면 「-」, 못 재면 「?」).
비페이징 칸과 태그 칸은 2026-11-16에 더했다. 그날 아침 두 번의 멈춤 직전에 커밋이 1분에 24~36GB 늘었지만, 칸이 없어 누가
가져갔는지 바로 가리지 못했다. 같은 날 08:45에 따로 재 보니 커널 비페이징 풀이 1분 만에 20GB 넘게 불어 있었다.
저녁에 같은 조건으로 세 번 다시 일으켜 보려 했지만 일어나지 않아 드라이버를 정하지 못했다. 그래서 다음에 또 불면
그 순간의 태그가 남게 했다. 태그 뜻은 WinDbg 설치 폴더의 amd64\\triage\\pooltag.txt에 있다.
GPU 칸은 11-16 밤에 더했다. 그날 08:17과 09:21에 NVIDIA 그래픽 엔진이 멈췄는데(WATCHDOG 0x141), 렌더의 GPU 압축(NVENC)
탓인지 줄로 가릴 수 없었다. Remotion의 크롬은 Intel GPU로 그리므로 이 칸에 나오지 않고, NVENC는 VideoEncode로 나온다.
11-16 앞의 파일에는 끝 칸들이 없고, 11-16의 줄은 09:32부터 비페이징 칸, 저녁부터 태그 칸, 밤부터 GPU 칸이 붙는다.
파이썬 표준 모듈만 쓴다(예약 작업의 파이썬에는 psutil이 없다).
"""
import ctypes
import datetime
import os
import pathlib
import re
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


class SYSTEM_POOLTAG(ctypes.Structure):
    _fields_ = [("Tag", ctypes.c_ubyte * 4), ("PagedAllocs", wintypes.ULONG), ("PagedFrees", wintypes.ULONG), ("PagedUsed", ctypes.c_size_t),
                ("NonPagedAllocs", wintypes.ULONG), ("NonPagedFrees", wintypes.ULONG), ("NonPagedUsed", ctypes.c_size_t)]


class PDH_FMT_COUNTERVALUE(ctypes.Structure):
    _fields_ = [("CStatus", wintypes.DWORD), ("doubleValue", ctypes.c_double)]


class PDH_FMT_COUNTERVALUE_ITEM_W(ctypes.Structure):
    _fields_ = [("szName", ctypes.c_wchar_p), ("FmtValue", PDH_FMT_COUNTERVALUE)]


def 커널32():
    k = ctypes.windll.kernel32
    k.OpenProcess.restype = wintypes.HANDLE
    k.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    k.CloseHandle.argtypes = [wintypes.HANDLE]
    k.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
    return k


def 프로세스이름(k, pid):
    h = k.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
    if not h:
        return None
    try:
        buf = ctypes.create_unicode_buffer(1024)
        n = wintypes.DWORD(1024)
        return os.path.basename(buf.value) if k.QueryFullProcessImageNameW(h, 0, buf, ctypes.byref(n)) else None
    finally:
        k.CloseHandle(h)


def 엔비디아luid():
    """DirectX 어댑터 목록(레지스트리)에서 NVIDIA GPU의 LUID를 「GPU Engine」 카운터 이름 꼴(0x…_0x…)로 모은다."""
    try:
        import winreg
        모음 = set()
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\DirectX") as 뿌리:
            for i in range(winreg.QueryInfoKey(뿌리)[0]):
                try:
                    with winreg.OpenKey(뿌리, winreg.EnumKey(뿌리, i)) as 키:
                        설명 = str(winreg.QueryValueEx(키, "Description")[0])
                        luid = int(winreg.QueryValueEx(키, "AdapterLuid")[0])
                except (OSError, ValueError, TypeError):
                    continue
                if "NVIDIA" in 설명.upper():
                    모음.add(f"0x{(luid >> 32) & 0xFFFFFFFF:08x}_0x{luid & 0xFFFFFFFF:08x}")
        return 모음
    except (OSError, ImportError):
        return set()


def GPU엔진시작():
    """GPU 엔진 사용률을 재기 시작한다(PDH 「GPU Engine」 카운터, 관리자 권한이 필요 없고 GPU를 깨우지 않는다). 못 하면 None."""
    try:
        pdh = ctypes.windll.pdh
        pdh.PdhOpenQueryW.argtypes = [wintypes.LPCWSTR, ctypes.c_size_t, ctypes.POINTER(wintypes.HANDLE)]
        pdh.PdhAddEnglishCounterW.argtypes = [wintypes.HANDLE, wintypes.LPCWSTR, ctypes.c_size_t, ctypes.POINTER(wintypes.HANDLE)]
        pdh.PdhCollectQueryData.argtypes = [wintypes.HANDLE]
        pdh.PdhGetFormattedCounterArrayW.argtypes = [wintypes.HANDLE, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD), ctypes.POINTER(wintypes.DWORD), ctypes.c_void_p]
        pdh.PdhCloseQuery.argtypes = [wintypes.HANDLE]
        for f in (pdh.PdhOpenQueryW, pdh.PdhAddEnglishCounterW, pdh.PdhCollectQueryData, pdh.PdhGetFormattedCounterArrayW, pdh.PdhCloseQuery):
            f.restype = ctypes.c_long
        q, c = wintypes.HANDLE(), wintypes.HANDLE()
        if pdh.PdhOpenQueryW(None, 0, ctypes.byref(q)) != 0:
            return None
        if pdh.PdhAddEnglishCounterW(q, "\\GPU Engine(*)\\Utilization Percentage", 0, ctypes.byref(c)) != 0 or pdh.PdhCollectQueryData(q) != 0:
            pdh.PdhCloseQuery(q)
            return None
        return pdh, q, c
    except (OSError, AttributeError):
        return None


def GPU엔진끝(시작, 프로그램수=3):
    """GPU엔진시작() 뒤 그때까지의 NVIDIA GPU 사용률을 「엔진=%」(엔진 종류별 합)와 「/ 프로그램=%」로 돌려준다.
    아무것도 0.5%를 넘지 않으면 「-」, NVIDIA GPU가 없거나 재지 못하면 「?」다."""
    if not 시작:
        return "?"
    pdh, q, c = 시작
    try:
        luid = 엔비디아luid()
        if not luid or pdh.PdhCollectQueryData(q) != 0:
            return "?"
        크기, 수 = wintypes.DWORD(0), wintypes.DWORD(0)
        if pdh.PdhGetFormattedCounterArrayW(c, 0x200, ctypes.byref(크기), ctypes.byref(수), None) & 0xFFFFFFFF != 0x800007D2:
            return "?"  # PDH_FMT_DOUBLE로 물어 PDH_MORE_DATA(칸 크기)를 받아야 한다
        buf = ctypes.create_string_buffer(크기.value)
        if pdh.PdhGetFormattedCounterArrayW(c, 0x200, ctypes.byref(크기), ctypes.byref(수), buf) != 0:
            return "?"
        엔진, 쓴곳 = {}, {}
        for 칸 in (PDH_FMT_COUNTERVALUE_ITEM_W * 수.value).from_buffer(buf):
            m = re.match(r"pid_(\d+)_luid_(0x[0-9a-f]+_0x[0-9a-f]+)_phys_\d+_eng_\d+_engtype_(.*)$", 칸.szName or "", re.I)
            값 = 칸.FmtValue.doubleValue
            if not m or 칸.FmtValue.CStatus > 1 or m.group(2).lower() not in luid or 값 <= 0:
                continue
            종류 = m.group(3).replace(" ", "_") or "?"
            엔진[종류] = 엔진.get(종류, 0.0) + 값
            쓴곳[int(m.group(1))] = 쓴곳.get(int(m.group(1)), 0.0) + 값
    except (OSError, ValueError, AttributeError):
        return "?"
    finally:
        pdh.PdhCloseQuery(q)
    엔진글 = " ".join(f"{이름}={값:.0f}" for 이름, 값 in sorted(엔진.items(), key=lambda x: -x[1]) if 값 >= 0.5)
    if not 엔진글:
        return "-"
    k, 합 = 커널32(), {}
    for pid, 값 in 쓴곳.items():
        이름 = (프로세스이름(k, pid) or f"pid{pid}").lower().removesuffix(".exe").replace(" ", "_")
        합[이름] = 합.get(이름, 0.0) + 값
    프로그램글 = " ".join(f"{이름}={값:.0f}" for 이름, 값 in sorted(합.items(), key=lambda x: -x[1])[:프로그램수] if 값 >= 0.5)
    return 엔진글 + (f" / {프로그램글}" if 프로그램글 else "")


def 큰풀태그(개수=3):
    """비페이징 풀을 가장 많이 쓴 태그(「태그=MB」를 띄어 씀). 관리자 권한 없이 읽힌다(NtQuerySystemInformation 22).
    읽지 못하면 빈 글을 돌려 한 줄 남기기를 막지 않는다."""
    try:
        nt = ctypes.windll.ntdll
        nt.NtQuerySystemInformation.restype = ctypes.c_long
        nt.NtQuerySystemInformation.argtypes = [wintypes.ULONG, ctypes.c_void_p, wintypes.ULONG, ctypes.POINTER(wintypes.ULONG)]
        크기 = 1 << 20
        for _ in range(6):
            buf = ctypes.create_string_buffer(크기)
            받은 = wintypes.ULONG()
            st = nt.NtQuerySystemInformation(22, buf, 크기, ctypes.byref(받은)) & 0xFFFFFFFF
            if st == 0xC0000004:  # 칸이 모자라다는 뜻이라 늘려서 다시 읽는다
                크기 = max(크기 * 2, 받은.value + 65536)
                continue
            if st != 0:
                return ""
            수 = ctypes.c_uint32.from_buffer(buf).value
            표 = (SYSTEM_POOLTAG * 수).from_buffer(buf, 8)
            큰 = sorted(표, key=lambda t: -t.NonPagedUsed)[:개수]
            return " ".join("".join(chr(b) if 32 < b < 127 else "_" for b in t.Tag) + f"={t.NonPagedUsed / 2 ** 20:.0f}" for t in 큰)
    except (OSError, ValueError, AttributeError):
        return ""
    return ""


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
            "커밋한도": gb(p.CommitLimit * p.PageSize), "프로세스": p.ProcessCount, "스레드": p.ThreadCount, "핸들": p.HandleCount,
            "비페이징": gb(p.KernelNonpaged * p.PageSize)}


def 큰프로그램(개수=5):
    k, ps = 커널32(), ctypes.windll.psapi
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
    gpu = GPU엔진시작()
    cpu = cpu사용률()  # 1초를 쉬며 재므로 GPU 엔진 사용률도 같은 1초로 잰다
    gpu글 = GPU엔진끝(gpu)
    m = 메모리()
    큰 = " ".join(f"{이름}×{수}={크기:.1f}" for 이름, 수, 크기 in 큰프로그램())
    return "\t".join([
        뜬때.strftime("%Y-%m-%d %H:%M:%S"), f"{늦음:.1f}", f"{cpu:.0f}", f"{m['쓴']:.1f}/{m['전체']:.1f}", f"{m['커밋']:.1f}/{m['커밋한도']:.1f}",
        str(m["프로세스"]), str(m["스레드"]), str(m["핸들"]), f"{쓰기:.0f}", f"{여유('C:/'):.1f}", f"{여유('D:/'):.1f}", 큰,
        f"{m['비페이징']:.1f}", 큰풀태그(), gpu글,
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
    제목 = "시각\t늦음초\tCPU%\t메모리GB\t커밋GB\t프로세스\t스레드\t핸들\tC쓰기ms\tC여유\tD여유\t메모리 큰 프로그램\t비페이징GB\t큰 비페이징 태그(MB)\tNVIDIA 엔진%(/ 프로그램%)"
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

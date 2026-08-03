"""채점기 자기검증용 **최소 스텁** — ARC 저장소의 recorder.py를 복사하지 않기 위한 것.

실제 벤더 채점은 각 작업장에 있는 **진짜** recorder.py를 로드한다. 이 스텁은
채점기가 정답을 만점 주는지·오답을 감점하는지만 확인하는 데 쓰인다.
"""
RECORDING_SUFFIX = ".recording.jsonl"


class Recorder:
    @classmethod
    def get_prefix_one(cls, filename: str) -> str:
        return filename.split(".")[0] if "." in filename else filename

    @classmethod
    def get_guid(cls, filename: str) -> str:
        return filename.split(".")[-3] if "." in filename else filename

# tools/lib/hwp — HWP 5 다루기 부품

`tools/hwp쪽배치.py`(한컴 없이 쪽 배치 재기)가 쓴다. 재도전 사업계획서 작업(2026-10-19~21)의 `.tmp` 스크립트에서 2026-10-22에 옮겼다. 함정과 실측은 [현장 노트 · 한글(HWP)](../../../docs/현장노트/한글_HWP.md).

| 파일 | 하는 일 |
|---|---|
| `hwprec.py` | HWP 5 레코드 읽기·쓰기(스트림은 olefile로 읽는다) |
| `RepackMulti.java` | OLE 상자를 새로 만들며 지시한 스트림만 바꾸고 나머지는 원본 바이트 그대로 옮긴다(Java 17 단일 파일 실행) |
| `hwplib-1.1.9.jar` | [hwplib](https://github.com/neolord0/hwplib) 1.1.9(Apache-2.0, 안에 아파치 POI). Maven Central `kr.dogfoot:hwplib:1.1.9` 그대로 — SHA-1 `a185d5504606bef698f2f5a1b31c9fda28b9496a`, SHA-256 `aa14757394c6db60b2c5e0ebf4d43fcc28069161afaa9f03a0386524169bd1ac`. 라이선스 전문 `hwplib-LICENSE.txt` |

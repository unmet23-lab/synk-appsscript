# 하린 아이스커피 v4 · ⑦ LoRA 검증 결과

2026-10-17 22:00 · 콘티 v4의 ⑦을 「동영상 제작 워크플로우」 세션이 대신했다(유호님 「여기서 해줘」). 원래 맡았던 「이미지 생성 벤치마킹 성능」 세션이 꺼져 있었다.

## 판정

- **LoRA 검증 통과**: 학습에 없던 각도·조명 10장이 모두 하린으로 보인다(제작 규칙 「LoRA 검증」). V05(아래에서 본 한낮)와 V07(파란 해 질 녘)은 조금 성숙해 보인다.
- **포니테일 유지**: 포니테일 2장 모두 얼굴이 하린으로 남았다. 따라서 콘티 v4 머리 판정은 **하이 포니테일 그대로** 간다. 다만 LoRA판은 묶은 높이가 하이보다 조금 낮게 나오니, 키프레임에서 `high ponytail tied at the crown`처럼 높이를 분명히 쓴다.
- **한낮 측광은 약함**: 얼굴은 하린이지만 「해가 화면 왼쪽 위, 얼굴 한쪽만 강하게, 반대쪽 그늘」이 약하게 나온다. 판 B 키프레임 지시문에 `harsh direct sunlight, strong contrast, crisp shadow edge across her face, deep shade on the camera-right half of her face`처럼 빛을 세게 쓰고, 그래도 약하면 LoRA 세기 0.8과 비교한다. 배경에 사람이 들어가는 일이 있어 `empty alley`를 장면 문구에 넣는다(Z-Image Turbo는 부정문이 안 먹는다).

## 쓴 것

- LoRA: `C:\SYNK-LoRA\outputs\f02_harin_v2\f02_harin_v2.safetensors`(마지막 3,300스텝, 세기 1.0), 트리거 `pls_f02`
- ComfyUI: Z-Image Turbo 8스텝·cfg 1·res_multistep·shift 3, 768×1344(9:16)
- 지시문: `C:\SYNK-LoRA\validation\F02_harin\verify_v4_jobs.json`(판 B 서식: 트리거 맨 앞, 캡션 꼴, 부정문 없음). V01~V10 시드 101~110, 포니테일 P1·P2 시드 201·202(콘티 v4 차림·장소), 한낮 측광 S1·S2 시드 301·302(컷 1 구도, 기본 머리)
- 그림: `C:\SYNK-LoRA\tools\ComfyUI\output\f02_harin_v2\verify_v4\`, 비교판 `C:\SYNK-LoRA\validation\F02_harin\v2_validate\verify_v4_14장.jpg`·`verify_v4_포니테일_측광.jpg`, 수치 `verify_v4_수치.json`
- 체크포인트를 고른 근거: [하린 명세서 5절](../../../PULSE_AI모델_캐스팅_20260930/명세서/F02_하린.md)

## 다음

콘티 v4 ③(A판 여름 기준 2장)은 하이 포니테일로 진행할 수 있다. ⑧ B판 키프레임은 위의 빛·포니테일 높이·빈 골목 문구를 더해 만든다.

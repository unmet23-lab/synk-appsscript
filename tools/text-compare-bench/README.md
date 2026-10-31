# 문자 비교: JavaScript 개선판과 Rust 실험

2026-10-31, 유호님 요청으로 `tools/영상사전검사.mjs`의 `compareText`를 비교했다. **2026-11-01 사용자 요청으로 JavaScript 개선판을 영상 검사 도구에 연결했다.** Fable의 적용 가능 판정 뒤 P3 제안 세 건을 반영하고 관련 시험 13개를 통과했다([검수·적용 기록](../../docs/_ops/qa/text-compare-fable-20261031/README.md)). 아래 속도 수치는 최초 독립 실험(e93481078)의 기록이며, 최종 적용판의 새 실측으로 바꿔 적지 않았다.

## 구현과 비교 범위

- 기존판: 최초 실측은 `../영상사전검사.mjs`의 실제 `compareText`를 가져왔다. 그 구현을 [baseline.mjs](baseline.mjs)에 그대로 고정하여, 운영 함수가 개선된 뒤에도 자기 자신과 비교하지 않게 한다. 기준선의 정규화·오류 문구도 독립적으로 유지한다.
- JS 개선판: [공유 구현](../lib/text-compare.mjs)을 영상 검사 도구와 [벤치마크 입구](compare.mjs)가 함께 사용한다. 같은 앞뒤 부분 제외, 짧은 쪽 크기의 한 행 재사용, 정수 코드포인트 비교, 차이가 작은 경우 대각선 주변부터 계산한다. 범위를 넓혀 **정확한** 편집 거리가 확인될 때 끝낸다. 근사 점수나 오차 허용을 도입하지 않는다.
- Rust판: [rust/src/lib.rs](rust/src/lib.rs). JS 개선판과 같은 알고리즘을 Rust로 구현하고 release WebAssembly로 빌드했다. [rust.mjs](rust.mjs)가 Node 안에서 직접 호출한다. NFKC·대소문자·문자 분류는 두 후보 모두 동일한 JS 함수를 사용하여 Unicode 버전과 문맥별 소문자 규칙을 유지한다. Rust가 담당하는 부분은 편집 거리 계산이다.
- 기존 결과의 다섯 필드, 입력 순서별 글자 수, 12,000자 제한·오류 문구를 유지한다. 빈 문자열, 한글 자모 결합, 전각, 그리스어, 보조 평면 문자, 제거되는 이모지와 잘못된 서로게이트도 확인했다.
- 네이티브 `.exe`·Node 애드온, 브라우저, 모바일, 실제 고객 대본 분포는 측정하지 않았다. **이 결과를 Rust 전체의 성능으로 일반화하지 않는다.**

## 실측

[원자료 JSON](evidence/20261031.json)에 21개 사례의 7회 표본, 최솟값·중앙값·최댓값, 배치 횟수, 입력·소스·WASM 해시를 저장했다. 아래는 **한 번 호출하는 데 걸리는 시간의 중앙값(ms)**이다. 문자 정리·코드포인트 변환·결과 객체, Rust의 메모리 복사와 호출 비용을 모두 포함한다. 최초 모듈 로딩은 별도로 측정했다.

| 입력 | 기존 JS | 개선 JS | Rust/WASM | JS 개선 효과 |
|---|---:|---:|---:|---:|
| 짧은 한국어 대본, 62자 → 58자 | 0.045 | 0.016 | 0.015 | 2.8배 |
| 100자, 4자 치환 | 0.093 | 0.021 | 0.021 | 4.3배 |
| 1,000자, 35자 치환 | 6.002 | 0.535 | 0.466 | 11.2배 |
| 4,000자, 138자 치환 | 123.422 | 6.016 | 6.702 | 20.5배 |
| 12,000자, 414자 치환 | 1,242.155 | 29.560 | 36.176 | 42.0배 |
| 1,000자, 삽입·삭제·치환 혼합 | 7.690 | 0.431 | 0.384 | 17.8배 |
| 4,000자, 삽입·삭제·치환 혼합 | 117.649 | 3.640 | 3.928 | 32.3배 |
| 12,000자, 삽입·삭제·치환 혼합 | 1,063.933 | 35.609 | 45.457 | 29.9배 |
| 12,000자, 한 글자만 다름 | 865.083 | 2.063 | 2.098 | 419.4배 |
| 12,000자, 완전히 다름 | 871.185 | 356.410 | 488.172 | 2.4배 |

완전히 같은 12,000자는 기존 941.541ms → JS 2.250ms → Rust/WASM 2.145ms였다. 같은 부분을 제외하는 효과가 매우 큰 사례라 일반 대본의 대표 속도로 삼지 않는다. 위 표에 없는 100·1,000·4,000자의 동일·국소 수정·완전 불일치 사례도 원자료에 포함했다.

Rust/WASM 산출물은 18,020바이트. 별도 Node 프로세스 7개에서 모듈 읽기·컴파일·인스턴스 생성·첫 짧은 비교까지 **중앙값 2.075ms**, 범위 1.660~5.818ms였다. 이 수치는 Node 프로세스 시작 시간을 제외하며, 그 시간도 원자료에는 따로 남겼다. 정상 호출 표는 한 번 로딩한 인스턴스를 재사용한다. Rust 설치·빌드 시간은 호출 시간에 포함하지 않는다.

### 조건과 한계

- Intel Core Ultra 9 275HX, Windows, Node v24.20.0 / V8 13.6, Unicode 17.0. Rust 1.99.1, `wasm32-unknown-unknown`, release `opt-level=3`, LTO, 단일 codegen unit.
- 500회 공통 준비 실행 후 사례별 배치 크기를 정한다. 측정 순서를 매 회차 순환시켰고, 7개 배치의 회당 평균 중 중앙값을 사용했다. 느린 사례는 배치 1회다. 요청 지연시간 p95나 서비스 동시 접속 시험은 아니다.
- 입력은 고정 난수 한글과 새로 쓴 짧은 대본이다. 치환은 약 3.45%, 혼합 편집은 약 3.1%. 각 사례의 실제 편집 거리도 원자료에 있다. 실제 고객 자료·외부 전사·유료 API는 사용하지 않았다.
- 다른 데스크톱 작업의 부하는 통제하지 않았다. 12,000자 치환의 JS 표본은 25.960~63.480ms, Rust는 30.141~88.112ms로 변동했다. 수 % 차이는 우열의 확정 근거로 삼지 않는다.
- 정규화를 뺀 계산 시간도 별도로 측정했다. Rust 쪽은 이 경우에도 메모리 복사와 JS/WASM 호출을 포함한다. 긴 입력에서의 결과를 최초 로딩 비용 탓으로 해석하지 않는다.

## 정확성 확인

최초 실험의 `node --test tests/text-compare-bench.test.mjs` 실행 결과: **2개 시험 통과, 실패 0, 생략 0**. JS와 실제 release WASM 각각 **134,514개 입력쌍**의 결과 객체 전체를 기존 함수와 대조했다. 11-01 최종 적용판은 `node --test tests/text-compare-bench.test.mjs tests/영상사전검사.test.mjs`로 **13개 통과, 실패 0, 생략 0**을 확인했다. 운영 입구를 고정 기준선과 비교하고, 계산 범위 확대 136쌍과 치환·삽입·삭제 혼합 68쌍, 제한 초과 오류의 이전판 일치, 실제 영상의 96%·95%·94% 경고 경계를 검사한다. 빈 입력 검사와 문자 비교의 정규화는 공유 함수 하나를 쓴다.

- 알파벳 `a`, `b`, `가`의 길이 0~5인 모든 문자열 364개를 서로 비교: 132,496쌍.
- Unicode·입력 형변환 사례와 고정 난수 삽입·삭제·치환: 2,013쌍.
- 긴 입력·극단적인 길이 차이·보조 평면 문자의 경계: 5쌍.
- 별도로 제한 초과 오류와 정규화 후 12,000자 허용을 단언했다.
- 성능 측정의 21개 사례도 측정 전에 기존판·JS·Rust의 결과 객체가 같은지 단언했다.

WASM이 없는 환경의 시험은 Rust 항목을 이름과 이유를 표시해 생략한다. **JS 시험만 통과한 것을 Rust 검증 완료로 세면 안 된다.** Rust를 확인하려면 아래 빌드를 먼저 수행한다. 새 CI 관문이나 Rust 자동 설치는 추가하지 않았다.

## 다시 실행

저장소 루트에서 Rust와 해당 target이 준비된 경우:

```powershell
rustup target add wasm32-unknown-unknown
cargo build --release --locked --target wasm32-unknown-unknown --manifest-path tools/text-compare-bench/rust/Cargo.toml
node --test tests/text-compare-bench.test.mjs
New-Item -ItemType Directory -Path tools/text-compare-bench/results -Force | Out-Null
$env:SYNK_BENCH_RUSTC_VERSION = rustc --version
node tools/text-compare-bench/bench.mjs --out tools/text-compare-bench/results/new-run.json
```

결과 파일은 새 이름을 지정해야 한다. `wx`로 저장하여 기존 측정 자료를 덮어쓰지 않는다. `rust/target`과 `results`는 git에서 제외했다. 이번 PC의 Rust 도구는 `.tmp/text-compare-rust-toolchain` 아래에 설치했고 시스템 PATH는 바꾸지 않았다. 이 도구를 쓸 때는 다음 설정 후 위 명령의 `cargo`를 `& "$env:CARGO_HOME\bin\cargo.exe"`, `rustc`를 `& "$env:CARGO_HOME\bin\rustc.exe"`로 부른다.

```powershell
$env:RUSTUP_HOME = Join-Path (Get-Location) '.tmp/text-compare-rust-toolchain/rustup'
$env:CARGO_HOME = Join-Path (Get-Location) '.tmp/text-compare-rust-toolchain/cargo'
```

설치 방식과 target은 [Rustup 공식 설치 문서](https://rust-lang.github.io/rustup/installation/other.html), [Rust 공식 WASM target 문서](https://doc.rust-lang.org/rustc/platform-support/wasm32-unknown-unknown.html)를 확인했다. 외부 crate 의존성은 없다. 설치 파일 SHA-256은 공식 배포 체크섬과 재대조해 일치했다. 첫 체크섬 읽기 명령은 PowerShell 응답 형식 오류로 실패했으며, 설치 전 검증이 성공했다고 간주하지 않았다.

## 판단

이번 함수의 큰 개선은 **계산할 양을 줄인 알고리즘**에서 나왔다. JS 개선판만으로 1,000~12,000자의 소규모 편집 사례에서 약 11~42배 빨라졌다. 짧은 대본은 원래도 1ms보다 훨씬 작다. Rust/WASM은 일부 짧은 사례에서 비슷하거나 조금 빨랐지만, 긴 계산에서 추가 이득을 입증하지 못했다. JS 개선판은 별도 빌드 산출물과 모듈 로딩 없이 기존 호출 방식에 연결할 수 있다.

따라서 이 실험의 추천은 **JS 개선판 채택**이다. Rust의 네이티브 실행·다른 알고리즘·다른 모듈의 전환 가능성은 별도 문제이며 이번 결과로 배제하지 않는다. 영상 전체 검사나 SYNK 서비스 전체가 위 배수만큼 빨라진다는 뜻도 아니다.

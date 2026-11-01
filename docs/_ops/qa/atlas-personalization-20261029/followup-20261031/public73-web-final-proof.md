# PC0.4.73·웹 최종 공개 증명

11월1일 실제 공개·검수·시험 결과다. PC 설치 파일의 공개와 이 PC의 설치 관측을 구분한다. HTTP 제공 파일66개와 Git 검증77항목도 구분한다. 개인정보·인증값·비공개 검수 원문은 포함하지 않는다.

```json
{
  "at": "2026-11-01T06:17:45.156Z",
  "publication": {
    "commit": "9a0100409bc1e9eab54420166c58ce6b73a2e0d8",
    "url": "https://synk.im/",
    "plan": "480eb6be60b9",
    "review": "atlas-personal-ko13-public-final-baseline-20261101",
    "canonicalGatePassed": true,
    "siteCI": {
      "conclusion": "success",
      "headSha": "9a0100409bc1e9eab54420166c58ce6b73a2e0d8",
      "status": "completed",
      "url": "https://github.com/unmet23-lab/synk-policy/actions/runs/41279236324"
    },
    "pagesCI": {
      "conclusion": "success",
      "headSha": "9a0100409bc1e9eab54420166c58ce6b73a2e0d8",
      "status": "completed",
      "url": "https://github.com/unmet23-lab/synk-policy/actions/runs/41279235769"
    }
  },
  "web": {
    "candidateEntries": 77,
    "gitEntriesAllExactIncludingModeAndDeletion": true,
    "httpFiles": 66,
    "httpFilesAllExact": true,
    "nonHTTPEntries": 11,
    "tests": {
      "tests": 245,
      "pass": 245,
      "fail": 0,
      "cancelled": 0,
      "skipped": 0
    },
    "syntheticImages": 16,
    "widths": [
      1440,
      390
    ],
    "all77EntriesUnchangedDuringTests": true,
    "liveSiteAudit": {
      "checked": 78,
      "newAccessibilityFindings": [],
      "knownAccessibilityCount": 0,
      "accessibilityErrors": [],
      "visualCompared": 78,
      "visuallySameIncludingTiny": 65,
      "visualChanges": [
        {
          "route": "/builds/",
          "device": "desktop",
          "percent": 44.29,
          "height": [
            1029,
            1555
          ],
          "rows": [
            320,
            1554
          ],
          "diff": "visual/desktop/builds.png"
        },
        {
          "route": "/name/",
          "device": "desktop",
          "percent": 0.17,
          "height": [
            1836,
            1836
          ],
          "rows": [
            560,
            756
          ],
          "diff": "visual/desktop/name.png"
        },
        {
          "route": "/prompts/",
          "device": "desktop",
          "percent": 44.88,
          "height": [
            7447,
            15689
          ],
          "rows": [
            156,
            11998
          ],
          "diff": "visual/desktop/prompts.png"
        },
        {
          "route": "/world/korean-rhythm/",
          "device": "desktop",
          "percent": 15.01,
          "height": [
            1121,
            1303
          ],
          "rows": [
            1006,
            1302
          ],
          "diff": "visual/desktop/world~korean-rhythm.png"
        },
        {
          "route": "/world/korean-runner/",
          "device": "desktop",
          "percent": 0.19,
          "height": [
            1037,
            1037
          ],
          "rows": [
            664,
            686
          ],
          "diff": "visual/desktop/world~korean-runner.png"
        },
        {
          "route": "/builds/",
          "device": "mobile",
          "percent": 50.95,
          "height": [
            1393,
            1931
          ],
          "rows": [
            257,
            1930
          ],
          "diff": "visual/mobile/builds.png"
        },
        {
          "route": "/prompts/",
          "device": "mobile",
          "percent": 25.25,
          "height": [
            10944,
            23840
          ],
          "rows": [
            358,
            11999
          ],
          "diff": "visual/mobile/prompts.png"
        },
        {
          "route": "/world/korean-rhythm/",
          "device": "mobile",
          "percent": 16.14,
          "height": [
            1667,
            1846
          ],
          "rows": [
            1023,
            1845
          ],
          "diff": "visual/mobile/world~korean-rhythm.png"
        },
        {
          "route": "/world/korean-runner/",
          "device": "mobile",
          "percent": 13.57,
          "height": [
            1599,
            1575
          ],
          "rows": [
            662,
            1598
          ],
          "diff": "visual/mobile/world~korean-runner.png"
        }
      ],
      "missingBaselineImages": [
        {
          "route": "/builds/voice-check/",
          "device": "desktop"
        },
        {
          "route": "/study/",
          "device": "desktop"
        },
        {
          "route": "/builds/voice-check/",
          "device": "mobile"
        },
        {
          "route": "/study/",
          "device": "mobile"
        }
      ],
      "layoutErrors": [],
      "visualErrors": [],
      "allPagesVisuallyIdenticalNotClaimed": true
    }
  },
  "fable": {
    "model": "claude-fable-5-1",
    "complete": true,
    "p0": 0,
    "p1": 0,
    "fullSourceReview": "atlas-personal-ko13-full-public-20261101",
    "sourceReadScope": "21 source deltas, 8 full models, 8 compiler AST proofs, 2 actual compiled schema functions, 16 actual images",
    "menuDeltaReview": "atlas-personal-ko13-public-r2-20261101",
    "freshBaselineReview": "atlas-personal-ko13-public-final-baseline-20261101",
    "freshReadScope": "Identical77after-entry provenance, actual TAP, fresh baseline and16images; unchanged source verdict preserved from actual completed reviews",
    "rawCompiledCarriersNotAllReread": true,
    "freshArgonPackets": 32,
    "freshArgonFindings": 0,
    "nonblockingFollowups": [
      "F1: web schema accepts a manually constructed Doc13 containing a ko13 row; normal UI writes Doc14 and server rejects the malformed row."
    ],
    "evidenceCorrection": "F2 source-helper diff regenerated against actual d62 bytes; product code was already correct."
  },
  "native": {
    "version": "0.4.73",
    "buildId": "20261101.14",
    "sourceHash": "fc902effc63e5cd37ee85c40719e1047b9fe80551154be10a4bb0b175c7db6de",
    "releaseURL": "https://github.com/unmet23-lab/synk-policy/releases/tag/platform-preview-0.4.73",
    "ciURL": "https://github.com/unmet23-lab/synk-policy/actions/runs/41238949564",
    "all3OSBuildsSucceeded": true,
    "windowsIsolatedInstallAndStartupVerifiedInCI": true,
    "pairedTests": {
      "tests": 1090,
      "pass": 1090,
      "fail": 0,
      "skipped": 0
    },
    "all3PublicAssetsFullyDownloadedAndHashVerified": true,
    "artifacts": [
      {
        "platform": "win32",
        "arch": "x64",
        "bytes": 406877184,
        "sha256": "469ac5c1050d3ab7a27d2668d7f0836cf6c8b8ff38f3cbf31fabd230a0d3f745",
        "url": "https://github.com/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.73/SYNK-Platform-Preview-0.4.73-Signal-win-x64.exe"
      },
      {
        "platform": "darwin",
        "arch": "arm64",
        "bytes": 461216397,
        "sha256": "b1da26bc1a3b010465d4f8dc33ff879fe1179a199850070f78a4912b6204f3ff",
        "url": "https://github.com/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.73/SYNK-Platform-Preview-0.4.73-Signal-mac-arm64.dmg"
      },
      {
        "platform": "darwin",
        "arch": "x64",
        "bytes": 477793822,
        "sha256": "3fd02a9c35777d7842f72ff00b4a7e80f8575ac1ad402109f44d9f42c8c7ef5a",
        "url": "https://github.com/unmet23-lab/synk-policy/releases/download/platform-preview-0.4.73/SYNK-Platform-Preview-0.4.73-Signal-mac-x64.dmg"
      }
    ],
    "localInstalledPackageVersionObserved": "0.4.70",
    "forcedLocalRestart": false,
    "installed73NotInferredFromFeed": true,
    "localInstalledObservedAt": "2026-11-01T06:08:30.534Z"
  },
  "server": {
    "personalVersion": 74,
    "proof": "personal74-live-proof.json",
    "existingOther46ModulesPreserved": true,
    "actual47ModulesExact": true,
    "all6JWTEnabled": true,
    "all6AnonymousPost401": true,
    "operatingSqlWrites": 0,
    "customerProfileWrites": 0,
    "tokenRefreshes": 0
  },
  "validation": {
    "document14FenceGeneratedTests": 4,
    "document14FenceTestsPassed": true,
    "oldKo12SourcePreserved": true,
    "onlyTestsAndRecordsChangedAfterFunctionalReview": true
  },
  "computerUseCalls": 0
}
```

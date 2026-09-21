#!/usr/bin/env node
'use strict';

// 2026-09-22: 옛 리드크루 45편과 파생 콘텐츠는 현재 제작 대상에서 제외했다.
if (require.main === module) {
  console.error('옛 리드크루·카운트다운 제작 도구는 폐기했습니다. 현재 콘텐츠의 원문과 제작 경로는 docs/마케팅_정본.md에서 확인하세요. 파일 생성과 AI 호출은 하지 않았습니다.');
  process.exitCode = 2;
}

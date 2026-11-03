// 11-03 유호님 「둘 다 전부 빼기」로 고객 앱의 견본 목소리 A·B·C(13명 × 3, M03은 유호님 인터뷰 원음)를 지우지 않고
// 공개 폴더 밖 archive/casting-voice-20261103/로 옮겼다. 옮기기 전과 같은 바이트인지, 저장소 공개 폴더에는 남지 않았는지 본다.
// 회사 서버 판은 부모 원천의 파일을 지우지 못한다(tools/company-release/compose.cjs · 판 deployment/scope.cjs) — 운영 원천에는 옛 자리에 남고
// 공개 목록에서만 빠진다(10-22 「모델은 사진만」의 영상 · 기획 모음과 같은 길). 그래서 이 확인은 회사 판이 도는 회사 폴더 시험이 아니라 여기 둔다.
// 공개되지 않는지는 회사 시험(pulse-casting-server · pulse-photos-films-server)이 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const app = new URL('../docs/마케팅/온라인마케팅지도/engagement/company/', import.meta.url);
const VOICE_ARCHIVE = new URL('archive/casting-voice-20261103/', app);
const ARCHIVED_VOICE_SHA256 = {
  "F01-1.mp3": "0e1c1628659661857aaedcd29cae64e4dafdba61496ceb1270c467282ad18f7f",
  "F01-2.mp3": "c42813e425ac708b90fcacdfce37f886bee88e94dbae888faa9b8bf6c96bdd26",
  "F01-3.mp3": "4af0e37fc7e129e6c8e41c2b61850392b5f0e08087b1e8cf5de40bae7a052fd3",
  "F02-1.mp3": "dfade28a7094250e592f218395ea792b883c9273bbc0e71d9c946456d4ff0356",
  "F02-2.mp3": "16d041c0bfffdcd86c33205686fc5beaf1d3ab9454ad5219083742b249616a2a",
  "F02-3.mp3": "8c846a468d582e4b69de6df2ced56a9ac8633bab14cfea1db5497f688449f6ba",
  "F03-1.mp3": "51a6c9bf35e210cf3912bdd13b36dcd11f6be0de14dde2173996b0507357aaaa",
  "F03-2.mp3": "05635d102dbafb1ea4ef48a146fdaa47c0dfc4c2b2e6d085298d98ff4fd5dff2",
  "F03-3.mp3": "38ccb8c5787f7d0d42bc774a5ec4be8130f6e9b6aa66694b4525b0aedca64fda",
  "F04-1.mp3": "6442cf3c05bee8f21d02ba2a9062cdc8e62730c2b2b190d496224492daaf2013",
  "F04-2.mp3": "70d270adb302e52ac98c30648d6df6c58c76f80b518ad3024a16f9373bdf8bf0",
  "F04-3.mp3": "967cb24f9cffc72ec923d1b64e1b175b3632c11f1ea91c7d5e82da27e64e89af",
  "M01-1.mp3": "a24faa5f009d8c3aa7ecc447a22b23d0c47e57c036622f8bdba8c37b8b1d58cb",
  "M01-2.mp3": "f65e20d4b56558875ed61137f526d020513d151b62276ab36d027bd647129368",
  "M01-3.mp3": "717579033fcf4a001dbfe7391e46a405779c51b150305f5fe669e8bf9cf5d865",
  "M02-1.mp3": "282fd2df19e52a275607c84db4df9b1234a086a4480805f188dcde18c2fba912",
  "M02-2.mp3": "7f9a8b160b137c744f74867d778f21a5ecc55ca7e25a6bf5f55ca44db45f568d",
  "M02-3.mp3": "18b1bf45fad1d73b166c9cde5ed0ed6fe166907f3c68d40a91916d84fb1ed835",
  "M03-1.mp3": "417c1e652e70478c373a2c357ce1a7db1539b56e004ea5f582ddd558f40e24c8",
  "M03-2.mp3": "44de06897bc9b3225c7c1907631f32c8f074b620934a4e040751fb82c4cdaaec",
  "M03-3.mp3": "e2f3af34009c810bfaf9022ae002d8db3ab5cfa1e7c38cf9c0de2b8b5a3c1e94",
  "F05-1.mp3": "d1cafcd70deea0d6962687005794869df9819051257d105aacb7f207596f285a",
  "F05-2.mp3": "3ef39d7dfda8c0e5661029bed5f63287a5ed7ac6b57046b7a78fcb6e9b7579ac",
  "F05-3.mp3": "f28e00a028ce9def2b9f204f9f2e6a22bbca83b6a72fdae9bbabedb9ce80f598",
  "M04-1.mp3": "08551d6a4a1f729b218e833ac91a5652137c4d0e18b39b46e5286d59c13364c2",
  "M04-2.mp3": "d4813633dbd40c3000b72e5871b61985c7850e0faa47d5fcad9f4d34ba985c5f",
  "M04-3.mp3": "8f39e619c8ded952bf8c055b039eb3e02344abfd8ced53f610355fe37c31cb3c",
  "F06-1.mp3": "1d7203780107881b8f226761dc9dc23da52bc87fab4004ae869ba18eda4cc4f8",
  "F06-2.mp3": "9f13c79673b3de0176743b7e34ca3ad193dd614c6b78ca0c7069e327425c971c",
  "F06-3.mp3": "ed0d1b91843789b88a465e350d2110ec04fb8d91bf6ae6e75ca0e56ae02097a6",
  "F07-1.mp3": "e9d1a4c114f6f82af9eaa7e1697d47f1403c62235c18e757048ac224f3e9911d",
  "F07-2.mp3": "450d95706dc8ffcd412ecb7d372a4107d772d095728fc1e76f54c690000cbdb6",
  "F07-3.mp3": "81a7d29be539aacfd07d6607bf9df3fa5cfd4eeedfacb3fe81458db9ab361534",
  "M05-1.mp3": "49474dd0fc9bb033688391976aa443ab9cbc398dcfe76bbb04cc66a7b9a9a6f0",
  "M05-2.mp3": "4c7fc3d145f7af70ed7858ad16f09f4ac7f849dc059647afa3bc8406e9a46621",
  "M05-3.mp3": "4bc832b1c86dcd542091b78fa5031770f58081e6a37b44e382976a07789e8c14",
  "M06-1.mp3": "9799ef9012afb040cdcc0a109598c64372fa4795ac47638adde4eea08832bb38",
  "M06-2.mp3": "105ab3512f0f6e4bf5424c6e463fbef443116748739c78e617a9d010dba85baf",
  "M06-3.mp3": "14e3d9cf13f59d75ad77f6efc0f893dd07c87a514e5bc8a12764ade031038155"
};

test('옛 목소리 샘플 39개는 공개 폴더 밖 보관함에 같은 바이트로 있고, 공개 폴더에는 없다', async () => {
  assert.equal(Object.keys(ARCHIVED_VOICE_SHA256).length, 39);
  assert.deepEqual((await readdir(VOICE_ARCHIVE)).sort(), [...Object.keys(ARCHIVED_VOICE_SHA256), 'README.md'].sort(), '보관함에 샘플 전부와 안내 글');
  for (const [name, expected] of Object.entries(ARCHIVED_VOICE_SHA256)) {
    const bytes = await readFile(new URL(name, VOICE_ARCHIVE));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, name);
    assert.equal(existsSync(new URL('public/pulse-app/assets/casting/voice/' + name, app)), false, name + '는 공개 폴더에 없다');
  }
  assert.equal(existsSync(new URL('public/pulse-app/assets/casting/voice/', app)), false, '공개 목소리 폴더 없음');
});

// 시험 대상 — 기본은 이 패키지의 src/ · loader/. ATLAS_SUBJECT_ROOT가 있으면 그 폴더의 것을 시험한다(tools/mutants.mjs가 고친 사본).
// unit · properties 시험은 src · loader를 여기로만 부른다 — 그래야 변형 실행기가 사본을 시험할 수 있다(test/unit/conventions.test.mjs가 본다).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SUBJECT_ROOT = process.env.ATLAS_SUBJECT_ROOT
  ? path.resolve(process.env.ATLAS_SUBJECT_ROOT)
  : PACKAGE_ROOT;

export const subjectPath = (...parts) => path.join(SUBJECT_ROOT, ...parts);
export const subject = (relative = 'index.mjs') =>
  import(pathToFileURL(subjectPath('src', relative)).href);
export const loaderSource = (name = 'loader.js') =>
  fs.readFileSync(subjectPath('loader', name), 'utf8').replace(/\r\n/g, '\n');

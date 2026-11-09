# 복원 체계의 구글 드라이브 통로 — 새 노트북에서도 이 파일과 requests만 있으면 돈다(옛 media-upload.py는 import할 때 회사 앱 자격을 읽어 복원 첫 단계에 못 쓴다).
# 이어 올리기 · md5 대조 · 지연을 재며 속도 맞추기는 media-upload.py(10-03~)에서 겪은 대로다. 토큰 값은 어디에도 찍지 않는다.
import hashlib
import json
import random
import socket
import threading
import time
from pathlib import Path

import requests

API = 'https://www.googleapis.com/drive/v3/'
UP = 'https://www.googleapis.com/upload/drive/v3/files'
FOLDER = 'application/vnd.google-apps.folder'
CHUNK = 32 << 20
RETRYABLE = (429, 500, 502, 503, 504)


class Rate:
    """올림 속도. 30초마다 google 연결 시간을 재서 350ms를 넘으면 절반, 150ms 아래면 올린다(백업_업로드 현장 노트 「회선을 채워 gh·git push가 끊긴다」)."""

    def __init__(self, max_file=None, default_max=25.0, start=4.0):
        self.max_file, self.default_max = max_file, default_max
        self.lock = threading.Lock()
        self.next = time.monotonic()
        self.rate = start * 125000
        self.stop = threading.Event()
        self.thread = None

    def ceiling(self):
        try:
            return max(0.5, float(Path(self.max_file).read_text(encoding='utf-8').strip()))
        except (OSError, TypeError, ValueError):
            return self.default_max

    def adapt(self, measure=None):
        times = []
        for _ in range(3):
            began = time.perf_counter()
            try:
                if measure:
                    measure()
                else:
                    socket.create_connection(('www.google.com', 443), timeout=3).close()
                times.append((time.perf_counter() - began) * 1000)
            except OSError:
                times.append(3000.0)
        rtt = sorted(times)[1]
        current = self.rate / 125000
        if rtt > 350:
            current *= 0.5
        elif rtt < 150:
            current = current * 1.25 + 0.5
        self.rate = max(0.5, min(self.ceiling(), current)) * 125000
        return rtt

    def start(self):
        if self.thread:
            return

        def loop():
            while not self.stop.wait(30):
                self.adapt()
        self.thread = threading.Thread(target=loop, daemon=True)
        self.thread.start()

    def take(self, n):
        with self.lock:
            now = time.monotonic()
            begin = max(now, self.next)
            self.next = begin + n / self.rate
        if begin > now:
            time.sleep(begin - now)


class Body:
    """requests가 조금씩 읽어 보내는 본문. 읽을 때마다 속도에 맞춰 기다린다."""

    def __init__(self, data, rate):
        self.data, self.pos, self.rate = data, 0, rate

    def __len__(self):
        return len(self.data) - self.pos

    def read(self, n=-1):
        n = 64 << 10 if n is None or n < 0 else min(n, 64 << 10)
        part = self.data[self.pos:self.pos + n]
        self.pos += len(part)
        if part and self.rate:
            self.rate.take(len(part))
        return bytes(part)


def q(text):
    return text.replace('\\', '\\\\').replace("'", "\\'")


def read_clasp(auth_file):
    tokens = json.loads(Path(auth_file).read_text(encoding='utf-8'))['tokens']['default']
    return {key: tokens[key] for key in ('client_id', 'client_secret', 'refresh_token')}


class Drive:
    def __init__(self, cred, email, rate=None, session=None, sleep=time.sleep):
        self.cred, self.email, self.rate = cred, email, rate
        self.session = session or requests.Session()
        self.sleep = sleep
        self.access, self.expires = None, 0
        self.folders = {}

    def token(self, force=False):
        if force or not self.access or time.time() > self.expires:
            r = self.session.post('https://oauth2.googleapis.com/token', timeout=60, data={
                'client_id': self.cred['client_id'], 'client_secret': self.cred['client_secret'],
                'refresh_token': self.cred['refresh_token'], 'grant_type': 'refresh_token'})
            if r.status_code != 200:
                raise RuntimeError(f'DRIVE_TOKEN_FAILED {r.status_code}')
            body = r.json()
            self.access, self.expires = body['access_token'], time.time() + int(body.get('expires_in', 3600)) - 300
        return self.access

    def call(self, method, url, ok=(200,), headers=None, **kw):
        for attempt in range(9):
            try:
                r = self.session.request(method, url, headers={**(headers or {}), 'Authorization': 'Bearer ' + self.token()},
                                         timeout=kw.pop('timeout', 180), **kw)
            except requests.RequestException:
                self.sleep(min(60, 2 ** attempt) + random.random())
                continue
            if r.status_code in ok:
                return r
            if r.status_code == 401:
                self.token(force=True)
                continue
            text = r.text[:300]
            low = text.lower()
            if r.status_code in RETRYABLE or (r.status_code == 403 and ('rate' in low or 'quota' in low)):
                self.sleep(min(64, 2 ** attempt) + random.random() * 3)
                continue
            raise RuntimeError(f'DRIVE_HTTP_{r.status_code}: {method} {url.split("?")[0]} {text}')
        raise RuntimeError(f'DRIVE_RETRIES_EXHAUSTED: {method} {url.split("?")[0]}')

    def check_account(self):
        about = self.call('GET', API + 'about', params={'fields': 'user(emailAddress),storageQuota'}).json()
        if about['user']['emailAddress'] != self.email:
            raise RuntimeError('DRIVE_ACCOUNT_MISMATCH')
        return about

    def children(self, parent, name=None, folders_only=False):
        query = f"'{q(parent)}' in parents and trashed=false"
        if name is not None:
            query += f" and name='{q(name)}'"
        if folders_only:
            query += f" and mimeType='{FOLDER}'"
        found, page = [], None
        while True:
            params = {'q': query, 'pageSize': 1000,
                      'fields': 'nextPageToken,files(id,name,size,md5Checksum,mimeType,modifiedTime,webViewLink)'}
            if page:
                params['pageToken'] = page
            data = self.call('GET', API + 'files', params=params).json()
            found += data.get('files', [])
            page = data.get('nextPageToken')
            if not page:
                return found

    def folder(self, *names, make=True):
        """내 드라이브 맨 위에서 이름을 따라 폴더 ID를 준다. 같은 이름이 여럿이면 멈춘다(어느 쪽에 올렸는지 모르게 되므로)."""
        parent = 'root'
        for depth, name in enumerate(names):
            key = names[:depth + 1]
            if key in self.folders:
                parent = self.folders[key]
                continue
            have = self.children(parent, name, folders_only=True)
            if len(have) > 1:
                raise RuntimeError('DRIVE_DUPLICATE_FOLDER')
            if have:
                parent = have[0]['id']
            elif not make:
                return None
            else:
                made = self.call('POST', API + 'files', params={'fields': 'id'},
                                 json={'name': name, 'mimeType': FOLDER, 'parents': [parent]}).json()
                parent = made['id']
            self.folders[key] = parent
        return parent

    def upload(self, path, parent=None, name=None, file_id=None, properties=None):
        """이어 올리기. file_id를 주면 그 파일의 내용을 갈아 끼운다(파일 ID가 그대로라 Drive 판 기록에 남는다). (응답, md5, sha256)을 준다."""
        path = Path(path)
        size = path.stat().st_size
        meta = {'name': name or path.name}
        if parent and not file_id:
            meta['parents'] = [parent]
        if properties:
            meta['appProperties'] = properties
        if file_id:
            start = self.call('PATCH', UP + f'/{q(file_id)}?uploadType=resumable&fields=id,name,size,md5Checksum', json=meta,
                              headers={'X-Upload-Content-Type': 'application/octet-stream', 'X-Upload-Content-Length': str(size)})
        else:
            start = self.call('POST', UP + '?uploadType=resumable&fields=id,name,size,md5Checksum', json=meta,
                              headers={'X-Upload-Content-Type': 'application/octet-stream', 'X-Upload-Content-Length': str(size)})
        uri = start.headers['Location']
        offset, finished, failures = 0, None, 0
        with open(path, 'rb') as source:
            while finished is None:
                source.seek(offset)
                chunk = source.read(CHUNK)
                end = offset + len(chunk) - 1
                response = None
                try:
                    response = self.session.put(uri, data=Body(chunk, self.rate), timeout=900, headers={
                        'Authorization': 'Bearer ' + self.token(), 'Content-Length': str(len(chunk)),
                        'Content-Range': f'bytes {offset}-{end}/{size}' if chunk else f'bytes */{size}'})
                except requests.RequestException:
                    response = None
                if response is not None and response.status_code in (200, 201):
                    finished = response.json()
                    break
                if response is not None and response.status_code == 308:
                    failures = 0
                    got = response.headers.get('Range')
                    offset = int(got.split('-')[1]) + 1 if got else 0
                    continue
                if response is not None and response.status_code not in RETRYABLE and response.status_code != 401:
                    raise RuntimeError(f'DRIVE_UPLOAD_HTTP_{response.status_code}')
                failures += 1
                if failures > 12:
                    raise RuntimeError('DRIVE_UPLOAD_RETRIES_EXHAUSTED')
                if response is not None and response.status_code == 401:
                    self.token(force=True)
                self.sleep(min(60, 3 * failures) + random.random() * 3)
                # 어디까지 받았는지 물어 이어 간다
                try:
                    state = self.session.put(uri, timeout=60, headers={'Authorization': 'Bearer ' + self.token(),
                                                                       'Content-Length': '0', 'Content-Range': f'bytes */{size}'})
                except requests.RequestException:
                    continue
                if state.status_code in (200, 201):
                    finished = state.json()
                elif state.status_code == 308:
                    got = state.headers.get('Range')
                    offset = int(got.split('-')[1]) + 1 if got else 0
        md5, sha = file_hashes(path)
        if int(finished.get('size', -1)) != size or finished.get('md5Checksum') != md5:
            raise RuntimeError('DRIVE_UPLOAD_MISMATCH')
        return finished, md5, sha

    def download(self, file_id, dest, want_md5=None):
        """.part로 받고 md5가 맞을 때만 이름을 바꾼다. 끊기면 받은 데까지 이어 받는다."""
        dest = Path(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        part = dest.with_name(dest.name + '.part')
        for attempt in range(12):
            have = part.stat().st_size if part.exists() else 0
            headers = {'Authorization': 'Bearer ' + self.token()}
            if have:
                headers['Range'] = f'bytes={have}-'
            try:
                with self.session.get(API + f'files/{q(file_id)}', params={'alt': 'media', 'acknowledgeAbuse': 'true'},
                                      headers=headers, stream=True, timeout=300) as response:
                    if response.status_code == 416:
                        break
                    if response.status_code == 401:
                        self.token(force=True)
                        continue
                    if response.status_code in RETRYABLE:
                        self.sleep(min(60, 2 ** attempt) + random.random())
                        continue
                    if response.status_code not in (200, 206):
                        raise RuntimeError(f'DRIVE_DOWNLOAD_HTTP_{response.status_code}')
                    if have and response.status_code == 200:
                        part.unlink()
                    with open(part, 'ab') as out:
                        for block in response.iter_content(1 << 20):
                            out.write(block)
                break
            except requests.RequestException:
                self.sleep(min(60, 2 ** attempt) + random.random())
        else:
            raise RuntimeError('DRIVE_DOWNLOAD_RETRIES_EXHAUSTED')
        md5, _ = file_hashes(part)
        if want_md5 and md5 != want_md5:
            part.unlink()
            raise RuntimeError('DRIVE_DOWNLOAD_MISMATCH')
        part.replace(dest)
        return dest

    def trash(self, file_id):
        self.call('PATCH', API + f'files/{q(file_id)}', params={'fields': 'id'}, json={'trashed': True})


def file_hashes(path):
    md5, sha = hashlib.md5(), hashlib.sha256()
    with open(path, 'rb') as source:
        while block := source.read(8 << 20):
            md5.update(block)
            sha.update(block)
    return md5.hexdigest(), sha.hexdigest()

/* Dedicated PULSE intake project. Never merge into the main SYNK Apps Script. */
var PULSE_INTAKE_ = Object.freeze({
  prefix: 'pulse.intake.v1.', maxFileBytes: 30 * 1024 * 1024,
  maxTotalBytes: 80 * 1024 * 1024, maxFiles: 30, maxPayloadChars: 1024 * 1024,
  recipientLabel: 'SYNK PULSE 비공개 접수함'
});
var PULSE_ARTIFACTS_ = Object.freeze(['01_발주서.json', '02_자료목록.json', '03_제작검토_전달서.json', '04_제작검토_전달서.md', '05_발주서.html', '06_발주서.txt']);

function doGet(e) {
  var invite = e && e.parameter && typeof e.parameter.invite === 'string' ? e.parameter.invite : '';
  if (!/^[a-f0-9]{64}$/.test(invite)) invite = '';
  var config = JSON.stringify({invite: invite}).replace(/[<>&\u2028\u2029]/g, function(c) {
    return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
  });
  var html = HtmlService.createHtmlOutputFromFile('Index').getContent();
  html = html.replace(/<\/head>/i, '<script>window.SYNK_INTAKE=' + config + ';</script></head>');
  return HtmlService.createHtmlOutput(html).setTitle('SYNK PULSE · 영상 제작 발주서');
}

// Owner's local sync only. Customer RPCs never receive this separate credential.
function doPost(e) {
  var result;
  try {
    var body = e && e.postData && e.postData.contents;
    intakeAssert_(typeof body === 'string' && body.length <= 4096, 'invalid_admin_request', 'Invalid request');
    var input = JSON.parse(body);
    var expected = PropertiesService.getScriptProperties().getProperty(PULSE_INTAKE_.prefix + 'adminTokenHash');
    intakeAssert_(input && typeof input.adminToken === 'string' && /^[a-f0-9]{64}$/.test(input.adminToken) && expected && intakeEqual_(expected, intakeHash_(input.adminToken)), 'admin_unauthorized', 'Unauthorized');
    result = intakeLocked_(function() {
      intakeRoot_();
      if (input.action === 'listReceived') return intakeListReceived_(input);
      if (input.action === 'readFile') return intakeReadFile_(input);
      intakeAssert_(false, 'invalid_admin_request', 'Invalid request');
    });
  } catch (error) {
    result = {ok: false, error: error && error.intakeCode === 'admin_unauthorized' ? 'unauthorized' : 'request_failed'};
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function getIntakeConfig(invite) {
  return intakeSafe_(function() {
    var enabled = false;
    try { intakeInvite_(invite); intakeRoot_(); enabled = true; } catch (e) { enabled = false; }
    return {enabled: enabled, recipientLabel: PULSE_INTAKE_.recipientLabel,
      maxFileBytes: PULSE_INTAKE_.maxFileBytes, maxTotalBytes: PULSE_INTAKE_.maxTotalBytes,
      maxFiles: PULSE_INTAKE_.maxFiles, analysisAutomatic: false};
  });
}

function beginIntake(input) {
  return intakeSafe_(function() { return intakeLocked_(function() {
    intakeAssert_(input && input.consent === true, 'consent_required', '발주서와 자료 전송에 동의해주세요.');
    var invite = intakeInvite_(input.invite);
    intakeAssert_(typeof input.requestId === 'string' && /^[A-Za-z0-9_-]{16,100}$/.test(input.requestId), 'invalid_request', '접수 요청 정보가 올바르지 않습니다.');
    var normalized = intakeNormalize_(input.payload, input.manifest);
    var requestHash = intakeHash_(intakeCanonical_({data: normalized.payload.data, manifest: normalized.manifest}));
    var root = intakeRoot_();
    if (invite.value.requestId) {
      intakeAssert_(invite.value.requestId === input.requestId, 'invite_used', '이 초대 링크로 이미 시작한 접수가 있습니다. 기존 작성 화면에서 다시 시도해주세요.');
      intakeAssert_(invite.value.requestHash === requestHash, 'request_changed', '이미 전송을 시작한 발주서나 자료 목록이 변경되었습니다. 새 접수 링크를 요청해주세요.');
    } else {
      var errors = PULSE_BRIEF_CORE_.validation(normalized.payload.data);
      intakeAssert_(!errors.length, 'invalid_answers', errors.length ? errors[0].message : '답변을 확인해주세요.');
      invite.value.requestId = input.requestId;
      invite.value.requestHash = requestHash;
      invite.value.submissionId = 'p_' + Utilities.getUuid().replace(/-/g, '');
      invite.value.startedAt = new Date().toISOString();
      intakePut_(invite.key, invite.value);
    }
    var id = invite.value.submissionId;
    var recordKey = 'submission.' + id;
    var record = intakeGet_(recordKey);
    if (!record) {
      // Deterministic names recover a Drive create that succeeded before a property write failed.
      var folder = intakeFindFolder_(root, id) || root.createFolder(id);
      intakePrivate_(folder);
      var token = intakeUploadToken_(id, invite.hash);
      var state = {version: 1, submissionId: id, requestHash: requestHash,
        createdAt: invite.value.startedAt, status: 'uploading', receivedAt: null,
        payload: normalized.payload, manifest: normalized.manifest, files: []};
      var stateFile = intakeFindFile_(folder, '_intake-state.json');
      if (!stateFile) stateFile = intakeWrite_(folder, '_intake-state.json', JSON.stringify(state), 'application/json');
      record = {submissionId: id, inviteHash: invite.hash, expiresAt: invite.value.expiresAt,
        requestHash: requestHash, folderId: folder.getId(), stateFileId: stateFile.getId(), uploadTokenHash: intakeHash_(token)};
      intakePut_(recordKey, record);
    }
    var loaded = intakeLoad_(record);
    intakeAssert_(loaded.state.requestHash === requestHash, 'request_changed', '접수 정보가 변경되어 확인이 필요합니다.');
    if (loaded.state.status === 'received') { intakeIndexReceipt_(loaded); return intakeReceipt_(loaded.state); }
    return {submissionId: id, uploadToken: intakeUploadToken_(id, invite.hash),
      uploaded: intakePresent_(loaded.state).map(function(f) { return f.index; }), status: loaded.state.status};
  }); });
}

function uploadIntakeFile(input) {
  return intakeSafe_(function() { return intakeLocked_(function() {
    var loaded = intakeAuthorized_(input);
    var state = loaded.state;
    intakeAssert_(Number.isInteger(input.index) && input.index >= 0 && input.index < state.manifest.length, 'invalid_file', '자료 번호를 확인해주세요.');
    var item = state.manifest[input.index];
    var encoded = input.base64;
    intakeAssert_(typeof encoded === 'string' && encoded.length === 4 * Math.ceil(item.size / 3) && /^[A-Za-z0-9+/]*={0,2}$/.test(encoded), 'invalid_file', '자료 전송 내용이 올바르지 않습니다. 다시 시도해주세요.');
    var bytes = Utilities.base64Decode(encoded);
    intakeAssert_(bytes.length === item.size && Utilities.base64Encode(bytes) === encoded, 'file_size_mismatch', '자료 크기가 처음 선택한 원본과 다릅니다.');
    var sha256 = intakeHash_(bytes);
    intakeAssert_(sha256 === item.sha256, 'file_hash_mismatch', '자료 내용이 처음 선택한 원본과 다릅니다. 원본을 다시 선택하거나 새 접수 링크를 요청해주세요.');
    var old = state.files[input.index];
    if (old) {
      intakeAssert_(old.sha256 === sha256 && old.size === item.size, 'file_changed', '이미 전송한 자료의 내용이 바뀌었습니다. 새 접수 링크를 요청해주세요.');
      var prior = intakeFile_(old.fileId);
      if (prior && prior.getSize() === item.size && intakeHash_(prior.getBlob().getBytes()) === sha256) {
        intakePrivate_(prior);
        return {index: input.index, size: item.size, sha256: sha256};
      }
      intakeAssert_(state.status !== 'received', 'received_file_missing', '접수한 자료 상태를 담당자가 확인해야 합니다.');
    }
    intakeAssert_(state.status !== 'received', 'already_received', '접수가 완료되었습니다.');
    var storedName = ('00' + input.index).slice(-2) + '__' + item.name;
    var file = intakeFindFile_(loaded.folder, storedName);
    if (file) {
      intakeAssert_(file.getSize() === item.size && intakeHash_(file.getBlob().getBytes()) === sha256, 'file_changed', '이미 전송한 자료와 내용이 다릅니다. 담당자에게 문의해주세요.');
    } else {
      file = loaded.folder.createFile(Utilities.newBlob(bytes, 'application/octet-stream', storedName));
    }
    intakePrivate_(file);
    state.files[input.index] = {index: input.index, fileId: file.getId(), name: item.name,
      size: item.size, category: item.category, type: item.type, sha256: sha256};
    intakeSave_(loaded, state);
    return {index: input.index, size: item.size, sha256: sha256};
  }); });
}

function finishIntake(input) {
  return intakeSafe_(function() { return intakeLocked_(function() {
    var loaded = intakeAuthorized_(input);
    var state = loaded.state;
    if (state.status === 'received') { intakeIndexReceipt_(loaded); return intakeReceipt_(state); }
    intakeAssert_(intakePresent_(state).length === state.manifest.length, 'files_missing', '아직 전송되지 않은 자료가 있습니다. 다시 전송해주세요.');
    var files = state.manifest.map(function(item) {
      var saved = state.files[item.index];
      var file = intakeFile_(saved.fileId);
      intakePrivate_(file);
      intakeAssert_(file && file.getSize() === item.size && intakeHash_(file.getBlob().getBytes()) === saved.sha256, 'file_verification_failed', '자료 확인에 실패했습니다. 다시 전송해주세요.');
      return {index: item.index, name: item.name, size: item.size, category: item.category, type: item.type, sha256: saved.sha256};
    });
    state.status = 'finalizing';
    // Assign on each finish attempt; a failed earlier attempt must not sort behind
    // a newer completed receipt and disappear from a sync cursor.
    var receiptProps = PropertiesService.getScriptProperties();
    var lastReceiptMs = Number(receiptProps.getProperty(PULSE_INTAKE_.prefix + 'lastReceiptMs') || 0);
    state.receivedAt = new Date(Math.max(Date.now(), lastReceiptMs + 1)).toISOString();
    intakeSave_(loaded, state);
    var data = PULSE_BRIEF_CORE_.effective(state.payload.data);
    var payload = {schema: 'synk-video-brief', version: 1, brand: 'SYNK PULSE', createdAt: state.createdAt,
      receivedAt: state.receivedAt, submissionId: state.submissionId, data: data};
    var context = {submissionId: state.submissionId, receivedAt: state.receivedAt, generatedAt: state.receivedAt};
    var handoff = PULSE_BRIEF_HANDOFF_.build(data, files, context);
    var artifacts = [
      ['01_발주서.json', JSON.stringify(payload, null, 2), 'application/json'],
      ['02_자료목록.json', JSON.stringify({submissionId: state.submissionId, receivedAt: state.receivedAt, files: files}, null, 2), 'application/json'],
      ['03_제작검토_전달서.json', JSON.stringify(handoff, null, 2), 'application/json'],
      ['04_제작검토_전달서.md', PULSE_BRIEF_HANDOFF_.markdown(handoff), 'text/plain'],
      ['05_발주서.html', PULSE_BRIEF_CORE_.reportHtml(data, files), 'text/html'],
      ['06_발주서.txt', PULSE_BRIEF_CORE_.reportText(data, files), 'text/plain']
    ];
    artifacts.forEach(function(item) { intakeWrite_(loaded.folder, item[0], item[1], item[2]); });
    // This final state write is the receipt boundary. Partial artifacts never mean received.
    receiptProps.setProperty(PULSE_INTAKE_.prefix + 'lastReceiptMs', String(Date.parse(state.receivedAt)));
    state.status = 'received';
    intakeSave_(loaded, state);
    intakeIndexReceipt_(loaded);
    intakeNotifyOwner_(loaded);
    return intakeReceipt_(state);
  }); });
}

function intakeNormalize_(payload, manifest) {
  intakeAssert_(payload && payload.schema === 'synk-video-brief' && payload.version === 1 && payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data), 'invalid_payload', '올바른 발주서 데이터가 필요합니다.');
  intakeAssert_(JSON.stringify(payload).length <= PULSE_INTAKE_.maxPayloadChars, 'payload_too_large', '발주서 내용이 너무 큽니다.');
  var data = PULSE_BRIEF_CORE_.effective(payload.data);
  var allowed = PULSE_BRIEF_CORE_.activeAssets(data).map(function(a) { return a.id; });
  intakeAssert_(Array.isArray(manifest) && manifest.length <= PULSE_INTAKE_.maxFiles, 'invalid_manifest', '자료는 최대 30개까지 전송할 수 있습니다.');
  var total = 0;
  var normalized = manifest.map(function(f, index) {
    intakeAssert_(f && typeof f.name === 'string' && f.name.length > 0 && f.name.length <= 255 && !/[\\/\x00-\x1f\x7f]/.test(f.name) && /^.+\.(jpe?g|png|webp|avif|heic|gif|svg|pdf|mp4|mov|webm|mp3|wav|ai|psd|psb|eps|zip|txt|docx|pptx)$/i.test(f.name), 'invalid_filename', '지원하는 자료 이름과 파일 형식을 확인해주세요.');
    intakeAssert_(Number.isSafeInteger(f.size) && f.size >= 0 && f.size <= PULSE_INTAKE_.maxFileBytes, 'file_too_large', '자료 하나는 최대 30MB까지 전송할 수 있습니다.');
    intakeAssert_(allowed.indexOf(f.category) !== -1, 'invalid_category', '현재 발주서에서 사용하는 자료 분류인지 확인해주세요.');
    var type = f.type === undefined ? '' : f.type;
    intakeAssert_(typeof type === 'string' && type.length <= 120 && (!type || /^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(type)), 'invalid_type', '자료 형식 정보가 올바르지 않습니다.');
    intakeAssert_(typeof f.sha256 === 'string' && /^[a-f0-9]{64}$/.test(f.sha256), 'invalid_hash', '자료 원본 확인값이 필요합니다. 자료를 다시 선택해주세요.');
    total += f.size;
    return {index: index, name: f.name, size: f.size, category: f.category, type: type, sha256: f.sha256};
  });
  intakeAssert_(total <= PULSE_INTAKE_.maxTotalBytes, 'total_too_large', '자료 전체는 최대 80MB까지 전송할 수 있습니다.');
  return {payload: {schema: 'synk-video-brief', version: 1, brand: 'SYNK PULSE', data: data}, manifest: normalized};
}

function intakeAuthorized_(input) {
  intakeAssert_(input && typeof input.submissionId === 'string' && /^p_[a-f0-9]{32}$/.test(input.submissionId) && typeof input.uploadToken === 'string' && /^[a-f0-9]{64}$/.test(input.uploadToken), 'unauthorized', '접수 인증 정보가 올바르지 않습니다.');
  var record = intakeGet_('submission.' + input.submissionId);
  intakeAssert_(record && intakeEqual_(record.uploadTokenHash, intakeHash_(input.uploadToken)), 'unauthorized', '접수 인증 정보가 올바르지 않습니다.');
  intakeAssert_(Date.parse(record.expiresAt) > Date.now(), 'expired', '접수 링크의 사용 기간이 지났습니다. 담당자에게 새 링크를 요청해주세요.');
  intakeRoot_();
  return intakeLoad_(record);
}
function intakeInvite_(token) {
  intakeAssert_(typeof token === 'string' && /^[a-f0-9]{64}$/.test(token), 'invalid_invite', '유효한 접수 링크가 필요합니다.');
  var hash = intakeHash_(token), key = 'invite.' + hash, value = intakeGet_(key);
  intakeAssert_(value && Date.parse(value.expiresAt) > Date.now(), 'invalid_invite', '접수 링크가 없거나 사용 기간이 지났습니다.');
  return {hash: hash, key: key, value: value};
}
function intakeRoot_() {
  var id = PropertiesService.getScriptProperties().getProperty(PULSE_INTAKE_.prefix + 'rootFolder');
  intakeAssert_(id, 'not_configured', '접수함을 준비하고 있습니다. 담당자에게 문의해주세요.');
  var folder = DriveApp.getFolderById(id);
  intakePrivate_(folder);
  return folder;
}
function intakePrivate_(entry) {
  intakeAssert_(entry && !entry.isTrashed() && entry.getSharingAccess() === DriveApp.Access.PRIVATE && !entry.getEditors().length && !entry.getViewers().length, 'storage_not_private', '비공개 접수함 상태를 담당자가 확인해야 합니다.');
}
function intakeLoad_(record) {
  var folder = DriveApp.getFolderById(record.folderId), stateFile = DriveApp.getFileById(record.stateFileId);
  intakePrivate_(folder); intakePrivate_(stateFile);
  var state = JSON.parse(stateFile.getBlob().getDataAsString('UTF-8'));
  intakeAssert_(state.submissionId === record.submissionId && state.requestHash === record.requestHash, 'invalid_state', '접수 상태를 담당자가 확인해야 합니다.');
  return {record: record, folder: folder, stateFile: stateFile, state: state};
}
function intakeSave_(loaded, state) { loaded.stateFile.setContent(JSON.stringify(state)); }
function intakeFile_(id) { try { var file = DriveApp.getFileById(id); return file.isTrashed() ? null : file; } catch (e) { return null; } }
function intakePresent_(state) {
  return state.manifest.map(function(item) {
    var saved = state.files[item.index], file = saved && intakeFile_(saved.fileId);
    return file && file.getSize() === item.size ? saved : null;
  }).filter(Boolean);
}
function intakeFindFile_(folder, name) { var it = folder.getFilesByName(name); return it.hasNext() ? it.next() : null; }
function intakeFindFolder_(folder, name) { var it = folder.getFoldersByName(name); return it.hasNext() ? it.next() : null; }
function intakeWrite_(folder, name, content, type) {
  var old = intakeFindFile_(folder, name);
  if (old) { intakePrivate_(old); old.setContent(content); return old; }
  var file = folder.createFile(Utilities.newBlob(content, type, name)); intakePrivate_(file); return file;
}
function intakeReceipt_(state) { return {ok: true, submissionId: state.submissionId, receivedAt: state.receivedAt, fileCount: state.manifest.length, status: 'received'}; }
function intakeIndexReceipt_(loaded) {
  if (loaded.record.receivedAt === loaded.state.receivedAt && loaded.record.fileCount === loaded.state.manifest.length) return;
  loaded.record.receivedAt = loaded.state.receivedAt;
  loaded.record.fileCount = loaded.state.manifest.length;
  intakePut_('submission.' + loaded.state.submissionId, loaded.record);
}
// One mail per new receipt replaces polling the inbox. It names no answers or files,
// and a mail failure never undoes a receipt: the private inbox still holds it.
function intakeNotifyOwner_(loaded) {
  try {
    var owner = Session.getEffectiveUser().getEmail();
    if (!owner) return false;
    var state = loaded.state;
    var bytes = state.manifest.reduce(function(sum, item) { return sum + item.size; }, 0);
    MailApp.sendEmail(owner, '[SYNK PULSE] 새 발주서 접수 ' + state.submissionId, [
      '비공개 접수함에 새 발주서가 들어왔습니다.', '',
      '접수 ID: ' + state.submissionId, '접수 시각: ' + state.receivedAt,
      '자료: ' + state.manifest.length + '개 (' + Math.ceil(bytes / 1024) + 'KB)',
      '폴더: ' + loaded.folder.getUrl(), '',
      '고객 답변과 파일 이름은 메일에 넣지 않았습니다. 분석이 필요하면 이 접수 ID로 요청하세요.'
    ].join('\n'));
    return true;
  } catch (e) {
    return false;
  }
}
function intakeListReceived_(input) {
  var limit = input.limit === undefined ? 20 : input.limit;
  intakeAssert_(Number.isInteger(limit) && limit >= 1 && limit <= 20, 'invalid_admin_request', 'Invalid limit');
  var after = '';
  if (input.cursor !== undefined && input.cursor !== null && input.cursor !== '') {
    intakeAssert_(typeof input.cursor === 'string' && input.cursor.length <= 160 && /^[A-Za-z0-9+/=]+$/.test(input.cursor), 'invalid_admin_request', 'Invalid cursor');
    after = Utilities.newBlob(Utilities.base64Decode(input.cursor)).getDataAsString('UTF-8');
    intakeAssert_(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\|p_[a-f0-9]{32}$/.test(after), 'invalid_admin_request', 'Invalid cursor');
  }
  var props = PropertiesService.getScriptProperties().getProperties(), prefix = PULSE_INTAKE_.prefix + 'submission.';
  var items = Object.keys(props).filter(function(key) { return key.indexOf(prefix) === 0; }).map(function(key) {
    var record = JSON.parse(props[key]);
    if (!record.receivedAt) {
      // Recover a successful final state write whose index update response was lost.
      var loaded;
      try { loaded = intakeLoad_(record); } catch (error) { return null; }
      if (loaded.state.status !== 'received') return null;
      intakeIndexReceipt_(loaded); record = loaded.record;
    }
    return {submissionId: record.submissionId, receivedAt: record.receivedAt, fileCount: record.fileCount};
  }).filter(Boolean).sort(function(a,b) {
    var ka = a.receivedAt + '|' + a.submissionId, kb = b.receivedAt + '|' + b.submissionId;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  }).filter(function(item) { return item.receivedAt + '|' + item.submissionId > after; });
  var page = items.slice(0, limit), last = page[page.length - 1];
  return {ok: true, items: page, nextCursor: items.length > limit ? Utilities.base64Encode(last.receivedAt + '|' + last.submissionId, Utilities.Charset.UTF_8) : null};
}
function intakeReadFile_(input) {
  intakeAssert_(typeof input.submissionId === 'string' && /^p_[a-f0-9]{32}$/.test(input.submissionId), 'invalid_admin_request', 'Invalid submission');
  var record = intakeGet_('submission.' + input.submissionId);
  intakeAssert_(record, 'invalid_admin_request', 'Invalid submission');
  var loaded = intakeLoad_(record), state = loaded.state;
  intakeAssert_(state.status === 'received', 'invalid_admin_request', 'Not received');
  var hasArtifact = typeof input.artifact === 'string', hasIndex = Number.isInteger(input.fileIndex);
  intakeAssert_(hasArtifact !== hasIndex, 'invalid_admin_request', 'Choose one file');
  var file, name, sha256;
  if (hasArtifact) {
    intakeAssert_(PULSE_ARTIFACTS_.indexOf(input.artifact) !== -1, 'invalid_admin_request', 'Invalid artifact');
    name = input.artifact; file = intakeFindFile_(loaded.folder, name);
  } else {
    intakeAssert_(input.fileIndex >= 0 && input.fileIndex < state.manifest.length, 'invalid_admin_request', 'Invalid file index');
    var saved = state.files[input.fileIndex];
    file = intakeFindFile_(loaded.folder, ('00' + input.fileIndex).slice(-2) + '__' + saved.name);
    intakeAssert_(file && file.getId() === saved.fileId && file.getSize() === saved.size, 'invalid_admin_request', 'File mismatch');
    name = saved.name; sha256 = saved.sha256;
  }
  intakePrivate_(file);
  var offset = input.offset === undefined ? 0 : input.offset, limit = input.limit === undefined ? 1048576 : input.limit;
  intakeAssert_(Number.isSafeInteger(offset) && offset >= 0 && offset <= file.getSize() && Number.isInteger(limit) && limit > 0 && limit <= 1048576, 'invalid_admin_request', 'Invalid range');
  var bytes = file.getBlob().getBytes(), chunk = bytes.slice(offset, offset + limit);
  return {ok: true, submissionId: state.submissionId, name: name, size: bytes.length,
    sha256: sha256 || intakeHash_(bytes), offset: offset, base64: Utilities.base64Encode(chunk), eof: offset + chunk.length >= bytes.length};
}
function intakeUploadToken_(id, inviteHash) {
  var secret = PropertiesService.getScriptProperties().getProperty(PULSE_INTAKE_.prefix + 'secret');
  intakeAssert_(secret, 'not_configured', '접수함을 준비하고 있습니다.');
  return intakeHex_(Utilities.computeHmacSha256Signature(id + ':' + inviteHash, secret, Utilities.Charset.UTF_8));
}
function intakeGet_(key) { var value = PropertiesService.getScriptProperties().getProperty(PULSE_INTAKE_.prefix + key); return value ? JSON.parse(value) : null; }
function intakePut_(key, value) { PropertiesService.getScriptProperties().setProperty(PULSE_INTAKE_.prefix + key, JSON.stringify(value)); }
function intakeHex_(bytes) { return bytes.map(function(b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); }
function intakeHash_(value) { return intakeHex_(typeof value === 'string' ? Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8) : Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value)); }
function intakeEqual_(a, b) { if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false; var diff = 0; for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i); return diff === 0; }
function intakeCanonical_(value) {
  if (Array.isArray(value)) return '[' + value.map(intakeCanonical_).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(function(key) { return JSON.stringify(key) + ':' + intakeCanonical_(value[key]); }).join(',') + '}';
  return JSON.stringify(value);
}
function intakeLocked_(fn) { var lock = LockService.getScriptLock(); lock.waitLock(20000); try { return fn(); } finally { lock.releaseLock(); } }
function intakeAssert_(test, code, message) { if (!test) { var error = new Error(message); error.intakeCode = code; throw error; } }
function intakeSafe_(fn) {
  try { return fn(); } catch (error) {
    if (error && error.intakeCode) throw new Error('[' + error.intakeCode + '] ' + error.message);
    throw new Error('[retry] 접수를 완료하지 못했습니다. 같은 화면에서 다시 시도해주세요. 계속되면 담당자에게 문의해주세요.');
  }
}

// Editor-only administration. Trailing underscores hide these from google.script.run.
function initializeInbox_() {
  return intakeLocked_(function() {
    var props = PropertiesService.getScriptProperties(), prefix = PULSE_INTAKE_.prefix;
    var id = props.getProperty(prefix + 'rootFolder');
    var folder = id ? DriveApp.getFolderById(id) : DriveApp.createFolder('SYNK PULSE · 비공개 접수함');
    intakePrivate_(folder);
    props.setProperty(prefix + 'rootFolder', folder.getId());
    if (!props.getProperty(prefix + 'secret')) props.setProperty(prefix + 'secret', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
    return {configured: true, recipientLabel: PULSE_INTAKE_.recipientLabel};
  });
}
function createInvite_(options) {
  return intakeLocked_(function() {
    intakeRoot_();
    var days = options && options.days !== undefined ? options.days : 7;
    intakeAssert_(Number.isInteger(days) && days >= 1 && days <= 30, 'invalid_expiry', '초대 링크 사용 기간은 1~30일이어야 합니다.');
    var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    var now = new Date(), expiresAt = new Date(now.getTime() + days * 86400000).toISOString();
    intakePut_('invite.' + intakeHash_(token), {version: 1, createdAt: now.toISOString(), expiresAt: expiresAt});
    return {invite: token, expiresAt: expiresAt};
  });
}
function configureAdminSync_(token) {
  intakeAssert_(typeof token === 'string' && /^[a-f0-9]{64}$/.test(token), 'invalid_admin_token', '64자리 임의 16진수 토큰이 필요합니다.');
  PropertiesService.getScriptProperties().setProperty(PULSE_INTAKE_.prefix + 'adminTokenHash', intakeHash_(token));
  return {configured: true};
}

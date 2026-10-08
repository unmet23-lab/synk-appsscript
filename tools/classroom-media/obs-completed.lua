-- OBS 29+ Tools > Scripts. One OBS instance/profile per physical room stream.
-- RECORDING_STOPPED means OBS has closed the file. File-size polling is not used.
obs = obslua
local active_file = ""
local inbox_dir = ""
local snapshot = nil
local in_use = nil
-- Only the START which claimed this snapshot may consume one STOP. A failed
-- completion keeps its original snapshot for recovery, never for a later file.
local recording_open = false

function script_description()
  return "SYNK: 녹화 종료 후 완료 manifest 생성. CLI prepare/arm으로 수업을 먼저 지정하세요. 녹화 원본은 보존합니다. 자동 remux/파일 분할은 끄세요."
end

function script_properties()
  local props = obs.obs_properties_create()
  obs.obs_properties_add_path(props, "active_file", "교실의 active-room JSON (CLI 출력 경로)", obs.OBS_PATH_FILE, "JSON (*.json)", nil)
  obs.obs_properties_add_path(props, "inbox_dir", "완료 폴더 (config inboxDir)", obs.OBS_PATH_DIRECTORY, nil, nil)
  return props
end

function script_update(settings)
  active_file = obs.obs_data_get_string(settings, "active_file")
  inbox_dir = obs.obs_data_get_string(settings, "inbox_dir")
end

local function log_error(message)
  obs.script_log(obs.LOG_ERROR, "SYNK: " .. message)
end

local function exists(file)
  local handle = io.open(file, "rb")
  if handle then handle:close(); return true end
  return false
end

function on_event(event)
  if event == obs.OBS_FRONTEND_EVENT_RECORDING_STARTED then
    if snapshot then log_error("이전 녹화 완료 처리 확인 필요"); return end
    if active_file == "" or inbox_dir == "" then log_error("스크립트 경로 설정 필요"); return end
    if exists(active_file .. ".in-use") then log_error("이전 .in-use 파일 수동 확인 필요"); return end
    -- Claim first, then read that exact file. Reading active_file before rename
    -- could capture class A while a concurrent arm replaces it with class B.
    in_use = active_file .. ".in-use"
    if not os.rename(active_file, in_use) then log_error("먼저 CLI prepare/arm으로 수업 지정 필요"); return end
    snapshot = obs.obs_data_create_from_json_file(in_use)
    if not snapshot then log_error("점유된 수업 파일 확인 필요"); return end
    local name = obs.obs_data_get_string(snapshot, "manifestName")
    if #name ~= 64 or not name:match("^[a-f0-9]+$") then
      obs.obs_data_release(snapshot); snapshot = nil; log_error("잘못된 수업 파일"); return
    end
    recording_open = true
  elseif event == obs.OBS_FRONTEND_EVENT_RECORDING_STOPPED then
    if not snapshot or not recording_open then log_error("이 녹화에 지정된 수업 없음. 녹화는 보존됨; CLI seal 사용"); return end
    -- Consume the STOP before any fallible work. Even a missing path must not
    -- be filled later from obs_frontend_get_last_recording() for another class.
    recording_open = false
    local recording = obs.obs_frontend_get_last_recording()
    if not recording or recording == "" then log_error("완료된 녹화 경로 확인 실패"); return end
    obs.obs_data_set_string(snapshot, "file", recording)
    obs.obs_data_set_string(snapshot, "endsAt", os.date("!%Y-%m-%dT%H:%M:%SZ"))
    obs.obs_data_set_string(snapshot, "completion", "obs-recording-stopped")
    obs.obs_data_set_bool(snapshot, "fallback", false)
    local target = inbox_dir .. "/" .. obs.obs_data_get_string(snapshot, "manifestName") .. ".ready.json"
    if exists(target) then log_error("같은 수업 완료 파일 존재. 덮어쓰지 않음"); return end
    local temp = target .. ".tmp"
    local handle = io.open(temp, "wb")
    if not handle then log_error("완료 폴더 쓰기 실패"); return end
    local ok = handle:write(obs.obs_data_get_json(snapshot))
    local closed = handle:close()
    if not ok or not closed or not os.rename(temp, target) then log_error("완료 파일 원자적 등록 실패"); return end
    os.rename(in_use, in_use .. ".completed." .. tostring(os.time()) .. ".json")
    obs.obs_data_release(snapshot); snapshot = nil; in_use = nil
    obs.script_log(obs.LOG_INFO, "SYNK: 녹화 완료 등록. 업로더가 자동 처리합니다.")
  end
end

function script_load(settings)
  script_update(settings)
  obs.obs_frontend_add_event_callback(on_event)
end

function script_unload()
  obs.obs_frontend_remove_event_callback(on_event)
  recording_open = false
  if snapshot then obs.obs_data_release(snapshot); snapshot = nil end
end

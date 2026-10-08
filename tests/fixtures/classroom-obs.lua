-- Real Lua execution of obs-completed.lua; OBS and disk writes are synthetic.
local source, scenario = arg[1], arg[2]
local active, inbox = 'state/active-room-test.json', 'inbox'
local files, encoded, assignments, logs = {}, {}, {}, {}
local failure, last_recording, path_reads = nil, 'recordings/A.mkv', 0
local serial = 0
local function clone(value)
  local result = {}
  for key, item in pairs(value) do result[key] = item end
  return result
end
local function session(letter)
  return { classId = 'class-' .. letter, sessionKey = 'session-' .. letter, manifestName = string.rep(letter, 64) }
end
local function target(letter) return inbox .. '/' .. string.rep(letter, 64) .. '.ready.json' end
local function arm(letter) files[active] = session(letter) end
local function manifest(letter) return encoded[files[target(letter)]] end

io.open = function(file, mode)
  if mode == 'rb' then
    if files[file] == nil then return nil, 'not found' end
    return { close = function() return true end }
  end
  assert(mode == 'wb', 'unexpected mode')
  if failure == 'open' then return nil, 'synthetic open failure' end
  files[file] = ''
  return {
    write = function(self, value)
      if failure == 'write' then return nil, 'synthetic write failure' end
      files[file] = value
      return self
    end,
    close = function()
      if failure == 'close' then return nil, 'synthetic flush failure' end
      return true
    end,
  }
end
os.rename = function(from, to)
  if failure == 'rename' and to:match('%.ready%.json$') then return nil, 'synthetic rename failure' end
  if files[from] == nil then return nil, 'not found' end
  files[to], files[from] = files[from], nil
  return true
end
os.time = function() return 1791500000 end
os.date = function() return '2026-10-09T01:00:00Z' end
obslua = {
  OBS_FRONTEND_EVENT_RECORDING_STARTED = 1, OBS_FRONTEND_EVENT_RECORDING_STOPPED = 2,
  LOG_ERROR = 'error', LOG_INFO = 'info',
  obs_data_get_string = function(value, key) return value[key] or '' end,
  obs_data_create_from_json_file = function(file) return files[file] and clone(files[file]) end,
  obs_data_set_string = function(value, key, item)
    value[key] = item
    if key == 'file' then assignments[#assignments + 1] = item end
  end,
  obs_data_set_bool = function(value, key, item) value[key] = item end,
  obs_data_get_json = function(value)
    serial = serial + 1
    local key = 'encoded-' .. tostring(serial)
    encoded[key] = clone(value)
    return key
  end,
  obs_data_release = function() end,
  obs_frontend_get_last_recording = function() path_reads = path_reads + 1; return last_recording end,
  obs_frontend_add_event_callback = function() end,
  obs_frontend_remove_event_callback = function() end,
  script_log = function(level, text) logs[#logs + 1] = { level = level, text = text } end,
}
dofile(source)
script_load({ active_file = active, inbox_dir = inbox })
local function start() on_event(obslua.OBS_FRONTEND_EVENT_RECORDING_STARTED) end
local function stop() on_event(obslua.OBS_FRONTEND_EVENT_RECORDING_STOPPED) end

if scenario == 'unarmed' then
  start(); stop()
  assert(path_reads == 0, 'unarmed stop must never select a recording')
  assert(files[target('a')] == nil)
elseif scenario == 'success' then
  arm('a'); start(); stop()
  assert(manifest('a').file == 'recordings/A.mkv')
  assert(files[active .. '.in-use'] == nil)
  last_recording = 'recordings/B.mkv'
  arm('b'); start(); stop()
  assert(manifest('b').file == 'recordings/B.mkv')
  assert(manifest('a').file == 'recordings/A.mkv')
  assert(path_reads == 2)
elseif scenario == 'duplicate-stop' then
  arm('a'); start(); stop()
  last_recording = 'recordings/B.mkv'; stop()
  assert(path_reads == 1, 'duplicate stop must not read a later recording')
  assert(manifest('a').file == 'recordings/A.mkv')
else
  arm('a'); start()
  if scenario == 'missing-path' then last_recording = ''
  elseif scenario == 'existing-manifest' then files[target('a')] = 'original-completed-manifest'
  elseif scenario == 'manual-recovery' then failure = 'open'
  else failure = scenario:match('^(.*)%-failure$'); assert(failure) end
  stop()
  assert(files[active .. '.in-use'], 'failure must retain the occupied session for manual recovery')
  if scenario == 'existing-manifest' then
    assert(files[target('a')] == 'original-completed-manifest', 'existing completion must be preserved')
  else
    assert(files[target('a')] == nil, 'failed write/flush must not publish a completion')
  end
  failure, last_recording = nil, 'recordings/B.mkv'
  -- Even if the operator starts another recording, its stop cannot complete A.
  start(); stop(); stop()
  assert(path_reads == 1, 'a later recording must not replace the first stopped path')
  for _, file in ipairs(assignments) do assert(file == 'recordings/A.mkv', 'later recording associated with previous class') end
  if scenario == 'existing-manifest' then assert(files[target('a')] == 'original-completed-manifest')
  else assert(files[target('a')] == nil, 'later recording must not publish under previous class') end
  assert(#logs > 0, 'failure must be visible in OBS logs')
  if scenario == 'manual-recovery' then
    -- Operator seals A, checks and archives .in-use, then reloads the script.
    files[target('a')] = 'manually-sealed-A'
    assert(os.rename(active .. '.in-use', active .. '.recovered'))
    script_unload()
    script_load({ active_file = active, inbox_dir = inbox })
    arm('b'); start(); stop()
    assert(manifest('b').file == 'recordings/B.mkv', 'recovered script must handle the newly armed class')
    assert(files[target('a')] == 'manually-sealed-A', 'recovery must preserve the sealed original')
    assert(path_reads == 2)
  end
end
script_unload()
print('PASS ' .. scenario)

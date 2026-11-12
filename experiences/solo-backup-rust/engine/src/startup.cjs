'use strict';
function startupControl(app, { executable = process.execPath, testMode = false } = {}) {
  const options = { path: executable, args: ['--background'] };
  const settings = () => app.getLoginItemSettings(options);
  const active = value => !!value.openAtLogin && value.executableWillLaunchAtLogin === true && value.launchItems?.some(item => item.name === 'SoloWorkBackup' && item.enabled === true) === true;
  return {
    startupRegistered() { return testMode ? false : active(settings()); },
    setStartup(enabled) {
      if (typeof enabled !== 'boolean') throw new Error('시작 설정을 확인해 주세요.');
      if (testMode || !app.isPackaged) throw new Error('시험 실행에서는 Windows 시작 등록을 변경하지 않습니다.');
      const before = settings();
      // A Run entry can exist while Task Manager disables its actual launch.
      // An explicit off request must also remove such a disabled Run entry.
      if (enabled ? !active(before) : before.openAtLogin) app.setLoginItemSettings({ ...options, openAtLogin: enabled, enabled, name: 'SoloWorkBackup' });
      const after = settings();
      if (enabled ? !active(after) : after.openAtLogin) throw new Error('Windows 시작 등록을 확인하지 못했습니다.');
      return enabled;
    }
  };
}
module.exports = { startupControl };

param([Parameter(Mandatory=$true)][string]$EventPath)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$result = @{ channel = 'windows-notification'; accepted = $false; checkedAt = [DateTimeOffset]::UtcNow.ToString('o') }
try {
    $event = [IO.File]::ReadAllText($EventPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
    if ($event.id -notmatch '^[a-f0-9]{64}$') { throw 'Invalid event ID' }
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null
    [Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType=WindowsRuntime] | Out-Null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType=WindowsRuntime] | Out-Null
    $appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
    $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId)
    $result.setting = $notifier.Setting.ToString()
    if ($result.setting -ne 'Enabled') { throw 'Notifications disabled' }
    $title = [Security.SecurityElement]::Escape([string]$event.title)
    $body = [Security.SecurityElement]::Escape([string]$event.body)
    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml("<toast><visual><binding template='ToastGeneric'><text>$title</text><text>$body</text></binding></visual></toast>")
    $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
    $toast.Tag = $event.id.Substring(0,16)
    $toast.Group = 'SYNKBackup'
    $toast.ExpirationTime = [DateTimeOffset]::Now.AddDays(3)
    $notifier.Show($toast)
    # Show() alone is not delivery evidence. Confirm this exact tag in OS history.
    for ($attempt=0; $attempt -lt 10; $attempt++) {
        Start-Sleep -Milliseconds 300
        $found = @([Windows.UI.Notifications.ToastNotificationManager]::History.GetHistory($appId) | Where-Object { $_.Tag -eq $toast.Tag -and $_.Group -eq $toast.Group })
        if ($found.Count -gt 0) { $result.accepted = $true; break }
    }
    $result.code = if ($result.accepted) { 'OS_HISTORY_CONFIRMED' } else { 'OS_HISTORY_UNCONFIRMED' }
    $result.eventId = $event.id
    $result.tag = $toast.Tag
} catch {
    # Never expose account/config/provider exception text in notifications.
    $result.code = 'NOTIFICATION_DELIVERY_FAILED'
}
$result | ConvertTo-Json -Compress
if (-not $result.accepted) { exit 1 }

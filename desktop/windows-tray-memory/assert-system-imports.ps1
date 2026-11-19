param([Parameter(Mandatory)][AllowEmptyString()][string[]]$Report)

# Read every import row, including the optional delay-load section.
$lines = @($Report | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$type = [Array]::IndexOf($lines, 'File Type: DLL')
$summary = [Array]::LastIndexOf($lines, 'Summary')
if ($type -lt 0 -or $summary -le $type + 2 -or $lines[$type + 1] -ne 'Image has the following dependencies:') {
    throw 'Unrecognized dumpbin dependency report.'
}

$allowed = @('kernel32.dll', 'user32.dll', 'ntdll.dll', 'api-ms-win-core-synch-l1-2-0.dll')
$libraries = $lines[($type + 2)..($summary - 1)]
foreach ($entry in $libraries) {
    if ($entry -eq 'Image has the following delay load dependencies:') { continue }
    if ($entry -notin $allowed) { throw ('Unexpected PE import: ' + $entry) }
}
if ($libraries -notcontains 'KERNEL32.dll') { throw 'Expected KERNEL32.dll in the PE imports.' }

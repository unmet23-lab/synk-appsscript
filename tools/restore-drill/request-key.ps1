param([Parameter(Mandatory=$true)][string]$PlanPath)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$form=New-Object Windows.Forms.Form
$form.Text='SYNK 백업 복원 시험'
$form.ClientSize=New-Object Drawing.Size(510,200)
$form.StartPosition='CenterScreen'
$form.FormBorderStyle='FixedDialog'
$form.MaximizeBox=$false
$label=New-Object Windows.Forms.Label
$label.Location=New-Object Drawing.Point(18,16)
$label.Size=New-Object Drawing.Size(475,55)
$label.Text="기존 백업 암호를 입력해 주세요.`n암호는 채팅·파일·명령줄에 저장하지 않고, 이 PC의 격리 복원에만 사용합니다."
$box=New-Object Windows.Forms.TextBox
$box.Location=New-Object Drawing.Point(20,82)
$box.Size=New-Object Drawing.Size(465,28)
$box.UseSystemPasswordChar=$true
$button=New-Object Windows.Forms.Button
$button.Location=New-Object Drawing.Point(355,132)
$button.Size=New-Object Drawing.Size(130,34)
$button.Text='복원 시험 시작'
$button.Add_Click({
 if($box.Text.Length -eq 0){return}
 $button.Enabled=$false
 try {
  $psi=New-Object Diagnostics.ProcessStartInfo
  $psi.FileName=(Get-Command node.exe).Source
  $psi.ArgumentList.Add((Join-Path $PSScriptRoot 'decrypt-plan.cjs'))
  $psi.ArgumentList.Add($PlanPath)
  $psi.UseShellExecute=$false
  $psi.CreateNoWindow=$true
  $psi.RedirectStandardInput=$true
  $psi.RedirectStandardOutput=$true
  $psi.RedirectStandardError=$true
  $p=[Diagnostics.Process]::Start($psi)
  $script:restoreProcess=$p
  $p.StandardInput.WriteLine($box.Text)
  $p.StandardInput.Close()
  $box.Clear()
  $form.Close()
 } catch {
  $box.Clear()
  $button.Enabled=$true
  $label.Text='입력창 실행에 실패했습니다. 암호는 저장되지 않았습니다.'
 }
})
$form.Controls.AddRange(@($label,$box,$button))
$form.AcceptButton=$button
$form.Add_Shown({$box.Focus()})
[void]$form.ShowDialog()
if($script:restoreProcess){$script:restoreProcess.WaitForExit();$script:restoreProcess.Dispose()}

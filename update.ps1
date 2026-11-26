# Pulls the latest main branch from GitHub without git (the VM has no git).
# Overwrites tracked files in place; keeps node_modules, captures, aqs.host,
# aqs.local.json. Files deleted upstream are not deleted here.
# Run: npm run update
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$url = 'https://github.com/Dzmitry-Palkhouski/aqs-automation/archive/refs/heads/main.zip'
$zip = Join-Path $env:TEMP 'aqs-automation-main.zip'
$tmp = Join-Path $env:TEMP 'aqs-automation-update'

Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $zip
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $tmp -Force
$src = Join-Path $tmp 'aqs-automation-main'

robocopy $src $PSScriptRoot /E /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with code $LASTEXITCODE" }

$sha = ''
try {
  $sha = (Invoke-RestMethod -UseBasicParsing 'https://api.github.com/repos/Dzmitry-Palkhouski/aqs-automation/commits/main').sha.Substring(0, 7)
} catch { }
Write-Host "Updated from GitHub main $sha"

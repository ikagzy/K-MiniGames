@echo off
rem K-MiniGames: oyun modelini k-ai yapar (ayar dosyasindaki baska ayarlara dokunmaz).
rem Cift tikla calistir. K-MiniGames acikken de calisir; degisiklik bir sonraki acilista gecerli olur.
set "MODEL=%~1"
if "%MODEL%"=="" set "MODEL=k-ai-v3:latest"
powershell -NoProfile -Command ^
  "$p = Join-Path $env:LOCALAPPDATA 'K-MiniGames\settings.json'; $d = [ordered]@{}; if (Test-Path $p) { (Get-Content $p -Raw -Encoding UTF8 | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $d[$_.Name] = $_.Value } }; $d['game_model'] = '%MODEL%'; New-Item -ItemType Directory -Force -Path (Split-Path $p) | Out-Null; [System.IO.File]::WriteAllText($p, ($d | ConvertTo-Json), (New-Object System.Text.UTF8Encoding $false)); Write-Host ('Oyun modeli: ' + $d['game_model']); Write-Host ('Dosya: ' + $p)"
echo.
echo Simdi K-MiniGames'i (yeniden) ac.
pause

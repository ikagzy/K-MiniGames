@echo off
rem K-MiniGames: danismanin (Don'un) hafiza notlarini siler. Bob "Don bana sunlari anlatti" derken bu notlari gosterir.
rem K-MiniGames kapaliyken calistir.
set "F=%LOCALAPPDATA%\K-MiniGames\danisman_hafiza.md"
if exist "%F%" (del "%F%" & echo Silindi: %F%) else echo Dosya yok: %F%
echo.
pause

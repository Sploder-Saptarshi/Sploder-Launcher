@echo off
call yarn dist-32bit
call yarn dist
echo Build complete.
pause

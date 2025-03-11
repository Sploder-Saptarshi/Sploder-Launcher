@echo off
rem set NODE_OPTIONS=--openssl-legacy-provider
call npx yarn dist
echo Build complete. Press any key to close.
pause > nul

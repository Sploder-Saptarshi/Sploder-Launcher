@echo off
set NODE_OPTIONS=--openssl-legacy-provider --openssl_fips=''
call yarn dist
echo Build complete. Press any key to close.
pause > nul

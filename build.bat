@echo off
set NODE_OPTIONS=--openssl-legacy-provider
set openssl_fips=0
call yarn dist
echo Build complete. Press any key to close.
pause > nul

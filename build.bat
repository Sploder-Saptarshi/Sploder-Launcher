@echo off
set NODE_OPTIONS=--openssl-legacy-provider
call yarn dist --openssl_fips=''
echo Build complete. Press any key to close.
pause > nul

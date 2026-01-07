@echo off
echo Stopping backend server...
taskkill /F /IM node.exe
timeout /t 2
echo.
echo Backend stopped. Please restart manually with: npm run dev
pause

@echo off
echo ========================================
echo  Class Management System — Dev Start
echo ========================================
echo.
echo Starting Backend on http://localhost:5000 ...
start cmd /k "cd backend && npm install && npm run dev"
timeout /t 4 > nul
echo Starting Frontend on http://localhost:4200 ...
start cmd /k "cd frontend && npm install && ng serve --open"
echo.
echo Both servers starting. Browser will open automatically.
echo.
echo FIRST TIME SETUP: Make sure to run seed once:
echo   cd backend
echo   npm run seed

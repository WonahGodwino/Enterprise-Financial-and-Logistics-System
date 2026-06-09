@echo off
echo =========================================
echo  EFMS Deployment from Windows
echo =========================================
echo.
echo Current directory: %cd%
echo.
echo 📤 Pushing to GitHub (master)...
git push origin master

if %errorlevel% neq 0 (
    echo ❌ Git push failed!
    pause
    exit /b %errorlevel%
)

echo.
echo 🚀 Deploying to server (168.231.116.154)...
ssh root@168.231.116.154 "cd /opt/efms/Enterprise-Financial-and-Logistics-System && git pull origin master && cd backend && docker compose down && docker compose build --no-cache backend frontend && docker compose up -d --force-recreate --renew-anon-volumes && echo ===== Backend startup logs ===== && docker compose logs backend --tail=50"

if %errorlevel% neq 0 (
    echo ❌ Deployment failed!
    pause
    exit /b %errorlevel%
)

echo.
echo ✅ Deployment complete!
echo.
echo 🌐 Access at: http://168.231.116.154
pause
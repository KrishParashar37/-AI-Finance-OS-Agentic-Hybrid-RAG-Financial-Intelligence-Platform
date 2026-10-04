@echo off
echo Pushing SSL Fix for Next.js...
git add .
git commit -m "Fix TiDB SSL connection in Next.js"
git push
echo Done!
pause

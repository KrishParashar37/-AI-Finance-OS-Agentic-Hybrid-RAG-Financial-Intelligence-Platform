@echo off
echo Committing dependency fixes...
git add .
git commit -m "Relax all dependencies"
echo Pushing to GitHub...
git push
echo Done!
pause

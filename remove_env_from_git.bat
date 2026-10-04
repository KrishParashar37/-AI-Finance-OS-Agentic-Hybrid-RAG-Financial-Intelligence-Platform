@echo off
echo Removing .env from GitHub...
git rm --cached .env
git add .gitignore
git commit -m "Remove .env from repository"
echo Pushing to GitHub...
git push
echo Done!
pause

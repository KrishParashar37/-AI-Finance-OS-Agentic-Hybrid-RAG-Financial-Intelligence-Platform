@echo off
echo Pushing final fixes...
git add .
git commit -m "Final fixes for TiDB connection and SSL"
git push
echo Done!
pause

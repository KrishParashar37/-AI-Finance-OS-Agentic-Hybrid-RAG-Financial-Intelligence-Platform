@echo off
echo Pushing Netlify settings...
git add netlify.toml
git commit -m "Disable overly sensitive Netlify secrets scanning"
git push
echo Done!
pause

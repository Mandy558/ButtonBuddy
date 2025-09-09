@echo off
REM Adjust the path below if your repo is elsewhere:
cd /d "C:\Users\sidh_\Downloads\ButtonBuddy_v2\buttonbuddy_v2\backend"
call .\.venv\Scripts\activate
uvicorn server:app --port 8000
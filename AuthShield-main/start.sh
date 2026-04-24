#!/bin/sh
set -e

cd /app/frontend_demo
python -m http.server 3000 --bind 0.0.0.0 &

cd /app/backend_demo/backend
exec uvicorn main:app --host 0.0.0.0 --port 8000

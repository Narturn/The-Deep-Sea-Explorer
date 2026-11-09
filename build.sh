#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "=== [1/3] Cài đặt dependencies với uv sync ==="
uv sync --frozen

echo "=== [2/3] Thu thập static assets (collectstatic) ==="
uv run python manage.py collectstatic --no-input

echo "=== [3/3] Thực thi database migrations ==="
uv run python manage.py migrate

echo "=== Build hoàn tất thành công! ==="


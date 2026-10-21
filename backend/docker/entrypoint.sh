#!/bin/sh
set -e

[ -f .env ] || cp .env.example .env
grep -q '^APP_KEY=.\+' .env || php artisan key:generate --force

php artisan migrate --force
php artisan db:seed --force   # idempotent: skipped when the admin user already exists

exec php artisan serve --host=0.0.0.0 --port=8000

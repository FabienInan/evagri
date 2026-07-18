#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy

echo "Seeding database if needed..."
npx tsx prisma/seed.ts

echo "Starting application..."
exec node server.js

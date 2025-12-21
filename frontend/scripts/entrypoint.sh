#!/bin/bash
set -e

echo "Installing dependenciess..."
npm install

echo "Starting application..."
exec npm run dev -- --host 0.0.0.0

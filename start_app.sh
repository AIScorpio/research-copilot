#!/bin/bash
echo "Starting Applied AI Research Pipeline..."
echo "Running database migrations..."
npx prisma db push
echo "Building the application..."
npm run build
echo "Starting production server..."
npm start

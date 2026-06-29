#!/bin/bash
# Quick start script — opens both backend and frontend in parallel
echo "🚀 Starting Class Management System..."
echo ""
echo "Starting backend on http://localhost:5000 ..."
(cd backend && npm install && npm run dev) &
echo "Starting frontend on http://localhost:4200 ..."
(cd frontend && npm install && ng serve --open) &
wait

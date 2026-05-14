#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# AI-Powered Smart Traffic Congestion Predictor — Start All Services
# ─────────────────────────────────────────────────────────────────────────────
# Services:
#   1. Flask AI Microservice  → http://localhost:5002
#   2. Spring Boot API        → http://localhost:8080
#   3. React Frontend (Vite)  → http://localhost:5173
# ─────────────────────────────────────────────────────────────────────────────

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
FLASK_DIR="$ROOT/backend/traffic-controll-i/ai_model"
SPRING_DIR="$ROOT/backend/traffic-controll-i"
FRONTEND_DIR="$ROOT/frontend"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   AI-Powered Smart Traffic Congestion Predictor          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Flask AI Microservice ─────────────────────────────────────────────────
echo "▶ Starting Flask AI Microservice on port 5002..."
cd "$FLASK_DIR"

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
  echo "  Creating Python virtual environment..."
  python3 -m venv venv
fi

source venv/bin/activate
pip install -q -r requirements.txt

# Start Flask in background
python app.py &
FLASK_PID=$!
echo "  Flask started (PID: $FLASK_PID)"
deactivate

# ── 2. Spring Boot ────────────────────────────────────────────────────────────
echo ""
echo "▶ Starting Spring Boot API on port 8080..."
cd "$SPRING_DIR"
./mvnw spring-boot:run -q &
SPRING_PID=$!
echo "  Spring Boot started (PID: $SPRING_PID)"

# Wait for Spring Boot to be ready
echo "  Waiting for Spring Boot to be ready..."
for i in $(seq 1 30); do
  if curl -s http://localhost:8080/api/traffic/health > /dev/null 2>&1; then
    echo "  ✓ Spring Boot is ready"
    break
  fi
  sleep 2
done

# ── 3. React Frontend ─────────────────────────────────────────────────────────
echo ""
echo "▶ Starting React Frontend on port 5173..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!
echo "  Frontend started (PID: $FRONTEND_PID)"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  All services started!                                   ║"
echo "║                                                          ║"
echo "║  Flask AI:     http://localhost:5002/health              ║"
echo "║  Spring Boot:  http://localhost:8080/api/traffic/health  ║"
echo "║  Frontend:     http://localhost:5173                     ║"
echo "║                                                          ║"
echo "║  Press Ctrl+C to stop all services                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Trap Ctrl+C to kill all background processes
trap "echo ''; echo 'Stopping all services...'; kill $FLASK_PID $SPRING_PID $FRONTEND_PID 2>/dev/null; exit 0" INT

# Keep script running
wait

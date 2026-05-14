# AI-Powered Smart Traffic Congestion Predictor

> Predict traffic before it happens — 30–60 minutes in advance.

## Architecture

```
React Frontend (port 5173)
        │
        │  /api/* → Vite proxy
        ▼
Spring Boot API (port 8080)  ──── MySQL (port 3306)
        │                          db: smrtrafficcontroller
        │  RestTemplate HTTP
        ▼
Flask AI Microservice (port 5002)
        │
        │  tf.keras.models.load_model("mkc.h5")
        ▼
Keras Model — 4-class congestion classifier
[LOW | MEDIUM | HIGH | SEVERE]
```

## Features

| Feature | Status |
|---|---|
| AI Congestion Prediction (30–60 min ahead) | ✅ |
| Traffic Heatmap (live, Delhi NCR) | ✅ |
| Smart Route Planner (AI rerouting) | ✅ |
| Real-time Alerts | ✅ |
| Emergency Vehicle Priority Corridor | ✅ |
| AI Chatbot (traffic assistant) | ✅ |
| Smart Signal Timing | ✅ |
| DB History (MySQL) | ✅ |

## Prerequisites

- **Node.js** 18+ and npm
- **Java** 17+ and Maven (or use `./mvnw`)
- **Python** 3.9+
- **MySQL** running on port 3306

## Quick Start

### Option A — One command (macOS/Linux)

```bash
./start.sh
```

### Option B — Manual (3 terminals)

**Terminal 1 — Flask AI Microservice**
```bash
cd backend/traffic-controll-i/ai_model
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
# → http://localhost:5002
```

**Terminal 2 — Spring Boot API**
```bash
cd backend/traffic-controll-i
./mvnw spring-boot:run
# → http://localhost:8080
```

**Terminal 3 — React Frontend**
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

## Database Setup

Create the MySQL database before starting Spring Boot:

```sql
CREATE DATABASE smrtrafficcontroller;
```

Hibernate will auto-create the tables on first run (`ddl-auto=update`).

The DB credentials are in `backend/traffic-controll-i/src/main/resources/application.properties`.  
For production, move the password to an environment variable.

## API Reference

All endpoints are available at `http://localhost:8080/api/traffic/`

| Endpoint | Method | Description |
|---|---|---|
| `/predict` | POST | Congestion prediction |
| `/heatmap` | POST | City heatmap grid |
| `/reroute` | POST | Alternate route suggestions |
| `/signal-timing` | POST | Dynamic signal timing |
| `/emergency-route` | POST | Emergency vehicle corridor |
| `/alerts` | GET/POST | Real-time traffic alerts |
| `/chatbot` | POST | AI traffic assistant |
| `/stats` | GET | Dashboard statistics |
| `/health` | GET | Service health check |
| `/history/predictions` | GET | Last 10 predictions (DB) |
| `/history/alerts` | GET | Last 10 alerts (DB) |
| `/history/emergency` | GET | Last 10 emergency activations (DB) |
| `/history/chat` | GET | Last 20 chat messages (DB) |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Leaflet, Recharts, Axios |
| API Gateway | Spring Boot 4, Spring Data JPA |
| AI Service | Flask 3, TensorFlow/Keras |
| Database | MySQL 8 |
| ML Model | Keras LSTM/Dense — 4-class classifier |

## Project Structure

```
├── frontend/                    React + Vite SPA
│   ├── src/pages/
│   │   ├── DashBoard.jsx        Prediction + forecast + signals
│   │   ├── MapView.jsx          Live heatmap (Leaflet)
│   │   ├── Routes.jsx           AI route planner
│   │   ├── Alerts.jsx           Real-time alerts
│   │   ├── Emergency.jsx        Emergency vehicle corridor
│   │   └── Chatbot.jsx          AI traffic assistant
│   └── vite.config.js           Proxy: /api → :8080
│
├── backend/
│   └── traffic-controll-i/
│       ├── ai_model/
│       │   ├── app.py           Flask AI microservice (port 5002)
│       │   ├── mkc.h5           Trained Keras model
│       │   └── requirements.txt
│       └── src/main/java/       Spring Boot (port 8080)
│           ├── controller/      TrafficController — 13 endpoints
│           ├── service/         AIService — proxies to Flask + saves to DB
│           ├── entity/          JPA entities (4 tables)
│           ├── model/           Request/Response DTOs
│           └── repository/      Spring Data JPA repos
│
├── data/
│   ├── generate_data.py         Synthetic training data generator
│   └── traffic_data.csv         1000-row dataset
│
└── start.sh                     One-command startup script
```

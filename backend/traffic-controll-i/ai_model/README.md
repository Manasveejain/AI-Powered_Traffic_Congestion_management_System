# AI Traffic Model — Flask Microservice

## Setup

```bash
cd ai_model
pip install -r requirements.txt
```

Place your `mkc.h5` model file in this `ai_model/` directory.

## Run

```bash
python app.py
```

Runs on `http://localhost:5002`

## Endpoints

| Method | Path              | Description                        |
|--------|-------------------|------------------------------------|
| POST   | /predict          | Congestion prediction              |
| POST   | /heatmap          | City traffic heatmap               |
| POST   | /reroute          | Smart rerouting suggestions        |
| POST   | /signal-timing    | Dynamic signal timing              |
| POST   | /emergency-route  | Emergency vehicle priority route   |
| POST   | /alerts           | Real-time traffic alerts           |
| POST   | /chatbot          | AI chatbot for traffic queries     |
| GET    | /stats            | Dashboard statistics               |
| GET    | /health           | Health check                       |

## Note
If `mkc.h5` is not found, the service automatically falls back to a rule-based
prediction engine so the app still works end-to-end.

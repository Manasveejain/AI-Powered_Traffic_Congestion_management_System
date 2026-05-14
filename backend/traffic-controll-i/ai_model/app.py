from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import random
import math
import os
import requests as http_requests
from datetime import datetime

app = Flask(__name__)
# Allow requests from Spring Boot (8080) and Vite dev server (5173)
CORS(app, origins=["http://localhost:8080", "http://localhost:5173", "http://localhost:3000"])

# ─── Load TensorFlow + Model (optional) ──────────────────────────────────────
try:
    import tensorflow as tf
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    print("[WARN] TensorFlow not installed. Using rule-based fallback.")

MODEL_LOADED = False
model = None

if TF_AVAILABLE:
    try:
        model = tf.keras.models.load_model("mkc.h5")
        MODEL_LOADED = True
        print("[INFO] Model loaded successfully.")
    except Exception as e:
        print(f"[WARN] Could not load model: {e}. Using fallback logic.")

# ─── Constants ────────────────────────────────────────────────────────────────
LABELS = ["LOW", "MEDIUM", "HIGH", "SEVERE"]

WEATHER_MAP = {
    0: "Clear",
    1: "Cloudy",
    2: "Rain",
    3: "Fog",
    4: "Snow",
    5: "Storm"
}

# Congestion score thresholds (0-100)
CONGESTION_THRESHOLDS = {
    "LOW":    (0,  25),
    "MEDIUM": (26, 50),
    "HIGH":   (51, 75),
    "SEVERE": (76, 100)
}

# ─── Helper: Fallback prediction ──────────────────────────────────────────────
def fallback_predict(vehicle_count, avg_speed, weather):
    """Rule-based fallback when model is not available."""
    score = 0
    score += min(vehicle_count / 2, 50)          # up to 50 pts from vehicle count
    score += max(0, (80 - avg_speed) / 80 * 30)  # up to 30 pts from low speed
    score += weather * 2                          # up to 10 pts from weather severity
    score = min(score, 100)

    if score <= 25:
        label = "LOW"
    elif score <= 50:
        label = "MEDIUM"
    elif score <= 75:
        label = "HIGH"
    else:
        label = "SEVERE"

    probs = [0.0, 0.0, 0.0, 0.0]
    idx = LABELS.index(label)
    probs[idx] = 0.85
    for i in range(4):
        if i != idx:
            probs[i] = 0.05
    return label, probs, round(score, 1)


def compute_congestion_score(label, probs):
    """Convert label + probabilities to a 0-100 congestion score."""
    weights = [12.5, 37.5, 62.5, 87.5]
    return round(sum(p * w for p, w in zip(probs, weights)), 1)


# ─── /predict ─────────────────────────────────────────────────────────────────
@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    vehicle_count = float(data.get('vehicleCount', 0))
    avg_speed     = float(data.get('avgSpeed', 0))
    weather       = float(data.get('weather', 0))
    location      = data.get('location', 'Unknown')
    timestamp     = data.get('timestamp', datetime.now().isoformat())

    if MODEL_LOADED:
        input_data = np.array([[[vehicle_count, avg_speed, weather]]], dtype=np.float32)
        raw = model.predict(input_data)
        probs = raw[0].tolist()
        predicted_class = int(np.argmax(raw))
        label = LABELS[predicted_class]
        score = compute_congestion_score(label, probs)
    else:
        label, probs, score = fallback_predict(vehicle_count, avg_speed, weather)

    # Derive ETA delay based on congestion
    eta_delay_map = {"LOW": 0, "MEDIUM": 5, "HIGH": 15, "SEVERE": 30}
    eta_delay = eta_delay_map[label]

    # Preventive actions
    actions = get_preventive_actions(label, vehicle_count, avg_speed, weather)

    return jsonify({
        "traffic":           label,
        "congestionScore":   score,
        "prediction":        probs,
        "etaDelayMinutes":   eta_delay,
        "location":          location,
        "timestamp":         timestamp,
        "weatherCondition":  WEATHER_MAP.get(int(weather), "Unknown"),
        "preventiveActions": actions,
        "modelUsed":         "TensorFlow/Keras" if MODEL_LOADED else "Rule-Based Fallback"
    })


# ─── /heatmap ─────────────────────────────────────────────────────────────────
@app.route('/heatmap', methods=['GET', 'POST'])
def heatmap():
    """
    Returns heatmap data for a grid of road segments.
    POST body (optional): { "city": "Mumbai", "gridSize": 5 }
    """
    data = request.get_json(silent=True) or {}
    city = data.get('city', 'SmartCity')
    grid_size = int(data.get('gridSize', 5))

    # Simulate a grid of intersections with congestion levels
    zones = []
    base_lat = data.get('baseLat', 19.0760)
    base_lng = data.get('baseLng', 72.8777)

    for i in range(grid_size):
        for j in range(grid_size):
            vc = random.randint(10, 120)
            spd = random.randint(5, 80)
            wth = random.randint(0, 3)

            if MODEL_LOADED:
                inp = np.array([[[vc, spd, wth]]], dtype=np.float32)
                raw = model.predict(inp)
                probs = raw[0].tolist()
                idx = int(np.argmax(raw))
                label = LABELS[idx]
                score = compute_congestion_score(label, probs)
            else:
                label, probs, score = fallback_predict(vc, spd, wth)

            zones.append({
                "zoneId":          f"Z{i}{j}",
                "lat":             round(base_lat + i * 0.01, 6),
                "lng":             round(base_lng + j * 0.01, 6),
                "congestionLevel": label,
                "congestionScore": score,
                "vehicleCount":    vc,
                "avgSpeed":        spd,
                "isHighRisk":      label in ("HIGH", "SEVERE")
            })

    high_risk_count = sum(1 for z in zones if z["isHighRisk"])

    return jsonify({
        "city":           city,
        "timestamp":      datetime.now().isoformat(),
        "totalZones":     len(zones),
        "highRiskZones":  high_risk_count,
        "zones":          zones
    })


# ─── /reroute ─────────────────────────────────────────────────────────────────
@app.route('/reroute', methods=['POST'])
def reroute():
    """
    Smart rerouting suggestions.
    Body: { "origin": "A", "destination": "B", "currentCongestion": "HIGH" }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    origin      = data.get('origin', 'Origin')
    destination = data.get('destination', 'Destination')
    congestion  = data.get('currentCongestion', 'MEDIUM')

    # Simulate alternative routes
    routes = [
        {
            "routeId":          "R1",
            "name":             "Main Highway",
            "distanceKm":       round(random.uniform(5, 20), 1),
            "estimatedMinutes": random.randint(10, 45),
            "congestionLevel":  congestion,
            "recommended":      False,
            "via":              ["Junction A", "Highway 1", "Junction B"]
        },
        {
            "routeId":          "R2",
            "name":             "Alternate Route via Ring Road",
            "distanceKm":       round(random.uniform(8, 25), 1),
            "estimatedMinutes": random.randint(8, 35),
            "congestionLevel":  "LOW",
            "recommended":      True,
            "via":              ["Ring Road", "Bypass 2", "Junction C"]
        },
        {
            "routeId":          "R3",
            "name":             "City Center Route",
            "distanceKm":       round(random.uniform(6, 18), 1),
            "estimatedMinutes": random.randint(12, 40),
            "congestionLevel":  "MEDIUM",
            "recommended":      False,
            "via":              ["City Center", "Market Road", "Junction D"]
        }
    ]

    # Sort by estimated time
    routes.sort(key=lambda r: r["estimatedMinutes"])
    routes[0]["recommended"] = True
    for r in routes[1:]:
        r["recommended"] = False

    return jsonify({
        "origin":          origin,
        "destination":     destination,
        "currentStatus":   congestion,
        "timestamp":       datetime.now().isoformat(),
        "alternateRoutes": routes,
        "carpoolSuggestion": congestion in ("HIGH", "SEVERE"),
        "parkingDiversion": congestion == "SEVERE"
    })


# ─── /signal-timing ───────────────────────────────────────────────────────────
@app.route('/signal-timing', methods=['POST'])
def signal_timing():
    """
    Dynamic signal timing optimization.
    Body: { "intersectionId": "INT-01", "vehicleCount": 80, "avgSpeed": 20, "weather": 1 }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    intersection_id = data.get('intersectionId', 'INT-01')
    vehicle_count   = float(data.get('vehicleCount', 50))
    avg_speed       = float(data.get('avgSpeed', 40))
    weather         = float(data.get('weather', 0))

    if MODEL_LOADED:
        inp = np.array([[[vehicle_count, avg_speed, weather]]], dtype=np.float32)
        raw = model.predict(inp)
        probs = raw[0].tolist()
        idx = int(np.argmax(raw))
        label = LABELS[idx]
    else:
        label, probs, _ = fallback_predict(vehicle_count, avg_speed, weather)

    # Compute green light duration based on congestion
    base_green = 30
    adjustments = {"LOW": -5, "MEDIUM": 0, "HIGH": 15, "SEVERE": 25}
    green_duration = base_green + adjustments[label]
    red_duration   = max(15, 60 - green_duration)
    yellow_duration = 5

    return jsonify({
        "intersectionId":    intersection_id,
        "congestionLevel":   label,
        "timestamp":         datetime.now().isoformat(),
        "signalTiming": {
            "greenSeconds":  green_duration,
            "yellowSeconds": yellow_duration,
            "redSeconds":    red_duration,
            "cycleSeconds":  green_duration + yellow_duration + red_duration
        },
        "adaptiveMode":      True,
        "recommendation":    f"Extended green phase by {adjustments[label]}s due to {label} congestion" if adjustments[label] > 0 else "Normal signal timing"
    })


# ─── /emergency-route ─────────────────────────────────────────────────────────
@app.route('/emergency-route', methods=['POST'])
def emergency_route():
    """
    Emergency vehicle priority routing.
    Body: { "vehicleType": "AMBULANCE", "origin": "Hospital A", "destination": "Accident Site" }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    vehicle_type = data.get('vehicleType', 'AMBULANCE')
    origin       = data.get('origin', 'Base Station')
    destination  = data.get('destination', 'Incident Site')

    # Priority levels
    priority_map = {
        "AMBULANCE":   "CRITICAL",
        "FIRE_TRUCK":  "CRITICAL",
        "POLICE":      "HIGH",
        "RESCUE":      "HIGH"
    }
    priority = priority_map.get(vehicle_type.upper(), "HIGH")

    # Simulate cleared corridor
    cleared_signals = [f"Signal-{i}" for i in range(1, random.randint(4, 8))]

    return jsonify({
        "vehicleType":       vehicle_type,
        "priority":          priority,
        "origin":            origin,
        "destination":       destination,
        "timestamp":         datetime.now().isoformat(),
        "estimatedMinutes":  random.randint(3, 12),
        "clearedSignals":    cleared_signals,
        "corridorActive":    True,
        "route": {
            "name":          "Emergency Priority Corridor",
            "distanceKm":    round(random.uniform(2, 10), 1),
            "via":           ["Emergency Lane 1", "Priority Junction", "Fast Track Road"]
        },
        "broadcastMessage":  f"{vehicle_type} en route — please clear the road"
    })


# ─── /alerts ──────────────────────────────────────────────────────────────────
@app.route('/alerts', methods=['GET', 'POST'])
def alerts():
    """
    Real-time traffic alerts.
    Optional POST body: { "city": "Mumbai", "severity": "HIGH" }
    """
    data = request.get_json(silent=True) or {}
    city     = data.get('city', 'SmartCity')
    severity = data.get('severity', None)

    alert_templates = [
        {"type": "ACCIDENT",      "severity": "HIGH",   "message": "Multi-vehicle accident on Highway 1 near Junction 4. Expect 20-min delay."},
        {"type": "ROADWORK",      "severity": "MEDIUM", "message": "Road maintenance on Ring Road. Lane 2 closed until 6 PM."},
        {"type": "CONGESTION",    "severity": "SEVERE", "message": "Severe congestion near City Center. Avoid if possible."},
        {"type": "WEATHER",       "severity": "HIGH",   "message": "Heavy rain causing reduced visibility on Expressway. Drive slow."},
        {"type": "EVENT",         "severity": "MEDIUM", "message": "Public event at Central Park causing high footfall near Main Street."},
        {"type": "SIGNAL_FAULT",  "severity": "HIGH",   "message": "Traffic signal malfunction at Junction 7. Manual control in effect."},
        {"type": "FLOOD",         "severity": "SEVERE", "message": "Waterlogging reported on Coastal Road. Route blocked."},
    ]

    # Filter by severity if requested
    active_alerts = alert_templates if not severity else [
        a for a in alert_templates if a["severity"] == severity.upper()
    ]

    # Add metadata
    for i, alert in enumerate(active_alerts):
        alert["alertId"]    = f"ALT-{1000 + i}"
        alert["city"]       = city
        alert["timestamp"]  = datetime.now().isoformat()
        alert["active"]     = True
        alert["location"]   = f"Zone-{random.randint(1, 10)}"

    return jsonify({
        "city":         city,
        "timestamp":    datetime.now().isoformat(),
        "totalAlerts":  len(active_alerts),
        "alerts":       active_alerts
    })


# ─── /chatbot ─────────────────────────────────────────────────────────────────

OSRM_BASE   = "http://router.project-osrm.org/route/v1/driving"
NOMINATIM   = "https://nominatim.openstreetmap.org/search"
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL   = "llama3-8b-8192"

# ── Session memory ─────────────────────────────────────────────────────────────
_sessions = {}   # session_id → list of {role, content}

# ── 1. Geocode any place name → (lat, lon) ────────────────────────────────────
def geocode(place):
    """Convert place name to lat/lon using Nominatim (free OSM geocoder)."""
    try:
        r = http_requests.get(NOMINATIM, params={
            "q": place + ", India",
            "format": "json",
            "limit": 1,
        }, headers={"User-Agent": "SmartTrafficAI/1.0"}, timeout=5)
        data = r.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"]), data[0]["display_name"].split(",")[0]
    except Exception as e:
        print(f"[Geocode] {e}")
    return None, None, None

# ── 2. Get real route from OSRM ───────────────────────────────────────────────
def get_osrm_route(lat1, lon1, lat2, lon2, via_lat=None, via_lon=None):
    """Fetch real road route from OSRM. Returns distance_km, duration_min, geometry."""
    try:
        if via_lat:
            coords = f"{lon1},{lat1};{via_lon},{via_lat};{lon2},{lat2}"
        else:
            coords = f"{lon1},{lat1};{lon2},{lat2}"
        url = f"{OSRM_BASE}/{coords}?overview=false&alternatives=false"
        r = http_requests.get(url, timeout=8)
        data = r.json()
        if data.get("code") == "Ok" and data.get("routes"):
            route = data["routes"][0]
            return {
                "distance_km": round(route["distance"] / 1000, 1),
                "duration_min": round(route["duration"] / 60),
                "ok": True
            }
    except Exception as e:
        print(f"[OSRM] {e}")
    return {"ok": False}

# ── 3. Congestion level from OSRM time vs free-flow ───────────────────────────
def congestion_level(distance_km, duration_min):
    """Simulate congestion: compare actual OSRM time vs free-flow at 50 km/h."""
    free_flow_min = (distance_km / 50) * 60
    if free_flow_min == 0:
        return "UNKNOWN", 1.0
    ratio = duration_min / free_flow_min
    if ratio < 1.2:
        return "LOW",    ratio
    elif ratio < 1.5:
        return "MEDIUM", ratio
    elif ratio < 2.0:
        return "HIGH",   ratio
    else:
        return "SEVERE", ratio

CONGESTION_EMOJI = {"LOW": "🟢", "MEDIUM": "🟡", "HIGH": "🔴", "SEVERE": "🚨", "UNKNOWN": "⚪"}

# ── 4. ML model prediction ────────────────────────────────────────────────────
def ml_predict(vehicle_count, avg_speed, weather_code):
    """Use the Keras model (or fallback) to predict congestion."""
    try:
        if MODEL_LOADED:
            inp = np.array([[[vehicle_count, avg_speed, weather_code]]], dtype=np.float32)
            raw = model.predict(inp, verbose=0)
            idx = int(np.argmax(raw))
            return LABELS[idx], round(float(np.max(raw)) * 100)
    except Exception:
        pass
    # Rule-based fallback
    score = min(vehicle_count / 2, 50) + max(0, (80 - avg_speed) / 80 * 30) + weather_code * 2
    label = "SEVERE" if score > 75 else "HIGH" if score > 50 else "MEDIUM" if score > 25 else "LOW"
    return label, round(score)

# ── 5. Extract origin/destination from message ────────────────────────────────
def extract_places(msg):
    import re
    msg = msg.strip()
    # Remove noise prefixes: 'best route', 'shortest route', 'route', 'directions', etc.
    cleaned = re.sub(
        r'^(best\s+route|shortest\s+route|fastest\s+route|route|directions?|navigate|how\s+to\s+(go|reach|get))\s*',
        '', msg, flags=re.IGNORECASE
    ).strip()
    # Pattern: "from X to Y"
    m = re.search(r'from\s+(.+?)\s+to\s+(.+?)(?:\s*[\?\.]|$)', cleaned, re.IGNORECASE)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    # Pattern: "X to Y"
    m = re.search(r'^(.+?)\s+to\s+(.+?)(?:\s*[\?\.]|$)', cleaned, re.IGNORECASE)
    if m:
        o, d = m.group(1).strip(), m.group(2).strip()
        noise = {"best", "shortest", "fastest", "route", "way", "path", "how", "what"}
        if o.lower() not in noise and len(o) > 2:
            return o, d
    # Pattern: "between X and Y"
    m = re.search(r'between\s+(.+?)\s+and\s+(.+?)(?:\s*[\?\.]|$)', cleaned, re.IGNORECASE)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return None, None

# ── 6. Build route answer ─────────────────────────────────────────────────────
def build_route_answer(origin_str, dest_str):
    """
    Full pipeline: geocode → OSRM → congestion → ML → format answer.
    Returns a rich text answer.
    """
    # Geocode both places
    lat1, lon1, name1 = geocode(origin_str)
    lat2, lon2, name2 = geocode(dest_str)

    if not lat1 or not lat2:
        missing = origin_str if not lat1 else dest_str
        return f"❌ Could not find **{missing}** on the map. Please check the spelling or try a more specific name (e.g. 'Bhopal, MP')."

    # Get 3 routes: direct + 2 via intermediate cities
    VIA_CITIES = [
        ("Nagpur",    21.1458, 79.0882),
        ("Indore",    22.7196, 75.8577),
        ("Bhopal",    23.2599, 77.4126),
        ("Ahmedabad", 23.0225, 72.5714),
        ("Pune",      18.5204, 73.8567),
        ("Hyderabad", 17.3850, 78.4867),
        ("Jaipur",    26.9124, 75.7873),
        ("Lucknow",   26.8467, 80.9462),
        ("Surat",     21.1702, 72.8311),
        ("Agra",      27.1751, 78.0421),
    ]

    # Filter via cities that are geographically between origin and destination
    min_lat = min(lat1, lat2) - 2
    max_lat = max(lat1, lat2) + 2
    min_lon = min(lon1, lon2) - 2
    max_lon = max(lon1, lon2) + 2
    candidates = [
        v for v in VIA_CITIES
        if min_lat <= v[1] <= max_lat and min_lon <= v[2] <= max_lon
        and not (abs(v[1]-lat1)<0.5 and abs(v[2]-lon1)<0.5)
        and not (abs(v[1]-lat2)<0.5 and abs(v[2]-lon2)<0.5)
    ][:3]

    routes = []

    # Direct route
    r = get_osrm_route(lat1, lon1, lat2, lon2)
    if r["ok"]:
        level, ratio = congestion_level(r["distance_km"], r["duration_min"])
        ml_label, ml_conf = ml_predict(70, 35, 0)
        toll = round(r["distance_km"] * 2.5 / 10) * 10
        routes.append({
            "name": "Direct Route",
            "distance_km": r["distance_km"],
            "duration_min": r["duration_min"],
            "level": level,
            "ratio": round(ratio, 2),
            "ml_label": ml_label,
            "toll": toll,
        })

    # Via routes
    for via_name, via_lat, via_lon in candidates:
        r = get_osrm_route(lat1, lon1, lat2, lon2, via_lat, via_lon)
        if r["ok"]:
            level, ratio = congestion_level(r["distance_km"], r["duration_min"])
            ml_label, ml_conf = ml_predict(60, 40, 0)
            toll = round(r["distance_km"] * 2.5 / 10) * 10
            routes.append({
                "name": f"Via {via_name}",
                "distance_km": r["distance_km"],
                "duration_min": r["duration_min"],
                "level": level,
                "ratio": round(ratio, 2),
                "ml_label": ml_label,
                "toll": toll,
            })

    if not routes:
        return f"❌ Could not calculate route between **{name1}** and **{name2}**. OSRM may not have road data for this area."

    # Sort by congestion ratio (least traffic first)
    routes.sort(key=lambda x: x["ratio"])

    best = routes[0]
    emoji = CONGESTION_EMOJI.get(best["level"], "⚪")

    # Format answer
    lines = [
        f"🗺️ **{name1} → {name2}**\n",
        f"Found **{len(routes)} route(s)** — ranked by least traffic:\n",
    ]

    rank_labels = ["🥇 BEST", "🥈 2ND", "🥉 3RD", "4️⃣ 4TH", "5️⃣ 5TH"]
    for i, route in enumerate(routes[:5]):
        e = CONGESTION_EMOJI.get(route["level"], "⚪")
        toll_str = "FREE" if route["toll"] == 0 else f"Rs.{route['toll']}"
        lines.append(
            f"{rank_labels[i]}: **{route['name']}**\n"
            f"   📏 {route['distance_km']} km  ⏱ {route['duration_min']} min  "
            f"{e} {route['level']} ({route['ratio']}x)  💳 {toll_str}"
        )

    lines.append(f"\n🤖 **AI Recommendation:** Take the **{best['name']}**")
    lines.append(f"   {emoji} {best['level']} congestion · {best['distance_km']} km · {best['duration_min']} min")

    # Fuel estimate
    petrol = round(best["distance_km"] / 15 * 103)
    diesel = round(best["distance_km"] / 18 * 90)
    lines.append(f"\n⛽ Fuel estimate: Petrol ~Rs.{petrol}  |  Diesel ~Rs.{diesel}")

    # Time advice
    hour = datetime.now().hour
    if 8 <= hour <= 10 or 17 <= hour <= 20:
        lines.append("⚠️ Currently peak hours — expect +20-30% extra time.")
    else:
        lines.append("✅ Off-peak hours — good time to travel.")

    return "\n".join(lines)

# ── 7. Traffic status for any city ───────────────────────────────────────────
def build_city_traffic(city_str):
    """Get traffic status for any city using geocoding + time-based simulation."""
    lat, lon, name = geocode(city_str)
    if not lat:
        return f"❌ Could not find **{city_str}**. Try a more specific name."

    hour = datetime.now().hour
    is_peak = (8 <= hour <= 10) or (17 <= hour <= 20)
    is_night = hour < 6 or hour > 22

    # Simulate vehicle count based on time
    if is_night:
        vc, spd, wth = 15, 65, 0
    elif is_peak:
        vc, spd, wth = 95, 18, 0
    else:
        vc, spd, wth = 50, 38, 0

    ml_label, ml_conf = ml_predict(vc, spd, wth)
    emoji = CONGESTION_EMOJI.get(ml_label, "⚪")
    time_str = "peak hours" if is_peak else ("night" if is_night else "off-peak")

    return (
        f"{emoji} **Traffic in {name}**\n\n"
        f"• Status: **{ml_label}** ({time_str})\n"
        f"• AI confidence: {ml_conf}%\n"
        f"• Est. avg speed: ~{spd} km/h\n"
        f"• Vehicle density: {'High' if vc > 70 else 'Medium' if vc > 30 else 'Low'}\n\n"
        f"{'⚠️ Peak hours active — expect delays on main roads.' if is_peak else '✅ Roads are relatively clear right now.'}\n"
        f"🤖 Predicted by: {'TensorFlow/Keras' if MODEL_LOADED else 'Rule-Based AI'}"
    )

# ── 8. Groq LLM call ──────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are an expert AI Traffic Assistant for India.
You help users with:
- Route planning between any two places in India
- Traffic conditions in any city
- Highway information (NH-48, NH-44, NH-8, etc.)
- Weather impact on roads
- Peak hours, signal timings, fuel costs
- Emergency routing

When a user asks about a route, extract the origin and destination and provide:
1. Distance and estimated travel time
2. Congestion level (LOW/MEDIUM/HIGH/SEVERE)
3. Toll cost estimate
4. Best route recommendation

Be specific with numbers. Use bullet points. Keep answers concise but complete.
Always mention if it's peak hours or off-peak based on current time."""

def call_groq(history, user_msg):
    if not GROQ_API_KEY:
        return None
    try:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages.extend(history[-10:])
        messages.append({"role": "user", "content": user_msg})
        r = http_requests.post(GROQ_URL,
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={"model": GROQ_MODEL, "messages": messages, "max_tokens": 500, "temperature": 0.7},
            timeout=12)
        if r.status_code == 200:
            return r.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"[Groq] {e}")
    return None

# ── 9. Main intent router ─────────────────────────────────────────────────────
def route_intent(msg, session_history):
    """
    Detect intent and route to the right handler.
    Priority: route query > city traffic > groq LLM > rule-based
    """
    lower = msg.lower()

    # ── Route intent ──────────────────────────────────────────────────────────
    route_keywords = ["route", "way", "path", "how to go", "how to reach",
                      "directions", "navigate", "travel from", "go from",
                      "distance", "how far", "best route", "shortest",
                      "how long", "how much time", "reach", "get to"]
    has_to   = " to " in lower or " se " in lower
    has_from = "from " in lower
    is_route = (has_to or has_from) and any(w in lower for w in route_keywords + ["from"])

    # Also catch "how far is X from Y" pattern
    import re as _re
    how_far = _re.search(r'how far.+?(?:from|between|to)', lower)
    if how_far:
        is_route = True
        # Rewrite to standard form for extraction
        m = _re.search(r'how far (?:is )?(.+?) from (.+?)(?:\?|$)', lower)
        if m:
            msg = f"from {m.group(2).strip()} to {m.group(1).strip()}"
            lower = msg

    if is_route or (has_to and any(c.isupper() for c in msg)):
        origin_str, dest_str = extract_places(msg)
        if origin_str and dest_str:
            return build_route_answer(origin_str, dest_str), "OSRM+ML"

    # ── City traffic intent ───────────────────────────────────────────────────
    traffic_keywords = ["traffic", "congestion", "jam", "road condition",
                        "how is", "status", "busy", "rush"]
    if any(w in lower for w in traffic_keywords):
        # Try to extract city name — remove traffic keywords and common words
        stop_words = {"traffic", "in", "at", "the", "how", "is", "are",
                      "congestion", "jam", "road", "condition", "status",
                      "current", "now", "today", "right", "like"}
        words = [w for w in lower.split() if w not in stop_words and len(w) > 2]
        if words:
            city_guess = " ".join(words[:3])
            return build_city_traffic(city_guess), "OSRM+ML"

    # ── Try Groq LLM for everything else ─────────────────────────────────────
    groq_reply = call_groq(session_history, msg)
    if groq_reply:
        return groq_reply, "Groq/Llama3"

    # ── Rule-based fallback ───────────────────────────────────────────────────
    return rule_based_fallback(lower), "Rule-Based"


def rule_based_fallback(msg):
    if any(w in msg for w in ["hello", "hi", "hey", "namaste"]):
        return ("👋 Hi! I'm your AI Traffic Assistant.\n\n"
                "Ask me anything like:\n"
                "• \"Best route from Delhi to Mumbai\"\n"
                "• \"Traffic in Bengaluru right now\"\n"
                "• \"How far is Jaipur from Agra?\"\n"
                "• \"NH-48 highway status\"\n"
                "• \"Rain impact on roads\"\n\n"
                "I use real OpenStreetMap data + AI to answer!")

    if any(w in msg for w in ["rain", "fog", "weather", "storm", "monsoon"]):
        return ("🌧️ **Weather Impact on Traffic:**\n\n"
                "• Rain: Speed drops 30-40%, expect +15-25 min delay\n"
                "• Fog: Speed drops 50-60%, expect +30-45 min delay\n"
                "• Storm: Avoid travel if possible\n\n"
                "Tips: Use headlights, maintain 3-car gap, avoid underpasses during monsoon.")

    if any(w in msg for w in ["signal", "timing", "light"]):
        return ("⚡ **Smart Signal Timings (Adaptive AI):**\n\n"
                "• HIGH congestion: Green 45-55s, Red 15-25s\n"
                "• MEDIUM: Green 35-45s, Red 25-35s\n"
                "• LOW: Green 25-35s, Red 35-45s\n\n"
                "Signals adapt every 5 min based on live vehicle count.")

    if any(w in msg for w in ["peak", "rush", "best time", "when to travel"]):
        hour = datetime.now().hour
        now = "🔴 Currently PEAK hours" if (8<=hour<=10 or 17<=hour<=20) else "🟢 Currently OFF-PEAK"
        return (f"🕐 **Peak Hours Guide:**\n\n{now}\n\n"
                "• Delhi: 8-10am, 5-8pm\n"
                "• Mumbai: 8-11am, 6-9pm\n"
                "• Bengaluru: 8-10am, 5-9pm (worst in India)\n"
                "• Hyderabad: 9-11am, 6-8pm\n\n"
                "Best travel window: 10am-4pm or after 9pm.")

    if any(w in msg for w in ["fuel", "petrol", "diesel", "cost"]):
        return ("⛽ **Fuel Cost Guide:**\n\n"
                "• Petrol: ~Rs.103/litre\n"
                "• Diesel: ~Rs.90/litre\n"
                "• Highway mileage: 15-18 km/l\n\n"
                "Ask me a specific route for exact fuel cost estimate!")

    if any(w in msg for w in ["emergency", "ambulance", "fire"]):
        return ("🚨 **Emergency Routing:**\n\n"
                "• Green wave corridor: activated on request\n"
                "• All signals cleared ahead of emergency vehicle\n"
                "• Estimated corridor: 6-8 junctions\n\n"
                "Go to the Emergency page to activate a priority corridor.")

    return ("🤖 I can help with:\n"
            "• **Routes**: \"Best route from Pune to Hyderabad\"\n"
            "• **Traffic**: \"Traffic in Chennai now\"\n"
            "• **Distance**: \"How far is Agra from Delhi?\"\n"
            "• **Weather**: \"Rain impact on roads\"\n"
            "• **Fuel**: \"Fuel cost Delhi to Mumbai\"\n\n"
            "Just ask naturally — I understand any Indian city or highway!")


@app.route('/chatbot', methods=['POST'])
def chatbot():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    user_message = data.get('message', '').strip()
    session_id   = data.get('sessionId', 'default')

    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    # Get session history
    history = _sessions.get(session_id, [])

    # Route to correct handler
    response, powered_by = route_intent(user_message, history)

    # Update session memory
    history.append({"role": "user",      "content": user_message})
    history.append({"role": "assistant", "content": response})
    _sessions[session_id] = history[-20:]

    return jsonify({
        "userMessage": user_message,
        "botResponse": response,
        "timestamp":   datetime.now().isoformat(),
        "sessionId":   session_id,
        "powered_by":  powered_by,
    })

# ─── /stats ───────────────────────────────────────────────────────────────────
@app.route('/stats', methods=['GET'])
def stats():
    """Dashboard summary statistics."""
    return jsonify({
        "timestamp":           datetime.now().isoformat(),
        "totalVehiclesMonitored": random.randint(5000, 15000),
        "activeAlerts":        random.randint(2, 8),
        "highRiskZones":       random.randint(1, 5),
        "avgCitySpeed":        random.randint(25, 55),
        "congestionIndex":     round(random.uniform(30, 80), 1),
        "signalsOptimized":    random.randint(10, 50),
        "emergencyRoutesActive": random.randint(0, 3),
        "co2ReductionPercent": round(random.uniform(5, 20), 1),
        "predictedPeakHour":   "17:30 - 19:00",
        "modelStatus":         "ACTIVE" if MODEL_LOADED else "FALLBACK"
    })


# ─── /health ──────────────────────────────────────────────────────────────────
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status":      "UP",
        "modelLoaded": MODEL_LOADED,
        "timestamp":   datetime.now().isoformat(),
        "version":     "2.0.0",
        "endpoints": [
            "/predict", "/heatmap", "/reroute",
            "/signal-timing", "/emergency-route",
            "/alerts", "/chatbot", "/stats", "/health"
        ]
    })


# ─── Preventive Actions Helper ────────────────────────────────────────────────
def get_preventive_actions(label, vehicle_count, avg_speed, weather):
    actions = []
    if label in ("HIGH", "SEVERE"):
        actions.append("Activate alternate route guidance on VMS boards")
        actions.append("Extend green signal phase at upstream intersections")
    if label == "SEVERE":
        actions.append("Deploy traffic personnel at critical junctions")
        actions.append("Issue public advisory via mobile alerts")
        actions.append("Activate carpool lane")
    if weather >= 3:
        actions.append("Reduce speed limits due to adverse weather")
        actions.append("Activate fog lights and warning signs")
    if vehicle_count > 80:
        actions.append("Suggest smart parking diversion to reduce entry vehicles")
    if avg_speed < 20:
        actions.append("Coordinate with public transport for increased frequency")
    if not actions:
        actions.append("No immediate action required — monitor continuously")
    return actions


# ─── Run ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=True)

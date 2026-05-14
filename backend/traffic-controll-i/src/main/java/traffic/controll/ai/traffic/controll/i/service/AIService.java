package traffic.controll.ai.traffic.controll.i.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import traffic.controll.ai.traffic.controll.i.entity.*;
import traffic.controll.ai.traffic.controll.i.model.*;
import traffic.controll.ai.traffic.controll.i.repository.*;

import java.util.List;
import java.util.Map;

/**
 * AIService — calls Flask AI microservice and persists every result to MySQL.
 */
@Service
public class AIService {

    @Autowired private RestTemplate restTemplate;

    @Value("${ai.flask.base-url:http://localhost:5002}")
    private String flaskBaseUrl;

    // ── Repositories ──────────────────────────────────────────────────────────
    @Autowired private PredictionLogRepository predictionRepo;
    @Autowired private AlertLogRepository      alertRepo;
    @Autowired private EmergencyLogRepository  emergencyRepo;
    @Autowired private ChatLogRepository       chatRepo;

    // ── 1. Predict — saves to prediction_log ─────────────────────────────────
    public Map<?, ?> predictTraffic(TrafficRequest request) {
        Map<?, ?> result = post("/predict", request);
        try {
            PredictionLog log = new PredictionLog();
            log.setVehicleCount(request.getVehicleCount());
            log.setAvgSpeed(request.getAvgSpeed());
            log.setWeather(request.getWeather());
            log.setLocation(request.getLocation() != null ? request.getLocation() : "Unknown");
            log.setTrafficLevel(str(result, "traffic"));
            log.setCongestionScore(dbl(result, "congestionScore"));
            log.setEtaDelayMinutes(intVal(result, "etaDelayMinutes"));
            log.setWeatherCondition(str(result, "weatherCondition"));
            log.setModelUsed(str(result, "modelUsed"));
            Object actions = result.get("preventiveActions");
            if (actions instanceof List<?> list) {
                log.setPreventiveActions(String.join(", ", list.stream().map(Object::toString).toList()));
            }
            predictionRepo.save(log);
        } catch (Exception e) {
            System.err.println("[DB] Failed to save prediction: " + e.getMessage());
        }
        return result;
    }

    // ── 2. Heatmap ────────────────────────────────────────────────────────────
    public Map<?, ?> getHeatmap(HeatmapRequest request) {
        return post("/heatmap", request);
    }

    // ── 3. Reroute ────────────────────────────────────────────────────────────
    public Map<?, ?> getReroute(RouteRequest request) {
        return post("/reroute", request);
    }

    // ── 4. Signal Timing ──────────────────────────────────────────────────────
    public Map<?, ?> getSignalTiming(SignalRequest request) {
        return post("/signal-timing", request);
    }

    // ── 5. Emergency Route — saves to emergency_log ───────────────────────────
    public Map<?, ?> getEmergencyRoute(EmergencyRequest request) {
        Map<?, ?> result = post("/emergency-route", request);
        try {
            EmergencyLog log = new EmergencyLog();
            log.setVehicleType(request.getVehicleType());
            log.setOrigin(request.getOrigin());
            log.setDestination(request.getDestination());
            log.setPriority(str(result, "priority"));
            log.setEstimatedMinutes(intVal(result, "estimatedMinutes"));
            log.setCorridorActive(bool(result, "corridorActive"));
            log.setBroadcastMessage(str(result, "broadcastMessage"));
            emergencyRepo.save(log);
        } catch (Exception e) {
            System.err.println("[DB] Failed to save emergency log: " + e.getMessage());
        }
        return result;
    }

    // ── 6. Alerts — saves each alert to alert_log ─────────────────────────────
    public Map<?, ?> getAlerts(Map<String, String> params) {
        Map<?, ?> result = post("/alerts", params);
        try {
            Object alertsObj = result.get("alerts");
            if (alertsObj instanceof List<?> alerts) {
                for (Object item : alerts) {
                    if (item instanceof Map<?, ?> a) {
                        AlertLog log = new AlertLog();
                        log.setAlertId(str(a, "alertId"));
                        log.setCity(str(a, "city"));
                        log.setType(str(a, "type"));
                        log.setSeverity(str(a, "severity"));
                        log.setMessage(str(a, "message"));
                        log.setLocation(str(a, "location"));
                        log.setActive(bool(a, "active"));
                        alertRepo.save(log);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("[DB] Failed to save alerts: " + e.getMessage());
        }
        return result;
    }

    // ── 7. Chatbot — saves to chat_log ────────────────────────────────────────
    public Map<?, ?> chat(ChatRequest request) {
        Map<?, ?> result = post("/chatbot", request);
        try {
            ChatLog log = new ChatLog();
            log.setSessionId(request.getSessionId() != null ? request.getSessionId() : "default");
            log.setUserMessage(request.getMessage());
            log.setBotResponse(str(result, "botResponse"));
            chatRepo.save(log);
        } catch (Exception e) {
            System.err.println("[DB] Failed to save chat log: " + e.getMessage());
        }
        return result;
    }

    // ── 8. Stats ──────────────────────────────────────────────────────────────
    public Map<?, ?> getStats() {
        try {
            ResponseEntity<Map> response =
                    restTemplate.getForEntity(flaskBaseUrl + "/stats", Map.class);
            return response.getBody();
        } catch (RestClientException e) {
            return Map.of("error", "AI service unavailable: " + e.getMessage());
        }
    }

    // ── 9. Health ─────────────────────────────────────────────────────────────
    public Map<?, ?> getHealth() {
        try {
            ResponseEntity<Map> response =
                    restTemplate.getForEntity(flaskBaseUrl + "/health", Map.class);
            return response.getBody();
        } catch (RestClientException e) {
            return Map.of("status", "DOWN", "error", e.getMessage());
        }
    }

    // ── DB History endpoints ──────────────────────────────────────────────────
    public List<PredictionLog> getPredictionHistory()  { return predictionRepo.findTop10ByOrderByCreatedAtDesc(); }
    public List<AlertLog>      getAlertHistory()       { return alertRepo.findTop10ByOrderByCreatedAtDesc(); }
    public List<EmergencyLog>  getEmergencyHistory()   { return emergencyRepo.findTop10ByOrderByCreatedAtDesc(); }
    public List<ChatLog>       getChatHistory()        { return chatRepo.findTop20ByOrderByCreatedAtDesc(); }

    // ── Internal helpers ──────────────────────────────────────────────────────
    private Map<?, ?> post(String path, Object body) {
        try {
            ResponseEntity<Map> response =
                    restTemplate.postForEntity(flaskBaseUrl + path, body, Map.class);
            return response.getBody();
        } catch (RestClientException e) {
            return Map.of("error", "AI service unavailable: " + e.getMessage());
        }
    }

    private String str(Map<?, ?> m, String key) {
        Object v = m.get(key);
        return v != null ? v.toString() : "";
    }

    private double dbl(Map<?, ?> m, String key) {
        Object v = m.get(key);
        if (v instanceof Number n) return n.doubleValue();
        return 0.0;
    }

    private int intVal(Map<?, ?> m, String key) {
        Object v = m.get(key);
        if (v instanceof Number n) return n.intValue();
        return 0;
    }

    private boolean bool(Map<?, ?> m, String key) {
        Object v = m.get(key);
        if (v instanceof Boolean b) return b;
        return false;
    }
}

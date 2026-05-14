package traffic.controll.ai.traffic.controll.i.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import traffic.controll.ai.traffic.controll.i.model.*;
import traffic.controll.ai.traffic.controll.i.service.AIService;

import java.util.Map;

/**
 * TrafficController — exposes all Smart Traffic Congestion Predictor endpoints.
 *
 * Base path: /api/traffic
 *
 * POST /api/traffic/predict          — congestion prediction
 * POST /api/traffic/heatmap          — city heatmap data
 * POST /api/traffic/reroute          — smart rerouting suggestions
 * POST /api/traffic/signal-timing    — dynamic signal timing
 * POST /api/traffic/emergency-route  — emergency vehicle priority
 * POST /api/traffic/alerts           — real-time alerts (filter by severity)
 * GET  /api/traffic/alerts           — all active alerts
 * POST /api/traffic/chatbot          — AI chatbot
 * GET  /api/traffic/stats            — dashboard statistics
 * GET  /api/traffic/health           — AI service health
 */
@RestController
@RequestMapping("/api/traffic")
@CrossOrigin(origins = "*")
public class TrafficController {

    @Autowired
    private AIService aiService;

    // ── 1. Congestion Prediction ──────────────────────────────────────────────
    @PostMapping("/predict")
    public ResponseEntity<?> predict(@RequestBody TrafficRequest request) {
        Map<?, ?> result = aiService.predictTraffic(request);
        return ResponseEntity.ok(result);
    }

    // ── 2. Traffic Heatmap ────────────────────────────────────────────────────
    @PostMapping("/heatmap")
    public ResponseEntity<?> heatmap(@RequestBody(required = false) HeatmapRequest request) {
        if (request == null) request = new HeatmapRequest();
        Map<?, ?> result = aiService.getHeatmap(request);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/heatmap")
    public ResponseEntity<?> heatmapGet() {
        Map<?, ?> result = aiService.getHeatmap(new HeatmapRequest());
        return ResponseEntity.ok(result);
    }

    // ── 3. Smart Rerouting ────────────────────────────────────────────────────
    @PostMapping("/reroute")
    public ResponseEntity<?> reroute(@RequestBody RouteRequest request) {
        Map<?, ?> result = aiService.getReroute(request);
        return ResponseEntity.ok(result);
    }

    // ── 4. Signal Timing Optimisation ────────────────────────────────────────
    @PostMapping("/signal-timing")
    public ResponseEntity<?> signalTiming(@RequestBody SignalRequest request) {
        Map<?, ?> result = aiService.getSignalTiming(request);
        return ResponseEntity.ok(result);
    }

    // ── 5. Emergency Vehicle Priority Route ───────────────────────────────────
    @PostMapping("/emergency-route")
    public ResponseEntity<?> emergencyRoute(@RequestBody EmergencyRequest request) {
        Map<?, ?> result = aiService.getEmergencyRoute(request);
        return ResponseEntity.ok(result);
    }

    // ── 6. Real-time Alerts (POST with optional filter) ───────────────────────
    @PostMapping("/alerts")
    public ResponseEntity<?> alertsPost(@RequestBody(required = false) Map<String, String> params) {
        if (params == null) params = Map.of();
        Map<?, ?> result = aiService.getAlerts(params);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/alerts")
    public ResponseEntity<?> alertsGet(
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String severity) {
        Map<String, String> params = new java.util.HashMap<>();
        if (city != null)     params.put("city", city);
        if (severity != null) params.put("severity", severity);
        Map<?, ?> result = aiService.getAlerts(params);
        return ResponseEntity.ok(result);
    }

    // ── 7. AI Chatbot ─────────────────────────────────────────────────────────
    @PostMapping("/chatbot")
    public ResponseEntity<?> chatbot(@RequestBody ChatRequest request) {
        Map<?, ?> result = aiService.chat(request);
        return ResponseEntity.ok(result);
    }

    // ── 8. Dashboard Statistics ───────────────────────────────────────────────
    @GetMapping("/stats")
    public ResponseEntity<?> stats() {
        Map<?, ?> result = aiService.getStats();
        return ResponseEntity.ok(result);
    }

    // ── 9. AI Service Health ──────────────────────────────────────────────────
    @GetMapping("/health")
    public ResponseEntity<?> health() {
        Map<?, ?> result = aiService.getHealth();
        return ResponseEntity.ok(result);
    }

    // ── 10. DB History — last 10 predictions ─────────────────────────────────
    @GetMapping("/history/predictions")
    public ResponseEntity<?> predictionHistory() {
        return ResponseEntity.ok(aiService.getPredictionHistory());
    }

    // ── 11. DB History — last 10 alerts ──────────────────────────────────────
    @GetMapping("/history/alerts")
    public ResponseEntity<?> alertHistory() {
        return ResponseEntity.ok(aiService.getAlertHistory());
    }

    // ── 12. DB History — last 10 emergency activations ───────────────────────
    @GetMapping("/history/emergency")
    public ResponseEntity<?> emergencyHistory() {
        return ResponseEntity.ok(aiService.getEmergencyHistory());
    }

    // ── 13. DB History — last 20 chat messages ───────────────────────────────
    @GetMapping("/history/chat")
    public ResponseEntity<?> chatHistory() {
        return ResponseEntity.ok(aiService.getChatHistory());
    }
}

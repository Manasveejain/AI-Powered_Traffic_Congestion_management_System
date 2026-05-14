package traffic.controll.ai.traffic.controll.i.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * Stores every congestion prediction made via /api/traffic/predict
 */
@Entity
@Table(name = "prediction_log")
@Data
public class PredictionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private double vehicleCount;
    private double avgSpeed;
    private double weather;
    private String location;

    private String trafficLevel;       // LOW / MEDIUM / HIGH / SEVERE
    private double congestionScore;
    private int etaDelayMinutes;
    private String weatherCondition;
    private String modelUsed;

    @Column(length = 1000)
    private String preventiveActions;  // comma-separated

    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}

package traffic.controll.ai.traffic.controll.i.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * Stores every alert fetched via /api/traffic/alerts
 */
@Entity
@Table(name = "alert_log")
@Data
public class AlertLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String alertId;
    private String city;
    private String type;
    private String severity;

    @Column(length = 500)
    private String message;

    private String location;
    private boolean active;

    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}

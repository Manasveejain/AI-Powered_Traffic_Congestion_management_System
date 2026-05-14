package traffic.controll.ai.traffic.controll.i.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * Stores every emergency route activation via /api/traffic/emergency-route
 */
@Entity
@Table(name = "emergency_log")
@Data
public class EmergencyLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String vehicleType;
    private String priority;
    private String origin;
    private String destination;
    private int estimatedMinutes;
    private boolean corridorActive;

    @Column(length = 500)
    private String broadcastMessage;

    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}

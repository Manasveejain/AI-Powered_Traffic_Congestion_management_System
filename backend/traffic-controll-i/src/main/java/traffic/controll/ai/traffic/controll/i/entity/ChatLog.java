package traffic.controll.ai.traffic.controll.i.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * Stores every chatbot conversation via /api/traffic/chatbot
 */
@Entity
@Table(name = "chat_log")
@Data
public class ChatLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String sessionId;

    @Column(length = 500)
    private String userMessage;

    @Column(length = 1000)
    private String botResponse;

    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }
}

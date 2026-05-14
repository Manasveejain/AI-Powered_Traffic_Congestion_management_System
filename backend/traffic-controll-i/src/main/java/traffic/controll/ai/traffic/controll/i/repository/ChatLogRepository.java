package traffic.controll.ai.traffic.controll.i.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import traffic.controll.ai.traffic.controll.i.entity.ChatLog;

import java.util.List;

@Repository
public interface ChatLogRepository extends JpaRepository<ChatLog, Long> {

    List<ChatLog> findTop20ByOrderByCreatedAtDesc();

    List<ChatLog> findBySessionId(String sessionId);
}

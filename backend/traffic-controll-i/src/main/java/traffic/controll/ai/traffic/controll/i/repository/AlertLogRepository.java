package traffic.controll.ai.traffic.controll.i.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import traffic.controll.ai.traffic.controll.i.entity.AlertLog;

import java.util.List;

@Repository
public interface AlertLogRepository extends JpaRepository<AlertLog, Long> {

    List<AlertLog> findTop10ByOrderByCreatedAtDesc();

    List<AlertLog> findByCity(String city);

    List<AlertLog> findBySeverity(String severity);
}

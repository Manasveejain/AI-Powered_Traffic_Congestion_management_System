package traffic.controll.ai.traffic.controll.i.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import traffic.controll.ai.traffic.controll.i.entity.PredictionLog;

import java.util.List;

@Repository
public interface PredictionLogRepository extends JpaRepository<PredictionLog, Long> {

    List<PredictionLog> findTop10ByOrderByCreatedAtDesc();

    List<PredictionLog> findByTrafficLevel(String trafficLevel);

    List<PredictionLog> findByLocation(String location);
}

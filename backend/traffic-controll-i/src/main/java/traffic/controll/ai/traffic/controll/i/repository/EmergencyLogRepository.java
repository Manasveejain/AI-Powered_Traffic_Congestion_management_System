package traffic.controll.ai.traffic.controll.i.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import traffic.controll.ai.traffic.controll.i.entity.EmergencyLog;

import java.util.List;

@Repository
public interface EmergencyLogRepository extends JpaRepository<EmergencyLog, Long> {

    List<EmergencyLog> findTop10ByOrderByCreatedAtDesc();

    List<EmergencyLog> findByVehicleType(String vehicleType);
}

package traffic.controll.ai.traffic.controll.i.model;

import lombok.Data;

@Data
public class EmergencyRequest {

    private String vehicleType;
    private String origin;
    private String destination;
}

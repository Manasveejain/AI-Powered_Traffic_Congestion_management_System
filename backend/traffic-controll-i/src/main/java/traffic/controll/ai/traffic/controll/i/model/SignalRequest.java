package traffic.controll.ai.traffic.controll.i.model;

import lombok.Data;

@Data
public class SignalRequest {

    private String intersectionId;
    private double vehicleCount;
    private double avgSpeed;
    private double weather;
}

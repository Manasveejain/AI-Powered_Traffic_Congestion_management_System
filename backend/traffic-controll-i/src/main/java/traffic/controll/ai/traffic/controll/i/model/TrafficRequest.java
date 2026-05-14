package traffic.controll.ai.traffic.controll.i.model;

import lombok.Data;

@Data
public class TrafficRequest {

    private double vehicleCount;
    private double avgSpeed;
    private double weather;
    private String location;
    private String timestamp;
}

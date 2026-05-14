package traffic.controll.ai.traffic.controll.i.model;

import lombok.Data;

@Data
public class RouteRequest {

    private String origin;
    private String destination;
    private String currentCongestion;
}

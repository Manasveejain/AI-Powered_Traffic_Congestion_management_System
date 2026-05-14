package traffic.controll.ai.traffic.controll.i.model;

import lombok.Data;

@Data
public class HeatmapRequest {

    private String city;
    private Integer gridSize;
    private Double baseLat;
    private Double baseLng;
}

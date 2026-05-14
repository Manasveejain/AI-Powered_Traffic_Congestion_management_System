package traffic.controll.ai.traffic.controll.i.model;

import lombok.Data;
import java.util.List;

@Data
public class TrafficResponse {

    private String traffic;
    private Double congestionScore;
    private List<Double> prediction;
    private Integer etaDelayMinutes;
    private String location;
    private String timestamp;
    private String weatherCondition;
    private List<String> preventiveActions;
    private String modelUsed;
}

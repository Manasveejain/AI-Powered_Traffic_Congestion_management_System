import pandas as pd
import numpy as np
import random

np.random.seed(42)
rows = 1000

data = {
    'hour':        [random.randint(0, 23) for _ in range(rows)],
    'day_of_week': [random.randint(0, 6) for _ in range(rows)],
    'weather':     [random.choice([0,1,2]) for _ in range(rows)],
                    #  0=clear, 1=rain, 2=fog
    'event_flag':  [random.choice([0,0,0,1]) for _ in range(rows)],
                    #  25% chance of event
    'accident':    [random.choice([0,0,0,0,1]) for _ in range(rows)],
    'vehicle_count': np.random.randint(50, 800, rows).tolist()
}

df = pd.DataFrame(data)

# Realistic congestion formula
def calc_congestion(row):
    base = 20
    # Rush hours boost
    if row['hour'] in [8,9,17,18,19]:
        base += 40
    elif row['hour'] in [10,11,16]:
        base += 20
    # Weekday
    if row['day_of_week'] < 5:
        base += 10
    # Rain makes it worse
    if row['weather'] == 1:
        base += 15
    elif row['weather'] == 2:
        base += 10
    base += row['event_flag'] * 20
    base += row['accident'] * 25
    base += row['vehicle_count'] / 20
    noise = np.random.normal(0, 5)
    return max(0, min(100, base + noise))

df['congestion'] = df.apply(calc_congestion, axis=1).round(1)

df.to_csv('data/traffic_data.csv', index=False)
print(df.head(10))
print(f"Generated {len(df)} rows")
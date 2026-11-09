import pandas as pd
import random
import os

os.makedirs('data', exist_ok=True)

injury_types = ['حادث سيارة', 'حريق', 'أزمة قلبية', 'نزيف', 'كسور', 'غير ذلك']

data = []
for _ in range(1000):
    injury = random.choice(injury_types)
    bleeding = random.choice(['none', 'moderate', 'severe'])
    conscious = random.choice([True, False])
    injured_count = random.randint(1, 5)
    
    if bleeding == 'severe' or not conscious or injury == 'أزمة قلبية' or injured_count >= 3:
        severity = 'Critical'
    elif bleeding == 'moderate' or injury in ['حريق', 'كسور']:
        severity = 'Medium'
    else:
        severity = 'Low'
        
    data.append([injury, bleeding, conscious, injured_count, severity])

df = pd.DataFrame(data, columns=['injury_type', 'bleeding', 'conscious', 'injured_count', 'severity'])
df.to_csv('data/dataset.csv', index=False)

print("Dataset generated successfully inside data folder!")
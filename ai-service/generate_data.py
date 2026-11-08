import pandas as pd
import random
import os

# إنشاء مجلد data لو مش موجود
os.makedirs('data', exist_ok=True)

# إنشاء داتا تجريبية لفرز حالات الطوارئ
data = []
injury_types = ['Accident', 'Heart Attack', 'Bleeding', 'Burn', 'Fracture']

for _ in range(500):
    injury = random.choice(injury_types)
    bleeding = random.choice([0, 1])  # 0: لا يوجد، 1: يوجد
    consciousness = random.choice([0, 1])  # 0: فاقد الوعي، 1: واعي
    casualties = random.randint(1, 4)
    
    # منطق بسيط لتحديد درجة الخطورة
    if bleeding == 1 and consciousness == 0:
        priority = 'Critical'
    elif injury == 'Heart Attack' or casualties > 2:
        priority = 'Critical'
    elif injury in ['Burn', 'Fracture'] and bleeding == 0:
        priority = 'Medium'
    else:
        priority = 'Low'
        
    data.append([injury, bleeding, consciousness, casualties, priority])

# حفظ الداتا في ملف CSV داخل مجلد data
df = pd.DataFrame(data, columns=['injury_type', 'bleeding', 'consciousness', 'casualties', 'priority_level'])
df.to_csv('data/dataset.csv', index=False)

print("Dataset generated successfully inside data folder!")
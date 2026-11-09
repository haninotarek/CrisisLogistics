import random
import pandas as pd
import os

INJURY_TYPES = [
    "حادث سيارة",
    "ألم في الصدر",
    "سقوط من ارتفاع",
    "حروق",
    "جرح قطعي",
    "كسر في الذراع أو الساق",
    "إغماء",
    "اختناق أو صعوبة تنفس",
    "إصابة أخرى",
]

BLEEDING_LEVELS = ["none", "mild", "moderate", "severe"]

def generate_dataset(num_samples=5000):
    data = []
    for _ in range(num_samples):
        injury = random.choice(INJURY_TYPES)
        bleeding = random.choice(BLEEDING_LEVELS)
        conscious = random.choice([True, False])
        breathing_issue = random.choice([True, False])
        pain_level = random.randint(0, 10)
        
        # قواعد طبية دقيقة لتصنيف الخطورة
        if injury in ["ألم في الصدر", "اختناق أو صعوبة تنفس"] or not conscious or breathing_issue or bleeding == "severe":
            severity = "Critical"
        elif injury in ["حادث سيارة", "سقوط من ارتفاع", "حروق", "كسر في الذراع أو الساق", "إغماء"] or bleeding == "moderate" or pain_level >= 7:
            severity = "Medium"
        else:
            severity = "Low"
            
        data.append({
            "injury_type": injury,
            "bleeding": bleeding,
            "conscious": conscious,
            "breathing_issue": breathing_issue,
            "pain_level": pain_level,
            "severity": severity
        })
        
    df = pd.DataFrame(data)
    os.makedirs("data", exist_ok=True)
    df.to_csv("data/triage_dataset.csv", index=False)
    print("Dataset generated successfully with 5000 samples and robust rules!")

if __name__ == "__main__":
    generate_dataset()
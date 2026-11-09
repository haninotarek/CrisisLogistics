import random
import pandas as pd

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

def generate_dataset(num_samples=1500):
    data = []
    for _ in range(num_samples):
        injury = random.choice(INJURY_TYPES)
        bleeding = random.choice(BLEEDING_LEVELS)
        conscious = random.choice([True, False])
        breathing_issue = random.choice([True, False])
        pain_level = random.randint(0, 10)
        
        # قواعد طبية منطقية لتحديد خطورة الحالة (Severity)
        if not conscious or breathing_issue or bleeding == "severe" or injury in ["ألم في الصدر", "اختناق أو صعوبة تنفس"]:
            severity = "Critical"
        elif bleeding == "moderate" or pain_level >= 7 or injury in ["حادث سيارة", "سقوط من ارتفاع", "حروق", "كسر في الذراع أو الساق"]:
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
    df.to_csv("data/triage_dataset.csv", index=False)
    print("Dataset generated successfully with 9 injury types and new features!")

if __name__ == "__main__":
    import os
    os.makedirs("data", exist_ok=True)
    generate_dataset()
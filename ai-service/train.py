import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import joblib
import os

def train_model():
    # التأكد من وجود ملف البيانات أو توليده
    if not os.path.exists("data/triage_dataset.csv"):
        import generate_data
        generate_data.generate_dataset()
        
    df = pd.read_csv("data/triage_dataset.csv")
    
    # تحويل النصوص والـ Boolean إلى أرقام باستخدام LabelEncoders
    encoders = {}
    for col in ["injury_type", "bleeding"]:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col].astype(str))
        encoders[col] = le
        
    # تحويل البوليان لـ int
    for col in ["conscious", "breathing_issue"]:
        df[col] = df[col].astype(int)
        
    X = df[["injury_type", "bleeding", "conscious", "breathing_issue", "pain_level"]]
    y = df["severity"]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    # حفظ الموديل والـ Encoders معاً لتفادي أي أخطاء في الـ API
    os.makedirs("model", exist_ok=True)
    joblib.dump({"model": model, "encoders": encoders}, "model/model.joblib")
    print("Model trained and saved successfully with all encoders!")

if __name__ == "__main__":
    train_model()
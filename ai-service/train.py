import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score
import joblib
import os

# 1. قراءة البيانات التجريبية
data_path = 'data/dataset.csv'
if not os.path.exists(data_path):
    print("Dataset file not found! Please run generate_data.py first.")
else:
    df = pd.read_csv(data_path)
    
    # 2. تحديد المدخلات والمخرجات
    df['injury_type'] = df['injury_type'].astype('category').cat.codes
    
    X = df[['injury_type', 'bleeding', 'consciousness', 'casualties']]
    y = df['priority_level']
    
    # 3. تقسيم البيانات لتدريب واختبار
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # 4. بناء وتدريب الموديل
    model = DecisionTreeClassifier(random_state=42)
    model.fit(X_train, y_train)
    
    # 5. حساب دقة الموديل
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"Model trained successfully! Accuracy: {acc * 100:.2f}%")
    
    # 6. حفظ الموديل في ملف للاستخدام لاحقاً
    os.makedirs('data', exist_ok=True)
    joblib.dump(model, 'data/model.joblib')
    print("Model saved successfully in data/model.joblib")
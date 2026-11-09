import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score
import joblib
import os

data_path = 'data/dataset.csv'
if not os.path.exists(data_path):
    print("Dataset file not found! Please run generate_data.py first.")
else:
    df = pd.read_csv(data_path)
    
    le_injury = LabelEncoder()
    le_bleeding = LabelEncoder()
    
    df['injury_type_encoded'] = le_injury.fit_transform(df['injury_type'])
    df['bleeding_encoded'] = le_bleeding.fit_transform(df['bleeding'])
    df['conscious_encoded'] = df['conscious'].astype(int)
    
    X = df[['injury_type_encoded', 'bleeding_encoded', 'conscious_encoded', 'injured_count']]
    y = df['severity']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = DecisionTreeClassifier(random_state=42)
    model.fit(X_train, y_train)
    
    acc = accuracy_score(y_test, model.predict(X_test))
    print(f"Model trained successfully! Accuracy: {acc * 100:.2f}%")
    
    os.makedirs('data', exist_ok=True)
    joblib.dump({
        'model': model,
        'le_injury': le_injury,
        'le_bleeding': le_bleeding
    }, 'data/model.joblib')
    
    print("Model and Encoders saved successfully in data/model.joblib")
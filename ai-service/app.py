from flask import Flask, request, jsonify
import joblib
import os
import pandas as pd

app = Flask(__name__)

# تحميل الموديل والـ Encoders المحفوظة
model_path = "model/model.joblib"
if os.path.exists(model_path):
    saved_bundle = joblib.load(model_path)
    model = saved_bundle["model"]
    encoders = saved_bundle["encoders"]
else:
    model = None
    encoders = None

@app.route('/predict', methods=['POST'])
def predict():
    if not model or not encoders:
        return jsonify({"error": "Model not trained or missing"}), 500
        
    data = request.get_json()
    if not data:
        return jsonify({"error": "No input data provided"}), 400
        
    try:
        injury_type = data.get("injury_type", "حادث سيارة")
        bleeding = data.get("bleeding", "none")
        conscious = int(bool(data.get("conscious", True)))
        breathing_issue = int(bool(data.get("breathing_issue", False)))
        pain_level = int(data.get("pain_level", 5))
        
        # تحويل النصوص للأرقام باستخدام الـ encoders المحفوظة
        injury_encoded = encoders["injury_type"].transform([injury_type])[0]
        bleeding_encoded = encoders["bleeding"].transform([bleeding])[0]
        
        features = pd.DataFrame([[
            injury_encoded,
            bleeding_encoded,
            conscious,
            breathing_issue,
            pain_level
        ]], columns=["injury_type", "bleeding", "conscious", "breathing_issue", "pain_level"])
        
        prediction = model.predict(features)[0]
        
        return jsonify({
            "status": "success",
            "severity": prediction
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
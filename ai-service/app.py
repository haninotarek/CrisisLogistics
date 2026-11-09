from flask import Flask, request, jsonify
import joblib
import os
import pandas as pd

app = Flask(__name__)

model_path = "model/model.joblib"
if os.path.exists(model_path):
    saved_bundle = joblib.load(model_path)
    model = saved_bundle["model"]
    encoders = saved_bundle["encoders"]
else:
    model = None
    encoders = None

# قواعد الحماية الاحتياطية (نفس قواعد generate_data.py)
def fallback_severity(injury_type, bleeding, conscious, breathing_issue, pain_level):
    if injury_type in ["ألم في الصدر", "اختناق أو صعوبة تنفس"] or not conscious or breathing_issue or bleeding == "severe":
        return "Critical"
    elif injury_type in ["حادث سيارة", "سقوط من ارتفاع", "حروق", "كسر في الذراع أو الساق", "إغماء"] or bleeding == "moderate" or pain_level >= 7:
        return "Medium"
    return "Low"

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No input data provided"}), 400
        
    try:
        injury_type = data.get("injury_type", "حادث سيارة")
        bleeding = data.get("bleeding", "none")
        conscious = bool(data.get("conscious", True))
        breathing_issue = bool(data.get("breathing_issue", False))
        
        # درجة الألم ممكن تيجي فاضية (null) من السيرفر
        pain_level = data.get("pain_level")
        if pain_level is None:
            pain_level = 5
        pain_level = int(pain_level)
        
        # نظام الحماية الاحتياطي (Fallback) لو الموديل مش جاهز أو الكلمة جديدة
        if (not model or not encoders
                or injury_type not in encoders["injury_type"].classes_
                or bleeding not in encoders["bleeding"].classes_):
            severity = fallback_severity(injury_type, bleeding, conscious, breathing_issue, pain_level)
            return jsonify({"status": "success", "severity": severity, "source": "fallback_rules"})

        injury_encoded = encoders["injury_type"].transform([injury_type])[0]
        bleeding_encoded = encoders["bleeding"].transform([bleeding])[0]
        
        features = pd.DataFrame([[
            injury_encoded,
            bleeding_encoded,
            int(conscious),
            int(breathing_issue),
            pain_level
        ]], columns=["injury_type", "bleeding", "conscious", "breathing_issue", "pain_level"])
        
        prediction = model.predict(features)[0]
        
        return jsonify({
            "status": "success",
            "severity": prediction,
            "source": "ai_model"
        })
    except Exception as e:
        # لو حصل خطأ نرجّع error عشان السيرفر يستخدم القواعد الطبية بتاعته بدل ما نخمّن Medium
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
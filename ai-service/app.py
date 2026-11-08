from flask import Flask, request, jsonify
import joblib
import os
import pandas as pd

app = Flask(__name__)

# تحميل الموديل المحفوظ مسبقاً
model_path = 'data/model.joblib'
if os.path.exists(model_path):
    model = joblib.load(model_path)
else:
    model = None

@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({'error': 'Model not trained yet!'}), 500
    
    data = request.get_json()
    
    try:
        # استقبال البيانات المتوقعة من البلاغ
        injury_type = data.get('injury_type', 0)
        bleeding = data.get('bleeding', 0)
        consciousness = data.get('consciousness', 0)
        casualties = data.get('casualties', 1)
        
        # تجهيز البيانات لتكون ملائمة للموديل
        input_data = pd.DataFrame([[injury_type, bleeding, consciousness, casualties]], 
                                  columns=['injury_type', 'bleeding', 'consciousness', 'casualties'])
        
        # التنبؤ بدرجة الخطورة
        prediction = model.predict(input_data)[0]
        
        return jsonify({
            'status': 'success',
            'priority_level': prediction
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
from flask import Flask, request, jsonify
import joblib
import os
import pandas as pd

app = Flask(__name__)

model_path = 'data/model.joblib'
if os.path.exists(model_path):
    saved_objects = joblib.load(model_path)
    model = saved_objects['model']
    le_injury = saved_objects['le_injury']
    le_bleeding = saved_objects['le_bleeding']
else:
    model = None

@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({'error': 'Model not trained yet!'}), 500
    
    data = request.get_json()
    
    try:
        raw_injury = data.get('injury_type', 'غير ذلك')
        raw_bleeding = data.get('bleeding', 'none')
        conscious = data.get('conscious', True)
        injured_count = data.get('injured_count', 1)
        
        if raw_injury in le_injury.classes_:
            injury_encoded = le_injury.transform([raw_injury])[0]
        else:
            injury_encoded = le_injury.transform(['غير ذلك'])[0]
            
        if raw_bleeding in le_bleeding.classes_:
            bleeding_encoded = le_bleeding.transform([raw_bleeding])[0]
        else:
            bleeding_encoded = le_bleeding.transform(['none'])[0]
            
        conscious_encoded = 1 if conscious else 0
        
        input_data = pd.DataFrame([[injury_encoded, bleeding_encoded, conscious_encoded, injured_count]], 
                                  columns=['injury_type_encoded', 'bleeding_encoded', 'conscious_encoded', 'injured_count'])
        
        prediction = model.predict(input_data)[0]
        
        return jsonify({
            'status': 'success',
            'severity': prediction
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
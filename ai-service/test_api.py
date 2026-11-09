import urllib.request
import json

url = 'http://127.0.0.1:5000/predict'
payload = {
    "injury_type": "حادث سيارة",
    "bleeding": "severe",
    "conscious": False,
    "injured_count": 3
}

data = json.dumps(payload).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})

try:
    with urllib.request.urlopen(req) as response:
        print("Status Code:", response.status)
        print("Response from AI Server:", json.loads(response.read().decode('utf-8')))
except Exception as e:
    print("Error connecting to server:", e)
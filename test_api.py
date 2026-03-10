import urllib.request
import json
import traceback

data = {
    "context_type": "food_drug",
    "patient_id": "P001",
    "data": {
        "interactions": []
    }
}
req = urllib.request.Request(
    'http://localhost:8000/api/v1/ollama/summarize',
    data=json.dumps(data).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
try:
    response = urllib.request.urlopen(req)
    print(response.read().decode())
except Exception as e:
    print(e)
    if hasattr(e, 'read'):
        print(e.read().decode())

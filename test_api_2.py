import urllib.request
import json
import time

data = {
    "context_type": "restrictions",
    "patient_id": "P001",
    "data": {
        "restrictions": ["low_sugar"],
        "conflicts": [
            {"source": "low_sugar", "target": "low_carb", "shared": "bread", "danger": "warn"}
        ]
    }
}
req = urllib.request.Request(
    'http://localhost:8179/api/v1/ollama/summarize',
    data=json.dumps(data).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
try:
    t0 = time.time()
    response = urllib.request.urlopen(req, timeout=30)
    print(response.read().decode())
    print("Time taken:", time.time() - t0)
except Exception as e:
    print(e)
    if hasattr(e, 'read'):
        print(e.read().decode())

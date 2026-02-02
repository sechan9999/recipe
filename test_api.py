import os
import sys
import json
import urllib.request
import urllib.error

# Fix encoding for Windows console
sys.stdout.reconfigure(encoding='utf-8')

# Load API key from .env file
with open('.env', 'r') as f:
    for line in f:
        if line.startswith('OPENROUTER_API_KEY='):
            API_KEY = line.strip().split('=', 1)[1]
            break

BASE_URL = "https://openrouter.ai/api/v1"

def call_openrouter(model, messages, timeout=60):
    """Call OpenRouter API"""
    url = f"{BASE_URL}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    data = json.dumps({
        "model": model,
        "messages": messages
    }).encode('utf-8')

    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        try:
            return {"error": json.loads(error_body)}
        except:
            return {"error": {"message": error_body}}

# Test multiple models with fallback
text_models = [
    "google/gemma-3-4b-it:free",
    "deepseek/deepseek-r1-0528:free",
    "tngtech/deepseek-r1t-chimera:free",
]

image_models = [
    "google/gemma-3-27b-it:free",
    "google/gemma-3-12b-it:free",
    "google/gemma-3-4b-it:free",
]

print("=" * 60)
print("TEST 1: Text Generation")
print("=" * 60)

for model in text_models:
    print(f"\nTrying model: {model}")
    print("Sending request...")

    result = call_openrouter(model, [
        {"role": "user", "content": "Say hello in Korean. Just 1 sentence."}
    ])

    if "error" in result:
        print(f"Error: {result['error'].get('message', result['error'])}")
        continue
    else:
        content = result['choices'][0]['message']['content']
        print(f"SUCCESS!")
        print(f"Response: {content}")
        break

print("\n" + "=" * 60)
print("TEST 2: Image Recognition")
print("=" * 60)

test_image_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png"

for model in image_models:
    print(f"\nTrying model: {model}")
    print("Sending request with image...")

    result = call_openrouter(model, [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "What objects do you see in this image? Answer in 1 sentence."},
                {"type": "image_url", "image_url": {"url": test_image_url}}
            ]
        }
    ])

    if "error" in result:
        print(f"Error: {result['error'].get('message', result['error'])}")
        continue
    else:
        content = result['choices'][0]['message']['content']
        print(f"SUCCESS!")
        print(f"Response: {content}")
        break

print("\n" + "=" * 60)
print("API Test Complete!")
print("=" * 60)

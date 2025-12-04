import requests
import json
import base64

# 1. Thay API Key của bạn vào đây
API_KEY = "AIzaSyCqPF_CvGfUkd2LSJ00XGyYeFHcxP2QKj4" 

# 2. URL của model Gemini 1.5 Flash (Hỗ trợ Vision tốt nhất)
url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={API_KEY}"

# 3. Một ảnh base64 mẫu (ảnh chấm đỏ nhỏ xíu để test)
# Bạn không cần thay đổi dòng này
img_data = "iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="

payload = {
    "contents": [{
        "parts": [
            {"text": "Mô tả bức ảnh này xem nó là cái gì?"}, # Câu hỏi
            {"inline_data": {
                "mime_type": "image/png",
                "data": img_data
            }}
        ]
    }]
}

print("🚀 Đang gửi ảnh test lên Google Gemini...")
response = requests.post(url, headers={'Content-Type': 'application/json'}, data=json.dumps(payload))

print(f"📡 Status Code: {response.status_code}")
if response.status_code == 200:
    print("✅ THÀNH CÔNG! AI Trả lời:")
    print(response.json()['candidates'][0]['content']['parts'][0]['text'])
else:
    print("❌ THẤT BẠI! Lỗi từ Google:")
    print(response.text)
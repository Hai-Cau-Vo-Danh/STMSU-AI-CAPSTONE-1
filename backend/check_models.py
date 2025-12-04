import requests
import os
from dotenv import load_dotenv

# 1. Load Key
load_dotenv("backend/.env") # Đảm bảo đường dẫn đúng tới file .env
API_KEY = "AIzaSyCqPF_CvGfUkd2LSJ00XGyYeFHcxP2QKj4"

if not API_KEY:
    print("❌ Lỗi: Chưa tìm thấy API Key trong .env")
    exit()

print(f"🔑 Đang kiểm tra Key: {API_KEY[:5]}...{API_KEY[-5:]}")

# 2. Gọi API lấy danh sách Model
url = f"https://generativelanguage.googleapis.com/v1beta/models?key={API_KEY}"
response = requests.get(url)

if response.status_code == 200:
    data = response.json()
    print("\n✅ DANH SÁCH MODEL KHẢ DỤNG CHO KEY NÀY:")
    print("-" * 40)
    found_vision = False
    for model in data.get('models', []):
        name = model['name'].replace('models/', '')
        methods = model.get('supportedGenerationMethods', [])
        
        # Kiểm tra xem model có hỗ trợ tạo nội dung không
        if 'generateContent' in methods:
            print(f"🔹 {name}")
            if '1.5' in name or 'vision' in name:
                found_vision = True
    print("-" * 40)
    
    if not found_vision:
        print("⚠️ CẢNH BÁO: Key này không thấy model Vision nào (1.5-flash, pro-vision...).")
        print("👉 GIẢI PHÁP: Bắt buộc phải tạo Key mới tại https://aistudio.google.com/app/apikey (Chọn 'Create in new project')")
else:
    print(f"\n❌ Lỗi khi lấy danh sách model: {response.status_code}")
    print(response.text)
import json
import os
import requests
import base64
import io
from PIL import Image
from dotenv import load_dotenv
import PyPDF2
import docx
import io

# Load API Key
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("⚠️ CẢNH BÁO: Chưa có GEMINI_API_KEY trong .env")

# --- HÀM GỌI API CỐT LÕI (Dùng REST API) ---
def call_gemini_api(prompt, image_bytes=None, output_json=False):
    if not GEMINI_API_KEY: return None

    # 1. Chọn Model: Ưu tiên 2.0 Flash vì Key của bạn có hỗ trợ
    # Nếu 2.0 lỗi, bạn có thể đổi thành 'gemini-1.5-flash'
    MODEL_NAME = 'gemini-2.0-flash' 
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent?key={GEMINI_API_KEY}"
    headers = {'Content-Type': 'application/json'}
    
    # 2. Chuẩn bị nội dung
    parts = [{"text": prompt}]
    
    # Xử lý ảnh (nếu có)
    if image_bytes:
        try:
            # Resize ảnh nếu quá lớn (Gemini giới hạn dung lượng payload)
            img = Image.open(io.BytesIO(image_bytes))
            # Convert sang RGB nếu là RGBA (tránh lỗi PNG trong suốt)
            if img.mode in ('RGBA', 'P'): 
                img = img.convert('RGB')
            
            # Resize xuống max 1024px để nhẹ gánh đường truyền
            img.thumbnail((1024, 1024)) 
            
            # Lưu vào buffer
            buffered = io.BytesIO()
            img.save(buffered, format="JPEG", quality=80)
            img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')

            parts.append({
                "inline_data": {
                    "mime_type": "image/jpeg",
                    "data": img_str
                }
            })
        except Exception as e:
            print(f"❌ Lỗi xử lý ảnh cục bộ: {e}")
            return "Lỗi xử lý file ảnh trên server."

    payload = {
        "contents": [{"parts": parts}]
    }

    if output_json:
        payload["generationConfig"] = {"response_mime_type": "application/json"}

    # 3. Gửi Request & Debug
    try:
        print(f"🚀 Đang gửi request tới {MODEL_NAME}...")
        response = requests.post(url, headers=headers, data=json.dumps(payload))
        
        if response.status_code == 200:
            result = response.json()
            try:
                text = result['candidates'][0]['content']['parts'][0]['text']
                if output_json:
                    text = text.replace("```json", "").replace("```", "").strip()
                    return json.loads(text)
                return text
            except:
                return None
        else:
            # --- QUAN TRỌNG: IN LỖI CHI TIẾT TỪ GOOGLE ---
            print(f"\n❌ GOOGLE REFUSED ({response.status_code}):")
            print(f"👉 {response.text}\n") # <--- Nhìn vào dòng này trong Terminal để biết nguyên nhân
            return None

    except Exception as e:
        print(f"❌ Lỗi kết nối mạng: {e}")
        return None

# --- CÁC HÀM LOGIC ---

def analyze_task_semantics(title, description):
    prompt = f"""Phân tích task: Title: {title}, Description: {description}. JSON: {{ "priority": "high/medium/low", "category": "General" }}"""
    res = call_gemini_api(prompt, output_json=True)
    return res if res else {"priority": "medium", "category": "General"}

def generate_subtasks_ai(task_title, deadline):
    prompt = f"""Task: "{task_title}". Deadline: {deadline}. Chia nhỏ 3 bước. JSON: {{ "steps": [ {{"title": "..."}} ] }}"""
    res = call_gemini_api(prompt, output_json=True)
    return res.get("steps", []) if res else []

def moderate_content(content):
    prompt = f"""Đánh giá toxic: "{content}". JSON: {{ "is_toxic": true/false, "suggestion": "..." }}"""
    res = call_gemini_api(prompt, output_json=True)
    return res if res else {"is_toxic": False}

def generate_quiz_from_note(note_content):
    prompt = f"""Note: "{note_content}". 3 câu trắc nghiệm JSON: [ {{ "question": "...", "options": ["..."], "correct_index": 0 }} ]"""
    res = call_gemini_api(prompt, output_json=True)
    return res if res else []

def generate_leaderboard_comment(username, tomatoes, rank):
    prompt = f"User {username} hạng {rank}, {tomatoes} điểm. Roast hài hước ngắn."
    res = call_gemini_api(prompt)
    return res if res else f"Chúc mừng {username}!"

# --- VISION ---
def process_image_query(image_bytes, user_prompt):
    if not user_prompt: user_prompt = "Mô tả chi tiết bức ảnh này."
    
    res = call_gemini_api(user_prompt, image_bytes=image_bytes)
    
    if res:
        return res
    else:
        return "Xin lỗi, kết nối thất bại. Cậu hãy xem Terminal của server để biết lỗi cụ thể nhé!"
    
# --- 7. DOC TO WORKSPACE: ĐỌC FILE & PHÂN TÍCH ---

def extract_text_from_file(file_storage, filename):
    """Đọc nội dung text từ file PDF hoặc DOCX."""
    text = ""
    try:
        if filename.lower().endswith('.pdf'):
            pdf_reader = PyPDF2.PdfReader(file_storage)
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
        elif filename.lower().endswith('.docx'):
            doc = docx.Document(file_storage)
            for para in doc.paragraphs:
                text += para.text + "\n"
        else:
            return None # Không hỗ trợ định dạng khác
    except Exception as e:
        print(f"❌ Lỗi đọc file: {e}")
        return None
    return text

def generate_workspace_structure(document_text):
    """
    Gửi nội dung tài liệu cho AI để tạo cấu trúc dự án.
    Yêu cầu AI trích xuất thêm 'due_date' (Deadline).
    """
    prompt = f"""
    Bạn là chuyên gia Quản lý dự án.
    Nhiệm vụ: Phân tích tài liệu và tạo cấu trúc bảng công việc.

    NỘI DUNG TÀI LIỆU:
    {document_text[:10000]}
    
    YÊU CẦU CẤU TRÚC JSON (TUYỆT ĐỐI TUÂN THỦ):
    
    1. CÁC CỘT PHÂN LOẠI (Dựa trên nội dung):
       - Tạo các cột theo Giai đoạn/Chương mục.
       - QUAN TRỌNG: Với mỗi công việc (card), hãy cố gắng tìm "Deadline" hoặc "Ngày hết hạn" trong văn bản. 
       - Nếu tìm thấy ngày, hãy chuyển đổi sang định dạng ISO "YYYY-MM-DD". Nếu không, để null.
       
    2. CÁC CỘT TRẠNG THÁI (Bắt buộc phải có ở cuối):
       - Tạo cột "In Progress": Để trống.
       - Tạo cột "Done": Để trống.

    Output JSON mẫu:
    {{
        "workspace_name": "Tên Dự Án",
        "description": "Mô tả...",
        "lists": [
            {{ 
                "title": "Giai đoạn 1: Chuẩn bị", 
                "cards": [ 
                    {{ 
                        "title": "Nộp bản thảo", 
                        "description": "Gửi cho sếp duyệt", 
                        "due_date": "2025-12-20", 
                        "subtasks": ["Viết mục lục", "Soát lỗi"] 
                    }} 
                ] 
            }},
            {{ "title": "In Progress", "cards": [] }},
            {{ "title": "Done", "cards": [] }}
        ]
    }}
    """
    
    return call_gemini_api(prompt, output_json=True)
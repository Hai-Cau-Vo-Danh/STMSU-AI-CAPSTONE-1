from sqlalchemy import event
from DB.models import Task, Comment, BoardCard, CardChecklist, ChecklistItem, Notification
from DB.database import get_db
from ai_engine import analyze_task_semantics, moderate_content, generate_subtasks_ai
import threading

# --- 1. TRIGGER: Tự động gắn Priority & Category cho Task cá nhân ---
def register_task_triggers():
    @event.listens_for(Task, 'before_insert')
    def task_before_insert(mapper, connection, target):
        try:
            print(f"🧠 [AI Trigger] Đang phân tích Task: {target.title}")
            # Gọi AI phân tích
            analysis = analyze_task_semantics(target.title, target.description or "")
            
            # Gán kết quả vào Task trước khi lưu
            if analysis.get('priority'):
                target.priority = analysis['priority']
            
            # Nếu bạn có cột category, bỏ comment dòng dưới:
            # target.category = analysis.get('category', 'General')
            
        except Exception as e:
            print(f"⚠️ Lỗi AI Trigger Task: {e}")

# --- 2. TRIGGER: Kiểm duyệt bình luận (Moderation) ---
def register_comment_triggers():
    @event.listens_for(Comment, 'before_insert')
    def comment_before_insert(mapper, connection, target):
        try:
            check = moderate_content(target.content)
            if check.get('is_toxic'):
                print(f"🛡️ [AI Trigger] Phát hiện bình luận tiêu cực: {target.content}")
                # Thay đổi nội dung thành thông báo ẩn
                target.content = f"🚫 [Nội dung đã bị AI ẩn vì vi phạm tiêu chuẩn]. Gợi ý: {check.get('suggestion')}"
        except Exception as e:
            print(f"⚠️ Lỗi AI Moderator: {e}")

# --- 3. TRIGGER: Tự động chia nhỏ công việc (Auto-Breakdown) cho Card ---
def register_card_triggers():
    @event.listens_for(BoardCard, 'after_insert')
    def card_after_insert(mapper, connection, target):
        # Vì cần ghi thêm vào DB (Checklist), ta phải chạy ở Thread riêng sau khi Card đã lưu xong
        def async_breakdown(card_id, title, due_date):
            print(f"⚡ [AI Trigger] Đang chia nhỏ công việc cho Card ID {card_id}...")
            
            # Gọi AI
            # Lưu ý: due_date có thể là None hoặc datetime object, cần chuyển sang string
            date_str = str(due_date) if due_date else "tomorrow"
            steps = generate_subtasks_ai(title, date_str)
            
            if not steps: return

            # Mở session mới để lưu
            db = next(get_db())
            try:
                # Tạo Checklist cha
                new_checklist = CardChecklist(
                    card_id=card_id,
                    title="✨ Gợi ý từ AI",
                    position=0
                )
                db.add(new_checklist)
                db.commit()
                db.refresh(new_checklist) # Lấy ID
                
                # Tạo các Items con
                items = []
                for i, step in enumerate(steps):
                    items.append(ChecklistItem(
                        checklist_id=new_checklist.checklist_id,
                        title=step['title'],
                        position=i
                    ))
                db.add_all(items)
                db.commit()
                print(f"✅ [AI Trigger] Đã tạo {len(items)} bước cho Card {card_id}")
                
            except Exception as e:
                print(f"❌ Lỗi lưu Checklist AI: {e}")
                db.rollback()
            finally:
                db.close()

        # Chạy luồng riêng
        thread = threading.Thread(target=async_breakdown, args=(target.card_id, target.title, target.due_date))
        thread.start()

# --- 4. HÀM TỔNG HỢP ĐỂ GỌI TỪ APP.PY ---
# Đây là hàm mà app.py đang cố gắng import nhưng không thấy
def register_all_triggers():
    register_task_triggers()
    register_comment_triggers()
    register_card_triggers()
    print("🤖 Đã kích hoạt hệ thống AI ngầm (Triggers)!")

# --- 5. VISION: XỬ LÝ ẢNH (CHAT VỚI ẢNH) ---
def process_image_query(image_bytes, user_prompt):
    """
    Gửi ảnh + câu hỏi lên Gemini Vision.
    """
    if not GEMINI_API_KEY: return "Chưa cấu hình API Key."

    try:
        # Chuyển bytes thành ảnh PIL
        image = PIL.Image.open(io.BytesIO(image_bytes))
        
        # Dùng model Flash (hỗ trợ đa phương thức tốt)
        model_vision = genai.GenerativeModel('gemini-2.0-flash') # Hoặc 1.5-flash
        
        # Nếu user không hỏi gì, mặc định là mô tả hoặc trích xuất text
        if not user_prompt:
            user_prompt = "Hãy trích xuất toàn bộ nội dung văn bản trong ảnh này. Nếu là bài tập, hãy giải nó. Nếu là danh sách việc cần làm, hãy liệt kê ra."

        response = model_vision.generate_content([user_prompt, image])
        return response.text.strip()
    except Exception as e:
        print(f"Lỗi Vision: {e}")
        return "Xin lỗi, tớ không nhìn rõ ảnh này. Thử ảnh khác nhé!"    
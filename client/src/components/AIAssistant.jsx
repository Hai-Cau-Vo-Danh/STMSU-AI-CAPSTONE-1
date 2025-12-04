import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './AIAssistant.css';
import aiLogo from '../assets/Trangchu/art8.png'; // Đảm bảo đường dẫn đúng
import { IoImageOutline, IoCloseCircle, IoDocumentTextOutline, IoTrashOutline, IoRemove, IoSend } from 'react-icons/io5'; 
import { FaMicrophone } from 'react-icons/fa'; 

const getUserId = () => {
    try {
      const userString = localStorage.getItem("user");
      if (userString) return JSON.parse(userString)?.user_id;
    } catch (e) { console.error("Lỗi đọc user ID:", e); }
    return null;
};

const AIAssistant = () => {
  // --- STATE QUẢN LÝ ĐÓNG/MỞ ---
  const [isOpen, setIsOpen] = useState(false); 

  // --- STATE TIN NHẮN ---
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('mi_mi_chat_history');
      return saved ? JSON.parse(saved) : [{ id: 1, sender: 'ai', text: 'Chào cậu! 👋 Tớ là MiMi.', time: 'Now' }];
    } catch (e) { return []; }
  });

  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  
  // --- STATE DANH SÁCH GIỌNG NÓI (Dùng cho Fallback) ---
  const [voiceList, setVoiceList] = useState([]);
  
  // --- REFS ---
  const fileInputRef = useRef(null); 
  const fileDocInputRef = useRef(null); 
  const chatEndRef = useRef(null);
  const textInputRef = useRef(null); 

  function getTime() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

  // --- USE EFFECT: AUTO SAVE & SCROLL ---
  useEffect(() => { localStorage.setItem('mi_mi_chat_history', JSON.stringify(messages)); }, [messages]);
  
  useEffect(() => { if(isOpen) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isOpen, loading, selectedImage]);

  // --- USE EFFECT: AUTO FOCUS ---
  useEffect(() => {
    if (isOpen && !loading) {
        setTimeout(() => { textInputRef.current?.focus(); }, 10);
    }
  }, [isOpen, loading]);

  // --- USE EFFECT: GLOBAL KEYDOWN ---
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
        if (isOpen && textInputRef.current && document.activeElement !== textInputRef.current) {
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                textInputRef.current.focus();
            }
        }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen]);

  // --- USE EFFECT: LOAD GIỌNG NÓI (Cho Fallback Client-side) ---
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setVoiceList(voices);
      }
    };
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // --- CÁC HÀM XỬ LÝ ---
  const clearHistory = () => {
    if (window.confirm("Xóa toàn bộ lịch sử chat?")) {
      localStorage.removeItem('mi_mi_chat_history');
      setMessages([{ id: Date.now(), sender: 'ai', text: 'Chào cậu! 👋 Tớ là MiMi.', time: getTime() }]);
    }
  };

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) return alert("Trình duyệt không hỗ trợ voice.");
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.start();
    setIsListening(true);
    
    recognition.onend = () => {
        setIsListening(false);
        textInputRef.current?.focus(); 
    };
    
    recognition.onresult = (e) => setInputValue(prev => prev + " " + e.results[0][0].transcript);
  };

  const handleImageSelect = (e) => {
    if (e.target.files[0]) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result);
      reader.readAsDataURL(e.target.files[0]);
    }
    textInputRef.current?.focus(); 
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: `📄 File: **${file.name}**`, time: getTime() }]);
    setLoading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    try {
        const token = localStorage.getItem("token");
        const res = await fetch('http://localhost:5000/api/generate-workspace', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await res.json();
        const reply = res.ok ? `✅ Đã tạo dự án **"${data.workspace_name}"**.` : `❌ Lỗi: ${data.message}`;
        setMessages(prev => [...prev, { id: Date.now()+1, sender: 'ai', text: reply, time: getTime() }]);
    } catch (e) { 
        setMessages(prev => [...prev, { id: Date.now()+1, sender: 'ai', text: "❌ Lỗi kết nối.", time: getTime() }]); 
    }
    setLoading(false);
    fileDocInputRef.current.value = "";
  };

  const sendMessage = async () => {
    if (!inputValue.trim() && !selectedImage) return;
    const newMsg = { id: Date.now(), sender: 'user', text: inputValue, image: selectedImage, time: getTime() };
    setMessages(prev => [...prev, newMsg]);
    
    const currentImg = selectedImage;
    setInputValue(''); setSelectedImage(null); setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            message: newMsg.text, 
            user_id: getUserId(), 
            history: messages.slice(-5),
            image: currentImg
        })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { id: Date.now()+1, sender: 'ai', text: data.reply, time: getTime() }]);
      
      // ============================================================
      // LOGIC MỚI: ƯU TIÊN PHÁT AUDIO TỪ SERVER (GIỌNG GOOGLE)
      // ============================================================
      if (data.audio) {
          try {
              // Phát file mp3 base64 từ server
              const audioSrc = `data:audio/mp3;base64,${data.audio}`;
              const audio = new Audio(audioSrc);
              audio.play().catch(err => console.error("Lỗi phát audio:", err));
          } catch (audioErr) {
              console.error("Lỗi xử lý audio server:", audioErr);
          }
      } else {
          // FALLBACK: NẾU SERVER KHÔNG TRẢ VỀ AUDIO (Hoặc lỗi) -> DÙNG CƠ CHẾ CŨ
          console.log("⚠️ Server không gửi audio, dùng giọng trình duyệt thay thế.");
          
          if ('speechSynthesis' in window) {
              window.speechSynthesis.cancel();
              const ut = new SpeechSynthesisUtterance(data.reply);

              // Tìm giọng nữ (Backup)
              const availableVoices = voiceList.length > 0 ? voiceList : window.speechSynthesis.getVoices();
              const vnVoices = availableVoices.filter(v => v.lang.includes('vi'));
              
              let targetVoice = vnVoices.find(v => 
                  v.name.includes("Google Tiếng Việt") || 
                  v.name.includes("HoaiMy") || 
                  v.name.includes("Linh") ||
                  v.name.includes("Female")
              );
              if (!targetVoice && vnVoices.length > 0) targetVoice = vnVoices[0];

              if (targetVoice) ut.voice = targetVoice;
              ut.lang = 'vi-VN';
              ut.rate = 1.1; 
              window.speechSynthesis.speak(ut);
          }
      }
      // ============================================================

    } catch (e) {
      setMessages(prev => [...prev, { id: Date.now(), sender: 'ai', text: '⚠️ Lỗi server.', time: getTime() }]);
    } finally { setLoading(false); }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
  };

  // --- RENDER LOGIC ---
  if (!isOpen) {
      return (
          <button className="ai-floating-btn" onClick={() => setIsOpen(true)}>
              <img src={aiLogo} className="ai-floating-icon" alt="AI" />
          </button>
      );
  }

  return (
    <div className="ai-floating-window">
      {/* HEADER */}
      <div className="ai-header">
        <div className="ai-header-left">
          <img src={aiLogo} style={{width: '32px', height: '32px', borderRadius: '50%'}} alt="AI"/>
          <div className="ai-header-info">
            <h2>MiMi Pro</h2>
            <p>Trợ lý ảo</p>
          </div>
        </div>
        <div className="window-controls">
          <button onClick={clearHistory} title="Xóa chat"><IoTrashOutline size={18}/></button>
          <button onClick={() => setIsOpen(false)} title="Thu nhỏ"><IoRemove size={22}/></button>
        </div>
      </div>

      {/* CHAT AREA */}
      <div className="chat-area">
        {messages.map(msg => (
          <div key={msg.id} className={`msg ${msg.sender}`}>
            {msg.sender === 'ai' && <div className="msg-avatar"><img src={aiLogo} alt="AI"/></div>}
            <div className="msg-body">
              {msg.image && <img src={msg.image} className="msg-image-preview" alt="Upload" />}
              {msg.text && <div className="msg-bubble"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown></div>}
              <span className="msg-time">{msg.time}</span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="msg ai">
            <div className="msg-avatar"><img src={aiLogo} alt="AI"/></div>
            <div className="msg-bubble typing"><span className="dot"></span><span className="dot"></span><span className="dot"></span></div>
          </div>
        )}
        <div ref={chatEndRef}></div>
      </div>

      {/* PREVIEW */}
      {selectedImage && (
        <div className="image-preview-container">
          <img src={selectedImage} alt="Preview" />
          <button onClick={() => setSelectedImage(null)} className="remove-img-btn"><IoCloseCircle /></button>
        </div>
      )}

      {/* INPUT AREA */}
      <div className="chat-input-area">
        <input type="file" ref={fileInputRef} style={{display:'none'}} accept="image/*" onChange={handleImageSelect} />
        <input type="file" ref={fileDocInputRef} style={{display:'none'}} accept=".pdf,.docx" onChange={handleDocUpload} />

        <button className="action-btn" onClick={() => fileDocInputRef.current.click()} title="Gửi file"><IoDocumentTextOutline size={18}/></button>
        <button className="action-btn" onClick={() => fileInputRef.current.click()} title="Gửi ảnh"><IoImageOutline size={18}/></button>
        
        <input 
          ref={textInputRef} 
          className="chat-input" 
          placeholder="Nhập..." 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          disabled={loading}
          autoFocus 
        />
        
        <button className={`action-btn ${isListening ? 'listening' : ''}`} onClick={handleVoiceInput} title="Nói">
            <FaMicrophone size={16} color={isListening ? 'red' : 'inherit'}/>
        </button>
        
        <button className="send-btn" onClick={sendMessage} disabled={!inputValue.trim() && !selectedImage}>
            <IoSend size={16}/>
        </button>
      </div>
    </div>
  );
};

export default AIAssistant;
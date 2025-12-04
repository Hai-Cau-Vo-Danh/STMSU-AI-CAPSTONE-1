import React, { useState, useEffect } from 'react';
import './Notes.css';
import { BsPlus, BsSearch, BsTrash, BsPencil, BsPin, BsPinFill, BsTag } from 'react-icons/bs';
import { IoClose } from 'react-icons/io5';
// import io from 'socket.io-client'; // Import trực tiếp
import { socket } from '../socket';

const getUserId = () => {
    try {
      const userString = localStorage.getItem("user");
      if (userString) return JSON.parse(userString)?.user_id;
    } catch (e) { console.error("Lỗi đọc user ID:", e); }
    return null;
};

const formatDate = (isoString) => {
    if (!isoString) return "Vừa xong";
    try {
        return new Date(isoString).toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    } catch (e) { return "Ngày không hợp lệ"; }
};

const Notes = () => {
  const [notes, setNotes] = useState([]); 
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [modalFormData, setModalFormData] = useState({
    title: '', content: '', tags: [], color: '#e0f2fe'
  });
  const [tagInput, setTagInput] = useState('');

  const colors = [
    { name: 'Blue', value: '#e0f2fe' }, { name: 'Yellow', value: '#fef3c7' },
    { name: 'Green', value: '#dcfce7' }, { name: 'Red', value: '#fecaca' },
    { name: 'Purple', value: '#e9d5ff' }, { name: 'Pink', value: '#fce7f3' }
  ];
  
  // --- HÀM TẢI DỮ LIỆU TỪ DB ---
  const fetchNotes = async () => {
      // Không set isLoading=true ở đây để tránh hiện tượng "nháy" loading khi update ngầm
      const userId = getUserId();
      if (!userId) return;
      try {
          const response = await fetch(`http://localhost:5000/api/notes?userId=${userId}`);
          if (!response.ok) throw new Error("Lỗi tải data");
          const data = await response.json();
          const formattedData = data.map(note => ({ ...note, date: formatDate(note.date) }));
          
          setNotes(formattedData); // Cập nhật state -> Giao diện tự thay đổi
          console.log("✅ Đã cập nhật danh sách ghi chú mới nhất!");
      } catch (err) {
          console.error(err);
      } finally {
          setIsLoading(false);
      }
  };

useEffect(() => {
    // 1. Tải dữ liệu lần đầu
    fetchNotes();

    // 2. Định nghĩa hàm xử lý khi có tin nhắn từ Server
    const handleNewNote = (data) => {
        console.log("🔔 REAL-TIME: AI vừa tạo note mới!", data);
        
        // Mẹo UX: Có thể hiện thông báo nhỏ (Toast) ở đây
        // alert(`AI vừa tạo ghi chú: ${data.title}`);
        
        // QUAN TRỌNG: Gọi hàm tải lại dữ liệu
        fetchNotes(); 
    };

    // 3. Lắng nghe sự kiện trên socket CHUNG
    // (Lưu ý: Việc join phòng đã được App.jsx làm rồi, ở đây chỉ cần lắng nghe)
    socket.on('new_note', handleNewNote);

    // 4. Cleanup: Tắt lắng nghe khi rời trang để tránh bị gọi nhiều lần
    return () => {
        socket.off('new_note', handleNewNote);
    };
  }, []);

  // (Các hàm xử lý Modal, Save, Delete... giữ nguyên như cũ)
  const filteredNotes = notes.filter(note =>
    (note.title && note.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (note.content && note.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (note.tags && note.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
  );
  const pinnedNotes = filteredNotes.filter(note => note.pinned);
  const unpinnedNotes = filteredNotes.filter(note => !note.pinned);
  
  const handleOpenCreateModal = () => { setModalFormData({ title: '', content: '', tags: [], color: '#e0f2fe' }); setTagInput(''); setIsCreating(true); };
  const handleOpenEditModal = (note) => { setModalFormData({ id: note.id, title: note.title, content: note.content, tags: note.tags || [], color: note.color || '#e0f2fe' }); setTagInput(''); setSelectedNote(null); setIsCreating(true); };
  const handleCloseModal = () => { setIsCreating(false); setSelectedNote(null); setIsSaving(false); setModalFormData({ title: '', content: '', tags: [], color: '#e0f2fe' }); setTagInput(''); };
  
  const handleSaveNote = async () => {
      setIsSaving(true);
      const userId = getUserId();
      const isEditing = !!modalFormData.id;
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing ? `http://localhost:5000/api/notes/${modalFormData.id}` : 'http://localhost:5000/api/notes';

      try {
          const response = await fetch(url, {
              method: method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...modalFormData, creator_id: userId, user_id: userId })
          });
          if (response.ok) {
              fetchNotes(); // Lưu xong tự tải lại luôn
              handleCloseModal();
          }
      } catch (err) { alert(err.message); } finally { setIsSaving(false); }
  };

  const handleDeleteNote = async (noteId) => {
      if (!window.confirm("Xóa ghi chú này?")) return;
      const userId = getUserId();
      try {
          await fetch(`http://localhost:5000/api/notes/${noteId}?userId=${userId}`, { method: 'DELETE' });
          fetchNotes(); // Xóa xong tải lại luôn
          handleCloseModal();
      } catch (err) { console.error(err); }
  };

  const handleTogglePin = async (note) => {
      const userId = getUserId();
      const newPinnedState = !note.pinned;
      try {
          await fetch(`http://localhost:5000/api/notes/${note.id}`, {
              method: 'PUT', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: userId, pinned: newPinnedState })
          });
          fetchNotes(); 
      } catch (err) { console.error(err); }
  };

  const handleAddTag = () => { if (tagInput.trim() && !modalFormData.tags.includes(tagInput.trim())) { setModalFormData({ ...modalFormData, tags: [...modalFormData.tags, tagInput.trim()] }); setTagInput(''); } };
  const handleRemoveTag = (tag) => { setModalFormData({ ...modalFormData, tags: modalFormData.tags.filter(t => t !== tag) }); };

  if (isLoading && notes.length === 0) return <div className="notes-container" style={{justifyContent:'center', alignItems:'center'}}>Đang tải...</div>;
  if (error) return <div style={{color:'red'}}>Lỗi: {error}</div>;

  return (
    <div className="notes-container">
      <div className="notes-header">
        <div className="notes-header-top">
          <h1 className="notes-title">📝 Ghi chú của tôi</h1>
          <button className="create-note-btn" onClick={handleOpenCreateModal}> <BsPlus /> Tạo mới </button>
        </div>
        <div className="notes-search"> 
          <BsSearch className="search-icon" />
          <input type="text" placeholder="Tìm kiếm..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
        </div>
      </div>

      <div className="notes-content">
        {pinnedNotes.length > 0 && (
          <div className="notes-section">
            <h3 className="section-title"> <BsPinFill className="section-icon" /> Đã ghim </h3>
            <div className="notes-grid">
              {pinnedNotes.map(note => (
                <div key={note.id} className="note-card" style={{ backgroundColor: note.color, borderLeftColor: '#f59e0b' }} onClick={() => setSelectedNote(note)}>
                  <div className="note-card-header">
                    <h3 className="note-card-title">{note.title}</h3>
                    <button className="pin-btn pinned" onClick={(e) => { e.stopPropagation(); handleTogglePin(note); }}> <BsPinFill /> </button>
                  </div>
                  <p className="note-card-content">{note.content}</p>
                  <div className="note-card-footer">
                    <div className="note-tags"> {note.tags.map((tag, i) => <span key={i} className="note-tag"><BsTag/> {tag}</span>)} </div>
                    <span className="note-date">{note.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {unpinnedNotes.length > 0 && (
          <div className="notes-section">
            <h3 className="section-title">Ghi chú khác</h3>
            <div className="notes-grid">
              {unpinnedNotes.map(note => (
                <div key={note.id} className="note-card" style={{ backgroundColor: note.color }} onClick={() => setSelectedNote(note)}>
                  <div className="note-card-header">
                    <h3 className="note-card-title">{note.title}</h3>
                    <button className="pin-btn" onClick={(e) => { e.stopPropagation(); handleTogglePin(note); }}> <BsPin /> </button>
                  </div>
                  <p className="note-card-content">{note.content}</p>
                  <div className="note-card-footer">
                    <div className="note-tags"> {note.tags.map((tag, i) => <span key={i} className="note-tag"><BsTag/> {tag}</span>)} </div>
                    <span className="note-date">{note.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {isCreating && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="note-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"> <h2>{modalFormData.id ? 'Sửa' : 'Tạo'} ghi chú</h2> <button className="close-btn" onClick={handleCloseModal}><IoClose/></button> </div>
            <div className="modal-body">
                <input className="note-title-input" placeholder="Tiêu đề" value={modalFormData.title} onChange={e=>setModalFormData({...modalFormData, title: e.target.value})} />
                <textarea className="note-content-input" rows={8} placeholder="Nội dung" value={modalFormData.content} onChange={e=>setModalFormData({...modalFormData, content: e.target.value})} />
                {/* Color Picker & Tags (Giữ nguyên logic cũ) */}
                <div className="color-picker"> {colors.map(c => <button key={c.value} onClick={()=>setModalFormData({...modalFormData, color:c.value})} style={{backgroundColor:c.value, width:30, height:30, borderRadius:'50%', border: modalFormData.color===c.value?'2px solid #333':'1px solid #ddd', margin:5}}></button>)} </div>
            </div>
            <div className="modal-footer"> <button className="save-btn" onClick={handleSaveNote}>Lưu</button> </div>
          </div>
        </div>
      )}
      
      {selectedNote && (
        <div className="modal-overlay" onClick={handleCloseModal}>
            <div className="note-modal" onClick={e=>e.stopPropagation()} style={{backgroundColor: selectedNote.color}}>
                <div className="modal-header"> 
                    <h2>{selectedNote.title}</h2> 
                    <div>
                        <button onClick={()=>handleOpenEditModal(selectedNote)} style={{marginRight:10}}><BsPencil/></button>
                        <button onClick={()=>handleDeleteNote(selectedNote.id)}><BsTrash/></button>
                    </div>
                </div>
                <div className="modal-body"><p style={{whiteSpace:'pre-wrap'}}>{selectedNote.content}</p></div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Notes;
import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { BsPlayFill, BsPauseFill, BsStopFill, BsSkipEndFill, BsGearFill, BsMicFill, BsMicMuteFill } from 'react-icons/bs';
import './StudyRoom.css';

// ---------- CONFIG & SOCKET ----------
const SOCKET_SERVER_URL = import.meta.env.VITE_API_URL_BASE || 'http://localhost:5000';
const peerConnectionConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }]
};
const socket = io(SOCKET_SERVER_URL, { transports: ['websocket', 'polling'], autoConnect: true });

// ---------- HELPER FUNCTIONS ----------
const getUserId = () => { try { const u = localStorage.getItem("user"); return u ? JSON.parse(u)?.user_id : null; } catch (e) { console.error("Error getting user ID:", e); return null; } };
const formatTime = (secondsValue) => { const mins = String(Math.floor(secondsValue / 60)).padStart(2, '0'); const secs = String(secondsValue % 60).padStart(2, '0'); return `${mins}:${secs}`; };
const playAlarm = () => { try { const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg"); audio.play().catch(e => console.warn("Audio playback failed:", e)); } catch (e) { console.error("Failed to play alarm:", e); } };
const getCurrentTimeString = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// ---------- TIMER DISPLAY COMPONENT (Keep as is) ----------
// THAY THẾ const TimerDisplay (khoảng dòng 17-35) BẰNG CODE NÀY:
const TimerDisplay = ({ mode, duration, timeLeft, isRunning, cycle, onStartPause, onReset, isConnected }) => {

  // Helper function
  const modeDisplay = (mode, cycle) => {
    switch (mode) {
      case 'focus': return `Tập trung (Vòng ${cycle}/4)`;
      case 'shortBreak': return 'Nghỉ ngắn';
      case 'longBreak': return 'Nghỉ dài';
      default: return 'Focus';
    }
  };

  return (
    <div className="pomodoro-display-wrapper"> {/* Wrapper mới */}
      <div className="pomodoro-tomato-bg"> {/* Giao diện từ Pomodoro.css */}
        <div className="pomodoro-digital-time">
          <h2>{formatTime(timeLeft)}</h2>
        </div>
      </div>
      <p className="pomodoro-mode-display">{modeDisplay(mode, cycle)}</p>

      {/* Các nút điều khiển đã được chuyển vào đây */}
      <div className="pomodoro-controls">
        {/* Nút Start/Pause (Main) */}
        <button
          onClick={onStartPause}
          className="main-btn"
          title={isRunning ? 'Tạm dừng' : 'Bắt đầu'}
          disabled={!isConnected || timeLeft <= 0}
        >
          {isRunning ? <BsPauseFill /> : <BsPlayFill />}
        </button>

        {/* Nút Reset (Stop) - Nút này sẽ lưu lịch sử */}
        <button
          onClick={onReset}
          title="Dừng & Reset"
          disabled={!isConnected}
          className="side-btn"
        >
          <BsStopFill />
        </button>
      </div>
    </div>
  );
};

// ---------- MAIN COMPONENT ----------
const StudyRoom = () => {
  // ----- App state -----
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [isInRoom, setIsInRoom] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [userInfo, setUserInfo] = useState({
    user_id: null,
    username: `Guest_${Math.floor(Math.random() * 1000)}`,
    avatar_url: null
  });
  const [usersInRoom, setUsersInRoom] = useState({}); // Map { sid: username }
  const [isPrivateRoom, setIsPrivateRoom] = useState(false);
  const [serverError, setServerError] = useState('');

  // ----- Timer State -----
  const [timerState, setTimerState] = useState({ mode: 'focus', duration: 25 * 60, timeLeft: 25 * 60, isRunning: false, cycle: 1 });

  // ----- Chat State -----
  const [chatMessages, setChatMessages] = useState([]); // Array of { id, type: 'chat'|'system', username?, text, time, sid? }
  const [chatInput, setChatInput] = useState('');
  const chatMessagesEndRef = useRef(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  // ----- WebRTC State & Refs -----
  const [isMuted, setIsMuted] = useState(false);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const audioRefs = useRef({});

  // ----- Input Refs -----
  const roomIdInputRef = useRef(null);
  const usernameInputRef = useRef(null);
  const secretInputRef = useRef(null);

  // ----- Load Username -----
  // ----- Load Username & Avatar -----
  useEffect(() => {
    const stored = localStorage.getItem('user');
    let info = {
      user_id: null,
      username: `Guest_${Math.floor(Math.random() * 1000)}`,
      avatar_url: null
    };

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        info = {
          user_id: parsed.user_id || null,
          username: parsed.username || info.username,
          avatar_url: parsed.avatar_url || null // <-- LẤY AVATAR
        };
      } catch { /* Dùng info mặc định */ }
    }

    setUserInfo(info);

    // Vẫn cập nhật input ref để user có thể sửa
    if (usernameInputRef.current) {
      usernameInputRef.current.value = info.username;
    }
  }, []);

  // ----- Auto-scroll Chat (ĐÃ CÓ SẴN) -----
  useEffect(() => {
    // Logic này sẽ tự động cuộn xuống tin nhắn mới nhất
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ----- Add System Message Helper -----
  const addSystemMessage = useCallback((text) => {
    setChatMessages(prev => [...prev, { type: 'system', text, time: getCurrentTimeString(), id: Date.now() }]);
  }, []);

  const fetchHistory = async () => {
    const userId = getUserId(); // Hàm này đã có sẵn
    if (!userId) {
      setHistoryError("Chưa đăng nhập.");
      return;
    }
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await fetch(`http://localhost:5000/api/pomodoro/history?userId=${userId}`);
      if (!response.ok) throw new Error(`Lỗi HTTP: ${response.status}`);
      const data = await response.json();
      setHistory(data);
    } catch (err) {
      console.error("Lỗi fetch Pomo history:", err);
      setHistoryError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  };


  // ----- WebRTC Functions -----
  const getMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      console.log('🎤 Microphone obtained');
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = stream;
      stream.getAudioTracks().forEach(track => track.enabled = !isMuted);
      return stream;
    } catch (err) {
      console.error('Error getting media', err);
      setServerError('Lỗi: không thể truy cập microphone.');
      addSystemMessage('⚠️ Không thể truy cập microphone!'); // Add to chat
      return null;
    }
  }, [isMuted, addSystemMessage]); // Include addSystemMessage

  const createPeerConnection = useCallback((targetSid) => {
    if (peerConnectionsRef.current[targetSid]) return peerConnectionsRef.current[targetSid];
    if (!localStreamRef.current) { console.warn('createPeerConnection called without localStream'); return null; } // Return null if no stream

    console.log('Creating RTCPeerConnection for', targetSid);
    const pc = new RTCPeerConnection(peerConnectionConfig);
    localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
    pc.onicecandidate = (event) => { if (event.candidate) socket.emit('signal', { room_id: roomId, target_sid: targetSid, signal: { candidate: event.candidate } }); };
    pc.ontrack = (event) => {
      console.log('ontrack from', targetSid);
      if (event.streams && event.streams[0]) {
        const audioEl = audioRefs.current[targetSid];
        if (audioEl) audioEl.srcObject = event.streams[0];
        else console.warn('Audio element ref not available yet for', targetSid);
      }
    };
    pc.onconnectionstatechange = () => console.log(`PC(${targetSid}) state:`, pc.connectionState);
    peerConnectionsRef.current[targetSid] = pc;
    return pc;
  }, [roomId]); // Removed localStreamRef dependency, check inside function instead

  const handleIncomingSignal = useCallback(async (data) => {
    const { sender_sid: remoteSid, signal } = data;
    if (!remoteSid) return;
    console.log('Received signal from', remoteSid);
    // Ensure stream exists before proceeding
    const stream = localStreamRef.current || await getMedia();
    if (!stream) return console.error("Cannot handle signal: Local stream unavailable.");

    let pc = peerConnectionsRef.current[remoteSid];
    if (!pc) pc = createPeerConnection(remoteSid);
    if (!pc) return console.error('Failed to get/create PC for', remoteSid);

    try {
      if (signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        if (signal.sdp.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { room_id: roomId, target_sid: remoteSid, signal: { sdp: pc.localDescription } });
          console.log('Sent answer to', remoteSid);
        }
      } else if (signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (err) { console.error('Error handling signal', err); }
  }, [createPeerConnection, getMedia, roomId]);

  const handleUserReady = useCallback(async (data) => {
    const { sid: targetSid, username: targetUsername } = data;
    if (!targetSid || targetSid === socket.id) return;
    console.log('User ready:', targetSid, targetUsername);
    const stream = localStreamRef.current || await getMedia();
    if (!stream) return console.warn('No local stream, cannot initiate to', targetSid);
    const pc = createPeerConnection(targetSid);
    if (!pc) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('signal', { room_id: roomId, target_sid: targetSid, signal: { sdp: pc.localDescription } });
      console.log('Offer sent to', targetSid);
    } catch (err) { console.error('Failed to create/send offer', err); }
  }, [createPeerConnection, getMedia, roomId]);

  // ----- Socket Event Wiring -----
  useEffect(() => {
    const handleConnect = () => { console.log('Socket connected', socket.id); setIsConnected(true); setServerError(''); };
    const handleDisconnect = (reason) => {
      console.log('Socket disconnected', reason);
      setIsConnected(false); setIsInRoom(false); setUsersInRoom({}); setServerError('Mất kết nối.');
      if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
      Object.values(peerConnectionsRef.current).forEach(pc => { try { pc.close(); } catch { } });
      peerConnectionsRef.current = {}; audioRefs.current = {};
      setTimerState({ mode: 'focus', duration: 25 * 60, timeLeft: 25 * 60, isRunning: false, cycle: 1 });
      setChatMessages([]); // Clear chat
    };
    const handleRoomJoined = async (data) => {
      console.log('room_joined', data);
      const rId = data.room_id;
      setIsInRoom(true); setRoomId(rId); setIsPrivateRoom(Boolean(data.is_private));

      // Sửa ở đây: data.users bây giờ là dict {sid: username}
      setUsersInRoom(data.users);

      setChatMessages([]); setServerError('');
      setTimerState(data.timer_state); // Dòng này giờ sẽ hoạt động
      addSystemMessage(`Đã vào phòng ${rId}. ${Boolean(data.is_private) ? '(Riêng tư)' : '(Công khai)'}`);

      const stream = await getMedia();
      if (stream) {
        addSystemMessage(`Microphone sẵn sàng.`);
        socket.emit('ready', { room_id: rId, username: userInfo.username });
      }
    };
    const handleUserJoined = (data) => {
      if (data.sid === socket.id) return;
      console.log('user_joined', data);

      // Server gửi về { sid: '...', user_info: { username: '...', avatar_url: '...' } }
      const name = data.user_info?.username || 'Người lạ';

      // Thêm user mới vào state với đầy đủ info
      setUsersInRoom(prev => ({
        ...prev,
        [data.sid]: data.user_info // <-- Lưu cả object info
      }));

      addSystemMessage(`${name} đã vào phòng.`);
    };
    // Logic này ĐÚNG, sẽ xóa user khỏi state khi server báo
    const handleUserLeft = (data) => {
      console.log('user_left', data);
      const sid = data?.sid;

      // --- SỬA Ở ĐÂY ---
      // Tên sẽ được lấy từ state, dựa trên sid
      const name = usersInRoom[sid] || data?.username || 'Một người';
      if (sid) {
        setUsersInRoom(prev => {
          const next = { ...prev };
          delete next[sid]; // Xóa bằng sid
          return next;
        });
        // --- KẾT THÚC SỬA ---

        if (peerConnectionsRef.current[sid]) { try { peerConnectionsRef.current[sid].close(); } catch { } delete peerConnectionsRef.current[sid]; }
        if (audioRefs.current[sid]) { try { audioRefs.current[sid].srcObject = null; } catch { } delete audioRefs.current[sid]; }
      }
      addSystemMessage(`${name} đã rời phòng.`);
    };

    const handleRoomUsersUpdate = (usernames) => {
      console.log('Room users updated', usernames);
      // Chuyển mảng username thành object
      const usersObject = usernames.reduce((acc, name) => {
        if (name !== userInfo.username) { // <-- ĐÃ SỬA
          acc[name] = name;
        }
        return acc;
      }, {});
      setUsersInRoom(usersObject);
    };

    const handleUserReadyEvent = (data) => {
      if (data.sid === socket.id) return;
      console.log('user_ready', data);
      setUsersInRoom(prev => ({ ...prev, [data.sid]: data.username || prev[data.sid] || 'Unknown' }));
      handleUserReady(data);
    };
    const handleSignalEvent = (data) => { handleIncomingSignal(data); };
    const handleTimerUpdate = (newTimerState) => {
      setTimerState(newTimerState);
      if (newTimerState.timeLeft === 0 && !newTimerState.isRunning) { console.log('Timer finished'); playAlarm(); }
    };
    const handleNewMessage = (data) => {
      setChatMessages(prev => [...prev, { type: 'chat', ...data, time: getCurrentTimeString(), id: Date.now() }]);
    };
    const handleErrorEvent = (err) => { console.error('Socket error', err); setServerError(err?.message || 'Lỗi server.'); addSystemMessage(`⚠️ Lỗi: ${err?.message || 'Không rõ'}`); };

    // Attach/Detach listeners
    socket.on('connect', handleConnect); socket.on('disconnect', handleDisconnect);
    socket.on('room_joined', handleRoomJoined); socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft); socket.on('user_ready', handleUserReadyEvent);
    socket.on('signal', handleSignalEvent); socket.on('timer_update', handleTimerUpdate);
    socket.on('new_message', handleNewMessage); socket.on('error', handleErrorEvent);
    return () => {
      socket.off('connect', handleConnect); socket.off('disconnect', handleDisconnect);
      socket.off('room_joined', handleRoomJoined); socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft); socket.off('user_ready', handleUserReadyEvent);
      socket.off('signal', handleSignalEvent); socket.off('timer_update', handleTimerUpdate);
      socket.off('new_message', handleNewMessage); socket.off('error', handleErrorEvent);
    };
  }, [userInfo, roomId, getMedia, handleIncomingSignal, handleUserReady, addSystemMessage, usersInRoom]);
  // ----- UI leave cleanup -----
  useEffect(() => { return () => { /* ... keep cleanup ... */ }; }, []);

  // ----- Action Handlers -----
  // ...
  const handleCreateRoom = () => {
    const enteredRoomId = roomIdInputRef.current?.value?.trim();
    // Lấy username từ input (nếu user sửa) hoặc từ state
    const enteredUsername = usernameInputRef.current?.value?.trim() || userInfo.username;
    const enteredSecret = secretInputRef.current?.value?.trim();

    if (!enteredRoomId || !enteredUsername) return setServerError('Vui lòng nhập ID phòng và Tên hiển thị.');
    if (!userInfo.user_id) return setServerError('Lỗi: Không tìm thấy User ID. Vui lòng đăng nhập lại.');

    setServerError(''); console.log(`Creating room: ${enteredRoomId}`);
    socket.emit('create_room', {
      room_id: enteredRoomId,
      username: enteredUsername,
      secret: enteredSecret || null,
      user_id: userInfo.user_id, // Gửi ID
      avatar_url: userInfo.avatar_url // <-- GỬI AVATAR
    });
  };
  const handleJoinRoom = () => {
    const enteredRoomId = roomIdInputRef.current?.value?.trim();
    const enteredUsername = usernameInputRef.current?.value?.trim() || userInfo.username;
    const enteredSecret = secretInputRef.current?.value?.trim();

    if (!enteredRoomId || !enteredUsername) return setServerError('Lỗi: Không tìm thấy User ID. Vui lòng đăng nhập lại.');
    if (!userInfo.user_id) return setServerError('Lỗi: Không tìm thấy User ID. Vui lòng đăng nhập lại.');

    setServerError(''); console.log(`Joining room: ${enteredRoomId}`);
    socket.emit('join_room', {
      room_id: enteredRoomId,
      username: enteredUsername,
      secret: enteredSecret || null,
      user_id: userInfo.user_id, // Gửi ID
      avatar_url: userInfo.avatar_url // <-- GỬI AVATAR
    });
  };
  // ========== HÀM ĐÃ ĐƯỢC SỬA LỖI ==========
  const handleLeaveRoom = useCallback(() => {
    console.log("Leaving room...");

    // BƯỚC 1: GỬI SỰ KIỆN LÊN SERVER TRƯỚC KHI DỌN DẸP
    if (socket.connected && roomId) {
      socket.emit('leave_room', { room_id: roomId });
    }

    // BƯỚC 2: Dọn dẹp local (giữ nguyên)
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(track => track.stop()); localStreamRef.current = null; }
    Object.values(peerConnectionsRef.current).forEach(pc => { try { pc.close(); } catch { } });
    peerConnectionsRef.current = {}; audioRefs.current = {};
    setIsInRoom(false); setRoomId(''); setUsersInRoom({}); setChatMessages([]);
    setServerError('Đã rời phòng.');
    setTimerState({ mode: 'focus', duration: 25 * 60, timeLeft: 25 * 60, isRunning: false, cycle: 1 });

  }, [roomId]); // <-- BƯỚC 3: Thêm 'roomId' vào đây
  // ==========================================

  const handleStart = useCallback(() => { socket.emit('start_timer', { room_id: roomId }); }, [roomId]);
  const handlePause = useCallback(() => { socket.emit('pause_timer', { room_id: roomId }); }, [roomId]);
  const handleReset = useCallback(() => { socket.emit('reset_timer', { room_id: roomId }); }, [roomId]);
  const handleSendMessage = useCallback(() => {
    if (!chatInput.trim() || !roomId || !isConnected) return;
    socket.emit('send_message', { room_id: roomId, message: chatInput.trim() });
    setChatInput('');
  }, [chatInput, roomId, isConnected]);
  const handleToggleMute = useCallback(() => {
    if (!localStreamRef.current) return console.warn("No local stream.");
    const audioTracks = localStreamRef.current.getAudioTracks();
    if (audioTracks.length > 0) {
      setIsMuted(currentMuteState => {
        const newState = !currentMuteState; audioTracks[0].enabled = !newState;
        console.log(newState ? "🎤 Mic Muted" : "🎤 Mic Unmuted");
        return newState;
      });
    } else console.warn("No audio track found.");
  }, []);

  // ----- Assign audio element refs -----
  const setAudioRef = (sid, el) => { if (el) audioRefs.current[sid] = el; else delete audioRefs.current[sid]; };

  // ----- RENDER -----
  return (
    <div className="study-room-container">
      {!isInRoom ? (
        <div className="study-room-entry">
          <div className="entry-card">
            <h1>Study Room</h1>
            <p>Trạng thái: {isConnected ? '🟢 Đã kết nối' : '🔴 Mất kết nối'}</p>
            {serverError && <p className="server-message entry-message">{serverError}</p>}
            <h2>Tham gia hoặc Tạo phòng</h2>
            <p className="entry-subtitle">Nhập thông tin để bắt đầu phiên học nhóm!</p>
           <div className="entry-form-group"> <label htmlFor="username">Tên hiển thị:</label> <input ref={usernameInputRef} type="text" id="username" placeholder="Tên của bạn..." defaultValue={userInfo.username} className="entry-input" /> </div>
            <div className="entry-form-group"> <label htmlFor="roomId">ID Phòng:</label> <input ref={roomIdInputRef} type="text" id="roomId" placeholder="Nhập ID phòng (VD: HOCNHOM)" className="entry-input" /> </div>
            <div className="entry-form-group"> <label htmlFor="secret">Mã bí mật (nếu có):</label> <input ref={secretInputRef} type="password" id="secret" placeholder="Để trống nếu phòng công khai" className="entry-input" /> </div>
            <div className="entry-button-group"> <button onClick={handleJoinRoom} disabled={!isConnected} className="entry-btn join-btn">Tham gia</button> <button onClick={handleCreateRoom} disabled={!isConnected} className="entry-btn create-btn">Tạo phòng</button> </div>
          </div>
        </div>
      ) : (
        <div className="study-room-main-interface">
          <div className="left-panel">
            <div className="room-info"> <h2>Phòng: {roomId} {isPrivateRoom ? '(🔒)' : '(🌍)'}</h2> <p>Trạng thái: {isConnected ? '🟢 Đã kết nối' : '🔴 Mất kết nối'}</p> </div>
            <TimerDisplay {...timerState}
              isConnected={isConnected}
              onStartPause={() => timerState.isRunning ? handlePause() : handleStart()}
              onReset={handleReset} />
            <div className="timer-controls">

            </div>
            <div className="member-list-section panel">
              <h3>Thành viên ({Object.keys(usersInRoom).length + 1})</h3>
              <ul className="member-list">
                {/* --- MỤC CỦA BẠN --- */}
                <li key="you" className="member-item self">
                  <span className="member-avatar">
                    {userInfo.avatar_url ? (
                      <img src={userInfo.avatar_url} alt="Bạn" />
                    ) : (
                      '👤'
                    )}
                  </span>
                  <span className="member-name">{userInfo.username} (Bạn)</span>
                  <button onClick={handleToggleMute} disabled={!localStreamRef.current} className="mute-btn"> {isMuted ? <BsMicMuteFill /> : <BsMicFill />} </button>
                </li>

                {/* --- MỤC CỦA NGƯỜI KHÁC --- */}
                {Object.entries(usersInRoom).map(([sid, info]) => (
                  <li key={sid} className="member-item">
                    <span className="member-avatar">
                      {info.avatar_url ? (
                        <img src={info.avatar_url} alt={info.username} />
                      ) : (
                        '👤'
                      )}
                    </span>
                    <span className="member-name">{info.username || `User...`}</span>
                    {peerConnectionsRef.current[sid] ? ' 🔊' : ' (Đang kết nối...)'}
                  </li>
                ))}
              </ul>
            </div>
            {/* ===== DÁN KHỐI CODE MỚI NÀY VÀO ĐÂY ===== */}
            <div className="history-panel-container panel">
              <button
                className="history-toggle-btn-room"
                onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory(); }}
              >
                {showHistory ? 'Ẩn Lịch sử' : 'Xem Lịch sử Focus'}
              </button>

              {showHistory && (
                <div className="pomodoro-history-room">
                  {historyLoading && <p>Đang tải...</p>}
                  {historyError && <p className="error-msg">Lỗi: {historyError}</p>}
                  {!historyLoading && !historyError && history.length === 0 && <p>Chưa có dữ liệu.</p>}
                  {!historyLoading && !historyError && history.length > 0 && (
                    <ul>
                      {history.map(s => (
                        <li key={s.id}>
                          {new Date(s.endTime).toLocaleString('vi-VN', {
                            day: '2-digit', month: '2-digit',
                            hour: '2-digit', minute: '2-digit'
                          })}
                          - {s.duration} phút
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            {/* ===== KẾT THÚC KHỐI CODE MỚI ===== */}
            <div className="hidden-audio-streams"> {Object.keys(usersInRoom).map((sid) => (<audio key={sid} ref={(el) => setAudioRef(sid, el)} autoPlay playsInline />))} </div>
            {/* Nút rời phòng đặt ở cuối left-panel */}
            <button onClick={handleLeaveRoom} className="leave-btn danger">Rời phòng</button>
          </div>
          <div className="right-panel chat-panel">
            <h3>Trò chuyện</h3>
            <div className="chat-messages">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`message-item type-${msg.type} ${msg.sid === socket.id ? 'my-message' : 'other-message'}`}>

                  {/* Tin nhắn chat (của bạn hoặc người khác) */}
                  {msg.type === 'chat' && (
                    <>
                      {/* Avatar người gửi */}
                      <span className="message-avatar">
                        {msg.avatar_url ? (
                          <img src={msg.avatar_url} alt={msg.username} />
                        ) : (
                          '👤'
                        )}
                      </span>

                      <div className="message-content">
                        <span className="message-sender">{msg.username}{msg.sid === socket.id ? ' (Bạn)' : ''}</span>
                        <p className="message-text">{msg.message}</p>
                        <span className="message-time">{msg.time}</span>
                      </div>
                    </>
                  )}

                  {/* Tin nhắn hệ thống (vào/rời phòng) */}
                  {msg.type === 'system' && (
                    <p className="system-text">{msg.text}</p>
                  )}
                </div>
              ))}
              {/* Đây là thẻ div giúp tự động cuộn (ĐÃ CÓ SẴN) */}
              <div ref={chatMessagesEndRef} />
            </div>
            <div className="chat-input-area">
              <input type="text" placeholder="Nhập tin nhắn..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} disabled={!isConnected} className="entry-input" />
              <button onClick={handleSendMessage} disabled={!isConnected || !chatInput.trim()} className="entry-btn join-btn"> Gửi </button>
            </div>
          </div>
          {/* Nút rời phòng đã được chuyển sang left-panel cho hợp lý */}
        </div>
      )}
    </div>
  );
};

export default StudyRoom;
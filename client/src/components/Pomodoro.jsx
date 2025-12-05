import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from 'chart.js';
import { 
  BsPlayFill, BsPauseFill, BsStopFill, BsSkipEndFill, BsGearFill, 
  BsCardChecklist, BsTrash, BsMusicNoteBeamed, BsFillVolumeUpFill, BsFillVolumeMuteFill, BsBarChartFill 
} from 'react-icons/bs';
import { IoClose } from 'react-icons/io5';
import './Pomodoro.css'; 
import { workspaceService } from '../services/workspaceService'; 
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { usePopper } from 'react-popper';
import avt from "../assets/Trangchu/avt.png"; 

ChartJS.register(ArcElement, Tooltip, Legend, Title);

// (Các hằng số và hàm helper giữ nguyên logic cũ)
const DEFAULT_SETTINGS = {
    focus: 25,
    shortBreak: 5,
    longBreak: 15,
    cyclesBeforeLongBreak: 4,
    autoStartBreaks: false,
    autoStartFocus: false,
};
const playAlarm = () => {
    try {
        const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg"); 
        audio.play().catch(e => console.warn("Audio playback failed:", e)); 
    } catch (e) {
        console.error("Failed to play alarm:", e);
    }
};
const getUserId = () => {
    try { const u = localStorage.getItem("user"); return u ? JSON.parse(u)?.user_id : null; }
    catch (e) { console.error("Error getting user ID:", e); return null; }
};
const soundOptions = [
    { id: 'none', name: 'Tắt', url: null },
    { id: 'lofi', name: 'Lofi Hip Hop', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' }, 
    { id: 'rain', name: 'Tiếng mưa', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' }, 
    { id: 'cafe', name: 'Quán Cafe', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' }, 
];

// (Component PomodoroStats giữ nguyên logic)
const PomodoroStats = () => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const chartColors = [
      '#667eea', '#f59e0b', '#10b981', '#ec4899', 
      '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'
  ];

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const stats = await workspaceService.getPomodoroStats(); 
        
        if (stats.length === 0) {
          setChartData(null); 
          return;
        }

        const labels = stats.map(s => s.task_name);
        const dataPoints = stats.map(s => s.total_minutes);

        setChartData({
          labels: labels,
          datasets: [
            {
              label: 'Số phút tập trung',
              data: dataPoints,
              backgroundColor: chartColors.slice(0, dataPoints.length),
              borderColor: 'var(--bg-secondary-color)',
              borderWidth: 2,
            },
          ],
        });
        
      } catch (err) {
        console.error("Lỗi tải Pomodoro stats:", err);
        setError("Không thể tải thống kê.");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return <div className="spinner-small" style={{margin: '20px auto'}}></div>;
  }
  if (error) {
    return <p className="error-msg">{error}</p>;
  }
  if (!chartData) {
    return <p>Không có dữ liệu thống kê để hiển thị.</p>;
  }

  return (
    <div className="stats-chart-container">
      <Pie 
        data={chartData} 
        options={{
          responsive: true,
          plugins: {
            legend: {
              position: 'top',
              labels: { color: 'var(--text-color)' }
            },
            title: {
              display: true,
              text: 'Phân bổ thời gian tập trung',
              color: 'var(--text-color)',
              font: { size: 16 }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  let label = context.label || '';
                  if (label) {
                    label += ': ';
                  }
                  if (context.parsed !== null) {
                    label += `${context.parsed} phút`;
                  }
                  return label;
                }
              }
            }
          }
        }} 
      />
    </div>
  );
};


const Pomodoro = () => {
    // (Giữ nguyên toàn bộ State và Logic cũ)
    const [settings, setSettings] = useState(() => {
        try {
            const saved = localStorage.getItem('pomodoroSettings');
            return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
        } catch {
            return DEFAULT_SETTINGS;
        }
    });
    const [showSettings, setShowSettings] = useState(false);
    const [mode, setMode] = useState('focus'); 
    const [timeLeft, setTimeLeft] = useState(settings.focus * 60);
    const [isRunning, setIsRunning] = useState(false);
    const [cycle, setCycle] = useState(1); 
    const intervalRef = useRef(null); 
    const sessionStartTimeRef = useRef(null); 
     const [history, setHistory] = useState([]);
     const [historyLoading, setHistoryLoading] = useState(false);
     const [historyError, setHistoryError] = useState(null);
     const [showHistory, setShowHistory] = useState(false); 
    const [selectedTask, setSelectedTask] = useState(null); 
    const [showTaskModal, setShowTaskModal] = useState(false); 
    const [modalLoading, setModalLoading] = useState(false); 
    
    const [modalTaskGroups, setModalTaskGroups] = useState({ 
        overdue: [],
        today: [],
        upcoming: [],
        no_due_date: [] 
    });
    
    const [showAudioPanel, setShowAudioPanel] = useState(false);
    const [currentSound, setCurrentSound] = useState(soundOptions[0]);
    const [volume, setVolume] = useState(0.5); 
    const audioRef = useRef(null); 


    // ----- Effects (giữ nguyên) -----
    useEffect(() => {
      document.title = `${formatTime(timeLeft)} - ${modeDisplay()} | Pomodoro`;
        if (isRunning && timeLeft > 0) {
            intervalRef.current = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && isRunning) {
            clearInterval(intervalRef.current);
            setIsRunning(false); 
            playAlarm();
            handleSessionEnd(); 
        }
        return () => clearInterval(intervalRef.current);
    }, [isRunning, timeLeft]);

     useEffect(() => {
         fetchHistory();
     }, []); 

    useEffect(() => {
      const audioEl = audioRef.current;
      if (!audioEl) return;
      if (currentSound.url && isRunning && mode === 'focus') {
        audioEl.src = currentSound.url;
        audioEl.volume = volume;
        audioEl.loop = true;
        audioEl.play().catch(e => console.warn("Audio autoplay bị chặn:", e));
      } else {
        audioEl.pause();
      }
    }, [currentSound, isRunning, mode, volume]); 

    const handleVolumeChange = (e) => {
      const newVolume = parseFloat(e.target.value);
      setVolume(newVolume);
      if (audioRef.current) {
        audioRef.current.volume = newVolume;
      }
    };


    // (Tất cả các hàm logic xử lý timer, session, api... GIỮ NGUYÊN)
    const startTimer = () => {
        if (timeLeft <= 0) return; 
        sessionStartTimeRef.current = new Date(); 
        setIsRunning(true);
    };

    const pauseTimer = () => {
        clearInterval(intervalRef.current);
        setIsRunning(false);
    };

    const stopAndResetTimer = () => {
        clearInterval(intervalRef.current);
        const wasRunningFocus = isRunning && mode === 'focus';
        const startTime = sessionStartTimeRef.current;
        if (wasRunningFocus && startTime) {
            const endTime = new Date();
            const durationToSave = settings.focus; 
            saveSession(startTime, endTime, durationToSave, 'focus'); 
            fetchHistory(); 
        }
        setIsRunning(false);
        setMode('focus');
        setCycle(1);
        setTimeLeft(settings.focus * 60);
        sessionStartTimeRef.current = null; 
        setSelectedTask(null); 
    };

    const handleSessionEnd = () => {
        const finishedMode = mode; 
        const startTime = sessionStartTimeRef.current; 
        sessionStartTimeRef.current = null; 
        if (finishedMode === 'focus' && startTime) {
            const endTime = new Date();
            const durationMinutes = settings.focus;
            saveSession(startTime, endTime, durationMinutes, 'focus');
            fetchHistory(); 
        }
        let nextMode = 'focus';
        let nextTime = settings.focus * 60;
        let nextCycle = cycle;
        if (finishedMode === 'focus') {
            if (cycle >= settings.cyclesBeforeLongBreak) {
                nextMode = 'longBreak';
                nextTime = settings.longBreak * 60;
                nextCycle = 1; 
            } else {
                nextMode = 'shortBreak';
                nextTime = settings.shortBreak * 60;
                 nextCycle = cycle + 1; 
            }
        } else { 
            nextMode = 'focus';
            nextTime = settings.focus * 60;
             nextCycle = cycle;
        }
        setMode(nextMode);
        setTimeLeft(nextTime);
        setCycle(nextCycle);
        if (nextMode === 'focus' && settings.autoStartFocus) {
            startTimer();
        } else if ((nextMode === 'shortBreak' || nextMode === 'longBreak') && settings.autoStartBreaks) {
            startTimer();
        } else {
             setIsRunning(false); 
        }
    };
    
    const handleSkip = () => {
        if (!window.confirm(`Bạn có muốn bỏ qua phiên ${modeDisplay()} hiện tại?`)) return;
        clearInterval(intervalRef.current);
        setIsRunning(false); 
        playAlarm(); 
        const finishedMode = mode;
        const startTime = sessionStartTimeRef.current;
        if (finishedMode === 'focus' && startTime) {
             const endTime = new Date();
             let durationMinutes = 0;
             switch(finishedMode) {
                 case 'focus': durationMinutes = settings.focus; break;
                 default: durationMinutes = settings.focus;
             }
             if (durationMinutes > 0 && finishedMode === 'focus') {
                 saveSession(startTime, endTime, durationMinutes, 'focus'); 
                 fetchHistory(); 
             }
        }
        handleSessionEnd(); 
    };

     const saveSession = async (startTime, endTime, durationMinutes, type) => {
         const userId = getUserId();
         if (!userId) {
             console.error("Cannot save session: User ID not found.");
             return;
         }
         const taskIdString = selectedTask ? selectedTask.id : null;
         try {
             const data = await workspaceService.savePomodoroSession({
                 userId: userId,
                 startTime: startTime.toISOString(), 
                 endTime: endTime.toISOString(),     
                 duration: durationMinutes,
                 type: type,
                 taskId: taskIdString 
             });
             if (type === 'focus' && data.new_total_tomatoes) {
                 alert("Hoàn thành phiên tập trung!\nBạn nhận được +1 🍅");
             }
         } catch (error) {
             console.error("Error saving Pomodoro session:", error);
             setHistoryError(`Lỗi lưu session: ${error.message}`);
         }
     };

     const fetchHistory = async () => {
         setHistoryLoading(true);
         setHistoryError(null);
         try {
             const data = await workspaceService.getPomodoroHistory();
             setHistory(data);
         } catch (err) {
             console.error("Lỗi fetch Pomo history:", err);
             setHistoryError(err.message);
         } finally {
             setHistoryLoading(false);
         }
     };

    const handleSettingsChange = (e) => {
        const { name, value, type, checked } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : parseInt(value, 10) || 0
        }));
    };

    const saveSettings = () => {
        localStorage.setItem('pomodoroSettings', JSON.stringify(settings));
        setShowSettings(false);
        if (!isRunning && mode === 'focus') {
             setTimeLeft(settings.focus * 60);
        }
    };
    
    const handleOpenTaskModal = async () => {
      setModalLoading(true);
      setShowTaskModal(true);
      try {
        const data = await workspaceService.getMyTasks(); 
        setModalTaskGroups({
            overdue: data.overdue || [],
            today: data.today || [],
            upcoming: data.upcoming || [],
            no_due_date: data.no_due_date || []
        });
      } catch (err) {
        console.error("Lỗi tải 'My Tasks' cho Modal:", err);
      } finally {
        setModalLoading(false);
      }
    };
    
    const handleSelectTask = (task) => {
      setSelectedTask(task);
      setShowTaskModal(false);
    };
    
    const clearSelectedTask = (e) => {
      e.stopPropagation(); 
      setSelectedTask(null);
    };

    const formatTime = (secondsValue) => {
        const mins = String(Math.floor(secondsValue / 60)).padStart(2, '0');
        const secs = String(secondsValue % 60).padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const modeDisplay = () => {
        switch (mode) {
            case 'focus': return `Tập trung (Vòng ${cycle}/${settings.cyclesBeforeLongBreak})`;
            case 'shortBreak': return 'Nghỉ ngắn';
            case 'longBreak': return 'Nghỉ dài';
            default: return 'Focus';
        }
    };


    // ----- RENDER (THAY ĐỔI LỚN VỀ CẤU TRÚC HTML) -----
    return (
        <div className="pomodoro-container">
            <audio ref={audioRef} />

            {/* --- 1. Top Action Buttons (Nhóm nút trên cùng) --- */}
            <div className="pomodoro-header-actions">
                <button className="header-action-btn" onClick={() => setShowSettings(true)}>
                    <BsGearFill /> Cài đặt
                </button>
                <button className="header-action-btn" onClick={() => setShowAudioPanel(!showAudioPanel)}>
                    <BsMusicNoteBeamed /> Âm thanh
                </button>
                <button className="header-action-btn" onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory(); }}>
                    <BsBarChartFill /> {showHistory ? 'Đóng TK' : 'Thống kê'}
                </button>
            </div>

            {/* --- 2. Main Card (Phần hiển thị chính) --- */}
            <div className="pomodoro-main-card">
                 {/* Trạng thái (Vd: Tập trung Vòng 1/4) */}
                 <h2 className="pomodoro-status-text">{modeDisplay()}</h2>

                 {/* Đồng hồ hiển thị (Hộp đen số vàng) */}
                 <div className="pomodoro-timer-display">
                     {formatTime(timeLeft)}
                 </div>

                 {/* Các nút điều khiển */}
                 <div className="pomodoro-controls">
                    {/* Nút Stop */}
                    <button 
                        className="control-btn secondary" 
                        onClick={stopAndResetTimer} 
                        title="Dừng & Reset" 
                        disabled={!isRunning && timeLeft === settings[mode]*60}
                    >
                        <BsStopFill />
                    </button>

                    {/* Nút Play/Pause (Hình cà chua) */}
                    <button 
                        onClick={isRunning ? pauseTimer : startTimer} 
                        className="control-btn primary-tomato" 
                        title={isRunning ? 'Tạm dừng' : 'Bắt đầu'}
                    >
                        {isRunning ? <BsPauseFill className="tomato-icon" /> : <BsPlayFill className="tomato-icon" />}
                    </button>

                    {/* Nút Skip */}
                    <button 
                        className="control-btn secondary" 
                        onClick={handleSkip} 
                        title="Bỏ qua phiên" 
                        disabled={!isRunning && timeLeft === settings[mode]*60}
                    >
                        <BsSkipEndFill />
                    </button>
                </div>
            </div>

            {/* --- 3. Task Selector (Thanh chọn việc phía dưới) --- */}
            <div className="pomodoro-task-bar">
                <div 
                    className={`task-selector-dashed ${selectedTask ? 'has-task' : ''}`} 
                    onClick={handleOpenTaskModal} 
                    title={selectedTask ? selectedTask.title : "Chọn công việc"}
                >
                    <div className="left-content">
                        <BsCardChecklist className="task-icon" />
                        <span className="task-text">
                            {selectedTask 
                                ? <><span className="label">Đang làm:</span> {selectedTask.title}</>
                                : "Đang làm gì? Bấm để chọn việc..."
                            }
                        </span>
                    </div>
                    {selectedTask && (
                        <button className="task-clear-btn-mini" onClick={clearSelectedTask}>
                            <IoClose />
                        </button>
                    )}
                </div>
            </div>


            {/* --- Panels: Âm thanh & Lịch sử (Hiển thị có điều kiện bên dưới) --- */}
            <div className="pomodoro-panels-area">
                {showAudioPanel && (
                <div className="audio-panel panel-modern">
                    <h3>Âm thanh môi trường</h3>
                    <div className="sound-options">
                    {soundOptions.map(sound => (
                        <button
                        key={sound.id}
                        className={`sound-option ${currentSound.id === sound.id ? 'active' : ''}`}
                        onClick={() => setCurrentSound(sound)}
                        >
                        {sound.name}
                        </button>
                    ))}
                    </div>
                    <div className="volume-control">
                    <BsFillVolumeMuteFill />
                    <input
                        type="range" min="0" max="1" step="0.05" value={volume} onChange={handleVolumeChange} className="volume-slider"
                    />
                    <BsFillVolumeUpFill />
                    </div>
                </div>
                )}

                {showHistory && (
                    <div className="pomodoro-history panel-modern">
                        <h3>Thống kê Tập trung</h3>
                        <PomodoroStats />
                        <h3 style={{marginTop: '20px'}}>Lịch sử phiên Focus</h3>
                        {historyLoading && <div className="spinner-small"></div>}
                        {historyError && <p className="error-msg">Lỗi: {historyError}</p>}
                        {!historyLoading && !historyError && history.length === 0 && <p>Chưa có dữ liệu.</p>}
                        {!historyLoading && !historyError && history.length > 0 && (
                            <ul className="history-list">
                                {history.map(s => {
                                    let actualDurationText = `${s.duration} phút`; 
                                    try {
                                        const start = new Date(s.startTime);
                                        const end = new Date(s.endTime);
                                        const diffSeconds = Math.round((end - start) / 1000); 
                                        if (diffSeconds >= 0 && diffSeconds < (s.duration * 60 * 2)) { 
                                            const actualMinutes = Math.floor(diffSeconds / 60);
                                            const actualSeconds = diffSeconds % 60;
                                            actualDurationText = `${actualMinutes}p ${actualSeconds}s`; 
                                        }
                                    } catch (e) { console.error("Error calculating actual duration:", e); }
                                    
                                    return (
                                        <li key={s.id}>
                                            <span className="time">{new Date(s.endTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>
                                            <span className="duration">{actualDurationText}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                )}
            </div>


            {/* --- Settings Modal (Logic cũ, Style mới) --- */}
            {showSettings && (
                <div className="settings-modal-overlay" onClick={() => setShowSettings(false)}>
                    <div className="settings-modal panel-modern" onClick={(e) => e.stopPropagation()}>
                        <h3>Cài đặt Pomodoro</h3>
                        <div className="setting-group">
                            <div className="setting-item">
                                <label htmlFor="focus">Tập trung (phút)</label>
                                <input type="number" id="focus" name="focus" min="1" value={settings.focus} onChange={handleSettingsChange} />
                            </div>
                            <div className="setting-item">
                                <label htmlFor="shortBreak">Nghỉ ngắn</label>
                                <input type="number" id="shortBreak" name="shortBreak" min="1" value={settings.shortBreak} onChange={handleSettingsChange} />
                            </div>
                            <div className="setting-item">
                                <label htmlFor="longBreak">Nghỉ dài</label>
                                <input type="number" id="longBreak" name="longBreak" min="1" value={settings.longBreak} onChange={handleSettingsChange} />
                            </div>
                        </div>
                         <div className="setting-item full-width">
                            <label htmlFor="cyclesBeforeLongBreak">Số vòng trước khi Nghỉ dài:</label>
                            <input type="number" id="cyclesBeforeLongBreak" name="cyclesBeforeLongBreak" min="1" value={settings.cyclesBeforeLongBreak} onChange={handleSettingsChange} />
                        </div>
                        <div className="setting-item checkbox">
                            <input type="checkbox" id="autoStartBreaks" name="autoStartBreaks" checked={settings.autoStartBreaks} onChange={handleSettingsChange} />
                            <label htmlFor="autoStartBreaks">Tự động bắt đầu Nghỉ</label>
                        </div>
                        <div className="setting-item checkbox">
                            <input type="checkbox" id="autoStartFocus" name="autoStartFocus" checked={settings.autoStartFocus} onChange={handleSettingsChange} />
                            <label htmlFor="autoStartFocus">Tự động bắt đầu Tập trung</label>
                        </div>
                        <div className="settings-actions">
                            <button onClick={() => setShowSettings(false)}>Hủy</button>
                            <button onClick={saveSettings} className="save">Lưu Cài đặt</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* --- Task Selection Modal (Logic cũ) --- */}
            {showTaskModal && (
              <div className="modal-overlay" onClick={() => setShowTaskModal(false)}>
                <div className="task-modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="task-modal-header">
                    <h3>Chọn công việc</h3>
                    <button className="close-modal-btn" onClick={() => setShowTaskModal(false)}>
                      <IoClose />
                    </button>
                  </div>
                  <div className="task-modal-list">
                    {modalLoading ? (
                      <div className="loading-state"><div className="spinner-small"></div></div>
                    ) : (
                      <>
                        {Object.entries(modalTaskGroups).map(([groupName, groupTasks]) => (
                          groupTasks.length > 0 && (
                            <div key={groupName} className="task-group">
                              <h4>
                                {groupName === 'overdue' ? 'Quá hạn' : 
                                 groupName === 'today' ? 'Hôm nay' : 
                                 groupName === 'upcoming' ? 'Sắp tới' : 
                                 'Không có ngày hạn'}
                              </h4>
                              {groupTasks.map(task => (
                                <div 
                                  key={task.id} 
                                  className="task-modal-item"
                                  onClick={() => handleSelectTask(task)}
                                >
                                  <span className="task-title">{task.title}</span>
                                  <span className="task-origin">{task.workspace_name}</span>
                                </div> 
                              ))}
                            </div>
                          )
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            
        </div>
    );
};

export default Pomodoro;
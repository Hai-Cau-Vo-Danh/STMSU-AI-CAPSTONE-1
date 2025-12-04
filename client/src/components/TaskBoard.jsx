import React, { useState, useEffect } from 'react';
import TaskCard from './TaskCard';
import './TaskBoard.css';
import { BsPlus, BsThreeDots, BsSearch, BsTag } from 'react-icons/bs';
import { IoClose, IoSparkles } from 'react-icons/io5';

// --- 1. Import Socket chung ---
import { socket } from '../socket'; 

// --- 2. Import DnD Kit ---
import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    useDroppable
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- COMPONENT CON: Item có thể kéo ---
const SortableTaskItem = ({ task, columnId, openEditModal }) => { 
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ 
        id: task.id,
        data: { columnId: columnId, taskId: task.id }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    // Format ngày hiển thị
    const deadlineString = task.deadline && typeof task.deadline === 'string' 
                            ? task.deadline.split('T')[0] 
                            : task.deadline;
    const displayDate = deadlineString ? new Date(deadlineString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '';

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            className={`draggable-task-wrapper ${isDragging ? 'dragging' : ''}`}
        >
            <TaskCard 
                task={{ ...task, date: displayDate }} 
                onEditClick={() => openEditModal(task)} 
                {...listeners} 
            />
        </div>
    );
};

// --- COMPONENT CON: Vùng thả (Cột) ---
function DroppableTaskColumn({ columnId, children, isOver }) {
  const { setNodeRef } = useDroppable({
    id: columnId, 
    data: { type: 'column' }
  });

  return (
    <div ref={setNodeRef} className={`column-content ${isOver ? 'droppable-over-column' : ''}`}>
      {children}
    </div>
  );
}

// --- COMPONENT CON: Cột Task ---
const TaskColumn = ({ columnId, title, tasksCount, tasks, openCreateModal, openEditModal }) => { 
    return (
        <div className="task-column">
            <div className="column-header">
                <div className="column-title-wrapper">
                    <h3 className="column-title">{title}</h3>
                    <span className="column-count">{tasksCount}</span>
                </div>
                <div className="column-actions">
                    <button className="column-btn add-btn" onClick={() => openCreateModal(columnId)} title="Thêm CV"> <BsPlus /> </button>
                    <button className="column-btn menu-btn"> <BsThreeDots /> </button>
                </div>
            </div>
            
            <DroppableTaskColumn columnId={columnId} isOver={false}>
                <SortableContext
                    items={tasks.map(task => task.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {tasks.map((task) => (
                        <SortableTaskItem 
                            key={task.id} 
                            task={task} 
                            columnId={columnId} 
                            openEditModal={openEditModal} 
                        />
                    ))}
                    {tasks.length === 0 && (
                        <div className="empty-column-placeholder">
                            Kéo thẻ vào đây
                        </div>
                    )}
                </SortableContext>
            </DroppableTaskColumn>
            
            <button className="add-task-btn-in-column" onClick={() => openCreateModal(columnId)}> + Thêm công việc </button>
        </div>
    );
};

// --- COMPONENT CHÍNH ---
const TaskBoard = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [selectedColumn, setSelectedColumn] = useState('todo');
    const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
    const [currentTag, setCurrentTag] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [columns, setColumns] = useState({});
    const [activeTask, setActiveTask] = useState(null);
    
    // Form state cho tạo mới
    const [newTask, setNewTask] = useState({
        title: '', description: '', priority: 'medium', deadline: '', tags: []
    });

    const getUserId = () => {
        try { const u = localStorage.getItem("user"); return u ? JSON.parse(u)?.user_id : null; }
        catch (e) { console.error("Lỗi user ID:", e); return null; }
    };

    // --- 1. LOAD DATA TỪ API ---
    const fetchTasks = async () => {
        setIsLoading(true);
        setError(null);
        const userId = getUserId();
        if (!userId) {
            setError("Không tìm thấy thông tin người dùng.");
            setIsLoading(false);
            return;
        }
        try {
            const response = await fetch(`http://localhost:5000/api/tasks?userId=${userId}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json(); 
            
            // Chuyển đổi dữ liệu API thành object columns
            const columnsObject = data.reduce((acc, col) => {
                if (col && col.id) {
                     acc[col.id] = { ...col, tasks: col.tasks || [] };
                }
                return acc;
            }, {}); 
            
            // Đảm bảo thứ tự cột chuẩn
            const allColumnIds = ['todo', 'inprogress', 'review', 'done']; 
            const finalizedColumns = {};
            const titleMap = { 
                'todo': columnsObject['todo']?.title || 'To Do', 
                'inprogress': columnsObject['inprogress']?.title || 'In Progress', 
                'review': columnsObject['review']?.title || 'In Review', 
                'done': columnsObject['done']?.title || 'Done' 
            };
            
            allColumnIds.forEach(id => {
                finalizedColumns[id] = {
                    id: id,
                    title: titleMap[id],
                    tasks: columnsObject[id]?.tasks || [],
                    count: columnsObject[id]?.count || 0
                };
            });
            setColumns(finalizedColumns);
        } catch (err) {
            setError(`Không thể tải công việc: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // --- 2. LẮNG NGHE SOCKET REAL-TIME ---
   useEffect(() => {
        fetchTasks(); // Load lần đầu

        // Khi AI tạo task xong -> Gọi hàm fetchTasks để load lại từ DB
        const handleRefetch = (data) => {
            console.log("↻ Socket: Có task mới, đang tải lại bảng...", data);
            fetchTasks(); // <--- QUAN TRỌNG: Tải lại toàn bộ từ DB
        };

        socket.on('new_task', handleRefetch);

        return () => {
            socket.off('new_task', handleRefetch);
        };
    }, []);

    // --- 3. CÁC HÀM XỬ LÝ LOGIC KHÁC ---
    const parseNaturalLanguage = (input) => { 
        const parsed = { title: input, priority: 'medium', deadline: '', tags: [] };
        // Xử lý ưu tiên
        if (/khẩn cấp|urgent|cao/i.test(input)) parsed.priority = 'high';
        else if (/trung bình|medium/i.test(input)) parsed.priority = 'medium';
        else if (/thấp|low/i.test(input)) parsed.priority = 'low';
        
        // Xử lý ngày
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        if (/hôm nay|today/i.test(input)) parsed.deadline = today;
        else if (/ngày mai|mai|tomorrow/i.test(input)) parsed.deadline = tomorrow;
        
        // Xử lý tags #...
        const tagMatches = input.match(/#[\w\u00C0-\u024F\u1E00-\u1EFF]+/g);
        if (tagMatches) parsed.tags = tagMatches.map(tag => tag.substring(1));
        
        // Làm sạch tiêu đề (xóa các từ khóa đã parse)
        let cleanTitle = input;
        if (parsed.tags.length > 0) parsed.tags.forEach(tag => cleanTitle = cleanTitle.replace(`#${tag}`, ''));
        ['khẩn cấp', 'urgent', 'cao', 'trung bình', 'medium', 'thấp', 'low', 'hôm nay', 'ngày mai'].forEach(k => {
            cleanTitle = cleanTitle.replace(new RegExp(k, 'gi'), '');
        });
        parsed.title = cleanTitle.trim();
        return parsed;
    };

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // Giúp click không bị nhầm là drag
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    function handleDragStart(event) {
        const { active } = event;
        const taskId = active.id;
        const columnId = active.data.current?.columnId;
        if (columnId) {
            setActiveTask(columns[columnId].tasks.find(task => task.id === taskId));
        }
    }

    async function handleDragEnd(event) {
        const { active, over } = event;
        setActiveTask(null);
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;
        
        if (activeId === overId) return;

        const activeColumnId = active.data.current?.columnId;
        let overColumnId = over.data.current?.type === 'column' ? over.id : over.data.current?.columnId;

        if (!activeColumnId || !overColumnId) return;

        // Cập nhật UI (Optimistic Update)
        setColumns(prev => {
            const activeItems = prev[activeColumnId].tasks;
            const overItems = prev[overColumnId].tasks;
            
            const activeIndex = activeItems.findIndex(t => t.id === activeId);
            let overIndex;

            if (over.data.current?.type === 'column') {
                overIndex = overItems.length + 1;
            } else {
                const isBelowOverItem = over && active.rect.current.translated && active.rect.current.translated.top > over.rect.top + over.rect.height;
                const modifier = isBelowOverItem ? 1 : 0;
                overIndex = overItems.findIndex(t => t.id === overId) + modifier;
            }

            let newColumns;
            if (activeColumnId === overColumnId) {
                // Kéo thả trong cùng cột
                newColumns = {
                    ...prev,
                    [activeColumnId]: {
                        ...prev[activeColumnId],
                        tasks: arrayMove(activeItems, activeIndex, overIndex)
                    }
                };
            } else {
                // Kéo thả sang cột khác
                let newActiveItems = [...activeItems];
                const [movedItem] = newActiveItems.splice(activeIndex, 1);
                movedItem.status = overColumnId; // Cập nhật status mới

                let newOverItems = [...overItems];
                newOverItems.splice(overIndex, 0, movedItem);

                newColumns = {
                    ...prev,
                    [activeColumnId]: { ...prev[activeColumnId], tasks: newActiveItems, count: newActiveItems.length },
                    [overColumnId]: { ...prev[overColumnId], tasks: newOverItems, count: newOverItems.length }
                };
            }
            return newColumns;
        });

        // Gọi API Cập nhật
        if (activeColumnId !== overColumnId) {
            try {
                await fetch(`http://localhost:5000/api/tasks/${activeId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ user_id: getUserId(), status: overColumnId })
                });
            } catch (err) {
                console.error("Lỗi API move task:", err);
                fetchTasks(); // Revert nếu lỗi
            }
        }
    }

    // --- CÁC HÀM CRUD ---
    const handleQuickCreate = async () => {
        if (!naturalLanguageInput.trim()) return;
        const userId = getUserId();
        const parsed = parseNaturalLanguage(naturalLanguageInput);
        const taskData = { creator_id: userId, title: parsed.title, priority: parsed.priority, deadline: parsed.deadline || null, status: selectedColumn };
        
        setIsLoading(true);
        try {
            const response = await fetch('http://localhost:5000/api/tasks', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskData)
            });
            const createdTask = await response.json();
            
            setColumns(prev => {
                const t = createdTask.status || selectedColumn;
                if (!prev[t]) return prev;
                const u = [createdTask, ...(prev[t].tasks || [])];
                return { ...prev, [t]: { ...prev[t], tasks: u, count: u.length } };
            });
            setNaturalLanguageInput('');
            setShowCreateModal(false);
        } catch (err) { alert(`Lỗi: ${err.message}`); } finally { setIsLoading(false); }
    };

    const handleCreateTask = async () => {
        if (!newTask.title.trim()) return;
        const userId = getUserId();
        const taskData = { creator_id: userId, title: newTask.title, description: newTask.description || null, priority: newTask.priority, deadline: newTask.deadline || null, status: selectedColumn };
        
        setIsLoading(true);
        try {
            const response = await fetch('http://localhost:5000/api/tasks', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(taskData)
            });
            const createdTask = await response.json();
            
            setColumns(prev => {
                const t = createdTask.status || selectedColumn;
                if (!prev[t]) return prev;
                const u = [createdTask, ...(prev[t].tasks || [])];
                return { ...prev, [t]: { ...prev[t], tasks: u, count: u.length } };
            });
            setNewTask({ title: '', description: '', priority: 'medium', deadline: '', tags: [] });
            setShowCreateModal(false);
        } catch (err) { alert(`Lỗi: ${err.message}`); } finally { setIsLoading(false); }
    };

    const handleEditTask = async () => {
        if (!editingTask || !editingTask.title.trim()) return;
        const userId = getUserId();
        const updateData = { user_id: userId, title: editingTask.title, description: editingTask.description || null, priority: editingTask.priority, deadline: editingTask.deadline || null, status: editingTask.status };
        
        setIsLoading(true);
        try {
            const response = await fetch(`http://localhost:5000/api/tasks/${editingTask.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updateData)
            });
            const updatedTask = await response.json();
            
            setColumns(prev => {
                const n = { ...prev };
                // Tìm và cập nhật task trong cột tương ứng
                for (const c in n) {
                    const taskIndex = n[c].tasks.findIndex(t => t.id === updatedTask.id);
                    if (taskIndex !== -1) {
                        n[c].tasks[taskIndex] = { ...updatedTask };
                        break;
                    }
                }
                return n;
            });
            setShowEditModal(false); setEditingTask(null);
        } catch (err) { alert(`Lỗi: ${err.message}`); } finally { setIsLoading(false); }
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm("Bạn chắc chắn muốn xóa?")) return;
        const userId = getUserId();
        setIsLoading(true);
        try {
            await fetch(`http://localhost:5000/api/tasks/${taskId}?userId=${userId}`, { method: 'DELETE' });
            setColumns(prev => {
                const n = { ...prev };
                for (const c in n) {
                    n[c].tasks = n[c].tasks.filter(t => t.id !== taskId);
                    n[c].count = n[c].tasks.length;
                }
                return n;
            });
            setShowEditModal(false); setEditingTask(null);
        } catch (err) { alert(`Lỗi: ${err.message}`); } finally { setIsLoading(false); }
    };

    const openCreateModal = (colId) => { setSelectedColumn(colId); setShowCreateModal(true); };
    const openEditModal = (task) => { 
        const deadlineForInput = task.deadline ? task.deadline.split('T')[0] : ''; 
        setEditingTask({ ...task, deadline: deadlineForInput, priority: task.priority || 'low' }); 
        setShowEditModal(true); 
    };

    // Filter tasks
    const columnsToRender = Object.values(columns)
        .sort((a, b) => {
             const order = { 'todo': 1, 'inprogress': 2, 'review': 3, 'done': 4 }; 
             return (order[a.id] || 99) - (order[b.id] || 99);
        })
        .map(col => ({
            ...col,
            tasks: (col.tasks || []).filter(task =>
                !searchQuery ||
                task.title.toLowerCase().includes(searchQuery.toLowerCase())
            )
        }));

    if (isLoading && Object.keys(columns).length === 0) return <div>Đang tải công việc...</div>;
    if (error && Object.keys(columns).length === 0) return <div style={{ color: 'red', padding: '20px' }}>Lỗi: {error}</div>;

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="taskboard-wrapper">
                {/* Header */}
                <div className="taskboard-top-header">
                   <h1 className="taskboard-main-title">📋 Quản lý Công việc</h1>
                   <div className="taskboard-search-bar"> 
                       <BsSearch className="search-icon" /> 
                       <input type="text" className="search-input" placeholder="Tìm kiếm..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /> 
                   </div>
                </div>

                {/* Board */}
                <div className="task-board">
                    {columnsToRender.map((column) => (
                        <SortableContext key={column.id} items={column.tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                            <TaskColumn 
                                columnId={column.id}
                                title={column.title}
                                tasksCount={column.tasks.length}
                                tasks={column.tasks}
                                openCreateModal={openCreateModal}
                                openEditModal={openEditModal} 
                            />
                        </SortableContext>
                    ))}
                </div>

                <DragOverlay>
                    {activeTask ? (
                         <TaskCard task={activeTask} isOverlay={true} />
                    ) : null}
                </DragOverlay>

                {/* --- MODAL CREATE --- */}
                {showCreateModal && (
                    <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                        <div className="modal-content task-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">Tạo CV mới</h3>
                                <button className="close-modal-btn" onClick={() => setShowCreateModal(false)}> <IoClose /> </button>
                            </div>
                            <div className="modal-body">
                                <div className="natural-input-section">
                                    <label className="form-label"><IoSparkles className="sparkle-icon" /> Nhập nhanh</label>
                                    <div className="natural-input-wrapper">
                                        <input type="text" className="natural-input" placeholder='VD: "Báo cáo khẩn cấp hôm nay"' value={naturalLanguageInput} onChange={(e) => setNaturalLanguageInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleQuickCreate()}/>
                                        <button className="quick-create-btn" onClick={handleQuickCreate} disabled={isLoading}> <IoSparkles /> Tạo </button>
                                    </div>
                                </div>
                                <div className="divider"><span>Hoặc</span></div>
                                <div className="form-group"> <label>Tiêu đề *</label> <input type="text" className="form-input" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}/> </div>
                                <div className="form-group"> <label>Mô tả</label> <textarea className="form-textarea" rows="3" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}/> </div>
                                <div className="form-row">
                                    <div className="form-group"> <label>Ưu tiên</label> <select className="form-select" value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}> <option value="low">🟢 Thấp</option> <option value="medium">🟡 TB</option> <option value="high">🔴 Cao</option> </select> </div>
                                    <div className="form-group"> <label>Deadline</label> <input type="date" className="form-input" value={newTask.deadline} onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}/> </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn-cancel" onClick={() => setShowCreateModal(false)}> Hủy </button>
                                <button className="btn-create" onClick={handleCreateTask} disabled={!newTask.title.trim() || isLoading}> Tạo </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- MODAL EDIT --- */}
                {showEditModal && editingTask && (
                    <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                        <div className="modal-content task-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">Chỉnh sửa</h3>
                                <div className="modal-header-actions">
                                    <button className="delete-btn" onClick={() => handleDeleteTask(editingTask.id)} title="Xóa"> 🗑️ </button>
                                    <button className="close-modal-btn" onClick={() => setShowEditModal(false)}> <IoClose /> </button>
                                </div>
                            </div>
                            <div className="modal-body">
                                <div className="form-group"> <label>Tiêu đề *</label> <input type="text" className="form-input" value={editingTask.title} onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}/> </div>
                                <div className="form-group"> <label>Mô tả</label> <textarea className="form-textarea" rows="3" value={editingTask.description || ''} onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}/> </div>
                                <div className="form-row">
                                    <div className="form-group"> <label>Ưu tiên</label> <select className="form-select" value={editingTask.priority} onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value })}> <option value="low">🟢 Thấp</option> <option value="medium">🟡 TB</option> <option value="high">🔴 Cao</option> </select> </div>
                                    <div className="form-group"> <label>Deadline</label> <input type="date" className="form-input" value={editingTask.deadline || ''} onChange={(e) => setEditingTask({ ...editingTask, deadline: e.target.value })}/> </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn-cancel" onClick={() => setShowEditModal(false)}> Hủy </button>
                                <button className="btn-save" onClick={handleEditTask} disabled={!editingTask.title.trim() || isLoading}> Lưu </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DndContext>
    );
};

export default TaskBoard;
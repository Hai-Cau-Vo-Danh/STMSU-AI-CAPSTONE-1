// src/components/WorkspaceDetail.jsx
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from 'react-dom'; 
import "./WorkspaceDetail.css";
import { 
  BsPlus, BsPencil, BsTrash, BsCheck, BsStar, BsStarFill, BsArrowLeft,
  BsGearFill, BsGripVertical 
} from "react-icons/bs";
import { IoMdClose } from "react-icons/io";
import { useParams, useNavigate } from "react-router-dom"; 
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors, 
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy, 
  useSortable
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { SortableCard } from './SortableCard'; 
import TaskCard from './TaskCard'; 
import io from 'socket.io-client';
import { workspaceService } from '../services/workspaceService';
import "react-datepicker/dist/react-datepicker.css";
import CardDetailModal from './CardDetailModal'; 

const SOCKET_URL = 'http://localhost:5000'; 

function DroppableList({ list, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: list.id,
    data: {
      listId: list.id,
      type: 'list' 
    }
  });

  return (
    <div 
      ref={setNodeRef} 
      className={`list-cards ${isOver ? 'droppable-over' : ''}`}
    >
      {children}
    </div>
  );
}

function SortableListColumn({ list, children, activeDragItem }) {
  const isCardDragging = activeDragItem && activeDragItem.type === 'card';

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging, 
  } = useSortable({ 
    id: list.id,
    data: {
      type: 'list' 
    },
    disabled: isCardDragging
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: (isDragging && !isCardDragging) ? 0 : 1, 
    height: '100%', 
  };
  
  return (
    <div ref={setNodeRef} style={style} className="board-list-wrapper">
      {children(attributes, listeners)}
    </div>
  );
}

function WorkspaceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null); 

  const [workspace, setWorkspace] = useState(null);
  
  const [showAddList, setShowAddList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [newCardTitle, setNewCardTitle] = useState("");
  const [addingCardToList, setAddingCardToList] = useState(null);

  const [lists, setLists] = useState([]);
  const [members, setMembers] = useState([]);
  
  const [selectedCard, setSelectedCard] = useState(null);
  const [activeDragItem, setActiveDragItem] = useState(null);

  const dndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    const fetchWorkspaceData = async () => {
      try {
        const data = await workspaceService.getWorkspaceDetail(id); 
        setWorkspace(data.workspace);
        setLists(data.lists);
        setMembers(data.members); 
        setLoading(false);
      } catch (err) {
        console.error('Error fetching workspace data:', err);
        setWorkspace(null);
        setLoading(false);
        alert(err.response?.data?.message || 'Không thể tải workspace. Vui lòng thử lại.');
      }
    };
    fetchWorkspaceData();
    
    if (socketRef.current) { return; }
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });
    setSocket(newSocket);
    socketRef.current = newSocket; 
    const userString = localStorage.getItem('user');
    const user = userString ? JSON.parse(userString) : { username: 'Guest' };
    newSocket.emit('join-workspace', {
      workspaceId: id,
      user: {
        id: user.user_id || Date.now(),
        username: user.username,
        avatar: user.avatar_url || '👤'
      }
    });

    newSocket.on('workspace-users', (users) => setOnlineUsers(users));
    newSocket.on('list-added', (data) => {
      if (data.workspaceId === id) setLists(prev => [...prev, data.list]);
    });
    newSocket.on('card-added', (data) => {
      if (data.workspaceId === id) {
        setLists(prev => prev.map(list =>
          list.id === data.listId ? { ...list, cards: [...list.cards, data.card] } : list
        ));
      }
    });
    newSocket.on('card-moved', (data) => {
      if (data.workspaceId === id) setLists(data.lists);
    });
    newSocket.on('list-deleted', (data) => {
      if (data.workspaceId === id) setLists(prev => prev.filter(list => list.id !== data.listId));
    });
    newSocket.on('card-deleted', (data) => {
      if (data.workspaceId === id) {
        setLists(prev => prev.map(list =>
          list.id === data.listId ? { ...list, cards: list.cards.filter(card => card.id !== data.cardId) } : list
        ));
      }
    });
    newSocket.on('list-updated', (data) => {
      if (data.workspaceId === id) {
        setLists(prev => prev.map(list =>
          list.id === data.listId ? { ...list, title: data.title } : list
        ));
      }
    });
    newSocket.on('card-updated', (data) => {
      if (data.workspaceId === id) {
        setLists(prev => prev.map(list => ({
          ...list,
          cards: list.cards.map(card =>
            card.id === data.cardId ? { ...card, ...data.cardData } : card
          )
        })));
      }
    });
    
    return () => {
      if (socketRef.current) {
          socketRef.current.emit('leave-workspace', { workspaceId: id });
          newSocket.close();
          socketRef.current = null;
      }
    };
  }, [id]);

  const handleDragStart = (event) => {
    const { active } = event;
    const type = active.data.current?.type;
    
    if (type === 'list') {
      const list = lists.find(l => l.id === active.id);
      setActiveDragItem({ ...list, type: 'list' }); 
    } else if (type === 'card') {
      const list = lists.find(l => l.id === active.data.current.listId);
      const card = list?.cards.find(c => c.id === active.id);
      setActiveDragItem({ ...card, type: 'card' }); 
    }
  };

  const handleDragCancel = () => {
    setActiveDragItem(null);
  };
  
  // ==========================================================
  // === LOGIC KÉO THẢ (ĐÃ SỬA CHỐNG GIAN LẬN NGÀY NỘP) ===
  // ==========================================================
  const handleDragEnd = async (event) => { 
    setActiveDragItem(null); 
    
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return; 
    
    const activeType = active.data.current?.type;

    // --- 1. KÉO LIST ---
    if (activeType === 'list') {
      const oldIndex = lists.findIndex(l => l.id === activeId);
      const newIndex = lists.findIndex(l => l.id === overId);

      if (oldIndex === -1 || newIndex === -1) return;

      const newListsOrder = arrayMove(lists, oldIndex, newIndex);
      setLists(newListsOrder);

      const orderedIds = newListsOrder.map(l => l.id);
      try {
        await workspaceService.reorderLists(orderedIds);
      } catch (err) {
        console.error("Lỗi lưu vị trí list:", err);
        alert("Không thể lưu thứ tự danh sách, đang hoàn tác.");
        setLists(lists); 
      }
      return; 
    }
    
    // --- 2. KÉO CARD ---
    if (activeType === 'card') {
      const activeListId = active.data.current?.listId;
      let overListId = over.data.current?.listId;

      if (!overListId) {
        const overData = over.data.current;
        if (overData?.type === 'list') {
          overListId = over.id; 
        } else {
          return; 
        }
      }

      if (!activeListId || !overListId) return;
      
      const activeList = lists.find(list => list.id === activeListId);
      const overList = lists.find(list => list.id === overListId);
      if (!activeList || !overList) return;

      const activeCard = activeList.cards.find(card => card.id === active.id);
      if (!activeCard) return;

      // --- (LOGIC KIỂM TRA QUY TẮC) ---
      const activeListType = activeList.listType;
      const overListType = overList.listType;

      // >>> RULE 1: Kéo vào "In Progress"
      if (overListType === 'in_progress' && activeListType !== 'in_progress') {
          if (!activeCard.assignee) {
              alert("⛔ CHẶN: Bạn phải gán thành viên (Assignee) chịu trách nhiệm trước khi bắt đầu làm!");
              return; // Hủy kéo thả
          }
          if (!activeCard.dueDate) {
              alert("⛔ CHẶN: Bạn phải đặt ngày hết hạn (Due Date) để cam kết thời gian!");
              return; // Hủy kéo thả
          }
      }

      // >>> RULE 2: Kéo vào "Done" (ĐÃ SỬA LẠI)
      // Điều kiện: Tự động lấy ngày hôm nay làm ngày nộp. User không được nhập.
      if (overListType === 'done' && activeListType !== 'done') {
          
          // Lấy ngày hiện tại (Hôm nay) chuẩn ISO YYYY-MM-DD
          const today = new Date().toISOString().split('T')[0];
          
          // Kiểm tra hạn (Nếu card có due date)
          if (activeCard.dueDate) {
              const dueDateStr = new Date(activeCard.dueDate).toISOString().split('T')[0];
              
              // Nếu hôm nay > ngày hạn -> Trễ hạn
              if (today > dueDateStr) {
                  const confirmLate = window.confirm(
                      `⚠️ CẢNH BÁO NỘP MUỘN!\n\n- Hạn chót: ${dueDateStr}\n- Ngày nộp thực tế: ${today} (Hôm nay)\n\nBạn đang nộp bài trễ hạn. Bạn có chắc chắn muốn hoàn thành task này không?`
                  );
                  if (!confirmLate) return; // User bấm Cancel -> Hủy kéo thả, task quay về chỗ cũ
              } else {
                  // Đúng hạn -> Im lặng hoặc thông báo nhỏ
                  // alert("✅ Nộp đúng hạn!"); 
              }
          }
          
          // (Logic này đảm bảo tính trung thực, user không thể "fake" ngày nộp)
      }
      // --- (KẾT THÚC LOGIC KIỂM TRA) ---
      
      // ... Xử lý di chuyển như bình thường
      if (activeListId === overListId) {
        const oldIndex = activeList.cards.findIndex(card => card.id === active.id);
        const newIndex = over.id === overListId 
          ? activeList.cards.length 
          : overList.cards.findIndex(card => card.id === over.id);

        if (oldIndex === newIndex) return;
        
        const newCards = arrayMove(activeList.cards, oldIndex, newIndex);
        const newLists = lists.map(list =>
          list.id === activeListId ? { ...list, cards: newCards } : list
        );
        setLists(newLists); 
        
        try {
          await workspaceService.moveCard(id, active.id, overListId, newIndex);
        } catch (err) {
          console.error("Lỗi lưu vị trí card:", err);
          setLists(lists); 
        }
      } else {
        const activeCards = activeList.cards.filter(card => card.id !== active.id);
        const insertIndex = over.id === overListId 
          ? overList.cards.length 
          : overList.cards.findIndex(card => card.id === over.id);
          
        const newOverCards = [...overList.cards];
        newOverCards.splice(insertIndex, 0, activeCard);
        
        const newLists = lists.map(list => {
          if (list.id === activeListId) return { ...list, cards: activeCards };
          if (list.id === overListId) return { ...list, cards: newOverCards };
          return list;
        });
        setLists(newLists); 

        try {
          await workspaceService.moveCard(id, active.id, overListId, insertIndex);
        } catch (err) {
          console.error("Lỗi lưu vị trí card:", err);
          setLists(lists);
        }
      }
    }
  };

  const handleAddList = async () => {
    if (!newListTitle.trim()) return;
    try {
      const newList = await workspaceService.addList(id, newListTitle);
      setLists(prev => [...prev, newList]);
      setNewListTitle("");
      setShowAddList(false);
    } catch (err) {
      console.error('Error adding list:', err);
      alert(err.response?.data?.error || 'Không thể thêm list. Vui lòng thử lại.');
    }
  };
  const handleAddCard = async (listId) => {
    if (!newCardTitle.trim()) return;
    try {
      const newCard = await workspaceService.addCard(id, listId, {
        title: newCardTitle,
        priority: "medium"
      });
      setLists(lists.map(list =>
        list.id === listId
          ? { ...list, cards: [...list.cards, newCard] }
          : list
      ));
      setNewCardTitle("");
      setAddingCardToList(null);
    } catch (err) {
      console.error('Error adding card:', err);
      alert('Không thể thêm card. Vui lòng thử lại.');
    }
  };
  const toggleStar = async () => {
    try {
      await workspaceService.updateWorkspace(id, { starred: !workspace.starred });
      setWorkspace({ ...workspace, starred: !workspace.starred });
    } catch (err) {
      console.error('Error toggling star:', err);
    }
  };

  const [editingListId, setEditingListId] = useState(null);
  const [editingListTitle, setEditingListTitle] = useState("");
  const handleStartEditList = (list) => {
    setEditingListId(list.id);
    setEditingListTitle(list.title);
  };
  const handleSaveListTitle = async (listId) => {
    if (!editingListTitle.trim()) {
      alert("Tên list không được để trống");
      return;
    }
    try {
      await workspaceService.updateList(id, listId, editingListTitle);
      setLists(lists.map(list =>
        list.id === listId ? { ...list, title: editingListTitle } : list
      ));
      setEditingListId(null);
      setEditingListTitle("");
    } catch (err) {
      console.error('Error updating list:', err);
      alert('Không thể cập nhật list. Vui lòng thử lại.');
    }
  };
  const handleCancelEditList = () => {
    setEditingListId(null);
    setEditingListTitle("");
  };
  const handleDeleteList = async (listId) => {
    if (!window.confirm("Bạn có chắc muốn xóa list này? Tất cả card trong list sẽ bị xóa.")) {
      return;
    }
    try {
      await workspaceService.deleteList(id, listId);
      setLists(lists.filter(list => list.id !== listId));
    } catch (err) {
      console.error('Error deleting list:', err);
      alert(err.response?.data?.error || 'Không thể xóa list. Vui lòng thử lại.');
    }
  };

  const [editingCardId, setEditingCardId] = useState(null);
  
  const handleDeleteCard = async (listId, cardId) => {
    console.log('🗑️ Deleting card:', cardId, 'from list:', listId);
    if (!window.confirm("Bạn có chắc muốn xóa card này?")) {
      return;
    }
    try {
      await workspaceService.deleteCard(id, cardId);
      console.log('✅ Card deleted successfully');
      setLists(lists.map(list =>
        list.id === listId
          ? { ...list, cards: list.cards.filter(card => card.id !== cardId) }
          : list
      ));
    } catch (err) {
      console.error('❌ Error deleting card:', err);
      console.error('Error details:', err.response?.data);
      alert(err.response?.data?.error || 'Không thể xóa card. Vui lòng thử lại.');
    }
  };
  
  if (loading) {
    return (
      <div className="workspace-detail-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Đang tải workspace...</p>
        </div>
      </div>
    );
  }
  if (!workspace) {
    return (
      <div className="workspace-detail-container">
        <div className="error-state">
          <p>Workspace không tồn tại</p>
          <button onClick={() => navigate('/workspaces')} className="retry-btn">
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-detail-container">
      <div className="workspace-detail-header">
        <div className="header-left-section">
          <button className="back-btn" onClick={() => navigate("/workspaces")}>
            <BsArrowLeft /> Quay lại
          </button>
          <div className="workspace-info">
            <div className="workspace-icon-small" style={{ backgroundColor: workspace.color }}>
              {workspace.icon}
            </div>
            <div>
              <h1>{workspace.name}</h1>
              <p>{workspace.description}</p>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <button className="star-btn-header" onClick={toggleStar}>
            {workspace.starred ? <BsStarFill /> : <BsStar />}
          </button>
          {onlineUsers.length > 0 && (
            <div className="online-users-indicator">
              <div className="online-avatars">
                {onlineUsers.slice(0, 3).map((user, index) => (
                  <div 
                    key={user.id} 
                    className="online-avatar"
                    style={{ zIndex: onlineUsers.length - index }}
                    title={user.username}
                  >
                    {user.avatar}
                  </div>
                ))}
                {onlineUsers.length > 3 && (
                  <div className="online-count">+{onlineUsers.length - 3}</div>
                )}
              </div>
              <span className="online-text">{onlineUsers.length} online</span>
            </div>
          )}
          
          <button 
            className="members-btn" 
            onClick={() => navigate(`/app/workspace/${id}/settings`)}
          >
            <BsGearFill /> Cài đặt
          </button>
        </div>
      </div>

      <DndContext
        sensors={dndSensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="board-lists">
          <SortableContext
            items={lists.map(l => l.id)}
            strategy={horizontalListSortingStrategy}
          >
            {lists.map((list) => (
              <SortableListColumn 
                key={list.id} 
                list={list}
                activeDragItem={activeDragItem}
              >
                {(dragAttributes, dragListeners) => (
                  <div className="board-list">
                    {editingListId === list.id ? (
                      <div className="edit-list-form">
                        <input
                          type="text"
                          value={editingListTitle}
                          onChange={(e) => setEditingListTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveListTitle(list.id)}
                          autoFocus
                        />
                        <div className="edit-list-actions">
                          <button onClick={() => handleSaveListTitle(list.id)}><BsCheck /></button>
                          <button onClick={handleCancelEditList}><IoMdClose /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="list-header" {...dragAttributes}>
                        <button 
                          className="list-drag-handle" 
                          {...dragListeners} 
                        >
                          <BsGripVertical />
                        </button>
                        
                        <h3>{list.title}</h3>
                        <div className="list-actions">
                          <span className="card-count">{list.cards.length}</span>
                          {list.listType === 'custom' && (
                            <>
                              <button className="list-edit-btn" onClick={() => handleStartEditList(list)}>
                                <BsPencil />
                              </button>
                              <button className="list-delete-btn" onClick={() => handleDeleteList(list.id)}>
                                <BsTrash />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    <SortableContext
                      items={list.cards.map(card => card.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <DroppableList list={list}>
                        {list.cards.map((card) => (
                          <SortableCard 
                              key={`${list.id}-${card.id}`}
                              card={card} 
                              listId={list.id} 
                              members={members}
                              onEditClick={() => setSelectedCard({ ...card, listId: list.id })}
                          />
                        ))}
                        {list.cards.length === 0 && (
                          <div className="empty-list-placeholder">
                            Kéo thẻ vào đây
                          </div>
                        )}
                      </DroppableList>
                    </SortableContext>

                    {addingCardToList === list.id ? (
                      <div className="add-card-form">
                        <input
                          type="text"
                          placeholder="Nhập tiêu đề card..."
                          value={newCardTitle}
                          onChange={(e) => setNewCardTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddCard(list.id)}
                          autoFocus
                        />
                        <div className="form-actions">
                          <button onClick={() => handleAddCard(list.id)}>
                            <BsCheck /> Thêm
                          </button>
                          <button onClick={() => setAddingCardToList(null)}>
                            Hủy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="add-card-btn"
                        onClick={() => setAddingCardToList(list.id)}
                      >
                        <BsPlus /> Thêm thẻ
                      </button>
                    )}
                  </div> 
                )} 
              </SortableListColumn> 
            ))}
          </SortableContext>

          {showAddList ? (
            <div className="add-list-form">
              <input
                type="text"
                placeholder="Nhập tiêu đề danh sách..."
                value={newListTitle}
                onChange={(e) => setNewListTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddList()}
                autoFocus
              />
              <div className="form-actions">
                <button onClick={handleAddList}>
                  <BsCheck /> Thêm
                </button>
                <button onClick={() => setShowAddList(false)}>
                  Hủy
                </button>
              </div>
            </div>
          ) : (
            <button
              className="add-list-btn"
              onClick={() => setShowAddList(true)}
            >
              <BsPlus /> Thêm danh sách
            </button>
          )}
        </div>
        
        {createPortal(
          <DragOverlay 
            dropAnimation={{
                sideEffects: defaultDropAnimationSideEffects({
                  styles: { active: { opacity: '0.5' } },
                }),
              }}
          >
            {activeDragItem ? (
              activeDragItem.type === 'list' ? (
                <div className="board-list is-dragging-overlay">
                  <div className="list-header">
                    <h3>{activeDragItem.title}</h3>
                    <div className="list-actions">
                      <span className="card-count">{activeDragItem.cards.length}</span>
                    </div>
                  </div>
                  <div className="list-cards">
                    <div className="empty-list-placeholder">
                      Đang di chuyển...
                    </div>
                  </div>
                </div>
              ) : (
                <TaskCard
                  task={activeDragItem}
                  members={members}
                  isOverlay={true} 
                />
              )
            ) : null}
          </DragOverlay>,
          document.body 
        )}
      </DndContext>

      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          listTitle={lists.find(l => l.id === selectedCard.listId)?.title || ""}
          workspaceId={id}
          members={members}
          onClose={() => setSelectedCard(null)}
          onUpdateCard={(updatedCardData) => {
            setLists(prevLists => 
              prevLists.map(list => ({
                ...list,
                cards: list.cards.map(card =>
                  card.id === updatedCardData.id
                    ? { ...card, ...updatedCardData }
                    : card
                )
              }))
            );
            setSelectedCard(prev => ({ ...prev, ...updatedCardData }));
          }}
        />
      )}
    </div>
  );
}

export default WorkspaceDetail;
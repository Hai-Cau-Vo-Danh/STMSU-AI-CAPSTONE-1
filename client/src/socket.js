import io from 'socket.io-client';

// Khởi tạo kết nối 1 lần duy nhất
export const socket = io('http://localhost:5000', {
    transports: ['websocket', 'polling'],
    autoConnect: true
});

// Hàm tiện ích để join room
export const joinUserRoom = (userId) => {
    if (socket && userId) {
        console.log(`🔌 Socket: Requesting to join room user_${userId}`);
        socket.emit('join_user_room', { user_id: userId });
    }
};
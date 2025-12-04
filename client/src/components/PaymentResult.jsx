import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const PaymentResult = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing'); // processing, success, failed
  
  // Lấy API_URL từ biến môi trường
  const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, '');


  useEffect(() => {
    const verifyPayment = async () => {
      // Lấy param từ URL do VNPAY trả về
      const params = Object.fromEntries([...searchParams]);
      const queryString = new URLSearchParams(params).toString();
      
      const token = localStorage.getItem('token');
      const existingUserString = localStorage.getItem('user') || '{}';
      
      if (!token) {
        setStatus('error');
        return;
      }

      try {
        // Gọi API backend để xử lý kết quả VNPAY
        const res = await fetch(`${API_URL}/api/payment/vnpay-return?${queryString}`, {
            // Cần thêm Authorization header để backend xác thực
            headers: {
                'Authorization': `Bearer ${token}` 
            }
        });
        const data = await res.json();
        
        if (data.status === 'success' && data.user) {
          setStatus('success');
          
          // **********************************************
          // ********* BƯỚC KHẮC PHỤC QUAN TRỌNG *********
          // **********************************************
          const existingUser = JSON.parse(existingUserString);
          
          const updatedUser = {
              ...existingUser, // Giữ lại token và các trường khác
              ...data.user     // Ghi đè bằng dữ liệu mới nhất (is_premium: true)
          };

          // Ghi đè vào LocalStorage
          localStorage.setItem('user', JSON.stringify(updatedUser));
          console.log("✅ Payment Success: Đã cập nhật is_premium=True vào localStorage.");
          // **********************************************

          // Sau 5 giây tự về Dashboard (dùng window.location.href để buộc tải lại)
          setTimeout(() => window.location.href = '/app/dashboard', 5000);
        } else {
          setStatus('failed');
        }
      } catch (err) {
        console.error("Lỗi xác thực thanh toán:", err);
        setStatus('error');
      }
    };

    verifyPayment();
  }, [searchParams]); // Bỏ navigate khỏi dependency để tránh warning

  return (
    <div style={{ textAlign: 'center', marginTop: '50px', padding: '20px' }}>
      {status === 'processing' && <h2>⏳ Đang xác thực giao dịch...</h2>}
      
      {status === 'success' && (
        <div>
          <h1 style={{fontSize: '50px'}}>🎉</h1>
          <h2 style={{color: 'green'}}>Thanh toán thành công!</h2>
          <p>Tài khoản của bạn đã được nâng cấp lên Premium.</p>
          <p>Đang chuyển về trang chủ...</p>
          <button onClick={() => window.location.href = '/app/dashboard'}>Về trang chủ ngay</button>
        </div>
      )}

      {(status === 'failed' || status === 'error') && (
        <div>
          <h1 style={{fontSize: '50px'}}>❌</h1>
          <h2 style={{color: 'red'}}>Thanh toán thất bại</h2>
          <p>Có lỗi xảy ra hoặc bạn đã hủy giao dịch.</p>
          <button onClick={() => navigate('/app/dashboard')}>Quay lại</button>
        </div>
      )}
    </div>
  );
};

export default PaymentResult;
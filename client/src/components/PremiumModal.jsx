import React, { useState } from 'react';
import './PremiumModal.css';
import { BsCheckLg, BsXLg } from 'react-icons/bs';

const PremiumModal = ({ onClose }) => {
  const [loading, setLoading] = useState(false);

  // Hàm xử lý thanh toán
  const handlePayment = async (provider) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      // 1. Gọi API backend để lấy Link thanh toán
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        // Gửi số tiền 99k cho gói Pro
        body: JSON.stringify({ 
            amount: 99000, 
            provider: provider 
        })
      });
      
      const data = await response.json();
      
      if (data.payment_url) {
        // 2. CHUYỂN HƯỚNG NGƯỜI DÙNG SANG VNPAY (Trang này sẽ có mã QR)
        console.log("Redirecting to:", data.payment_url);
        window.location.href = data.payment_url;
      } else {
        alert("Lỗi: " + (data.message || "Không lấy được link thanh toán"));
        setLoading(false);
      }
    } catch (error) {
      console.error("Payment Error:", error);
      alert("Lỗi kết nối server. Vui lòng thử lại sau.");
      setLoading(false);
    }
  };

  return (
    <div className="premium-modal-overlay" onClick={onClose}>
      <div className="premium-modal-container" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="premium-close-btn" title="Đóng"><BsXLg /></button>
        
        {/* --- GÓI STARTER --- */}
        <div className="pricing-card">
          <div className="card-header">
            <h3>Starter</h3>
            <div className="price">0đ</div>
            <div className="period">/ trọn đời</div>
          </div>
          <ul className="feature-list">
            <li><BsCheckLg className="check-icon" /> 5 Dự án cá nhân</li>
            <li><BsCheckLg className="check-icon" /> Pomodoro Timer cơ bản</li>
            <li><BsCheckLg className="check-icon" /> Đồng bộ 2 thiết bị</li>
            <li className="disabled">AI Smart Scheduling</li>
            <li className="disabled">Phân tích chuyên sâu</li>
          </ul>
          <button className="btn-plan btn-starter" disabled>Gói hiện tại</button>
        </div>

        {/* --- GÓI PRO AI (VIP) --- */}
        <div className="pricing-card popular">
          <div className="popular-badge">KHUYÊN DÙNG</div>
          <div className="card-header">
            <h3 className="text-highlight">Pro AI</h3>
            <div className="price">99k</div>
            <div className="period">/ tháng</div>
          </div>
          <ul className="feature-list">
            <li><BsCheckLg className="check-icon highlight" /> <strong>Không giới hạn</strong> dự án</li>
            <li><BsCheckLg className="check-icon highlight" /> <strong>AI Smart Scheduling</strong></li>
            <li><BsCheckLg className="check-icon highlight" /> Phân tích biểu đồ sâu</li>
            <li><BsCheckLg className="check-icon highlight" /> Hỗ trợ ưu tiên 24/7</li>
            <li><BsCheckLg className="check-icon highlight" /> Huy hiệu VIP độc quyền</li>
          </ul>
          
          {/* Nút bấm thanh toán */}
          <button 
            className="btn-plan btn-pro"
            onClick={() => handlePayment('vnpay')}
            disabled={loading}
          >
            {loading ? (
                <span>⏳ Đang chuyển đến VNPAY...</span>
            ) : (
                <span>💳 Thanh toán VNPAY (QR / Thẻ)</span>
            )}
          </button>
          
          <p className="trial-text">Bảo mật SSL - Hủy bất kỳ lúc nào</p>
        </div>

        {/* --- GÓI TEAM --- */}
        <div className="pricing-card">
          <div className="card-header">
            <h3>Team</h3>
            <div className="price">299k</div>
            <div className="period">/ tháng</div>
          </div>
          <ul className="feature-list">
            <li><BsCheckLg className="check-icon" /> Mọi tính năng Pro</li>
            <li><BsCheckLg className="check-icon" /> Shared Workspaces</li>
            <li><BsCheckLg className="check-icon" /> Giao việc & Bình luận</li>
            <li><BsCheckLg className="check-icon" /> Xuất báo cáo PDF</li>
          </ul>
          <button 
            className="btn-plan btn-team"
            onClick={() => alert("Vui lòng liên hệ email: support@stmsuai.com")}
          >
            Liên hệ Sale
          </button>
        </div>

      </div>
    </div>
  );
};

export default PremiumModal;
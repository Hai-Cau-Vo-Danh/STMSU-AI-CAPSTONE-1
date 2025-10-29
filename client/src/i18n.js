// src/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector'; // Lỗi xảy ra ở dòng này
import HttpApi from 'i18next-http-backend';

// Cấu hình i18next
i18n
  .use(HttpApi) // Tải file dịch từ /public/locales
  .use(LanguageDetector) // Tự phát hiện ngôn ngữ
  .use(initReactI18next) // Kết nối với React
  .init({
    // Cấu hình cơ bản
    debug: false, // Tắt debug khi triển khai production
    supportedLngs: ['en', 'vi'], // Ngôn ngữ hỗ trợ
    fallbackLng: 'vi', // Ngôn ngữ mặc định
    
    // Cấu hình phát hiện ngôn ngữ
    detection: {
      order: ['localStorage', 'cookie', 'htmlTag', 'path', 'subdomain'],
      caches: ['localStorage', 'cookie'], // Lưu lựa chọn ngôn ngữ
    },
    
    // Cấu hình Backend (Load translations)
    backend: {
      loadPath: '/locales/{{lng}}/translation.json', // Đường dẫn file dịch
    },
    
    // Cấu hình React
    react: {
      useSuspense: true, // Dùng Suspense để chờ tải
    },
    
    // Định nghĩa namespace mặc định
    ns: ['translation'],
    defaultNS: 'translation',

  });

export default i18n; // Xuất instance để main.jsx dùng
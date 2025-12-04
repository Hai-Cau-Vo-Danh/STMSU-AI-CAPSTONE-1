// src/main.jsx
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { GoogleOAuthProvider } from '@react-oauth/google'; // <--- THÊM DÒNG NÀY

// ⚠️ THAY THẾ BẰNG CLIENT ID CỦA BẠN LẤY TỪ GOOGLE CONSOLE
const GOOGLE_CLIENT_ID = "282456658925-aav558sdikobq5je7hul04vvqj6dq5jh.apps.googleusercontent.com";

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}> {/* <--- BỌC Ở NGOÀI CÙNG */}
      <Suspense fallback={<div>Loading translations...</div>}> 
        <I18nextProvider i18n={i18n}>
          <App />
        </I18nextProvider>
      </Suspense>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
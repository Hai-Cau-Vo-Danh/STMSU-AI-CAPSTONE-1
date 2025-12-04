// src/components/MainNavbar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import './MainNavbar.css';
import { useTranslation } from 'react-i18next';

import { 
  BsClipboardCheck, BsJournalText, BsCalendarWeek, BsStopwatch, 
  BsColumnsGap, BsGear, 
  BsGrid1X2Fill, // Icon cho Dashboard
  BsStars,       // Icon cho AI Assistant
  BsBookHalf,     // Icon cho Study Room
  BsChatSquareDots // <-- (CODE MỚI) Icon cho Forum
} from 'react-icons/bs';

const MainNavbar = () => {
  const { t } = useTranslation(); 

  const navItems = [
    { path: '/app/dashboard', labelKey: 'sidebar.dashboard', icon: <BsGrid1X2Fill /> }, 
    // --- (CODE MỚI) THÊM FORUM VÀO ĐÂY ---
    { path: '/app/forum', labelKey: 'sidebar.forum', icon: <BsChatSquareDots /> }, 
    // --- KẾT THÚC CODE MỚI ---
    { path: '/app/tasks', labelKey: 'sidebar.tasks', icon: <BsClipboardCheck /> },
    { path: '/app/notes', labelKey: 'sidebar.notes', icon: <BsJournalText /> },
    { path: '/app/calendar', labelKey: 'sidebar.calendar', icon: <BsCalendarWeek /> },
    { path: '/app/pomodoro', labelKey: 'sidebar.pomodoro', icon: <BsStopwatch /> },
    { path: '/app/workspaces', labelKey: 'sidebar.workspaces', icon: <BsColumnsGap /> },
    { path: '/app/study-room', labelKey: 'sidebar.studyRoom', icon: <BsBookHalf /> },
    { path: '/app/settings', labelKey: 'sidebar.settings', icon: <BsGear /> },
  ];

  return (
    <nav className="main-navbar">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{t(item.labelKey)}</span> 
        </NavLink>
      ))}
    </nav>
  );
};

export default MainNavbar;
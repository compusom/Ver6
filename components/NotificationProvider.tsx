import React, { useEffect, useState } from 'react';
import { onNotify, Notification } from './notificationService';

interface InternalNotification extends Notification { id: number; }

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<InternalNotification[]>([]);

  useEffect(() => {
    return onNotify((n) => {
      const id = Date.now() + Math.random();
      setNotifications((prev) => [...prev, { ...n, id }]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((not) => not.id !== id));
      }, 3000);
    });
  }, []);

  return (
    <>
      {children}
      <div className="notification-container">
        {notifications.map((n) => (
          <div key={n.id} className={`notification ${n.type}`}>{n.message}</div>
        ))}
      </div>
    </>
  );
};

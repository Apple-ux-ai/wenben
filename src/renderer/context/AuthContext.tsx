import React, { createContext, useContext, useState, useCallback } from 'react';
import { AuthModal } from '../components/shared/AuthModal';

interface AuthContextType {
  checkAuth: () => boolean;
  requireAuth: (onSuccess: () => void) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const isAuthValid = useCallback(() => {
    const authDataStr = localStorage.getItem('software_auth_data');
    if (!authDataStr) return false;

    try {
      const authData = JSON.parse(authDataStr);
      if (!authData.verified) return false;
      
      const now = Date.now();
      const authTime = authData.timestamp;
      const hours24 = 24 * 60 * 60 * 1000;
      
      return (now - authTime) < hours24;
    } catch (e) {
      return false;
    }
  }, []);

  const requireAuth = useCallback((onSuccess: () => void) => {
    if (isAuthValid()) {
      onSuccess();
    } else {
      setPendingAction(() => onSuccess);
      setModalVisible(true);
    }
  }, [isAuthValid]);

  const handleAuthSuccess = () => {
    setModalVisible(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  return (
    <AuthContext.Provider value={{ checkAuth: isAuthValid, requireAuth }}>
      {children}
      <AuthModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
        onSuccess={handleAuthSuccess} 
      />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

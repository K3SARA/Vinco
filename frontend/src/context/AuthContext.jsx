import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStoredUser() {
      const token = localStorage.getItem('alight_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/auth/me');
        setUser(response.data.user);
      } catch (error) {
        console.error('Session restore failed:', error);
        localStorage.removeItem('alight_token');
        localStorage.removeItem('alight_user');
      } finally {
        setLoading(false);
      }
    }

    loadStoredUser();
  }, []);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { username, password });
      const { token, user: loggedUser } = response.data;
      
      localStorage.setItem('alight_token', token);
      localStorage.setItem('alight_user', JSON.stringify(loggedUser));
      setUser(loggedUser);
      return loggedUser;
    } catch (error) {
      throw error.response?.data?.error || 'Authentication failed.';
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('alight_token');
    localStorage.removeItem('alight_user');
    setUser(null);
  };

  const hasRole = (roles) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

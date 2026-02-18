import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '@/services/api';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await api.getMe();
        setCurrentUser(user);
      } catch (error) {
        // Token invalid or missing
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const data = await api.login(email, password);
      setCurrentUser(data.user);
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error.response?.data || error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email, password, fullName, company) => {
    setIsLoading(true);
    try {
      const data = await api.signup({ email, password, fullName, company });
      setCurrentUser(data.user);
      return data;
    } catch (error) {
      console.error('Signup error:', error);
      throw error.response?.data || error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    api.logout();
    setCurrentUser(null);
  };

  const loginDemo = () => {
    setCurrentUser({
      email: "demo@example.com",
      fullName: "Demo User",
      company: "CloudGuard Demo",
      role: "admin"
    });
  };

  const value = {
    currentUser, login, signup, logout, loginDemo,
    isAuthenticated: !!currentUser,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

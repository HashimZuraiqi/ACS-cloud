import React, { createContext, useContext, useState, useEffect } from 'react';
import pb from '@/lib/pocketbaseClient';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(pb.authStore.model);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      if (pb.authStore.isValid) {
        setCurrentUser(pb.authStore.model);
      } else {
        setCurrentUser(null);
      }
      setIsLoading(false);
    };
    checkAuth();
    const unsubscribe = pb.authStore.onChange((token, model) => {
      setCurrentUser(model);
    });
    return () => { unsubscribe(); };
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const authData = await pb.collection('users').authWithPassword(email, password);
      return authData;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email, password, fullName, company) => {
    setIsLoading(true);
    try {
      await pb.collection('users').create({
        email, password, passwordConfirm: password, fullName, company,
      });
      return await login(email, password);
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    pb.authStore.clear();
    setCurrentUser(null);
  };

  const value = {
    currentUser, login, signup, logout,
    isAuthenticated: !!currentUser && pb.authStore.isValid,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

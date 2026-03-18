import { useState } from 'react';
import { authService, CreateAccountData } from '@/services/auth';

export function useAuth() {
  const [loading, setLoading] = useState(false);

  const createAccount = async (data: CreateAccountData) => {
    setLoading(true);
    try {
      await authService.createAccount(data);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await authService.signOut();
    } finally {
      setLoading(false);
    }
  };

  return {
    createAccount,
    signOut,
    loading,
  };
}

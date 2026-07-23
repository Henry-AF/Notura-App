import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { getEnv } from './env';

const supabaseStorage = {
  async getItem(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // no-op
    }
  },
  async removeItem(key: string) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // no-op
    }
  },
};

const { url, anonKey } = getEnv();

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: supabaseStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type SupabaseClient = typeof supabase;

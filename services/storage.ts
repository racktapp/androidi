import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@/template';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const supabase = getSupabaseClient();

const KEYS = {
  CURRENT_USER: 'rackt_current_user',
  ONBOARDING_COMPLETE: 'rackt_onboarding_complete',
};

export const StorageService = {
  async setCurrentUser(userId: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.CURRENT_USER, userId);
  },

  async getCurrentUser(): Promise<string | null> {
    return await AsyncStorage.getItem(KEYS.CURRENT_USER);
  },

  async clearCurrentUser(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.CURRENT_USER);
  },

  async setOnboardingComplete(): Promise<void> {
    await AsyncStorage.setItem(KEYS.ONBOARDING_COMPLETE, 'true');
  },

  async isOnboardingComplete(): Promise<boolean> {
    const value = await AsyncStorage.getItem(KEYS.ONBOARDING_COMPLETE);
    return value === 'true';
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([KEYS.CURRENT_USER, KEYS.ONBOARDING_COMPLETE]);
  },
};

/**
 * Upload file to Supabase Storage
 * @param fileUri - Local file URI (file://, http://, or data:)
 * @param fileName - Destination file name
 * @param bucket - Storage bucket name (default: 'avatars')
 * @returns Public URL of uploaded file
 */
export async function uploadFile(
  fileUri: string,
  fileName: string,
  bucket: string = 'avatars'
): Promise<string> {
  try {
    // Get current user ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Path must include user ID folder for RLS policy
    const filePath = `${user.id}/${fileName}`;

    let fileData: ArrayBuffer;

    if (Platform.OS === 'web') {
      // Web: Use fetch to get blob
      const response = await fetch(fileUri);
      const blob = await response.blob();
      fileData = await blob.arrayBuffer();
    } else {
      // Mobile: Convert to base64 then to ArrayBuffer
      const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Convert base64 to ArrayBuffer
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      fileData = bytes.buffer;
    }

    console.log('[Upload] Starting upload:', { bucket, filePath, size: fileData.byteLength });

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileData, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.error('[Upload] Storage error:', error);
      throw error;
    }

    console.log('[Upload] Upload successful:', data);

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    console.log('[Upload] Public URL:', publicUrlData.publicUrl);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('[Upload] Error:', error);
    throw error;
  }
}

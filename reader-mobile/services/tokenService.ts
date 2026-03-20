import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'github_access_token';

/**
 * Save GitHub Personal Access Token securely
 */
export async function saveToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to save token:', error);
    throw error;
  }
}

/**
 * Load GitHub Personal Access Token
 */
export async function loadToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (error) {
    console.error('Failed to load token:', error);
    return null;
  }
}

/**
 * Delete GitHub Personal Access Token
 */
export async function deleteToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (error) {
    console.error('Failed to delete token:', error);
    throw error;
  }
}

/**
 * Check if token is saved
 */
export async function hasToken(): Promise<boolean> {
  try {
    const token = await loadToken();
    return token !== null && token.length > 0;
  } catch (error) {
    return false;
  }
}

import * as SecureStore from 'expo-secure-store';

const REPO_URL_KEY = 'pbd_repo_url';
const GITHUB_TOKEN_KEY = 'pbd_github_token';

const DEFAULT_REPO_URL = 'https://github.com/SaraHan774/pbd-private';

/**
 * Get the stored GitHub repository URL.
 * Returns the default URL if no value has been saved.
 */
export async function getRepoUrl(): Promise<string> {
  try {
    const stored = await SecureStore.getItemAsync(REPO_URL_KEY);
    return stored ?? DEFAULT_REPO_URL;
  } catch (error) {
    console.error('Failed to get repo URL:', error);
    return DEFAULT_REPO_URL;
  }
}

/**
 * Save the GitHub repository URL securely.
 */
export async function setRepoUrl(url: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(REPO_URL_KEY, url);
  } catch (error) {
    console.error('Failed to set repo URL:', error);
    throw error;
  }
}

/**
 * Get the stored GitHub access token.
 * Returns null if no token has been saved.
 */
export async function getGithubToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(GITHUB_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to get GitHub token:', error);
    return null;
  }
}

/**
 * Save the GitHub access token securely.
 * Stored in iOS Keychain / Android EncryptedSharedPreferences —
 * value persists across app updates.
 */
export async function setGithubToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(GITHUB_TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to set GitHub token:', error);
    throw error;
  }
}

/**
 * Delete the GitHub access token from secure storage.
 */
export async function clearGithubToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(GITHUB_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to clear GitHub token:', error);
    throw error;
  }
}

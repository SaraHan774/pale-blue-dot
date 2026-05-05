import Constants from 'expo-constants';

export const APP_ENV =
  (Constants.expoConfig?.extra?.appEnv as string | undefined) ?? 'development';

export const IS_PRODUCTION = APP_ENV === 'production';
export const IS_PREVIEW = APP_ENV === 'preview';
export const IS_DEVELOPMENT = APP_ENV === 'development';

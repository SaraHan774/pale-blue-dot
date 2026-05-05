const IS_PROD = process.env.APP_ENV === 'production';
const IS_PREVIEW = process.env.APP_ENV === 'preview';
const APP_ENV = process.env.APP_ENV ?? 'development';

const appName = IS_PROD
  ? 'Pale Blue Dot Reader'
  : IS_PREVIEW
  ? 'PBD Reader (Preview)'
  : 'PBD Reader (Dev)';

const androidPackage = IS_PROD
  ? 'com.palebluedot.reader'
  : IS_PREVIEW
  ? 'com.palebluedot.reader.preview'
  : 'com.palebluedot.reader.dev';

module.exports = {
  expo: {
    name: appName,
    slug: 'pale-blue-dot-reader',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#1a1a1a',
    },
    assetBundlePatterns: ['**/*'],
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#1a1a1a',
      },
      package: androidPackage,
      versionCode: 1,
      permissions: ['android.permission.INTERNET'],
      statusBarTranslucent: false,
    },
    scheme: 'palebluedot',
    plugins: [
      'expo-router',
      [
        'expo-build-properties',
        {
          android: { newArchEnabled: false },
        },
      ],
    ],
    extra: {
      router: {},
      eas: {
        projectId: 'fbdc82b7-3ee2-4172-8b45-8fbbffda0b1f',
      },
      appEnv: APP_ENV,
    },
    owner: 'vertias-lux-mea',
  },
};

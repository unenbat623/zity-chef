import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'mn.zity.chef',
  appName: 'Zity Chef',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;

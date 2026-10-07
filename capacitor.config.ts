import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.xikosan.gameofconcepts',
  appName: 'Игра понятий',
  webDir: 'dist',
  plugins: { SystemBars: { hidden: true, insetsHandling: 'disable' } }
};

export default config;

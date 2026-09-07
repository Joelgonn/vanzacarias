import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.vanusazacarias.nutri',
  appName: 'Vanusa Zacarias Nutri',
  webDir: 'public',
  server: {
    url: 'https://vanzacarias-mu.vercel.app',
    cleartext: false,
    androidScheme: 'https'
  }
};

export default config;

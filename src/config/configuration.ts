// src/config/configuration.ts
export default () => ({
    port: parseInt(process.env.PORT!, 10) || 5000,
    clientUrl: process.env.NEXT_PUBLIC_CLIENT_URL || 'http://localhost:3000',
    database: {
      url: process.env.DATABASE_URL,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
    resend: {
      apiKey: process.env.RESEND_API_KEY || '',
    },
  });
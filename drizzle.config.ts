// This file provides the drizzle auth schema (with types) When you run Drizzle Kit CLI commands:
// npx drizzle-kit generate (generates migrations) or pnpm drizzle-kit generate
// npx drizzle-kit migrate (runs migrations) or pnpm drizzle-kit migrate
// npx drizzle-kit push (pushes schema to DB) or pnpm drizzle-kit push

// They are standalone Node.js scripts, not part of the NestJS app. So, no NestJS DI container exists here (hence the use of process.env.DATABASE_URL!)

import { defineConfig } from "drizzle-kit";
export default defineConfig({
    schema: './src/auth/schema.ts',
    out: './drizzle',  // output directory for migrations
    dialect: 'postgresql',  // database dialect
    dbCredentials: {
        url: process.env.DATABASE_URL!  // database URL
    }
});
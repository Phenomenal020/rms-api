import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";

// use npx @better-auth/cli generate --config=./src/auth/auth.ts to generate the migrations (dummy instance)
export const auth = betterAuth({
  database: drizzleAdapter({}, {
    provider: 'pg',
  })
});
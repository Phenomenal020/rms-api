import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ConfigService } from '@nestjs/config';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { sendPasswordResetEmail } from './emails/send-password-reset-email';
import { sendEmailVerificationEmail } from './emails/send-email-verification-email';
import { sendDeleteAccountVerificationEmail } from './emails/delete-account-verification-email';
import { sendEmailChange } from './emails/send-change-email';
import { passwordSchema } from './validation';

export function createBetterAuth(database: NodePgDatabase, configService: ConfigService) {
  return betterAuth({
    // Database configuration - postgres with drizzle adapter
    database: drizzleAdapter(database, {
      provider: 'pg',
    }),

    trustedOrigins: [
      configService.get<string>("clientUrl") ?? "http://localhost:3000",
    ],

    // Email and Password Authentication
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // do not require email verification for login
      // TODO: Use void to prevent timing attacks - don't await email sending
      sendResetPassword: async ({ user, url, token }, request) => {
        if (!user.email) {
          throw new Error("User email is required for password reset");
        }
        await sendPasswordResetEmail({
          user: {
            name: user.name,
            email: user.email,
          },
          url,
          token,
        });
      },
    },

    // User Management
    user: {
      // Additional fields in user schema
      additionalFields: {
        role: {
          type: "string",
          input: false,
        },
        firstName: {
          type: "string",
          input: true,
        },
        lastName: {
          type: "string",
          input: true,
        },
        subscription: {
          type: "string",
          input: true,
        },
      },
      // EMAIL CHANGE VERIFICATION
      changeEmail: {
        enabled: true,
        // Email change token expires in 24 hours (86400 seconds)
        sendChangeEmailVerification: async ({ user, url, newEmail }) => {
          await sendEmailChange({
            user: { ...user, email: newEmail },
            url,
          });
        },
      },
      deleteUser: {
        enabled: true,
        sendDeleteAccountVerification: async ({ user, url }) => {
          await sendDeleteAccountVerificationEmail({ user, url });
        },
      },
    },

    // EMAIL VERIFICATION ON SIGN UP
    emailVerification: {
      autoSignInAfterVerification: false,
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmailVerificationEmail({ user, url });
      },
    },

    // PASSWORD VALIDATION (server-side)
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (
          ctx.path === "/sign-up/email" ||
          ctx.path === "/reset-password" ||
          ctx.path === "/change-password"
        ) {
          const password = ctx.body as {
            password?: string;
            newPassword?: string;
          };
          const { error } = passwordSchema.safeParse(
            password.password || password.newPassword
          );
          if (error) {
            throw new APIError("BAD_REQUEST", {
              message: error.message,
            });
          }
        }
      }),
    },

    // Social providers
    socialProviders: {
      google: {
        clientId: configService.get<string>("google.clientId") ?? "",
        clientSecret: configService.get<string>("google.clientSecret") ?? "",
      },
    },
  });
}

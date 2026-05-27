// Dummy auth instance used only by the Better Auth CLI to generate schema/migrations.
// Manually kept in sync with the plugins and additionalFields in auth-setup.ts.
// Usage: run `pnpm run auth:generate`

import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import { emailOTP, twoFactor, organization, admin as adminPlugin } from "better-auth/plugins";

import { ac, orgadmin, admin, user } from "./permissions";

export const auth = betterAuth({
  database: drizzleAdapter({} as any, {
    provider: 'pg',
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },

  user: {
    additionalFields: {
      // role is managed by the admin plugin — not declared here
      firstName: {
        type: "string",
        input: true,
      },
      lastName: {
        type: "string",
        input: true,
      },
      // subscription removed from user — it lives on the organization (school) instead
    },
    changeEmail: {
      enabled: false,
    },
    deleteUser: {
      enabled: false,
    },
  },

  emailVerification: {
    autoSignInAfterVerification: true,
    sendOnSignUp: false, // link-based send is disabled; OTP is sent via emailOTP.sendVerificationOnSignUp
  },

  appName: "RMS",
  plugins: [
    emailOTP({
      overrideDefaultEmailVerification: true,
      otpLength: 6,
      expiresIn: 5 * 60,
      allowedAttempts: 2,
      sendVerificationOnSignUp: true,
      async sendVerificationOTP() {},
    }),
    twoFactor({
      skipVerificationOnEnable: true,
      otpOptions: {
        period: 5,
        async sendOTP() {},
      },
    }),
    // organisation plugin — each organisation represents a school.
    // Extra fields (schoolAddress, schoolMotto, schoolTelephone, schoolEmail) are stored in the metadata JSON column.
    organization({
      disableOrganizationDeletion: true,
      membershipLimit: 100,
      cancelPendingInvitationsOnReInvite: true,
      requireEmailVerificationOnInvitation: true,
    }),

    // Admin plugin for user management and impersonation
    adminPlugin({
      ac,
      roles: { orgadmin, admin, user },
      adminRoles: ["admin"],
      defaultRole: "user",
      impersonationSessionDuration: 60 * 30,
    }),
  ],

  socialProviders: {
    google: {
      clientId: "",
      clientSecret: "",
    },
  },
});

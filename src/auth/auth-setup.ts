// Better Auth setup
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ConfigService } from '@nestjs/config';

import { betterAuth } from 'better-auth';
import { emailOTP, twoFactor, organization } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { admin as adminPlugin } from "better-auth/plugins"

import { sendPasswordResetEmail } from './emails/send-password-reset-email';
import { sendVerifyEmailOtp } from './emails/send-email-verification-email';
import { send2FAOtpEmail } from './emails/send-2fa-otp-email';

import { passwordSchema } from './validation';
import { z } from 'zod';

import { ac, orgadmin, admin, user } from './permissions';
import { getOrganisationByUserId } from './helpers';
import type * as schema from './schema';

// Organisation metadata schema
const orgMetadataSchema = z.object({
  address: z.string().trim().max(255, { message: "Address must be 255 characters or fewer" }).nullable().optional(),
  motto: z.string().trim().max(500, { message: "Motto must be 500 characters or fewer" }).nullable().optional(),
  telephone: z.string().trim().max(20, { message: "Telephone must be 20 characters or fewer" }).nullable().optional(),
  email: z.email({ message: "Invalid email address" }).nullable().optional(),
}).optional();

// Create organisation schema
const createOrgSchema = z.object({
  name: z.string({ error: "School name is required" }).trim().min(1, { error: "School name is required" }).max(100, { error: "School name must be 100 characters or fewer" }),
  metadata: orgMetadataSchema,
});

// Update organisation schema
const updateOrgSchema = z.object({
  name: z.string().trim().min(1, { error: "School name cannot be empty" }).max(100, { error: "School name must be 100 characters or fewer" }).optional(),
  metadata: orgMetadataSchema,
});


// generate a random slug for the organisation
function generateSlug(fullName: string) {
  // extract the base name from the full school name
  const baseName = fullName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")   // remove special characters
    .replace(/\s+/g, "-")            // replace spaces with hyphens
    .replace(/-+/g, "-");            // collapse multiple hyphens
  // append suffix and return (conflicts very unlikely, so not checked)
  const suffix = crypto.randomUUID().split("-")[0]; // e.g. "f47ac10b"
  return `${baseName}-${suffix}`;
}


export function createBetterAuth(database: NodePgDatabase, configService: ConfigService) {
  return betterAuth({
    // Database configuration - postgres with drizzle adapter
    database: drizzleAdapter(database, {
      provider: 'pg',
    }),

    // Only allow requests from the trusted origins
    trustedOrigins: [
      configService.get<string>("clientUrl") ?? "http://localhost:3000",
    ],

    // Email and Password Authentication
    emailAndPassword: {
      enabled: true, // enable email and password authentication
      requireEmailVerification: true, // require email verification for login
      // Password Reset (link-based — not used; OTP-based reset is handled via emailOTP plugin below)
      // sendResetPassword: async ({ user, url, token }, request) => { ... },
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 10 * 60, // 600 seconds = 10 minutes
      // custom synthesic user for the user schema to prevent email enumeration attacks. Used when plugins add fields to the user table to ensure the fake response is indistinguishable from the real response.
      customSyntheticUser: ({ coreFields, additionalFields, id }) => (
        {
          ...coreFields,
          // admin plugin fields
          role: "user",
          banned: false,
          banReason: null,
          banExpires: null,
          // two factor plugin fields
          twoFactorEnabled: false,
          // additional fields
          ...additionalFields,
          // ids
          id
        }
      )
    },

    // User Management
    user: {
      // Additional fields in user schema
      additionalFields: {
        firstName: {
          type: "string",
          input: true,
        },
        lastName: {
          type: "string",
          input: true,
        },
      },

      // Email Change Verification
      changeEmail: {
        enabled: false, // not allowed. Admin should simply reassign the class to a new user/email
        // sendChangeEmailVerification: async ({ user, url, newEmail }) => {
        //   await sendEmailChange({ user, url, newEmail });
        // },
      },

      deleteUser: {
        enabled: false, // not allowed.
        // sendDeleteAccountVerification: async ({ user, url }) => {
        //   await sendDeleteAccountVerificationEmail({ user, url });
        // },
      },
    },

    // Email Verification on Sign Up
    emailVerification: {
      autoSignInAfterVerification: true,  // auto sign-in after email verification so user lands on dashboard
      sendOnSignUp: false, // link-based send is disabled; OTP is sent automatically via emailOTP.sendVerificationOnSignUp
      // sendVerificationEmail: async ({ user, url }) => {
      //   await sendEmailVerificationEmail({ user, url });
      // },
    },

    appName: "RMS",
    plugins: [
      // email otp for forgot/password reset and email verification
      emailOTP({
        // override the default email verification so BA uses otp for email verification rather than clicking a link
        overrideDefaultEmailVerification: true,
        otpLength: 6,  // default anyway
        expiresIn: 5 * 60, // 300 seconds = 5 minutes
        allowedAttempts: 2, // make it stricter
        sendVerificationOnSignUp: true, // automatically send OTP on sign-up (removes the need for a manual client-side call)
        // configure the email to send
        async sendVerificationOTP({ email, otp, type }) {
          if (type === "sign-in") {
            // await sendEmailVerificationEmail({ email, otp });
          } else if (type === "email-verification") {
            await sendVerifyEmailOtp({ email, otp });
          } else {   // password reset
            await sendPasswordResetEmail({ email, otp });
          }
        },
      }),

      // 2FA for sign in
      twoFactor({
        // skip TOTP verification when first enabling
        skipVerificationOnEnable: true,
        // OTP options
        otpOptions: {
          period: 5, // expires in 5mins
          async sendOTP({ user, otp }) {
            await send2FAOtpEmail({ email: user.email, otp, name: user.name });
          }
        }
      }),

      // organisation plugin — each organisation represents a school.
      organization({

        // disable organisation deletion
        disableOrganizationDeletion: true,

        // only org admins can create organisations (schools)
        allowUserToCreateOrganization: async (user) => {
          const role = user.role;
          return role === "orgadmin";
        },

        // Max members per organisation?
        membershipLimit: 100,

        // cancel any existing pending invitation when a new one is sent to the same email
        cancelPendingInvitationsOnReInvite: true,

        // Users must verify their email before they can accept or reject invitations.
        requireEmailVerificationOnInvitation: true,

        // // setup invitation email
        // async sendInvitationEmail(data) {
        //   const inviteLink = await generateInviteLink(data.id);
        //   await sendOrganizationInvitation({
        //     email: data.email,
        //     invitedByUsername: data.inviter.user.name,
        //     invitedByEmail: data.inviter.user.email,
        //     teamName: data.organization.name,
        //     inviteLink: inviteLink,
        //   })
        // }

        organizationHooks: {
          // Organisation hooks: before/after create, update, delete org; before/after add/remove member; before/after invite.
          // before organisation creation hook
          beforeCreateOrganization: async ({ organization, user }) => {
            // parse the payload
            const result = createOrgSchema.safeParse({
              name: organization.name,
              metadata: organization.metadata,
            });
            // if there is an error, throw a bad request error
            if (!result.success) {
              throw new APIError("BAD_REQUEST", { message: result.error.issues[0].message });
            }
            // Otherwise, generate a slug for the organisation 
            const slug =
              organization.slug === "autogenerate"
                ? generateSlug(organization.name!)
                : organization.slug;
            // Return the modified data
            return {
              data: {
                ...organization,
                slug,
              },
            };
          },

          // before organisation update hook
          beforeUpdateOrganization: async ({ organization, user, member }) => {
            // Parse the payload
            const result = updateOrgSchema.safeParse({
              name: organization.name,
              metadata: organization.metadata,
            });
            // if there is an error, throw a bad request error
            if (!result.success) {
              throw new APIError("BAD_REQUEST", { message: result.error.issues[0].message });
            }
            // Return the modified data
            return {
              data: {
                ...organization,
                name: organization.name?.trim(),
                metadata: organization.metadata,
              },
            };
          },

          // // before a member is added to an organisation hook
          // beforeAddMember: async ({ member, user, organization }) => {
          //   return {
          //     data: {
          //       ...member,
          //       role: "custom-role", // Override the role
          //     },
          //   };
          // },
        }
      }),

      // Admin plugin for user management and impersonation
      adminPlugin({
        ac,
        roles: { orgadmin, admin, user },
        adminRoles: ["admin"],
        defaultRole: "user",
        impersonationSessionDuration: 60 * 30, // 30 minutes
        defaultBanReason: "Account is under investigation",
        bannedUserMessage: "Your account has been temporarily disabled for investigation as per our terms of service. Please contact support if you believe this is an error."
      }),
    ],

    databaseHooks: {
      session: {
        create: {
          // Automatically set the user's organisation as the active organisation on every new session.
          // This means useActiveOrganization() works immediately after login — no client-side workarounds needed.
          before: async (session) => {
            const organisation = await getOrganisationByUserId(
              database as unknown as NodePgDatabase<typeof schema>,
              session.userId,
            );

            // If the user has no organisation (e.g. a plain user not yet added to a school), leave the session unchanged
            if (!organisation) return { data: session };

            return {
              data: {
                ...session,
                activeOrganizationId: organisation.id,
              },
            };
          },
        },
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
          // Validate password on the server side
          const body = ctx.body as { password?: string; newPassword?: string; email?: string };
          const { error } = passwordSchema.safeParse(body.password || body.newPassword);
          if (error) {
            throw new APIError("BAD_REQUEST", { message: error.message });
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
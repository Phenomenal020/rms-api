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
import * as schema from './schema';


// Helpers
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

// Update organisation schema — name, slug, and address are not updatable after onboarding
const updateOrgSchema = z.object({
  metadata: z.object({
    motto: z.string().trim().max(500, { message: "Motto must be 500 characters or fewer" }).nullable().optional(),
    telephone: z.string().trim().max(20, { message: "Telephone must be 20 characters or fewer" }).nullable().optional(),
    email: z.email({ message: "Invalid email address" }).nullable().optional(),
  }).optional(),
});

// generate a random slug for the organisation - organisation regId
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
    // Pass schema so org plugin models (member, invitation, …) resolve correctly.
    database: drizzleAdapter(database, {
      provider: 'pg',
      schema,
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
          required: true,
        },
        lastName: {
          type: "string",
          input: true,
          required: true,
        },
        signUpRole: {
          type: ["TEACHER", "SCHOOL_ADMIN"],
          input: true,
          required: true,
          defaultValue: "TEACHER",
        },
        onboardingStatus: {
          type: ["NONE", "PENDING", "APPROVED", "REJECTED", "CANCELLED"],
          input: false,
          required: true,
          defaultValue: "NONE",
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
        // only platform admins can create organisations (schools)
        allowUserToCreateOrganization: async (user) => {
          const role = user.role;
          return role === "admin";
        },
        // Max members per organisation?
        membershipLimit: 100,
        organizationHooks: {
          // Organisation hooks: before/after create, update, delete org; before/after add/remove member; before/after invite.
          // before organisation creation hook
          // Check that the user is not already a member of this organisation or any other one (and that the organisation doesnt already have an orgadmin)
          beforeCreateOrganization: async ({ organization }) => {
            // parse the payload (use safeParse to prevent error throws)
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
          // before organisation update hook: do not allow the orgadmin to update name, slug, or address
          beforeUpdateOrganization: async ({ organization, user }) => {
            // only verified orgadmins with 2FA can update organisations (schools)
            if (
              user.role !== "orgadmin" ||
              user.twoFactorEnabled !== true ||
              user.emailVerified !== true
            ) {
              throw new APIError("FORBIDDEN", { message: "You are not authorized to update this organisation" });
            }
            // Ensure name and slug are undefined
            if (organization.name !== undefined || organization.slug !== undefined) {
              throw new APIError("BAD_REQUEST", {
                message: "School name and registration ID cannot be updated",
              });
            }
            // Get the incoming metadata from the payload
            const incomingMetadata = organization.metadata;
            // Remove the address from the metadata
            const { address: _, ...metadataWithoutAddress } =
              incomingMetadata && typeof incomingMetadata === "object"
                ? incomingMetadata
                : {};
            // Parse the modified metadata payload (w/o address)
            const result = updateOrgSchema.safeParse({
              metadata: incomingMetadata === undefined ? undefined : metadataWithoutAddress,
            });
            // If there is an error, throw a bad request error
            if (!result.success) {
              throw new APIError("BAD_REQUEST", { message: result.error.issues[0].message });
            }
            // Otherwise, get the existing organisation from the db
            const existingOrg = await getOrganisationByUserId(
              database as unknown as NodePgDatabase<typeof schema>,
              user.id,
            );
            // Extract the existing address from the organisation
            const existingAddress =
              existingOrg?.metadata && typeof existingOrg.metadata === "object"
                ? (existingOrg.metadata as Record<string, unknown>).address
                : undefined;
            // If the client sent no metadata, leave the stored record unchanged
            if (result.data.metadata === undefined) {
              return;
            }
            return {
              data: {
                metadata: {
                  ...result.data.metadata,
                  address: existingAddress,
                },
              },
            };
          },
          // before add member: `user` is the person being added (not the caller).
          // Reject if they already belong to any organisation.
          beforeAddMember: async ({ member, user }) => {
            const existingOrg = await getOrganisationByUserId(
              database as unknown as NodePgDatabase<typeof schema>,
              member.userId ?? user.id,
            );
            if (existingOrg) {
              throw new APIError("BAD_REQUEST", {
                message: "This user already belongs to a school",
              });
            }
          },
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
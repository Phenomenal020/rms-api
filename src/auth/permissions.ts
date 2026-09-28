import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, userAc } from "better-auth/plugins/admin/access";

// Permission vocabulary (admin plugin defaults + org create for school onboarding).
const statement = {
  ...defaultStatements,
  organization: ["create"],
} as const;

export const ac = createAccessControl(statement);

// Platform admin — admin dashboard: list users, change role, ban/unban only.
export const admin = ac.newRole({
  user: ["list", "set-role", "ban", "impersonate"],
});

// Teacher / staff — no Better Auth admin-plugin powers.
export const user = ac.newRole({
  ...userAc.statements,
});

// School admin — create organisation (school) during onboarding.
export const orgadmin = ac.newRole({
  organization: ["create"],
});

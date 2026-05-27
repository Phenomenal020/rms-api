import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc, userAc } from "better-auth/plugins/admin/access";


// All resources and their allowed actions across the platform (resource name: [actions])
const statement = {
    ...defaultStatements,
    user:         ["get", "update", "create", "list", "set-role", "ban", "impersonate", "impersonate-admins", "delete", "set-password" ],
    session:      ["list", "revoke", "delete"],
    organization: ["create"],
} as const;

// create the access controller
export const ac = createAccessControl(statement);

// admin: full platform access (maps to user.role === "admin")
export const admin = ac.newRole({
    ...adminAc.statements,
});

export const user = ac.newRole({
    ...userAc.statements,
})

// orgadmin: can create and update their own organisation (maps to user.role === "orgadmin")
export const orgadmin = ac.newRole({
    organization: ["create"],
});

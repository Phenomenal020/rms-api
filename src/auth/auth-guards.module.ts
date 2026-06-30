import { Global, Module } from '@nestjs/common';
import { OrgAdminGuard } from './guards/org-admin.guard';
import { OrgMemberGuard } from './guards/org-member.guard';
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import { UserGuard } from './guards/user.guard';

@Global()
@Module({
  providers: [UserGuard, OrgAdminGuard, OrgMemberGuard, PlatformAdminGuard],
  exports: [UserGuard, OrgAdminGuard, OrgMemberGuard, PlatformAdminGuard],
})
export class AuthGuardsModule {}

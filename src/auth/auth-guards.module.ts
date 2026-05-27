import { Global, Module } from '@nestjs/common';
import { OrgAdminGuard } from './guards/org-admin.guard';
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import { UserGuard } from './guards/user.guard';

@Global()
@Module({
  providers: [UserGuard, OrgAdminGuard, PlatformAdminGuard],
  exports: [UserGuard, OrgAdminGuard, PlatformAdminGuard],
})
export class AuthGuardsModule {}

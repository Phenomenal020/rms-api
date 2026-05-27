import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ROLE_ORG_ADMIN } from '../roles';

// Organisation admin only. Runs after global AuthGuard (session must exist).
@Injectable()
export class OrgAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user ?? request.session?.user;

    if (!user?.id) {
      throw new UnauthorizedException('Unauthorised operation');
    }

    if (user.role !== ROLE_ORG_ADMIN) {
      throw new UnauthorizedException('Unauthorised operation');
    }  // deliberate to avoid leaking resource exists.

    return true;
  }
}
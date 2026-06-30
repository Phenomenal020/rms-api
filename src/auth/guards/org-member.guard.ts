import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ROLE_ORG_ADMIN, ROLE_USER } from '../roles';

const ORG_MEMBER_ROLES = new Set<string>([ROLE_USER, ROLE_ORG_ADMIN]);

// Any authenticated school member (teacher or org admin). Runs after global AuthGuard.
@Injectable()
export class OrgMemberGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user ?? request.session?.user;

    if (!user?.id) {
      throw new UnauthorizedException('Unauthorised operation. Please sign in first..');
    }

    if (!ORG_MEMBER_ROLES.has(user.role)) {
      throw new UnauthorizedException('Unauthorised operation. You are not authorised to access this resource.');
    }

    return true;
  }
}

import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import * as schema from '../auth/schema';
import { user } from '../auth/schema';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateRecoveryDto } from './dto/update-recovery.dto';

@Injectable()
export class UsersService {

  // Inject the database connection
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,  // with drizzle client
  ) { }

  async updateProfile(userId: string, updateData: UpdateProfileDto) {
    // Update user profile
    const [updatedUser] = await this.db  // use it to run queries
      .update(user)
      .set({
        firstName: updateData.firstName,
        lastName: updateData.lastName,
        name: `${updateData.firstName} ${updateData.lastName}`,
      })
      .where(eq(user.id, userId))
      .returning({ id: user.id });

    if (!updatedUser) {
      throw new UnauthorizedException('User not found');
    }
  }

  // // Upsert recovery question + hashed answer for the user.
  // // The answer is normalised (trimmed, lowercased) before hashing so casing
  // // differences at verification time don't cause false negatives.
  // async updateRecovery(userId: string, dto: UpdateRecoveryDto): Promise<void> {
  //   const answerHash = crypto
  //     .createHash('sha256')
  //     .update(dto.answer)   // already trimmed+lowercased by the DTO transform
  //     .digest('hex');

  //   await this.db
  //     .insert(userRecovery)
  //     .values({
  //       userId,
  //       question: dto.question,
  //       answerHash,
  //     })
  //     .onConflictDoUpdate({
  //       target: userRecovery.userId,
  //       set: {
  //         question: dto.question,
  //         answerHash,
  //       },
  //     });
  // }

  // // Returns whether the user has set a recovery question
  // async getRecoveryStatus(userId: string): Promise<{ hasRecovery: boolean }> {
  //   const [row] = await this.db
  //     .select({ id: userRecovery.id })
  //     .from(userRecovery)
  //     .where(eq(userRecovery.userId, userId))
  //     .limit(1);

  //   return { hasRecovery: !!row };
  // }

  // Pure identity fetch — runs on every app load via GET /users/user.
  // Returns only the user row: role, name, email, schoolId, emailVerified, etc.
  // schoolId being non-null is sufficient for the shell to know a school exists.
  // Everything else (school details, terms, assessments…) is fetched on demand
  // by each page through its own dedicated endpoint.
  async getUser(userId: string) {
    const [userData] = await this.db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

      // If user not found, throw an unauthorized exception
    if (!userData) {
      throw new UnauthorizedException('User not found');
    }

    // Return the user data
    return userData;
  }
}
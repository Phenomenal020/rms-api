import { Injectable, UnauthorizedException, Inject} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import * as schema from '../auth/schema';
import { user } from '../auth/schema';
import { eq } from 'drizzle-orm';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {

  constructor(
    @Inject(DATABASE_CONNECTION)  // inject the database connection
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

  // Get user with all relations - Used for displaying school, term, students, subjects, assessments, and grading system
  async getUserWithRelations(userId: string) {
    const userData = await this.db.query.user.findFirst({
      where: eq(user.id, userId),
      with: {
        // Get school information (used for school header)
        school: true,
        // Get academic term with all nested relations
        academicTerm: {
          with: {
            // Get class information for the term
            class: true,
            // Get subjects for the term, ordered by creation date
            subjects: {
              orderBy: (subjects, { asc }) => [asc(subjects.createdAt)],
            },
            // Get assessment structures for the term, ordered by order field
            // to ensure assessment structures are in correct order (e.g., CA-1 before Exam-3)
            assessmentStructure: {
              orderBy: (assessmentStructure, { asc }) => [asc(assessmentStructure.order)],
            },
            // Get grading entries for the term, ordered by minScore descending
            // to ensure grading entries are in correct order (e.g., A 90-100 before B 80-89)
            gradingEntry: {
              orderBy: (gradingEntry, { desc }) => [desc(gradingEntry.minScore)],
            },
            // Get students for the term with their subjects and assessments
            students: {
              with: {
                // Subjects offered by the student (junction table for many-many relationship)
                subjects: {
                  with: {
                    // Subject information
                    subject: true,
                    // Assessments live here
                    assessments: {
                      with: {
                        // Assessments have scores (an array of scores according to the assessment structure)
                        scores: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!userData) {
      throw new UnauthorizedException('User not found');
    }

    return userData;
  }
}
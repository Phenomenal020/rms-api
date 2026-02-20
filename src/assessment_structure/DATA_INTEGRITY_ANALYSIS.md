# Assessment Structure Data Integrity Analysis

## Critical Data Integrity Issue

### The Problem Scenario

**Current State:**
- Assessment Structure: CA (id: "abc-123", 30%), Exam (id: "def-456", 70%)
- Students have assessment scores:
  - Student A: CA score = 80 (assessmentStructureId: "abc-123")
  - Student A: Exam score = 90 (assessmentStructureId: "def-456")

**User Action:**
- Removes CA from structure
- Changes to: Exam (100%)

**What Happens:**
1. Backend deletes CA assessment structure record (id: "abc-123")
2. Database constraint: `assessmentScore.assessmentStructureId` has `onDelete: "cascade"` (schema.ts:408)
3. **ALL CA scores are CASCADE DELETED** - Historical data is permanently lost!

### Impact

- **Data Loss**: All historical CA scores are deleted
- **Grade Calculation Errors**: Final grades become incorrect (missing CA component)
- **Audit Trail Broken**: Cannot reconstruct historical grades
- **Compliance Issues**: May violate record-keeping requirements
- **User Confusion**: Teachers won't understand why scores disappeared

---

## Current Implementation Analysis

### Schema Constraints

**File:** `schema.ts:406-408`
```typescript
assessmentStructureId: text("assessment_structure_id")
  .notNull()
  .references(() => assessmentStructure.id, { onDelete: "cascade" })
```

**Problem:** `onDelete: "cascade"` means:
- When an assessment structure is deleted, all related scores are automatically deleted
- No validation or warning before deletion
- No way to recover deleted data

### Backend Service

**File:** `assessment-structure.service.ts:96-104`
- Currently deletes assessment structures without checking for existing scores
- No validation similar to subjects service (which checks for student enrollments)
- No error handling for cascade deletions

---

## Senior Developer Approaches

### Option 1: Prevent Deletion if Scores Exist ⭐ **RECOMMENDED**

**Approach:** Similar to subjects service - check if assessment scores exist before allowing deletion.

**Pros:**
- Prevents data loss
- Clear error messages to users
- Maintains data integrity
- Simple to implement

**Cons:**
- Users cannot change structure once scores are entered
- May be too restrictive for some use cases

**Implementation:**
```typescript
// Before deletion, check if scores exist
const scoresInUse = await tx
  .select({ assessmentStructureId: assessmentScore.assessmentStructureId })
  .from(assessmentScore)
  .where(inArray(assessmentScore.assessmentStructureId, structuresToDeleteIds));

if (scoresInUse.length > 0) {
  throw new BadRequestException(
    'Cannot delete assessment structure components that have existing scores. Please remove all scores before modifying the structure.'
  );
}
```

### Option 2: Soft Delete (Mark as Inactive)

**Approach:** Add `isActive` or `deletedAt` field, mark as inactive instead of deleting.

**Pros:**
- Preserves historical data
- Allows structure changes
- Can still query historical scores

**Cons:**
- More complex schema and queries
- Requires migration to add new field
- Need to filter inactive structures in queries

**Implementation:**
```typescript
// Add to schema
isActive: boolean("is_active").default(true).notNull(),

// Instead of delete, update
await tx.update(assessmentStructure)
  .set({ isActive: false, deletedAt: new Date() })
  .where(...);
```

### Option 3: Structure Versioning

**Approach:** Create new structure version, keep old one for historical reference.

**Pros:**
- Complete audit trail
- Can reconstruct any historical grade calculation
- Most flexible for reporting

**Cons:**
- Most complex implementation
- Requires significant schema changes
- More storage overhead

**Implementation:**
```typescript
// Add versioning fields
version: integer("version").notNull(),
parentStructureId: text("parent_structure_id").references(...),
isCurrent: boolean("is_current").default(true),
```

### Option 4: Warning + Confirmation (Client-Side)

**Approach:** Warn user about data impact, allow if they confirm.

**Pros:**
- User has control
- Simple to implement (client-side only)

**Cons:**
- **NOT SUFFICIENT** - Users may not understand implications
- Data still gets deleted
- No server-side protection
- Easy to bypass

**Note:** This should be combined with Option 1, not used alone.

### Option 5: Data Migration/Transformation

**Approach:** When structure changes, migrate existing scores to new structure.

**Pros:**
- Preserves data
- Allows structure flexibility

**Cons:**
- Complex migration logic
- May not always be possible (e.g., CA → Exam migration doesn't make sense)
- Risk of data corruption if migration fails

**Example:** If CA (30%) is removed and Exam becomes 100%, what happens to CA scores?
- Option A: Distribute CA scores proportionally to remaining components
- Option B: Set CA scores to null/zero
- Option C: Reject the change

---

## Recommended Solution: Hybrid Approach

### Primary: Prevent Deletion if Scores Exist (Option 1)

**Why:** This is the safest approach that prevents data loss.

**Implementation:**
1. Before deleting assessment structures, check if any `assessmentScore` records reference them
2. If scores exist, throw `BadRequestException` with clear message
3. User must delete scores first (or we provide a bulk delete option)

### Secondary: Client-Side Warning

**Why:** Improves UX by warning users before they attempt the change.

**Implementation:**
1. Before submitting form, check if any structures will be deleted
2. If deletion detected, show warning modal:
   - "Warning: Removing assessment components will delete all related scores"
   - "This action cannot be undone"
   - "X students will be affected"
   - Require explicit confirmation

### Future Enhancement: Soft Delete (Option 2)

**Why:** Provides flexibility while maintaining data integrity.

**Implementation:**
1. Add `isActive` field to schema
2. Migrate existing data
3. Update queries to filter inactive structures
4. Allow "reactivation" of old structures if needed

---

## Implementation Priority

### High Priority (Immediate)
1. ✅ **Add validation to prevent deletion if scores exist** (like subjects service)
2. ✅ **Add client-side warning** before structure changes
3. ✅ **Improve error messages** to guide users

### Medium Priority (Next Sprint)
4. Consider soft delete implementation
5. Add audit logging for structure changes
6. Provide bulk score deletion option (if needed)

### Low Priority (Future)
7. Structure versioning system
8. Data migration tools
9. Historical grade reconstruction features

---

## Code Changes Required

### Backend (assessment-structure.service.ts)

1. **Import assessmentScore schema**
2. **Add validation before deletion** (similar to subjects service lines 99-114)
3. **Check for existing scores** using `assessmentScore` table
4. **Throw BadRequestException** if scores exist

### Frontend (assessment-structure-form.tsx)

1. **Add warning modal** before submission if structures will be deleted
2. **Show affected student count** (if available)
3. **Require explicit confirmation** before proceeding
4. **Improve error message display** for backend validation errors

---

## Comparison with Subjects Module

The subjects module already implements this pattern:
- ✅ Checks for `studentSubject` records before deletion
- ✅ Throws clear error message
- ✅ Prevents data loss

**Assessment structures should follow the same pattern** for consistency and data integrity.

---

## Conclusion

**Current State:** ⚠️ **CRITICAL VULNERABILITY** - Assessment structure changes can cause permanent data loss.

**Recommended Action:** Implement Option 1 (prevent deletion if scores exist) immediately, similar to how subjects service handles it. This is the safest, simplest, and most consistent approach.

**Long-term:** Consider soft delete (Option 2) for more flexibility while maintaining data integrity.

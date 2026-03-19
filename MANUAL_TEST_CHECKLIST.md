# Group Creation Fix - Manual Test Checklist

> Status note: this checklist is still manual-only. Automation now covers lint, release smoke checks, manifest trimming, and release-signing safeguards, but the scenarios below still require human validation on a real build.

## Critical Tests (Must Pass)

### Test 1: New Group Creation
**Objective**: Verify atomic group creation with owner membership

**Steps**:
1. Navigate to Groups tab
2. Tap "Create Group"
3. Enter group name (e.g., "Test Tennis Club")
4. Select sport focus (Tennis/Padel/Mixed)
5. Optionally invite friends
6. Tap "Create Group"

**Expected Results**:
- ✅ Group is created in database
- ✅ Owner membership row exists in group_members
- ✅ App navigates to group detail page (NOT "Group Not Found")
- ✅ Group detail page loads successfully showing:
  - Group name
  - Sport focus
  - Member count (at least 1 - the owner)

**Failure Indicators**:
- ❌ "Group Not Found" error after creation
- ❌ Stuck on "Loading..." screen
- ❌ Error message displayed
- ❌ No navigation occurs

---

### Test 2: Groups Home List
**Objective**: Verify created group appears in Groups Home immediately

**Steps**:
1. After creating a group (from Test 1)
2. Navigate back to Groups tab home
3. Optionally pull to refresh

**Expected Results**:
- ✅ New group appears in the list
- ✅ Group card shows correct name and sport focus
- ✅ Member count is accurate
- ✅ Tapping group card navigates to group detail

**Failure Indicators**:
- ❌ Group missing from list
- ❌ Empty state shown despite group existing
- ❌ Refresh required to see group

---

### Test 3: Backfilled Phantom Groups
**Objective**: Verify old groups (created before fix) now visible

**Pre-condition**: Groups existed in database before running migration

**Steps**:
1. Log in as user who owned groups created before this fix
2. Navigate to Groups tab
3. Check if previously invisible groups now appear

**Expected Results**:
- ✅ All owned groups are visible
- ✅ No "Group Not Found" errors when opening old groups
- ✅ Owner can manage group members

**Failure Indicators**:
- ❌ Old groups still missing
- ❌ "Group Not Found" when accessing backfilled groups

---

## Additional Validation Tests

### Test 4: Multiple Groups
**Steps**:
1. Create 3 groups with different sport focuses
2. Verify all 3 appear in Groups Home
3. Open each group detail page

**Expected**: All groups accessible, no errors

---

### Test 5: Group with Invited Friends
**Steps**:
1. Create group and invite 2 friends
2. Check group members list in group detail
3. Verify invited friends received feed events

**Expected**: 
- Owner + 2 friends = 3 members
- Feed shows "joined group" events for invited friends

---

### Test 6: Error Handling
**Steps**:
1. Try creating group with empty name
2. Try creating group while offline

**Expected**:
- Validation error for empty name
- Network error with retry option
- NO silent failures

---

## Database Verification (Optional)

### Check RLS Helper Function
```sql
SELECT public.is_group_member('<group_id>', '<user_id>');
```
Should return `true` for members, `false` for non-members

### Check Backfill Results
```sql
SELECT g.id, g.name, g.owner_id, 
       gm.user_id as member_id, gm.role
FROM groups g
LEFT JOIN group_members gm 
  ON gm.group_id = g.id AND gm.user_id = g.owner_id;
```
Every group should have owner membership row

### Check for Orphaned Groups
```sql
SELECT g.id, g.name, g.owner_id
FROM groups g
LEFT JOIN group_members gm 
  ON gm.group_id = g.id AND gm.user_id = g.owner_id
WHERE gm.group_id IS NULL;
```
Should return 0 rows (no orphaned groups)

---

## Success Criteria

**All 3 critical tests MUST pass** for the fix to be considered successful:
1. ✅ Create group → navigate to detail (no "Group Not Found")
2. ✅ New group appears in Groups Home immediately
3. ✅ Old phantom groups become visible to owners

**Additional requirement**:
- Zero infinite recursion errors in backend logs
- Zero RLS policy violations in backend logs

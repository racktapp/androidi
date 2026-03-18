# Tournament Invite & Delete Testing Checklist

## Implementation Summary

### OnSpace Cloud Data Model

**Tables Used:**
- `tournaments`: 
  - `id` (uuid, primary key)
  - `created_by_user_id` (uuid, foreign key to user_profiles)
  - `participants` (jsonb array of TournamentParticipant objects)
  - `state` ('draft' | 'inviting' | 'locked' | 'in_progress' | 'completed' | 'deleted')
  - `title`, `sport`, `type`, `mode`, `is_competitive`, `settings`, etc.

- `tournament_invites`:
  - `id` (uuid, primary key)
  - `tournament_id` (uuid, foreign key to tournaments)
  - `invited_user_id` (uuid, foreign key to user_profiles)
  - `invited_by_user_id` (uuid, foreign key to user_profiles)
  - `status` ('pending' | 'accepted' | 'declined' | 'expired')

**RLS Policies:**
- `authenticated_select_tournaments`: User can read if `created_by_user_id = auth.uid()` OR user's ID is in `participants` array
- `authenticated_update_tournaments`: User can update if `created_by_user_id = auth.uid()`
- `authenticated_select_tournament_invites`: User can read invites where `invited_user_id = auth.uid()`
- `authenticated_update_tournament_invites`: User can update invites where `invited_user_id = auth.uid()`

### Implementation Changes

**Files Modified:**

1. **`app/tournaments/index.tsx`**
   - Added comprehensive instrumentation with console logging
   - Added `useAlert` for toast notifications
   - Added `LoadingSpinner` component for button loading states
   - Updated `handleRespondToInvite` with:
     - Step-by-step logging (action, service call, reload, navigation)
     - Success/error alerts with specific messages
     - Increased navigation delay to 500ms for RLS propagation
     - Better error handling with stale invite detection
   - Updated invite buttons to show loading spinner when active
   - Added disabled styling for buttons during operations

2. **`services/tournaments.ts`**
   - Enhanced `respondToInvite()` with:
     - 7-step instrumentation with detailed console logging
     - Validation of invite existence and permissions
     - Tournament state validation (checks for 'deleted' state)
     - Detailed error logging with error codes, messages, and context
     - Automatic invite expiration for deleted tournaments
     - Better error messages (e.g., "This tournament has been deleted")
     - Idempotent operation (handles already-participant case)
   
   - Enhanced `deleteTournament()` with:
     - 3-step instrumentation with detailed console logging
     - Creator permission validation with detailed error logging
     - Soft delete implementation (sets state to 'deleted')
     - Automatic expiration of pending invites
     - Detailed error messages with OnSpace Cloud error details

3. **`app/tournaments/[id].tsx`**
   - Enhanced `handleDeleteTournament` with:
     - Detailed console logging
     - Better error display with specific messages
     - Error context logging (tournamentId, userId)

### OnSpace Cloud Queries Used

**Accept Invite Flow (`respondToInvite`):**
```typescript
// 1. Fetch invite
supabase.from('tournament_invites')
  .select('id, tournament_id, invited_user_id, status')
  .eq('id', inviteId)
  .single()

// 2. Fetch tournament
supabase.from('tournaments')
  .select('id, state, participants, created_by_user_id, title')
  .eq('id', tournament_id)
  .single()

// 3. Fetch user profile
supabase.from('user_profiles')
  .select('id, username, display_name, avatar_url')
  .eq('id', user_id)
  .single()

// 4. Update tournament participants (atomic)
supabase.from('tournaments')
  .update({ 
    participants: [...existing, newParticipant],
    updated_at: new Date().toISOString(),
  })
  .eq('id', tournament_id)

// 5. Update invite status
supabase.from('tournament_invites')
  .update({ status: 'accepted' })
  .eq('id', inviteId)

// 6. Mark invite as expired (if tournament deleted)
supabase.from('tournament_invites')
  .update({ status: 'expired' })
  .eq('id', inviteId)
```

**Delete Tournament Flow (`deleteTournament`):**
```typescript
// 1. Fetch tournament and verify creator
supabase.from('tournaments')
  .select('created_by_user_id, state, title')
  .eq('id', tournamentId)
  .single()

// 2. Soft delete tournament
supabase.from('tournaments')
  .update({ 
    state: 'deleted',
    updated_at: new Date().toISOString(),
  })
  .eq('id', tournamentId)

// 3. Expire pending invites
supabase.from('tournament_invites')
  .update({ status: 'expired' })
  .eq('tournament_id', tournamentId)
  .eq('status', 'pending')
```

---

## Test Checklist

### Test Environment Setup
- [ ] Two test user accounts created (User A = Creator, User B = Invitee)
- [ ] Both users logged in on separate devices/browsers
- [ ] Console logs visible (use browser DevTools or React Native Debugger)

---

## Part 1: Accept Invite - Happy Path

### Test 1.1: Creator invites user → user accepts → both see participant

**User A (Creator):**
1. [ ] Create a new tournament
2. [ ] Add User B to invites
3. [ ] Verify invite sent
4. [ ] Check console for `[TournamentInvite]` logs

**User B (Invitee):**
1. [ ] Navigate to Dashboard → Tournaments
2. [ ] Verify "Tournament Invitation" card appears
3. [ ] Tap "Accept" button
4. [ ] Verify loading spinner appears on button
5. [ ] Verify success alert: "You have joined the tournament!"
6. [ ] Verify navigation to tournament detail screen
7. [ ] Verify participant list shows User B
8. [ ] Check console for complete flow logs:
   ```
   [TournamentInvite] User action: Accept
   [TournamentInvite] Calling respondToInvite service...
   [respondToInvite] START
   [respondToInvite] STEP 1: Fetching invite...
   [respondToInvite] STEP 3: Fetching tournament...
   [respondToInvite] STEP 4: Fetching user profile...
   [respondToInvite] STEP 6: Adding user to tournament participants...
   [respondToInvite] SUCCESS - User added to tournament
   [respondToInvite] STEP 7: Updating invite status...
   [respondToInvite] COMPLETE - Successfully joined tournament
   [TournamentInvite] Service call successful
   [TournamentInvite] Navigating to tournament detail...
   ```

**User A (Creator) - After User B accepts:**
1. [ ] Pull to refresh tournaments list
2. [ ] Tap tournament
3. [ ] Verify participants count increased
4. [ ] Verify User B appears in participants list

---

## Part 2: Accept Invite - Idempotency

### Test 2.1: Accept twice does not duplicate

**User B (Invitee):**
1. [ ] After accepting in Test 1.1, force-refresh the app
2. [ ] If invite still appears (shouldn't), tap "Accept" again
3. [ ] Verify console shows:
   ```
   [respondToInvite] User already a participant, just updating invite status
   [respondToInvite] SUCCESS - Already participant, invite updated
   ```
4. [ ] Verify no duplicate participant in tournament

**User A (Creator):**
1. [ ] Verify only ONE instance of User B in participants

---

## Part 3: Delete Tournament - Invite Flow

### Test 3.1: Creator deletes tournament → invitee cannot accept, invite disappears

**User A (Creator):**
1. [ ] Create a new tournament
2. [ ] Invite User B
3. [ ] Navigate to tournament detail screen
4. [ ] Tap trash icon (top-right)
5. [ ] Verify delete confirmation modal appears:
   - "Delete Tournament?"
   - "This action cannot be undone..."
6. [ ] Tap "Delete" button
7. [ ] Verify success alert: "Tournament Deleted"
8. [ ] Verify navigation back to tournaments list
9. [ ] Verify tournament no longer appears in active tournaments
10. [ ] Check console for complete flow logs:
    ```
    [TournamentDelete] User confirmed deletion
    [TournamentDelete] Calling deleteTournament service...
    [deleteTournament] START
    [deleteTournament] STEP 1: Verifying creator permissions...
    [deleteTournament] STEP 2: Soft-deleting tournament
    [deleteTournament] SUCCESS - Tournament state updated to deleted
    [deleteTournament] STEP 3: Expiring pending invites...
    [deleteTournament] SUCCESS - Pending invites expired
    [deleteTournament] COMPLETE - Tournament deleted successfully
    [TournamentDelete] Service call successful
    [TournamentDelete] Navigating back...
    ```

**User B (Invitee):**
1. [ ] Navigate to Dashboard → Tournaments (before deleting)
2. [ ] Verify invite card appears
3. [ ] After User A deletes, pull to refresh
4. [ ] Verify invite card disappears OR
5. [ ] If invite still visible, tap "Accept"
6. [ ] Verify error alert: "This tournament has been deleted"
7. [ ] Verify invite card disappears after refresh
8. [ ] Check console for error logs:
   ```
   [respondToInvite] ERROR - Tournament deleted
   [TournamentInvite] ERROR: This tournament has been deleted
   ```

---

## Part 4: Delete Tournament - Permissions

### Test 4.1: Non-creator cannot delete

**User A (Creator):**
1. [ ] Create tournament
2. [ ] Invite User B
3. [ ] User B accepts

**User B (Participant, not creator):**
1. [ ] Navigate to tournament detail
2. [ ] Verify trash icon is NOT visible (only shows for creator)
3. [ ] (If testing via API): Attempt to call `deleteTournament(tournamentId)`
4. [ ] Verify error: "Only the tournament creator can delete this tournament"
5. [ ] Check console:
   ```
   [deleteTournament] ERROR - Permission denied
   ```

**User A (Creator):**
1. [ ] Verify tournament still exists
2. [ ] Verify User B still in participants

---

## Part 5: Edge Cases & Error Handling

### Test 5.1: Accept invite for deleted tournament

**Setup:**
1. [ ] User A creates tournament, invites User B
2. [ ] User A deletes tournament (before User B accepts)

**User B:**
1. [ ] Navigate to Tournaments (invite card should still be visible initially)
2. [ ] Tap "Accept"
3. [ ] Verify error alert: "This tournament has been deleted"
4. [ ] Verify invite card disappears after refresh
5. [ ] Console shows:
   ```
   [respondToInvite] ERROR - Tournament deleted
   [TournamentInvite] Stale invite detected, refreshing list...
   ```

### Test 5.2: Accept invite for completed tournament

**Setup:**
1. [ ] User A creates tournament, invites User B
2. [ ] User A completes entire tournament (all matches confirmed)

**User B:**
1. [ ] Tap "Accept" on pending invite
2. [ ] Verify error: "This tournament has already completed"

### Test 5.3: Network error during accept

**User B:**
1. [ ] Disable network/WiFi
2. [ ] Tap "Accept" on invite
3. [ ] Verify error alert with network error message
4. [ ] Verify button returns to normal state (not stuck loading)
5. [ ] Re-enable network
6. [ ] Tap "Accept" again
7. [ ] Verify successful acceptance

### Test 5.4: Network error during delete

**User A:**
1. [ ] Disable network/WiFi
2. [ ] Tap delete, confirm
3. [ ] Verify error alert with network error message
4. [ ] Verify tournament still exists
5. [ ] Re-enable network
6. [ ] Retry delete
7. [ ] Verify successful deletion

---

## Part 6: Console Logging Verification

### Test 6.1: Accept invite logs

**Verify console shows ALL these log entries:**
- [ ] `[TournamentInvite] User action: Accept, inviteId=..., userId=...`
- [ ] `[TournamentInvite] Calling respondToInvite service...`
- [ ] `[respondToInvite] START - inviteId=..., userId=..., accept=true`
- [ ] `[respondToInvite] STEP 1: Fetching invite...`
- [ ] `[respondToInvite] Invite data: {...}`
- [ ] `[respondToInvite] STEP 3: Fetching tournament...`
- [ ] `[respondToInvite] Tournament data: {...}`
- [ ] `[respondToInvite] STEP 4: Fetching user profile...`
- [ ] `[respondToInvite] Profile data: {...}`
- [ ] `[respondToInvite] STEP 6: Adding user to tournament participants...`
- [ ] `[respondToInvite] New participant count: ...`
- [ ] `[respondToInvite] SUCCESS - User added to tournament`
- [ ] `[respondToInvite] STEP 7: Updating invite status...`
- [ ] `[respondToInvite] SUCCESS - Invite status updated`
- [ ] `[respondToInvite] COMPLETE - Successfully joined tournament`
- [ ] `[TournamentInvite] Service call successful: {...}`
- [ ] `[TournamentInvite] Reloading tournaments...`
- [ ] `[TournamentInvite] Navigating to tournament detail...`
- [ ] `[TournamentInvite] Handler complete`

### Test 6.2: Delete tournament logs

**Verify console shows ALL these log entries:**
- [ ] `[TournamentDelete] User confirmed deletion - tournamentId=..., userId=...`
- [ ] `[TournamentDelete] Calling deleteTournament service...`
- [ ] `[deleteTournament] START - tournamentId=..., userId=...`
- [ ] `[deleteTournament] STEP 1: Verifying creator permissions...`
- [ ] `[deleteTournament] Tournament data: {...}`
- [ ] `[deleteTournament] STEP 2: Soft-deleting tournament: ...`
- [ ] `[deleteTournament] SUCCESS - Tournament state updated to deleted`
- [ ] `[deleteTournament] STEP 3: Expiring pending invites...`
- [ ] `[deleteTournament] SUCCESS - Pending invites expired`
- [ ] `[deleteTournament] COMPLETE - Tournament deleted successfully`
- [ ] `[TournamentDelete] Service call successful`
- [ ] `[TournamentDelete] Navigating back...`

### Test 6.3: Error logs include full context

**When errors occur, verify logs include:**
- [ ] Error message
- [ ] Error code
- [ ] Error details/hints
- [ ] Relevant IDs (tournamentId, inviteId, userId)
- [ ] Current state/context

---

## Part 7: UI/UX Verification

### Test 7.1: Loading states

**Accept invite:**
- [ ] Button shows loading spinner while processing
- [ ] Button is disabled during operation
- [ ] Button returns to normal if error occurs
- [ ] Button style changes when disabled

**Delete tournament:**
- [ ] Trash icon changes color when deleting
- [ ] Modal closes immediately after confirmation
- [ ] Navigation happens after success

### Test 7.2: Error messaging

**User-friendly errors:**
- [ ] "This tournament has been deleted" (not technical error)
- [ ] "This tournament no longer exists or has been deleted"
- [ ] "Only the tournament creator can delete this tournament"
- [ ] "Failed to join tournament: [specific reason]"
- [ ] Network errors show readable message

### Test 7.3: Success feedback

**Accept:**
- [ ] Alert: "You have joined the tournament!"
- [ ] Navigation to tournament detail
- [ ] Participant list updates immediately

**Decline:**
- [ ] Alert: "You have declined the tournament invitation."
- [ ] Invite card disappears

**Delete:**
- [ ] Alert: "This tournament has been permanently deleted."
- [ ] Navigation back to list
- [ ] Tournament no longer visible

---

## Success Criteria

All tests must pass with:
- ✅ No silent failures (all errors show alerts)
- ✅ Loading states visible during operations
- ✅ Comprehensive console logging for debugging
- ✅ Proper error messages (user-friendly + technical details in console)
- ✅ Idempotent operations (accept twice = same result)
- ✅ Creator-only permissions enforced
- ✅ Stale invites handled gracefully
- ✅ Both creator and invitee see updated participant lists

---

## Known Issues Fixed

1. ✅ Accept invite showed no loading state → Now shows spinner
2. ✅ Accept invite failed silently → Now shows detailed errors
3. ✅ Accept invite didn't add user → Now properly updates participants array
4. ✅ Delete tournament failed → Now includes detailed error logging
5. ✅ Race condition on navigation → Increased delay to 500ms
6. ✅ No error context → All errors now include IDs and context
7. ✅ Stale invites not cleaned up → Now automatically expired

# Rackt V1 Testing Checklist

## Automated Validation Status

These checks are validated directly in-repo and can be re-run in CI/local development:

- [x] `CI=1 npx expo lint`
- [x] `npm run smoke:release`
- [x] Android release config no longer falls back to the debug keystore
- [x] Shipped Android manifest is trimmed to the permission(s) required by the current app behavior

## Still Requires Manual Verification

The remaining sections below are intentionally left as manual QA items. Do not mark them complete unless they are exercised on a real build/environment.

## Authentication Flow

### New User Journey
- [ ] Open app → should see "Welcome to Rackt" email screen
- [ ] Enter invalid email → should show "Please enter a valid email address"
- [ ] Enter valid email → should send OTP and navigate to verification screen
- [ ] Enter wrong code → should show "Invalid code" error
- [ ] Enter expired code → should show "Code expired" message
- [ ] Click "Resend code" → should send new code with 60s cooldown
- [ ] Click "Change email" → should go back to email screen
- [ ] Enter correct 6-digit code → should verify and go to onboarding

### Returning User Journey
- [ ] Open app with valid session → should go directly to main tabs
- [ ] Open app with session but incomplete profile → should resume onboarding
- [ ] Logout → should clear session and return to auth screen

### Error Handling
- [ ] Network error during send code → should show blocking error, not navigate away
- [ ] Network error during verify → should show blocking error, not navigate away
- [ ] Code send rate limit → should show clear error message

## Onboarding Flow

### Profile Creation
- [ ] Empty username → should show "Username is required"
- [ ] Username < 3 chars → should show "Username must be at least 3 characters"
- [ ] Username with special chars → should show "can only contain letters, numbers, and underscores"
- [ ] Duplicate username → should show "Username already taken" after server check
- [ ] Empty display name → should show "Display name is required"
- [ ] Valid inputs → should save to database and continue to sports selection
- [ ] Profile save fails → should show blocking error, not navigate away

### Sports Selection
- [ ] No sports selected → should show "Select at least one sport"
- [ ] Select tennis → should highlight card
- [ ] Select both sports → should continue to level selection for first sport
- [ ] Deselect sport → should remove from selection

### Level Selection - Preset Mode
- [ ] Click "New / Beginner" → should set level to 1.0
- [ ] Click "Casual / Intermediate" → should set level to 2.5
- [ ] Click "Competitive / Advanced" → should set level to 3.8
- [ ] Click "Lower" adjustment → should decrease by 0.5 (clamped to 0.0)
- [ ] Click "Higher" adjustment → should increase by 0.5 (clamped to 4.5 for onboarding)
- [ ] Level should display correctly in "Your starting level" section
- [ ] Reliability should show 20%
- [ ] Helper text should show about competitive matches

### Level Selection - Manual Entry Mode
- [ ] Click "I already know my rank" → should expand manual input area
- [ ] Enter 2.5 → should update current level display
- [ ] Enter 8.0 → should clamp to 7.0
- [ ] Enter -1.0 → should clamp to 0.0
- [ ] Enter 5.5 → should show warning "Most players start between 0–4"
- [ ] Enter invalid text → should ignore or show validation error
- [ ] Click "← Back to presets" → should hide manual input and show preset cards
- [ ] Adjustment buttons work with manual input → should apply ±0.5

### Multi-Sport Onboarding
- [ ] Select both tennis and padel
- [ ] Set tennis level to 2.0
- [ ] Click "Next Sport" → should go to padel level selection
- [ ] Set padel level to 3.5
- [ ] Click "Complete" → should save both ratings
- [ ] Both ratings should appear in database

### Completion
- [ ] Complete onboarding → should save profile + ratings and navigate to main tabs
- [ ] Rating save fails → should show blocking error, not navigate away
- [ ] Return to app after completion → should go directly to tabs, not show onboarding again

## Routing & State Management

### Auth State
- [ ] Refresh app during onboarding → should resume at correct step
- [ ] Close and reopen app → should maintain session if authenticated
- [ ] Session expires → should return to auth flow

### Navigation Guards
- [ ] Try to access tabs without auth → should redirect to auth
- [ ] Try to access tabs without profile → should redirect to onboarding
- [ ] Complete all onboarding → should access tabs successfully

## Data Persistence

### Database Writes
- [ ] Profile updates should save to `user_profiles` table
- [ ] Username should be lowercase in database
- [ ] Display name should preserve case
- [ ] User ratings should save to `user_ratings` table
- [ ] Reliability should start at 0.20 (20%)
- [ ] Matches played should start at 0
- [ ] All saves should be atomic (either all succeed or all fail)

### Error Scenarios
- [ ] Database connection fails → should show clear error
- [ ] RLS policy blocks write → should show permission error
- [ ] Duplicate constraint violation → should show appropriate message
- [ ] All errors should be logged for debugging (without exposing secrets)

## UI/UX Standards

### Midnight Blue Theme
- [ ] Auth screens use dark background (#070B16)
- [ ] Cards use surface color (#0E1730)
- [ ] Primary buttons use blue accent (#1D4ED8)
- [ ] Text hierarchy uses primary/muted/disabled colors
- [ ] All screens maintain consistent theme

### Loading States
- [ ] "Send Code" button shows "Sending..." when loading
- [ ] "Verify" button shows "Verifying..." when loading
- [ ] "Continue" button shows disabled state during save
- [ ] All async operations show visual feedback

### Error Display
- [ ] All errors are visible and readable
- [ ] Errors appear near relevant inputs
- [ ] Errors don't disappear until user takes action
- [ ] Network errors provide retry option

## Edge Cases

### Manual Rank Entry
- [ ] Enter "2" → should accept as 2.0
- [ ] Enter "2." → should handle gracefully
- [ ] Enter "07.0" → should normalize to 7.0
- [ ] Rapid adjustments → should handle without crashes
- [ ] Switch between manual and preset → should maintain level

### Code Verification
- [ ] Enter code slowly (one digit at a time) → should work
- [ ] Paste 6-digit code → should work
- [ ] Enter non-numeric characters → should filter them out
- [ ] Hit verify with < 6 digits → button should be disabled
- [ ] Multiple rapid resend attempts → should respect cooldown

### Session Management
- [ ] Token refresh during onboarding → should maintain flow
- [ ] Logout during onboarding → should clear state
- [ ] Multiple tabs/windows (web) → should sync state

## Performance & Stability

### Never Silent Failures (Critical)
- [ ] **Every** database write either succeeds OR shows error
- [ ] **Every** auth operation either succeeds OR shows error
- [ ] No navigation on failure
- [ ] All errors logged with enough context for debugging
- [ ] User never left in unknown state

### Console Logging
- [ ] Auth errors logged with error type
- [ ] Database errors logged with query context
- [ ] No sensitive data (passwords, tokens) in logs
- [ ] Enough information to reproduce issues

---

## Pass Criteria

- [x] Automated validation section passes in local/CI runs
- [ ] All manual checklist items below have been executed on a production-like build
- [ ] No silent failures anywhere in the flow
- [ ] All database writes are atomic
- [ ] Clear error messages for all failure scenarios
- [ ] Midnight Blue theme consistent across all screens
- [ ] Manual rank entry validates and clamps correctly
- [ ] Returning users skip onboarding and go directly to tabs

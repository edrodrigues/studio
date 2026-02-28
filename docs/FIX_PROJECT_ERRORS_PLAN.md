# Plan to Fix Project Page Errors

## 1. Firebase Permission Errors (`FirebaseError: Missing or insufficient permissions`)

### Problem Analysis
- **Accept Invite:** `acceptInvite` uses a `writeBatch` that tries to:
    1. Create a `projectMembers` doc.
    2. Update the `invites` doc.
    3. Increment `memberCount` on the `projects` doc.
- **Rules Issue:** 
    - `projects` update requires `isProjectMember(projectId)`, but the member doc is being created in the *same batch*, so `isProjectMember` returns false during validation.
    - `projectMembers` create rule only allows owners/editors to create memberships, or a user creating their *own* membership *only when creating a new project*. It doesn't allow a user to create their own membership by accepting an invite.
- **Project Updates:** Saving `contractType` or `processType` fails because they are not in the "affectedKeys" whitelist for non-owners.

### Solutions
- **Update `firestore.rules`**:
    - Allow users to create their own `projectMembers` record if they have a valid, pending invite.
    - Update `projects` update rule to allow `memberCount` increment by anyone who is either a member OR is currently becoming one (via the invite batch).
    - Expand `affectedKeys` for `projects` updates to include `contractType` and `processType` for Editors.
    - Ensure `invites` read/update rules handle case-insensitive emails if necessary, though current `useInvites` uses `toLowerCase()`.

## 2. 404 Errors (`Failed to load resource`)

### Problem Analysis
- Links in `ProjectDetailPage` point to `/projects/${projectId}/documents` and `/projects/${projectId}/placeholders`.
- These directories/pages do not exist in the file system.

### Solutions
- **Create missing routes**:
    - Create `src/app/(main)/projects/[projectId]/documents/page.tsx`.
    - Create `src/app/(main)/projects/[projectId]/placeholders/page.tsx`.
- **Alternatively:** Update the links to stay on the same page and just change the active tab, or implement the missing pages by moving the tab content into them.

## 3. COOP Policy Warning (`Cross-Origin-Opener-Policy`)

### Problem Analysis
- Standard warning when using `signInWithPopup`. It doesn't usually break functionality unless the site is served with strict COOP headers that conflict with the popup.

### Solutions
- **Check Headers:** If this is blocking the popup from closing, ensure `next.config.ts` or the hosting provider isn't setting `Cross-Origin-Opener-Policy: same-origin` too strictly.
- **Alternative:** Use `signInWithRedirect` if the popup continues to be an issue, though it requires more complex state handling.

## 4. Implementation Step-by-Step

1.  **Surgical Rules Update:**
    - Modify `firestore.rules` to fix the `acceptInvite` batch permission issue.
    - Fix the `projects` metadata update permissions for `contractType` and `processType`.
2.  **Create Missing Pages:**
    - Implement basic pages for `/documents` and `/placeholders` within the project context to resolve 404s.
3.  **Refine Invite Batch:**
    - Verify if `getUserEmail()` in rules correctly matches the email in the `invites` collection. (Firebase `request.auth.token.email` is only available if the user has an email provider or is linked).

## 5. Validation
- Test accepting an invite with a fresh user.
- Test updating project settings as an Editor.
- Test navigating to the Documents and Variables pages.

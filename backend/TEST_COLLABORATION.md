# Testing Collaboration - Step by Step

## Setup

1. **Start Backend**:
   ```bash
   cd backend
   docker-compose up -d
   uv run alembic upgrade head  # Make sure invitations table exists
   uv run uvicorn main:app --reload --host 0.0.0.0 --port 8001
   ```

2. **Start Frontend**:
   ```bash
   cd frontend_dev
   npm run dev
   ```

## Test Scenario

### Step 1: Create Owner Account

1. Open http://localhost:5173
2. Click "Register"
3. Fill in:
   - Email: `owner@example.com`
   - Username: `owner`
   - Password: `password123`
4. Click "Register"

### Step 2: Owner Creates Project & File

1. Click "+ New Project"
2. Name: `Shared Document`
3. Description: `Testing collaboration`
4. Click "Create Project"
5. Click "Open" on the project
6. Click "+" to create a file
7. Name: `main.typ`
8. Type some content:
   ```typst
   #heading[Collaborative Document]

   This document is being edited by multiple users!
   ```
9. Click "💾 Save"

### Step 3: Owner Invites Collaborator

1. Go back to Projects (click "← Back")
2. Click "👥 Invite" on the Shared Document project
3. Enter email: `collab@example.com`
4. Select role: `Editor`
5. Click "Send Invitation"
6. You should see "Invitation sent successfully!"

### Step 4: Create Collaborator Account

1. Open a **new incognito/private window** (or different browser)
2. Go to http://localhost:5173
3. Click "Register"
4. Fill in:
   - Email: `collab@example.com` (MUST match invitation email!)
   - Username: `collaborator`
   - Password: `password123`
5. Click "Register"

### Step 5: Collaborator Accepts Invitation

1. After login, you should see a **yellow banner** at the top:
   ```
   📬 Pending Invitations (1)
   ```
2. Click "✓ Accept"
3. Page will reload
4. You should now see "Shared Document" in your projects!

### Step 6: Test Real-Time Collaboration

**Window 1 (Owner)**:
1. Open "Shared Document"
2. Open `main.typ`
3. You should see the content you created
4. Connection status should be "🟢 Connected"

**Window 2 (Collaborator)**:
1. Open "Shared Document"
2. You should see the file `main.typ`
3. Click on it to open
4. You should see the SAME content
5. Connection status should be "🟢 Connected"

**Now test sync**:
- **Window 1**: Type "Owner is typing..."
- **Window 2**: You should see it appear instantly!
- **Window 2**: Type "Collaborator is typing..."
- **Window 1**: You should see it appear instantly!

## Expected Results

✅ Both users see the same files
✅ Both users can edit
✅ Changes appear in real-time
✅ Connection status is green
✅ No permission errors

## Common Issues & Fixes

### Issue: Collaborator can't see files

**Cause**: Permission check in files API
**Fix**: Already fixed! The API now uses `check_project_access` instead of checking owner_id

### Issue: Files don't sync

**Check**:
1. Both users are editing the SAME file (check file ID in URL or network tab)
2. WebSocket is connected (green status)
3. Backend WebSocket server is running
4. Check browser console for errors

### Issue: Invitation not appearing

**Check**:
1. Invitee email MUST match registered email exactly
2. Check database: `SELECT * FROM invitations WHERE status = 'pending';`
3. Check backend logs for errors

### Issue: "Project not found" for collaborator

**Cause**: Collaborator table might not have the entry
**Fix**: Check the database:
```sql
SELECT * FROM project_collaborators WHERE user_id = (
  SELECT id FROM users WHERE email = 'collab@example.com'
);
```

Should show a row with project_id matching your shared project.

## Debug Commands

### Check invitations in database:
```sql
SELECT i.*, u.email as inviter_email, p.name as project_name
FROM invitations i
JOIN users u ON i.inviter_id = u.id
JOIN projects p ON i.project_id = p.id
ORDER BY i.created_at DESC;
```

### Check collaborators:
```sql
SELECT pc.*, u.email, p.name as project_name
FROM project_collaborators pc
JOIN users u ON pc.user_id = u.id
JOIN projects p ON pc.project_id = p.id;
```

### Check who can access a project:
```sql
-- Replace 1 with your project ID
SELECT
  p.id as project_id,
  p.name,
  p.owner_id,
  u1.email as owner_email,
  pc.user_id as collaborator_id,
  u2.email as collaborator_email,
  pc.role
FROM projects p
LEFT JOIN users u1 ON p.owner_id = u1.id
LEFT JOIN project_collaborators pc ON p.id = pc.project_id
LEFT JOIN users u2 ON pc.user_id = u2.id
WHERE p.id = 1;
```

## Success Criteria

The collaboration is working correctly if:

1. ✅ Invitations can be sent
2. ✅ Invitations appear in the yellow banner
3. ✅ Accepting adds user as collaborator
4. ✅ Collaborators can see the project
5. ✅ Collaborators can see all files
6. ✅ Collaborators can edit files
7. ✅ Changes sync in real-time between users
8. ✅ Both users see "🟢 Connected" status
9. ✅ No 403/404 errors in browser console

If all these work, congratulations! Your real-time collaborative Typst editor is fully functional! 🎉

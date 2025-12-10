# Project Collaboration System

This document describes the collaboration system that allows multiple users to work together on projects with different permission levels.

## Overview

The collaboration system allows project owners to:
- Add collaborators to their projects
- Assign different roles to collaborators (Reader, Commentor, Editor, Admin)
- Manage collaborator permissions
- Allow collaborators to leave projects

## Collaborator Roles

The system supports four distinct roles with hierarchical permissions:

### 1. **Reader** (`reader`)
- View project files and assets
- Read project information
- Cannot make changes or comments

### 2. **Commentor** (`commentor`)
- All Reader permissions
- Add comments to documents
- Participate in discussions

### 3. **Editor** (`editor`)
- All Commentor permissions
- Create and modify files
- Upload and manage assets
- Edit document content

### 4. **Admin** (`admin`)
- All Editor permissions
- Add/remove collaborators
- Change collaborator roles
- Update project settings
- **Cannot** delete the project (only owner can)

### Owner (Implicit Role)
- All Admin permissions
- Delete the project
- Transfer ownership (future feature)
- Cannot be removed as collaborator

## Database Schema

### ProjectCollaborator Table

```sql
CREATE TABLE project_collaborators (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,  -- 'reader', 'commentor', 'editor', 'admin'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);
```

## API Endpoints

All endpoints require authentication via JWT token in the `Authorization` header.

### List Project Collaborators

```http
GET /api/v1/projects/{project_id}/collaborators
```

**Required Role:** Any collaborator or owner

**Response:**
```json
[
    {
        "id": 1,
        "project_id": 10,
        "user_id": 5,
        "role": "editor",
        "user": {
            "id": 5,
            "email": "john@example.com",
            "username": "john_doe"
        },
        "created_at": "2025-12-11T10:00:00Z",
        "updated_at": "2025-12-11T10:00:00Z"
    }
]
```

### Add Collaborator

```http
POST /api/v1/projects/{project_id}/collaborators
```

**Required Role:** Owner or Admin

**Request Body:**
```json
{
    "user_id": 5,
    "role": "editor"
}
```

**Response:** `201 Created`
```json
{
    "id": 1,
    "project_id": 10,
    "user_id": 5,
    "role": "editor",
    "user": {
        "id": 5,
        "email": "john@example.com",
        "username": "john_doe"
    },
    "created_at": "2025-12-11T10:00:00Z",
    "updated_at": "2025-12-11T10:00:00Z"
}
```

**Error Cases:**
- `404`: User not found
- `400`: User is already a collaborator
- `400`: Cannot add the project owner as a collaborator
- `403`: You need to be an admin or owner

### Update Collaborator Role

```http
PUT /api/v1/projects/{project_id}/collaborators/{user_id}
```

**Required Role:** Owner or Admin

**Request Body:**
```json
{
    "role": "admin"
}
```

**Response:** `200 OK`
```json
{
    "id": 1,
    "project_id": 10,
    "user_id": 5,
    "role": "admin",
    "user": {
        "id": 5,
        "email": "john@example.com",
        "username": "john_doe"
    },
    "created_at": "2025-12-11T10:00:00Z",
    "updated_at": "2025-12-11T12:00:00Z"
}
```

**Error Cases:**
- `404`: Collaborator not found
- `403`: You need to be an admin or owner

### Remove Collaborator / Leave Project

```http
DELETE /api/v1/projects/{project_id}/collaborators/{user_id}
```

**Required Role:** 
- Owner or Admin (to remove any collaborator)
- Any collaborator (to remove themselves / leave the project)

**Response:** `204 No Content`

**Error Cases:**
- `404`: Collaborator not found
- `400`: Cannot remove the project owner
- `403`: You need to be an admin or owner (when removing others)

## Permission Checks

The system includes several permission helper functions:

### `check_project_access(db, project_id, user_id, required_role=None)`
Verifies that a user has access to a project and optionally checks for a specific role level.

### `check_is_admin_or_owner(db, project_id, user_id)`
Ensures the user is either the project owner or has an admin role.

### `get_user_project_role(db, project_id, user_id)`
Retrieves the user's role in a project (returns `None` if not a collaborator).

## Updated Project Endpoints

### List Projects

```http
GET /api/v1/projects
```

Now returns projects where the user is either:
- The owner, OR
- A collaborator (any role)

### Get Project

```http
GET /api/v1/projects/{project_id}
```

Now includes collaborators in the response:

```json
{
    "id": 10,
    "name": "My Project",
    "description": "A collaborative project",
    "owner_id": 1,
    "collaborators": [
        {
            "id": 1,
            "user_id": 5,
            "role": "editor",
            "user": {
                "id": 5,
                "email": "john@example.com",
                "username": "john_doe"
            }
        }
    ],
    "created_at": "2025-12-11T10:00:00Z",
    "updated_at": "2025-12-11T10:00:00Z"
}
```

### Update Project

```http
PUT /api/v1/projects/{project_id}
```

**Required Role:** Owner or Admin (changed from owner-only)

### Delete Project

```http
DELETE /api/v1/projects/{project_id}
```

**Required Role:** Owner only (unchanged)

## Usage Examples

### Example 1: Add an Editor to a Project

```bash
curl -X POST http://localhost:8000/api/v1/projects/10/collaborators \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 5,
    "role": "editor"
  }'
```

### Example 2: Promote Collaborator to Admin

```bash
curl -X PUT http://localhost:8000/api/v1/projects/10/collaborators/5 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "admin"
  }'
```

### Example 3: Leave a Project (Self-Remove)

```bash
curl -X DELETE http://localhost:8000/api/v1/projects/10/collaborators/5 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Example 4: Remove a Collaborator (as Admin/Owner)

```bash
curl -X DELETE http://localhost:8000/api/v1/projects/10/collaborators/5 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Migration

To apply the database migration:

```bash
cd backend
uv run alembic upgrade head
```

This will create the `project_collaborators` table with the necessary constraints and indexes.

## Security Considerations

1. **Cascading Deletes:** When a project or user is deleted, all related collaborator records are automatically removed.

2. **Unique Constraint:** A user can only have one role per project (enforced at the database level).

3. **Owner Protection:** The project owner cannot be added as a collaborator and cannot be removed.

4. **Self-Leave:** Any collaborator can remove themselves from a project without needing admin privileges.

5. **Role Hierarchy:** The system enforces a role hierarchy where higher roles include all permissions of lower roles.

## Future Enhancements

Potential improvements to the collaboration system:

- **Ownership Transfer:** Allow owners to transfer project ownership to another user
- **Invitation System:** Send email invitations to join projects
- **Activity Log:** Track collaborator actions and changes
- **Fine-grained Permissions:** More detailed permission controls per file or feature
- **Team/Group Support:** Add collaborators by group rather than individually
- **Notification System:** Notify users when they're added to or removed from projects
- **Public Projects:** Option to make projects publicly readable


# Sharing and Access Model

## Roles

- `reader`: can view project contents.
- `commentor`: can view and comment.
- `writer`: can view, comment, and edit.
- `admin`: can manage sharing and collaborators.
- `owner`: full control.

## Hash IDs

Projects, users, and invitations expose `id` as a non-sequential hash ID in API responses.
Internal integer IDs remain database implementation details.

## Share Links

Each project supports up to one active public link per type:

- `read`
- `comment`
- `edit`

Links are globally unique hashes and can be created/revoked by users with `admin` or `owner` permissions.

## API

### Sharing overview

- `GET /api/v1/projects/{project_ref}/sharing`

Returns:

- current collaborators and roles
- pending invitations
- active public links

### Public links management

- `GET /api/v1/projects/{project_ref}/share-links`
- `POST /api/v1/projects/{project_ref}/share-links/{link_type}`
- `DELETE /api/v1/projects/{project_ref}/share-links/{link_type}`

`link_type` is one of `read | comment | edit`.

### Public link access

- `GET /api/v1/projects/share/{share_hash}`

Behavior:

- If the link is valid, the user is granted access with the corresponding role.

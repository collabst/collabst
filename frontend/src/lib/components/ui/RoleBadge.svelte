<script lang="ts">
  import type { CollaboratorRole, ProjectRole } from "$lib/types";

  const VALID_ROLES = new Set(["owner", "admin", "writer", "commentor", "reader"]);

  let {
    role,
    uppercase = false,
    size = "md",
  } = $props<{
    role: CollaboratorRole | ProjectRole | string;
    uppercase?: boolean;
    size?: "sm" | "md";
  }>();

  const normalizedRole = $derived((role ?? "owner").toLowerCase());
  const safeRole = $derived(VALID_ROLES.has(normalizedRole) ? normalizedRole : "owner");
  const displayLabel = $derived(uppercase ? safeRole.toUpperCase() : safeRole);
</script>

<span class="role-badge role-{safeRole} role-{size}">
  {displayLabel}
</span>

<style>
  .role-badge {
    display: inline-block;
    border: 1px solid transparent;
    border-radius: 12px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .role-md {
    font-size: 10px;
    padding: 0.25rem 0.5rem;
  }

  .role-sm {
    font-size: 11px;
    padding: 0.25rem 0.625rem;
  }

  .role-owner {
    background: var(--role-owner-bg);
    color: var(--role-owner-text);
    border-color: var(--role-owner-border);
  }

  .role-admin {
    background: var(--role-admin-bg);
    color: var(--role-admin-text);
    border-color: var(--role-admin-border);
  }

  .role-writer {
    background: var(--role-writer-bg);
    color: var(--role-writer-text);
    border-color: var(--role-writer-border);
  }

  .role-commentor {
    background: var(--role-commentor-bg);
    color: var(--role-commentor-text);
    border-color: var(--role-commentor-border);
  }

  .role-reader {
    background: var(--role-reader-bg);
    color: var(--role-reader-text);
    border-color: var(--role-reader-border);
  }
</style>

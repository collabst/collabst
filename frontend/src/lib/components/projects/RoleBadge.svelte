<script lang="ts">
  import type { CollaboratorRole, ProjectRole } from "$lib/types";

  interface Props {
    role: CollaboratorRole | ProjectRole | string;
  }

  let { role }: Props = $props();

  const VALID = new Set(["owner", "admin", "writer", "commentor", "reader"]);
  let safeRole = $derived.by(() => {
    const normalized = (role ?? "owner").toLowerCase();
    return VALID.has(normalized) ? normalized : "owner";
  });
</script>

<span class="badge role-{safeRole}">{safeRole}</span>

<style>
  .badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border: 1px solid transparent;
    border-radius: 999px;
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
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

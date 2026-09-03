<script lang="ts">
  import { COLLABORATOR_ROLES } from "./context";
  import type { CollaboratorRole } from "$lib/types";

  interface Props {
    value: CollaboratorRole;
    onchange: (role: CollaboratorRole) => void;
    disabled?: boolean;
    ariaLabel?: string;
  }

  let { value, onchange, disabled = false, ariaLabel = "Role" }: Props = $props();
</script>

<select
  class="role-select"
  {value}
  {disabled}
  aria-label={ariaLabel}
  onchange={(e) => onchange(e.currentTarget.value as CollaboratorRole)}
>
  {#each COLLABORATOR_ROLES as role (role.value)}
    <option value={role.value}>{role.label}</option>
  {/each}
</select>

<style>
  .role-select {
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--navbar-border);
    border-radius: 0.6rem;
    background-color: var(--navbar-bg);
    color: var(--text-primary);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }

  .role-select:disabled {
    opacity: 0.45;
    cursor: default;
  }
</style>

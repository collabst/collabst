<script lang="ts">
  import {
    canManageProject,
    project,
    renameProject,
  } from "$lib/components/editor/context";

  let editing = $state(false);
  let draft = $state("");
  let input: HTMLInputElement | undefined = $state();

  function startEditing() {
    if (!$canManageProject) return;
    draft = $project?.name ?? "";
    editing = true;
    queueMicrotask(() => input?.select());
  }

  function cancel() {
    editing = false;
    draft = "";
  }

  async function submit() {
    // The editor stays open when the rename fails, so the typed name is not
    // silently thrown away.
    if (await renameProject(draft)) cancel();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      void submit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }
</script>

{#if editing}
  <input
    class="name-input"
    bind:this={input}
    bind:value={draft}
    onkeydown={handleKeydown}
    onblur={submit}
    aria-label="Project name"
  />
{:else}
  <button
    class="name"
    class:editable={$canManageProject}
    onclick={startEditing}
    title={$canManageProject ? "Rename project" : undefined}
    disabled={!$canManageProject}
  >
    {$project?.name ?? "Untitled project"}
  </button>
{/if}

<style>
  .name,
  .name-input {
    margin-left: 0.5rem;
    padding: 0.1rem 0.3rem;
    border: 1px solid transparent;
    border-radius: 0.4rem;
    background: transparent;
    color: var(--text-primary);
    font: inherit;
    font-size: 1.15rem;
    font-weight: bold;
    letter-spacing: -0.03em;
  }

  .name {
    cursor: default;
  }

  .name.editable {
    cursor: text;
  }

  .name.editable:hover {
    border-color: var(--navbar-border);
    background-color: var(--surface-hover);
  }

  .name-input {
    border-color: var(--color-tertiary-500);
    background-color: var(--bg-input);
    min-width: 8rem;
  }
</style>

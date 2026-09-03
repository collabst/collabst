<script lang="ts">
  import {
    closeCreateDialog,
    createDialogOpen,
    createProject,
    creatingProject,
  } from "./context";
  import Dialog from "./Dialog.svelte";
  import Field from "./Field.svelte";
  import Button from "./Button.svelte";

  let name = $state("");
  let description = $state("");
  let nameInput: HTMLInputElement | undefined = $state();

  // Reset the draft each time the dialog opens, and focus the first field.
  $effect(() => {
    if (!$createDialogOpen) return;
    name = "";
    description = "";
    queueMicrotask(() => nameInput?.focus());
  });

  function handleSubmit(event: Event) {
    event.preventDefault();
    void createProject(name, description);
  }
</script>

{#if $createDialogOpen}
  <Dialog title="New project" onclose={closeCreateDialog}>
    <form id="create-project-form" onsubmit={handleSubmit}>
      <Field label="Project name" forId="create-project-name">
        <input
          id="create-project-name"
          bind:this={nameInput}
          bind:value={name}
          type="text"
          required
          placeholder="My awesome project"
        />
      </Field>
      <Field label="Description" forId="create-project-description">
        <textarea
          id="create-project-description"
          bind:value={description}
          placeholder="A brief description of your project"
        ></textarea>
      </Field>
    </form>

    {#snippet actions()}
      <Button onclick={closeCreateDialog}>Cancel</Button>
      <Button
        variant="primary"
        disabled={!name.trim() || $creatingProject}
        onclick={handleSubmit}
      >
        {$creatingProject ? "Creating…" : "Create project"}
      </Button>
    {/snippet}
  </Dialog>
{/if}

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
</style>

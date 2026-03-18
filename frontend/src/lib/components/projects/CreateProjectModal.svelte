<script lang="ts">
  let { show = $bindable(false), onSubmit } = $props<{
    show?: boolean;
    onSubmit: (name: string, description: string) => void;
  }>();

  let newProjectName = $state("");
  let newProjectDescription = $state("");
  let projectNameInput = $state<HTMLInputElement | undefined>();

  // Focus input when modal opens
  $effect(() => {
    if (show && projectNameInput) {
      setTimeout(() => projectNameInput?.focus(), 0);
    }
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    onSubmit(newProjectName, newProjectDescription);
    newProjectName = "";
    newProjectDescription = "";
  }

  function closeModal() {
    show = false;
    newProjectName = "";
    newProjectDescription = "";
  }
</script>

{#if show}
  <div
    class="modal"
    onclick={closeModal}
    onkeydown={(e) => e.key === "Escape" && closeModal()}
    role="presentation"
  >
    <div
      class="modal-content"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      tabindex="-1"
    >
      <h2>Create New Project</h2>
      <form onsubmit={handleSubmit}>
        <div class="field">
          <label for="project-name">Project Name</label>
          <input
            id="project-name"
            bind:this={projectNameInput}
            type="text"
            bind:value={newProjectName}
            required
            placeholder="My Awesome Project"
          />
        </div>
        <div class="field">
          <label for="project-description">Description</label>
          <textarea
            id="project-description"
            bind:value={newProjectDescription}
            placeholder="A brief description of your project"
          ></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" onclick={closeModal} class="cancel-btn">
            Cancel
          </button>
          <button type="submit" class="submit-btn"> Create Project </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--dialog-backdrop);
    backdrop-filter: blur(var(--dialog-backdrop-blur));
    -webkit-backdrop-filter: blur(var(--dialog-backdrop-blur));
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    z-index: var(--z-modal-backdrop);
    animation: fadeIn var(--transition-fast);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .modal-content {
    background: var(--dialog-bg);
    border: 2px solid var(--dialog-border);
    padding: 2rem;
    border-radius: var(--radius-xl);
    width: 100%;
    max-width: 500px;
    box-shadow: var(--shadow-2xl);
    animation: slideUp var(--transition-base);
  }

  .modal-content h2 {
    font-size: 2.3rem;
    font-weight: 900;
    margin: 0rem 0 1.5rem 0.1rem;
    color: var(--dialog-text);
    letter-spacing: -0.02em;
    font-family: "DM Serif Display", Georgia, serif;
  }

  .field {
    margin-bottom: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  label {
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
    color: var(--dialog-text);
  }

  input,
  textarea {
    padding: var(--space-3);
    border: 2px solid var(--dialog-input-border);
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    background: var(--bg-primary);
    color: var(--dialog-text);
  }

  input:focus,
  textarea:focus {
    outline: none;
    border-color: var(--color-tertiary-500);
  }

  input::placeholder,
  textarea::placeholder {
    color: var(--text-tertiary);
  }

  textarea {
    min-height: 80px;
    font-family: inherit;
    resize: vertical;
  }

  .modal-actions {
    display: flex;
    gap: var(--space-3);
    justify-content: flex-end;
    margin-top: 1.5rem;
  }

  .cancel-btn {
    flex: 1;
    background: var(--dialog-cancel-btn-bg);
    color: var(--dialog-text);
    border: none;
    padding: var(--space-3);
    border-radius: var(--radius-md);
    font-weight: var(--font-medium);
    cursor: pointer;
    font-size: var(--text-base);
  }

  .cancel-btn:hover {
    background: var(--dialog-cancel-btn-hover);
  }

  .cancel-btn:active {
    background: var(--dialog-cancel-btn-active);
    color: var(--text-active);
  }

  .submit-btn {
    flex: 1;
    background: var(--color-tertiary-500);
    color: white;
    border: none;
    padding: var(--space-3);
    border-radius: var(--radius-md);
    font-weight: 700;
    cursor: pointer;
    font-size: var(--text-base);
  }

  .submit-btn:hover {
    background: var(--color-tertiary-glow);
    box-shadow: 0 1px 6px var(--color-tertiary-glow);
  }

  .submit-btn:active {
    box-shadow: 0 1px 12px var(--color-tertiary-glow);
  }
</style>

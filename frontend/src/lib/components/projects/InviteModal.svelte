<script lang="ts">
  import SendHorizontal from "@lucide/svelte/icons/send-horizontal";

  let { show = $bindable(false), onSubmit } = $props<{
    show?: boolean;
    onSubmit: (email: string, role: string) => void;
  }>();

  let inviteEmail = $state("");
  let inviteRole = $state("editor");
  let inviteEmailInput = $state<HTMLInputElement | undefined>();

  // Focus input when modal opens
  $effect(() => {
    if (show && inviteEmailInput) {
      setTimeout(() => inviteEmailInput?.focus(), 0);
    }
  });

  // Handle Escape key
  $effect(() => {
    if (!show) return;
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    onSubmit(inviteEmail, inviteRole);
    inviteEmail = "";
    inviteRole = "editor";
  }

  function closeModal() {
    show = false;
    inviteEmail = "";
    inviteRole = "editor";
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
      <h2>Invite Collaborator</h2>
      <form onsubmit={handleSubmit}>
        <div class="field">
          <label for="invite-email">Email Address</label>
          <input
            id="invite-email"
            bind:this={inviteEmailInput}
            type="email"
            bind:value={inviteEmail}
            required
            placeholder="collaborator@example.com"
          />
        </div>
        <div class="field">
          <label for="invite-role">Role</label>
          <select id="invite-role" bind:value={inviteRole}>
            <option value="reader">Reader - Can only view</option>
            <option value="editor">Editor - Can edit files</option>
            <option value="admin">Admin - Can manage collaborators</option>
          </select>
        </div>
        <div class="modal-actions">
          <button type="button" onclick={closeModal} class="cancel-btn">
            Cancel
          </button>
          <button type="submit" class="submit-btn">
            Send Invitation
            <SendHorizontal size={16} />
          </button>
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
  select {
    padding: var(--space-3);
    border: 2px solid var(--dialog-input-border);
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    background: var(--bg-primary);
    color: var(--dialog-text);
  }

  input:focus,
  select:focus {
    outline: none;
    border-color: var(--color-tertiary-500);
  }

  input::placeholder {
    color: var(--text-tertiary);
  }

  select option {
    background: var(--dialog-input-bg);
    color: var(--dialog-text);
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
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .submit-btn:hover {
    background: var(--color-tertiary-glow);
    box-shadow: 0 1px 6px var(--color-tertiary-glow);
  }

  .submit-btn:active {
    box-shadow: 0 1px 12px var(--color-tertiary-glow);
  }
</style>

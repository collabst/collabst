<script lang="ts">
  export let show: boolean
  export let onClose: () => void
  export let onSubmit: (fileName: string) => void

  let fileName = ''

  function handleSubmit(e: Event) {
    e.preventDefault()
    if (fileName.trim()) {
      onSubmit(fileName.trim())
      fileName = ''
    }
  }

  function handleBackdropClick() {
    onClose()
  }
</script>

{#if show}
  <div class="modal" on:click={handleBackdropClick} role="dialog" aria-modal="true">
    <div class="modal-content" on:click|stopPropagation role="document">
      <h2>Create New File</h2>
      <form on:submit={handleSubmit}>
        <div class="field">
          <label for="fileName">File Name</label>
          <input
            id="fileName"
            type="text"
            bind:value={fileName}
            required
            placeholder="main.typ"
            autofocus
          />
        </div>
        <div class="modal-actions">
          <button type="button" on:click={onClose} class="cancel-btn">
            Cancel
          </button>
          <button type="submit" class="submit-btn">
            Create
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
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    z-index: 1000;
  }

  .modal-content {
    background: #252526;
    padding: 2rem;
    border-radius: 8px;
    width: 100%;
    max-width: 400px;
    color: white;
  }

  h2 {
    font-size: 20px;
    margin: 0 0 1.5rem 0;
  }

  .field {
    margin-bottom: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-size: 14px;
    font-weight: 600;
  }

  input {
    padding: 0.75rem;
    border: 1px solid #3e3e42;
    border-radius: 4px;
    font-size: 14px;
    background: #1e1e1e;
    color: white;
  }

  input:focus {
    outline: none;
    border-color: #0e639c;
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  button {
    flex: 1;
    padding: 0.75rem;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
    border: none;
  }

  .cancel-btn {
    background: #3e3e42;
    color: white;
  }

  .cancel-btn:hover {
    background: #4a4a4e;
  }

  .submit-btn {
    background: #0e639c;
    color: white;
  }

  .submit-btn:hover {
    background: #0a4d7a;
  }
</style>

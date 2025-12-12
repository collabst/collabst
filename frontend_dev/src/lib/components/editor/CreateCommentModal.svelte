<script lang="ts">
  import { createEventDispatcher } from 'svelte'

  export let isOpen = false
  export let selectedText = ''

  const dispatch = createEventDispatcher()

  let commentText = ''

  function handleSubmit() {
    if (commentText.trim()) {
      dispatch('submit', { content: commentText.trim() })
      commentText = ''
      isOpen = false
    }
  }

  function handleCancel() {
    commentText = ''
    isOpen = false
    dispatch('cancel')
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleCancel()
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit()
    }
  }
</script>

{#if isOpen}
  <div class="modal-backdrop" on:click={handleCancel} on:keydown={handleKeydown}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h3>Add Comment</h3>
        <button class="close-btn" on:click={handleCancel}>&times;</button>
      </div>

      <div class="modal-body">
        {#if selectedText}
          <div class="selected-text">
            <div class="label">Commenting on:</div>
            <div class="text">{selectedText}</div>
          </div>
        {/if}

        <textarea
          bind:value={commentText}
          placeholder="Write your comment..."
          rows="4"
          autofocus
          on:keydown={handleKeydown}
        />

        <div class="hint">Press Cmd/Ctrl+Enter to submit</div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-cancel" on:click={handleCancel}>Cancel</button>
        <button class="btn btn-submit" on:click={handleSubmit} disabled={!commentText.trim()}>
          Add Comment
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal {
    background: #1e1e1e;
    border: 1px solid #3e3e3e;
    border-radius: 8px;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    animation: slideIn 0.2s ease;
  }

  @keyframes slideIn {
    from {
      transform: translateY(-20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid #3e3e3e;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #e0e0e0;
  }

  .close-btn {
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 28px;
    line-height: 1;
    padding: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: #2e2e2e;
    color: #e0e0e0;
  }

  .modal-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .selected-text {
    background: #2a2a2a;
    border: 1px solid #3e3e3e;
    border-radius: 4px;
    padding: 12px;
  }

  .selected-text .label {
    font-size: 11px;
    color: #888;
    text-transform: uppercase;
    margin-bottom: 6px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .selected-text .text {
    font-size: 13px;
    color: #d0d0d0;
    line-height: 1.5;
    max-height: 80px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }

  textarea {
    width: 100%;
    background: #2a2a2a;
    border: 1px solid #3e3e3e;
    border-radius: 4px;
    padding: 12px;
    color: #e0e0e0;
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
    min-height: 100px;
  }

  textarea:focus {
    outline: none;
    border-color: #4a9eff;
  }

  .hint {
    font-size: 11px;
    color: #666;
    text-align: right;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid #3e3e3e;
  }

  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 500;
  }

  .btn-cancel {
    background: #2a2a2a;
    color: #d0d0d0;
  }

  .btn-cancel:hover {
    background: #3a3a3a;
  }

  .btn-submit {
    background: #4a9eff;
    color: white;
  }

  .btn-submit:hover:not(:disabled) {
    background: #3a8eef;
  }

  .btn-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>

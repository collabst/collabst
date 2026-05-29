<script lang="ts">
  import { Modal, Button } from '$lib/components/ui'
  import Trash2 from '@lucide/svelte/icons/trash-2'
  
  export let show: boolean
  export let title: string = 'Confirm Deletion'
  export let message: string
  export let onClose: () => void
  export let onConfirm: () => void

  function handleConfirm() {
    onConfirm()
    show = false
  }
</script>

<Modal bind:open={show} {title} size="sm" hideCloseButton onClose={onClose}>
  <p class="message">{message}</p>
  
  {#snippet footer()}
    <Button variant="ghost" onclick={onClose}>
      Cancel
    </Button>
    <Button variant="danger" onclick={handleConfirm}>
      Delete
      <Trash2 size={16} />
    </Button>
  {/snippet}
</Modal>

<style>
  .message {
    color: var(--text-primary);
    font-size: var(--text-base);
    margin: 0;
  }
</style>

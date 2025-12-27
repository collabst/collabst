<script lang="ts">
  import { Modal, Input, Button } from '$lib/components/ui'
  import CornerDownLeft from '@lucide/svelte/icons/corner-down-left'

  interface Props {
    show: boolean
    onClose: () => void
    onSubmit: (folderName: string) => void
  }

  let { show = $bindable(), onClose, onSubmit }: Props = $props()

  let folderName = ''
  let inputElement: HTMLInputElement | undefined

  // Auto-focus when modal opens
  $effect(() => {
    if (show && inputElement) {
      setTimeout(() => {
        inputElement?.focus()
      }, 0)
    }
  })

  function handleSubmit() {
    if (folderName.trim()) {
      onSubmit(folderName.trim())
      folderName = ''
      show = false
    }
  }
</script>

<Modal bind:open={show} title="Create New Folder" size="sm" hideCloseButton onClose={onClose}>
  <form on:submit|preventDefault={handleSubmit}>
    <Input
      bind:value={folderName}
      bind:inputElement
      label="Folder Name"
      placeholder="my-folder"
      required
      fullWidth
    />
  </form>

  {#snippet footer()}
    <Button variant="ghost" onclick={onClose}>
      Cancel
    </Button>
    <Button variant="primary" onclick={handleSubmit}>
      Create
      <CornerDownLeft size={16} />
    </Button>
  {/snippet}
</Modal>

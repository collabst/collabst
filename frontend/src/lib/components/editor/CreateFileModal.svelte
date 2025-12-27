<script lang="ts">
  import { Modal, Input, Button } from '$lib/components/ui'
  import CornerDownLeft from '@lucide/svelte/icons/corner-down-left'
  
  interface Props {
    show: boolean
    onClose: () => void
    onSubmit: (fileName: string) => void
  }

  let { show = $bindable(), onClose, onSubmit }: Props = $props()

  let fileName = ''
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
    if (fileName.trim()) {
      onSubmit(fileName.trim())
      fileName = ''
      show = false
    }
  }
</script>

<Modal bind:open={show} title="Create New File" size="sm" hideCloseButton onClose={onClose}>
  <form on:submit|preventDefault={handleSubmit}>
    <Input
      bind:value={fileName}
      bind:inputElement
      label="File Name"
      placeholder="main.typ"
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

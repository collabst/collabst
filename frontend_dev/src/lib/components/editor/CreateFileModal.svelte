<script lang="ts">
  import { Modal, Input, Button } from '$lib/components/ui'
  
  export let show: boolean
  export let onClose: () => void
  export let onSubmit: (fileName: string) => void

  let fileName = ''

  function handleSubmit() {
    if (fileName.trim()) {
      onSubmit(fileName.trim())
      fileName = ''
      show = false
    }
  }
</script>

<Modal bind:open={show} title="Create New File" size="sm" onClose={onClose}>
  <form on:submit|preventDefault={handleSubmit}>
    <Input
      bind:value={fileName}
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
    </Button>
  {/snippet}
</Modal>

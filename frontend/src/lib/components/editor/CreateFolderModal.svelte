<script lang="ts">
  import { Modal, Input, Button } from '$lib/components/ui'

  export let show: boolean
  export let onClose: () => void
  export let onSubmit: (folderName: string) => void

  let folderName = ''

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
    </Button>
  {/snippet}
</Modal>

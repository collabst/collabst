<script lang="ts">
  import { Modal, Button, Input } from '$lib/components/ui'

  type Format = 'svg' | 'png'

  const DEFAULT_PNG_PPI = 144

  interface Props {
    open: boolean
    format: Format
    pageCount: number
    onClose: () => void
    onSubmit: (opts: { index: number; ppi?: number }) => void
  }

  let { open = $bindable(false), format, pageCount, onClose, onSubmit }: Props = $props()

  // 1-based for the UI; converted to 0-based on submit.
  let pageInput = $state('1')
  let ppiInput = $state(String(DEFAULT_PNG_PPI))

  // Re-seed on open so a previous export's page doesn't carry over.
  $effect(() => {
    if (open) {
      pageInput = '1'
      ppiInput = String(DEFAULT_PNG_PPI)
    }
  })

  let pageNum = $derived(Number.parseInt(pageInput, 10))
  let ppi = $derived(Number.parseFloat(ppiInput))

  let pageError = $derived(
    !Number.isInteger(pageNum) || pageNum < 1 || pageNum > pageCount
      ? `Enter a page between 1 and ${pageCount}`
      : ''
  )
  let ppiError = $derived(
    format === 'png' && (!Number.isFinite(ppi) || ppi <= 0)
      ? 'Enter a positive number'
      : ''
  )
  let canSubmit = $derived(!pageError && !ppiError && pageCount > 0)

  function submit() {
    if (!canSubmit) return
    const opts: { index: number; ppi?: number } = { index: pageNum - 1 }
    if (format === 'png') opts.ppi = ppi
    onSubmit(opts)
  }
</script>

<Modal bind:open title={`Export ${format.toUpperCase()}`} size="sm" onClose={onClose}>
  <div class="fields">
    <Input
      type="number"
      label={`Page (1–${Math.max(pageCount, 1)})`}
      bind:value={pageInput}
      error={pageError}
      fullWidth
      autofocus
    />

    {#if format === 'png'}
      <Input
        type="number"
        label="Resolution (PPI)"
        bind:value={ppiInput}
        error={ppiError}
        fullWidth
      />
      <p class="hint">Pixels per inch. The Typst default is {DEFAULT_PNG_PPI}.</p>
    {/if}
  </div>

  {#snippet footer()}
    <Button variant="ghost" onclick={onClose}>Cancel</Button>
    <Button variant="primary" onclick={submit} disabled={!canSubmit}>
      Export
    </Button>
  {/snippet}
</Modal>

<style>
  .fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .hint {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-size-sm);
  }
</style>

<script lang="ts">
  import { setSortBy, sortBy, type SortBy } from "./context";
  import Button from "./Button.svelte";
  import ArrowDownWideNarrow from "@lucide/svelte/icons/arrow-down-wide-narrow";
  import Check from "@lucide/svelte/icons/check";

  const OPTIONS: { value: SortBy; label: string }[] = [
    { value: "modified", label: "Last modified" },
    { value: "created", label: "Last created" },
    { value: "name", label: "Name" },
  ];

  let open = $state(false);
  let currentLabel = $derived(
    OPTIONS.find((o) => o.value === $sortBy)?.label ?? "Sort",
  );

  function choose(value: SortBy) {
    setSortBy(value);
    open = false;
  }
</script>

<div class="sort">
  <Button onclick={() => (open = !open)} title="Sort projects">
    <ArrowDownWideNarrow size={16} />
    <span class="label">{currentLabel}</span>
  </Button>

  {#if open}
    <button class="backdrop" aria-label="Close menu" onclick={() => (open = false)}
    ></button>
    <div class="menu">
      {#each OPTIONS as option (option.value)}
        <button class="item" onclick={() => choose(option.value)}>
          <span class="check">
            {#if $sortBy === option.value}<Check size={14} />{/if}
          </span>
          {option.label}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .sort {
    position: relative;
  }

  .label {
    white-space: nowrap;
  }

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    border: none;
    background: transparent;
    cursor: default;
  }

  .menu {
    position: absolute;
    z-index: 41;
    top: calc(100% + 0.4rem);
    right: 0;
    min-width: 11rem;
    display: flex;
    flex-direction: column;
    padding: 0.35rem;
    border: 1px solid var(--navbar-border);
    border-radius: 0.75rem;
    background-color: color-mix(in srgb, var(--navbar-bg), transparent 10%);
    backdrop-filter: blur(12px);
    box-shadow:
      0 3px 0 0 var(--navbar-shadow),
      0 12px 28px -12px rgb(0 0 0 / 0.35);
  }

  .item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    padding: 0.4rem 0.6rem;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--text-secondary);
    font: inherit;
    font-size: 0.85rem;
    text-align: left;
    cursor: pointer;
  }

  .item:hover {
    background-color: var(--surface-hover);
    color: var(--text-primary);
  }

  .check {
    display: flex;
    width: 14px;
    flex-shrink: 0;
    color: var(--color-tertiary-500);
  }
</style>

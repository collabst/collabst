<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";

  export let onclick: () => void;
</script>

<button {onclick} class="create-btn">
  <span
    class="create-btn-content"
    style="display: flex; align-items: center; gap: 0.3rem;"
  >
    <Plus size={18} strokeWidth={3} style="vertical-align: middle;" />
    New Project
  </span>
</button>

<style>
  .create-btn {
    background: var(--bg-primary);
    color: var(--text-primary);
    border: 2px solid var(--border-primary);
    padding: 0.75rem 1rem;
    margin-left: 2.3rem;
    border-radius: 6px;
    font-weight: 700;
    cursor: pointer;
    font-size: 15px;
  }

  .create-btn:hover {
    background: var(--surface-hover);
    border-color: var(--border-secondary);
    color: var(--color-tertiary-500);
    border-color: var(--color-tertiary-glow);
  }

  .create-btn:active {
    transform: scaleY(0.96) scaleX(1.01);
    display: inline-block;
  }

  :global(.create-btn:active svg) {
    stroke-width: 3;
  }

  .create-btn:active .create-btn-content {
    display: inline-block;
  }
</style>

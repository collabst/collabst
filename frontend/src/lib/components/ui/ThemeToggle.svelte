<script lang="ts">
  import { theme } from "$lib/stores/theme";
  import { Tooltip } from "$lib/components/ui";
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";

  let currentTheme = $state($theme);

  $effect(() => {
    currentTheme = $theme;
  });

  function toggle() {
    theme.toggle();
  }
</script>

<Tooltip
  text={currentTheme === "dark"
    ? "Switch to light mode"
    : "Switch to dark mode"}
  position="bottom"
>
  <button class="theme-btn" onclick={toggle}>
    {#if currentTheme === "dark"}
      <Sun size={18} />
    {:else}
      <Moon size={18} />
    {/if}
  </button>
</Tooltip>

<style>
  .theme-btn {
    background: transparent;
    border: 1px solid var(--border-primary);
    color: var(--text-primary);
    padding: 0.375rem;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
  }

  .theme-btn:hover {
    background: var(--surface-hover);
    border-color: var(--border-secondary);
  }
</style>

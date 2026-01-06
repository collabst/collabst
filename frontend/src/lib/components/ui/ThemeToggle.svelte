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
    border: none;
    color: var(--text-secondary);
    padding: 0.375rem;
    border-radius: 50px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    margin-left: 0.75rem;
  }

  /* Light theme - show dark theme preview on hover */
  :global([data-theme="light"]) .theme-btn:hover {
    background: #2a2a2a;
    color: #cccccc;
    border-color: #4a4a4e;
  }

  /* Dark theme - show light theme preview on hover */
  :global([data-theme="dark"]) .theme-btn:hover {
    background: #e8e8e8;
    color: #1e1e1e;
    border-color: #b8b8b8;
  }
</style>

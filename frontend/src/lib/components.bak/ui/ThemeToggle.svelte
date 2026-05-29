<script lang="ts">
  import { theme } from "$lib/stores/theme";
  import { IconButton, Tooltip } from "$lib/components/ui";
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
  <div class="theme-toggle-wrapper">
    <IconButton
      icon={currentTheme === "dark" ? Sun : Moon}
      variant="top-bar"
      size="top-bar"
      onclick={toggle}
      class="theme-toggle"
    />
  </div>
</Tooltip>

<style>
  .theme-toggle-wrapper {
    margin-left: 0.75rem;
  }

  /* Light theme - show dark theme preview on hover */
  :global([data-theme="light"])
    .theme-toggle-wrapper
    :global(.theme-toggle:hover) {
    background: #2a2a2a !important;
    color: #cccccc !important;
    border-color: #4a4a4e !important;
  }

  /* Dark theme - show light theme preview on hover */
  :global([data-theme="dark"])
    .theme-toggle-wrapper
    :global(.theme-toggle:hover) {
    background: #e8e8e8 !important;
    color: #1e1e1e !important;
    border-color: #b8b8b8 !important;
  }

  .theme-toggle-wrapper :global(.theme-toggle:hover svg) {
    animation: bigJumpAnimation 0.2s ease-out;
  }

  @keyframes bigJumpAnimation {
    0% {
      transform: translateY(-8px) scaleX(0.8) scaleY(1.1);
    }
    80% {
      transform: translateY(1px) scaleX(1.2) scaleY(0.95);
    }
    100% {
      transform: none;
    }
  }
</style>

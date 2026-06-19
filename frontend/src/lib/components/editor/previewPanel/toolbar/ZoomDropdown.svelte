<script lang="ts">
  import {
    fitToWidth,
    fitToHeight,
    fitToPage,
  } from "$lib/components/editor/context";
  import Button from "./Button.svelte";
  import GaleryVertical from "@lucide/svelte/icons/gallery-vertical";
  import GaleryHorizontal from "@lucide/svelte/icons/gallery-horizontal";
  import Brackets from "@lucide/svelte/icons/brackets";

  interface Props {
    open: boolean;
  }

  let { open }: Props = $props();
</script>

<div class="dropdown" class:open>
  <div class="dropdown-content">
    <div class="dropdown-header">Zoom</div>
    <div class="dropdown-divider"></div>
    <div class="dropdown-item">
      <Button onclick={fitToWidth}>
        <GaleryHorizontal />
        <span class="dropdown-item-text">Fit width</span>
      </Button>
    </div>
    <div class="dropdown-item">
      <Button onclick={fitToHeight}>
        <GaleryVertical />
        <span class="dropdown-item-text">Fit height</span>
      </Button>
    </div>
    <div class="dropdown-item">
      <Button onclick={fitToPage}>
        <Brackets />
        <span class="dropdown-item-text">Fit page</span>
      </Button>
    </div>
  </div>
</div>

<style>
  .dropdown {
    position: relative;
    display: none;
  }

  .dropdown-content {
    position: absolute;
    margin-top: 0.5rem;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    background-color: var(--bg-primary);
    border: 1px solid var(--border-primary);
    border-radius: 0.5rem;
  }

  .dropdown.open {
    display: block;
  }

  .dropdown-header {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    color: var(--text-secondary);
  }

  .dropdown-divider {
    height: 1px;
    background-color: var(--border-secondary);
    margin: 0.25rem 0;
  }

  .dropdown-item :global(button) {
    margin: 0.25rem 0.5rem;
    padding: 0.25rem 0.5rem;
    gap: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }
</style>

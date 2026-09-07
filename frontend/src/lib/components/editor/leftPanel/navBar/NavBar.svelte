<script lang="ts">
  import File from "@lucide/svelte/icons/file";
  import Map from "@lucide/svelte/icons/map";
  import MessageSquareText from "@lucide/svelte/icons/message-square-text";
  import Search from "@lucide/svelte/icons/search";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import Button from "./Button.svelte";
  import {
    leftPanelTab,
    type LeftPanelTab,
    cycleLeftPanelTab,
  } from "$lib/components/editor/context/index";
  import { toggleLeftPanel } from "$lib/stores/layout";

  // Clicking the tab that is already showing collapses the panel — the same
  // toggle the old activity bar had.
  function handleTabClick(tab: LeftPanelTab) {
    if ($leftPanelTab === tab) {
      toggleLeftPanel();
      return;
    }
    $leftPanelTab = tab;
  }

  function handleNavWheel(event: WheelEvent) {
    const direction = event.deltaY > 0 ? 1 : -1;
    cycleLeftPanelTab(direction);
  }
</script>

<div class="container">
  <div class="nav-bar" onwheel={handleNavWheel}>
    <Button
      onclick={() => handleTabClick("files")}
      selected={$leftPanelTab === "files"}
    >
      <File />
    </Button>
    <Button
      onclick={() => handleTabClick("search")}
      selected={$leftPanelTab === "search"}
    >
      <Search />
    </Button>
    <Button
      onclick={() => handleTabClick("outline")}
      selected={$leftPanelTab === "outline"}
    >
      <Map />
    </Button>
    <Button
      onclick={() => handleTabClick("issues")}
      selected={$leftPanelTab === "issues"}
    >
      <TriangleAlert />
    </Button>
    <Button
      onclick={() => handleTabClick("comments")}
      selected={$leftPanelTab === "comments"}
    >
      <MessageSquareText />
    </Button>
  </div>
</div>

<style>
  .container {
    position: absolute;
    bottom: 0;
    left: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    margin: 0.5rem 0;
  }

  .nav-bar {
    display: flex;
    gap: 2px;
    background-color: var(--navbar-bg);
    border: 1px solid var(--navbar-border);
    border-radius: 1rem;
    padding: 0.5rem 0.8rem;
  }
</style>

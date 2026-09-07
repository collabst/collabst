<script lang="ts">
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import File from "@lucide/svelte/icons/file";
  import Map from "@lucide/svelte/icons/map";
  import MessageSquareText from "@lucide/svelte/icons/message-square-text";
  import Search from "@lucide/svelte/icons/search";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import Button from "./Button.svelte";
  import OverflowBar, {
    type OverflowItem,
  } from "$lib/components/ui/OverflowBar.svelte";
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

  // A narrow panel folds the tabs it cannot fit into the menu, tail first.
  const tabs: OverflowItem[] = $derived([
    { render: filesTab, label: "Files" },
    { render: searchTab, label: "Search" },
    { render: outlineTab, label: "Outline" },
    { render: issuesTab, label: "Issues" },
    { render: commentsTab, label: "Comments" },
  ]);
</script>

{#snippet filesTab()}
  <Button
    onclick={() => handleTabClick("files")}
    selected={$leftPanelTab === "files"}
  >
    <File />
  </Button>
{/snippet}

{#snippet searchTab()}
  <Button
    onclick={() => handleTabClick("search")}
    selected={$leftPanelTab === "search"}
  >
    <Search />
  </Button>
{/snippet}

{#snippet outlineTab()}
  <Button
    onclick={() => handleTabClick("outline")}
    selected={$leftPanelTab === "outline"}
  >
    <Map />
  </Button>
{/snippet}

{#snippet issuesTab()}
  <Button
    onclick={() => handleTabClick("issues")}
    selected={$leftPanelTab === "issues"}
  >
    <TriangleAlert />
  </Button>
{/snippet}

{#snippet commentsTab()}
  <Button
    onclick={() => handleTabClick("comments")}
    selected={$leftPanelTab === "comments"}
  >
    <MessageSquareText />
  </Button>
{/snippet}

{#snippet more({ onclick, open }: { onclick: (e: MouseEvent) => void; open: boolean })}
  <Button {onclick} selected={open} title="More tabs">
    <Ellipsis />
  </Button>
{/snippet}

<div class="container">
  <OverflowBar
    class="nav-bar"
    direction="up"
    items={tabs}
    {more}
    onwheel={handleNavWheel}
  />
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

  /*
    The bar is `OverflowBar`'s own element, so it is styled the way the regional
    buttons style `ui/Button.svelte`: from the outside, on a class it was given.
  */
  :global(.overflow-bar.nav-bar) {
    gap: 2px;
    background-color: var(--navbar-bg);
    border: 1px solid var(--navbar-border);
    border-radius: 1rem;
    padding: 0.5rem 0.8rem;
  }
</style>

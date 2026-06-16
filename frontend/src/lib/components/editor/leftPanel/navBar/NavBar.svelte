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

  function handleTabClick(tab: LeftPanelTab) {
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
      icon={File}
      onclick={() => handleTabClick("files")}
      selected={$leftPanelTab === "files"}
    />
    <Button
      icon={Search}
      onclick={() => handleTabClick("search")}
      selected={$leftPanelTab === "search"}
    />
    <Button
      icon={Map}
      onclick={() => handleTabClick("outline")}
      selected={$leftPanelTab === "outline"}
    />
    <Button
      icon={TriangleAlert}
      onclick={() => handleTabClick("issues")}
      selected={$leftPanelTab === "issues"}
    />
    <Button
      icon={MessageSquareText}
      onclick={() => handleTabClick("comments")}
      selected={$leftPanelTab === "comments"}
    />
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

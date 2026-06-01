<script lang="ts">
  import {
    File,
    Map,
    MessageSquareText,
    Search,
    TriangleAlert,
  } from "@lucide/svelte";
  import Button from "./Button.svelte";
  import {
    editorContext,
    type LeftPanelTab,
  } from "$lib/components/editor/context/index";

  function handleTabClick(tab: LeftPanelTab) {
    $editorContext.leftPanelTab = tab;
  }

  function handleNavWheel(event: WheelEvent) {
    const direction = event.deltaY > 0 ? 1 : -1;
    editorContext.cycleLeftPanelTab(direction);
  }

  let leftPanelTab = $derived($editorContext.leftPanelTab);
</script>

<div class="container">
  <div class="nav-bar" onwheel={handleNavWheel}>
    <Button
      icon={File}
      onclick={() => handleTabClick("files")}
      selected={leftPanelTab === "files"}
    />
    <Button
      icon={Search}
      onclick={() => handleTabClick("search")}
      selected={leftPanelTab === "search"}
    />
    <Button
      icon={Map}
      onclick={() => handleTabClick("outline")}
      selected={leftPanelTab === "outline"}
    />
    <Button
      icon={TriangleAlert}
      onclick={() => handleTabClick("issues")}
      selected={leftPanelTab === "issues"}
    />
    <Button
      icon={MessageSquareText}
      onclick={() => handleTabClick("comments")}
      selected={leftPanelTab === "comments"}
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
    background-color: var(--bg-editor);
    border: 1px solid #00ac97;
    border-radius: 1rem;
    padding: 0.5rem 0.8rem;
  }
</style>

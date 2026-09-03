<script lang="ts">
  import { editorSettings } from "$lib/stores/editorSettings";
  import {
    showToolbar,
    toggleLineWrapping,
    toggleShowToolbar,
    wrapLines,
  } from "$lib/components/editor/context";
  import Panel from "./Panel.svelte";
  import Row from "./Row.svelte";
  import Toggle from "./Toggle.svelte";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";

  interface Props {
    open: boolean;
  }

  let { open = $bindable(false) }: Props = $props();

  const MIN_FONT_SIZE = 6;
  const MAX_FONT_SIZE = 48;

  function setFontSize(size: number) {
    if (Number.isNaN(size)) return;
    editorSettings.setFontSize(
      Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(size))),
    );
  }
</script>

{#if open}
  <Panel title="Editor settings" onclose={() => (open = false)}>
    <Row label="Font family" forId="setting-font-family">
      <input
        id="setting-font-family"
        type="text"
        value={$editorSettings.fontFamily}
        oninput={(e) => editorSettings.setFontFamily(e.currentTarget.value)}
      />
      <button
        class="mini"
        onclick={() => editorSettings.resetFontFamily()}
        aria-label="Reset font family"
        title="Reset to default"
      >
        <RotateCcw size={14} />
      </button>
    </Row>

    <Row label="Font size" forId="setting-font-size">
      <input
        id="setting-font-size"
        class="size"
        type="number"
        min={MIN_FONT_SIZE}
        max={MAX_FONT_SIZE}
        value={$editorSettings.fontSize}
        oninput={(e) => setFontSize(e.currentTarget.valueAsNumber)}
      />
      <div class="steppers">
        <button
          class="mini"
          onclick={() => setFontSize($editorSettings.fontSize + 1)}
          aria-label="Increase font size"
        >
          <ChevronUp size={12} />
        </button>
        <button
          class="mini"
          onclick={() => setFontSize($editorSettings.fontSize - 1)}
          aria-label="Decrease font size"
        >
          <ChevronDown size={12} />
        </button>
      </div>
      <button
        class="mini"
        onclick={() => editorSettings.resetFontSize()}
        aria-label="Reset font size"
        title="Reset to default"
      >
        <RotateCcw size={14} />
      </button>
    </Row>

    <Row label="Ligatures" hint="Render -> and => as single glyphs">
      <Toggle
        checked={$editorSettings.ligatures}
        ariaLabel="Ligatures"
        onchange={(checked) => editorSettings.setLigatures(checked)}
      />
    </Row>

    <Row label="Wrap lines" hint="Fold long lines instead of scrolling">
      <Toggle
        checked={$wrapLines}
        ariaLabel="Wrap lines"
        onchange={toggleLineWrapping}
      />
    </Row>

    <Row label="Show toolbar" hint="The floating formatting bar">
      <Toggle
        checked={$showToolbar}
        ariaLabel="Show toolbar"
        onchange={toggleShowToolbar}
      />
    </Row>
  </Panel>
{/if}

<style>
  .size {
    width: 4.5rem !important;
  }

  .steppers {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .mini {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.15rem 0.25rem;
    border: 1px solid var(--navbar-border);
    border-radius: 0.35rem;
    background-color: var(--navbar-bg);
    color: var(--text-secondary);
    cursor: pointer;
  }

  .mini:hover {
    color: var(--text-primary);
    background-color: var(--surface-hover);
  }

  .mini:active {
    transform: translateY(1px);
  }
</style>

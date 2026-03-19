<script lang="ts">
  import { editorSettings } from "$lib/stores/editorSettings";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import ChevronUp from "@lucide/svelte/icons/chevron-up";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Ligature from "@lucide/svelte/icons/ligature";
  import Checkbox from "../ui/Checkbox.svelte";

  let fontSize = $state($editorSettings.fontSize);
  let fontFamily = $state($editorSettings.fontFamily);
  let ligatures = $state($editorSettings.ligatures);

  // Sync local state with store
  $effect(() => {
    fontSize = $editorSettings.fontSize;
  });

  $effect(() => {
    fontFamily = $editorSettings.fontFamily;
  });

  $effect(() => {
    ligatures = $editorSettings.ligatures;
  });

  function handleFontSizeInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = target.value;

    // Only allow digits
    const numericValue = value.replace(/[^\d]/g, "");

    if (numericValue !== value) {
      target.value = numericValue;
    }

    if (numericValue) {
      const parsed = parseInt(numericValue, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 999) {
        fontSize = parsed;
        editorSettings.setFontSize(parsed);
      }
    }
  }

  function incrementFontSize() {
    const newSize = Math.min(fontSize + 1, 999);
    fontSize = newSize;
    editorSettings.setFontSize(newSize);
  }

  function decrementFontSize() {
    const newSize = Math.max(fontSize - 1, 1);
    fontSize = newSize;
    editorSettings.setFontSize(newSize);
  }

  function handleFontFamilyInput(event: Event) {
    const target = event.target as HTMLInputElement;
    fontFamily = target.value;
    editorSettings.setFontFamily(target.value);
  }

  function resetFontSize() {
    editorSettings.resetFontSize();
  }

  function resetFontFamily() {
    editorSettings.resetFontFamily();
  }

  function toggleLigatures(checked: boolean) {
    ligatures = checked;
    editorSettings.setLigatures(checked);
  }
</script>

<div class="settings-panel">
  <div class="panel-header">
    <h3>Settings</h3>
  </div>
  <div class="panel-content">
    <section class="settings-section">
      <h4>Editor Settings</h4>

      <div class="setting-item">
        <div class="setting-row">
          <label for="font-size">Font size</label>
          <div class="input-with-controls">
            <input
              id="font-size"
              type="text"
              inputmode="numeric"
              value={fontSize}
              oninput={handleFontSizeInput}
              class="font-size-input"
            />
            <div class="increment-buttons">
              <button
                class="increment-btn"
                onclick={incrementFontSize}
                aria-label="Increase font size"
              >
                <ChevronUp size={14} />
              </button>
              <button
                class="increment-btn"
                onclick={decrementFontSize}
                aria-label="Decrease font size"
              >
                <ChevronDown size={14} />
              </button>
            </div>
            <button
              class="reset-btn"
              onclick={resetFontSize}
              aria-label="Reset font size to default"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </div>

      <div class="setting-item">
        <label for="font-family">Font family</label>
        <div class="input-with-reset">
          <input
            id="font-family"
            type="text"
            value={fontFamily}
            oninput={handleFontFamilyInput}
            class="font-family-input"
            placeholder='"JetBrains Mono", monospace'
          />
          <button
            class="reset-btn"
            onclick={resetFontFamily}
            aria-label="Reset font family to default"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-row">
          <label class="checkbox-label" for="ligatures">
            <Ligature size={16} />
            <span>Ligatures</span>
          </label>
          <Checkbox
            id="ligatures"
            checked={ligatures}
            onchange={toggleLigatures}
          />
        </div>
      </div>
    </section>
  </div>
</div>

<style>
  .settings-panel {
    width: 100%;
    height: calc(100% - var(--space-3));
    background: var(--bg-file-panel);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 8px;
    margin: 0 0 var(--space-3) 0;
  }

  .panel-header {
    padding: var(--space-4);
    border-bottom: 1px solid var(--border-subtle);
  }

  h3 {
    margin: 0;
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
  }

  .panel-content {
    flex: 1;
    padding: var(--space-4);
    overflow-y: auto;
  }

  .settings-section {
    margin-bottom: var(--space-6);
  }

  h4 {
    margin: 0 0 var(--space-4) 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: +0.01em;
  }

  .setting-item {
    margin-bottom: var(--space-4);
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  label {
    font-size: var(--text-sm);
    color: var(--text-primary);
    font-weight: var(--font-medium);
  }

  .input-with-controls {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .input-with-reset {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  input {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
    font-size: var(--text-xs);
    color: var(--text-primary);
    background: var(--bg-editor);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-lg);
  }

  input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px var(--primary-alpha);
  }

  .font-size-input {
    width: 40px;
    padding: var(--space-2) var(--space-2);
    text-align: right;
  }

  .font-family-input {
    flex: 1;
    min-width: 120px;
    padding: var(--space-2) 5px;
  }

  .increment-buttons {
    display: flex;
    flex-direction: column;
  }

  .increment-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 15px;
    background: var(--bg-editor);
    border: 1px solid var(--border);
    color: var(--color-primary-500);
    cursor: pointer;
    padding: 0;
  }

  .increment-btn:first-child {
    border-radius: 4px 4px 0 0;
    border-bottom: none;
  }

  .increment-btn:last-child {
    border-radius: 0 0 4px 4px;
  }

  .increment-btn:hover {
    background: var(--surface-hover);
  }

  .increment-btn:active {
    background: var(--surface-active);
  }

  .reset-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    background: transparent;
    border: none;
    border-radius: 50px;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 0;
    /* margin-left: -5px; */
    margin-right: -10px;
  }

  .reset-btn:hover {
    color: var(--text-primary);
  }

  .reset-btn:active {
    color: var(--text-active);
    transform: scale(0.9);
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
  }
</style>

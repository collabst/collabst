<script lang="ts">
  interface Props {
    checked: boolean;
    onchange: (checked: boolean) => void;
    ariaLabel: string;
  }

  let { checked, onchange, ariaLabel }: Props = $props();
</script>

<button
  class="toggle"
  class:on={checked}
  role="switch"
  aria-checked={checked}
  aria-label={ariaLabel}
  onclick={() => onchange(!checked)}
>
  <span class="knob"></span>
</button>

<style>
  .toggle {
    display: flex;
    align-items: center;
    width: 2.4rem;
    height: 1.35rem;
    padding: 2px;
    border: 1px solid var(--navbar-border);
    border-radius: 999px;
    background-color: var(--navbar-bg);
    box-shadow: inset 0 -2px 0 0 var(--navbar-shadow);
    cursor: pointer;
  }

  .toggle.on {
    border-color: var(--color-tertiary-500);
    background-color: color-mix(
      in srgb,
      var(--color-tertiary-500) 30%,
      transparent
    );
  }

  .knob {
    width: 1rem;
    height: 1rem;
    border-radius: 999px;
    background-color: var(--text-tertiary);
    transition: transform 0.12s ease-out;
  }

  .toggle.on .knob {
    background-color: var(--color-tertiary-500);
    transform: translateX(1rem);
  }

  .toggle:active {
    box-shadow: inset 0 2px 0 0 var(--navbar-shadow);
  }
</style>

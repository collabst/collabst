<script lang="ts">
  import type { Component } from "svelte";

  interface Props {
    icon: Component;
    onclick?: () => void;
    strokeWidth?: number;
    size?: number;
    width?: string;
    selected?: boolean;
  }

  let {
    icon: Icon,
    onclick,
    strokeWidth = 2,
    size = 24,
    width = "2.6rem",
    selected = false,
  }: Props = $props();
</script>

<button
  class="button"
  class:selected
  {onclick}
  style="--stroke-width: {strokeWidth}; --icon-size: {size}px; --width: {width};"
>
  <Icon />
</button>

<style>
  .button {
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-primary);
    border-radius: 0.8rem;
    box-sizing: border-box;
    width: var(--width);
    height: var(--width);
  }

  .button :global(svg) {
    stroke-width: var(--stroke-width);
    width: var(--icon-size);
    height: var(--icon-size);
  }

  .button:hover :global(svg) {
    animation: iconJumpAnimation 0.2s ease-out;
  }

  .button:hover {
    border: 1px solid #00ac97;
  }

  @keyframes iconJumpAnimation {
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

  @keyframes iconJumpAnimation2 {
    55% {
      transform: translateY(-8px) scaleX(0.8) scaleY(1.1);
    }
    95% {
      transform: translateY(1px) scaleX(1.2) scaleY(0.95);
    }
    100% {
      transform: none;
    }
  }

  @keyframes btnJumpAnimation {
    0% {
      height: var(--width);
      margin-top: 0px;
    }
    10% {
      height: calc(var(--width) + 8px);
      margin-top: -8px;
      box-shadow: inset 0px -8px 0px 0px #03493133;
      transform: scaleY(1.1) scaleX(0.9);
    }
    100% {
      height: calc(var(--width) + 2px);
      margin-top: -2px;
      box-shadow: inset 0px -4px 0px 0px #03493133;
    }
  }

  .button.selected {
    border: 1px solid #00ac97;
    box-shadow: inset 0px -4px 0px 0px #03493133;
    animation: btnJumpAnimation 0.2s ease-out;
    /* transition: box-shadow 0.05s; */
    height: calc(var(--width) + 2px);
    margin-top: -2px;
  }

  .button.selected :global(svg) {
    animation: iconJumpAnimation2 0.2s ease-out;
    transform: translateY(-1px);
  }

  .button:active {
    box-shadow: inset 0px 4px 0px 0px #03493133;
    height: var(--width);
    margin-top: 0px;
  }

  .button:active :global(svg) {
    transform: translateY(3px);
  }
</style>

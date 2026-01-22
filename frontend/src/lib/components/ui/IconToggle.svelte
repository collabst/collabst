<script lang="ts">
    import type { Component } from "svelte";
    import { Tooltip } from "$lib/components/ui";

    interface ToggleOption {
        value: string;
        icon: Component;
        label: string;
    }

    interface Props {
        options: ToggleOption[];
        value: string;
        onchange?: (value: string) => void;
    }

    let { options, value = $bindable(), onchange }: Props = $props();
</script>

<div class="icon-toggle">
    {#each options as option}
        <Tooltip text={option.label} position="top">
            <button
                class="toggle-btn"
                class:active={value === option.value}
                onclick={() => {
                    value = option.value;
                    onchange?.(option.value);
                }}
                aria-label={option.label}
            >
                <option.icon size={18} />
            </button>
        </Tooltip>
    {/each}
</div>

<style>
    .icon-toggle {
        display: flex;
        background: var(--bg-primary);
        border: 2px solid var(--border-primary);
        border-radius: 4px;
        overflow: hidden;
    }

    .toggle-btn {
        background: transparent;
        border: none;
        padding: 0.5rem 0.75rem;
        cursor: pointer;
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        border-right: 1px solid var(--border-primary);
    }

    .toggle-btn:last-child {
        border-right: none;
    }

    .toggle-btn:hover {
        background: var(--surface-hover);
        color: var(--text-primary);
    }

    .toggle-btn.active {
        background: var(--border-primary);
        color: var(--color-primary-500);
    }

    .toggle-btn:active {
        & > :global(svg),
        & > :global(span),
        & > :global(i) {
            transform: scaleY(0.9) scaleX(1.15);
        }
    }
</style>

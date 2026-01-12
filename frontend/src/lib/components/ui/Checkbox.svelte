<script lang="ts">
    import type { Component } from "svelte";
    import Check from "@lucide/svelte/icons/check";

    interface CheckboxProps {
        id?: string;
        checked?: boolean;
        disabled?: boolean;
        onchange?: (checked: boolean) => void;
        icon?: Component;
        size?: number;
        class?: string;
        ariaLabel?: string;
    }

    let {
        id = "",
        checked = false,
        disabled = false,
        onchange,
        icon = Check,
        size = 18,
        class: className = "",
        ariaLabel = "",
    }: CheckboxProps = $props();

    function handleChange(event: Event) {
        const target = event.target as HTMLInputElement;
        if (onchange) {
            onchange(target.checked);
        }
    }
</script>

<div class="checkbox-wrapper {className}">
    <input
        type="checkbox"
        {id}
        {checked}
        {disabled}
        onchange={handleChange}
        class="checkbox-input"
        aria-label={ariaLabel}
    />
    <div class="checkbox-custom" style="width: {size}px; height: {size}px;">
        {#if checked}
            {@const IconComponent = icon}
            <IconComponent size={size * 0.75} strokeWidth={3.0} />
        {/if}
    </div>
</div>

<style>
    .checkbox-wrapper {
        position: relative;
        display: inline-block;
    }

    .checkbox-input {
        position: absolute;
        opacity: 0;
        width: 100%;
        height: 100%;
        cursor: pointer;
    }

    .checkbox-input:disabled {
        cursor: not-allowed;
    }

    .checkbox-custom {
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--bg-editor);
        border: 2px solid var(--border-primary);
        border-radius: 4px;
        color: var(--color-gray-200);
        pointer-events: none;
    }

    .checkbox-input:checked ~ .checkbox-custom {
        background: var(--color-primary-500);
        border-color: var(--color-primary-500);
    }

    .checkbox-input:hover:not(:disabled) ~ .checkbox-custom {
        border-color: var(--color-primary-500);
        transform: scale(1.15);
    }

    .checkbox-input:active:not(:disabled) ~ .checkbox-custom {
        transform: scale(1);
    }

    .checkbox-input:disabled ~ .checkbox-custom {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>

<script lang="ts">
    import ChevronsUpDown from "@lucide/svelte/icons/chevrons-up-down";
    import Check from "@lucide/svelte/icons/check";

    interface DropdownOption {
        value: string;
        label: string;
    }

    interface Props {
        options: DropdownOption[];
        value: string;
        onchange?: (value: string) => void;
    }

    let { options, value = $bindable(), onchange }: Props = $props();
    let isOpen = $state(false);
    let buttonRef = $state<HTMLButtonElement>();

    function toggleDropdown() {
        isOpen = !isOpen;
    }

    function selectOption(optionValue: string) {
        value = optionValue;
        isOpen = false;
        onchange?.(optionValue);
    }

    function handleClickOutside(event: MouseEvent) {
        if (buttonRef && !buttonRef.contains(event.target as Node)) {
            isOpen = false;
        }
    }

    $effect(() => {
        if (isOpen) {
            document.addEventListener("click", handleClickOutside);
            return () =>
                document.removeEventListener("click", handleClickOutside);
        }
    });

    const currentLabel = $derived(
        options.find((opt) => opt.value === value)?.label || "",
    );
</script>

<div class="dropdown-container">
    <button
        bind:this={buttonRef}
        class="dropdown-btn"
        onclick={toggleDropdown}
        aria-expanded={isOpen}
    >
        <span class="label">{currentLabel}</span>
        <ChevronsUpDown size={16} style="color: var(--color-primary-500);" />
    </button>

    {#if isOpen}
        <div class="dropdown-menu">
            {#each options as option}
                <button
                    class="dropdown-item"
                    class:active={option.value === value}
                    onclick={() => selectOption(option.value)}
                >
                    <span class="dropdown-item-text">{option.label}</span>
                    {#if option.value === value}
                        <Check size={16} class="check-icon" />
                    {/if}
                </button>
            {/each}
        </div>
    {/if}
</div>

<style>
    .dropdown-container {
        position: relative;
    }

    .dropdown-btn {
        background: var(--bg-primary);
        border: 2px solid var(--border-primary);
        color: var(--text-primary);
        padding: 0.5rem 0.75rem;
        border-radius: 4px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .dropdown-btn:hover {
        background: var(--surface-hover);
        border-color: var(--border-secondary);
    }

    .dropdown-btn:active {
        color: var(--text-active);
        background: var(--surface-active);       
        transform: scaleX(1.03) scaleY(0.98);
    }

    .label {
        white-space: nowrap;
    }

    .dropdown-menu {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        background: var(--dropdown-bg);
        backdrop-filter: blur(var(--dropdown-blur));
        -webkit-backdrop-filter: blur(var(--dropdown-blur));
        border: 2px solid var(--surface-hover);
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 100;
        min-width: 100%;
        overflow: hidden;
    }

    .dropdown-item {
        width: 100%;
        background: transparent;
        border: none;
        color: var(--text-primary);
        padding: 0.5rem 0.75rem;
        text-align: left;
        cursor: pointer;
        font-size: 14px;
        white-space: nowrap;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
    }

    .dropdown-item-text {
        flex: 1;
    }

    .dropdown-item :global(.check-icon) {
        color: var(--color-primary-500);
        flex-shrink: 0;
    }

    .dropdown-item:hover {
        background: var(--surface-hover);
    }

    .dropdown-item.active {
        background: var(--surface-hover);
        color: var(--color-primary);
    }

    .dropdown-item:active {
        background: var(--surface-active);
    }
</style>

<script lang="ts">
    import { theme } from "$lib/stores/theme";
    import Sun from "@lucide/svelte/icons/sun";
    import Moon from "@lucide/svelte/icons/moon";
    import { browser } from "$app/environment";
    import collabstTextLogo from "../../../assets/collabst-text.svg";

    let currentTheme = $state($theme);

    $effect(() => {
        currentTheme = $theme;
    });

    function toggleTheme() {
        theme.toggle();
    }

    // Calculate number of circles based on viewport size
    let circles = $state<Array<{ delay: number; row: number }>>([]);

    function calculateCircles() {
        if (!browser) return [];

        const circleSize = 50; // Increased from 30 to reduce total circles
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Only calculate visible circles, no extra padding
        const cols = Math.ceil(viewportWidth / circleSize);
        const rows = Math.ceil(viewportHeight / circleSize);

        const result = [];
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                result.push({
                    delay: row * 100, // Same delay for all circles in the same row
                    row: row,
                });
            }
        }

        return result;
    }

    $effect(() => {
        if (browser) {
            circles = calculateCircles();

            let resizeTimer: number;
            const handleResize = () => {
                // Debounce resize to avoid excessive recalculations
                clearTimeout(resizeTimer);
                resizeTimer = window.setTimeout(() => {
                    circles = calculateCircles();
                }, 150);
            };

            window.addEventListener("resize", handleResize);

            return () => {
                window.removeEventListener("resize", handleResize);
                clearTimeout(resizeTimer);
            };
        }
    });
</script>

<div class="container" data-theme={currentTheme}>
    <!-- Animated circles background -->
    <div class="circles">
        {#each circles as circle}
            <div
                class="circle"
                style="animation-delay: {circle.delay}ms;"
            ></div>
        {/each}
    </div>

    <!-- Collabst logo in bottom center -->
    <div class="logo-container">
        <img src={collabstTextLogo} alt="collabst" />
    </div>

    <!-- Theme toggle button -->
    <button class="theme-toggle" onclick={toggleTheme} type="button">
        {#if currentTheme === "dark"}
            <Sun size={20} />
        {:else}
            <Moon size={20} />
        {/if}
    </button>

    <div class="card">
        <slot />
    </div>
</div>

<style>
    .container {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
    }

    .container[data-theme="light"] {
        /* Collabst diagonal gradient for light theme */
        background: linear-gradient(
            135deg,
            #5fd6b5 0%,
            #57afd1 75%,
            #35b6cc 100%
        );
    }

    .container[data-theme="dark"] {
        /* Darker gradient for dark theme */
        background: linear-gradient(
            135deg,
            #2d8b73 0%,
            #2e6a84 75%,
            #1e7080 100%
        );
    }

    /* Animated circles background */
    .circles {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: grid;
        grid-template-columns: repeat(auto-fill, 50px);
        grid-auto-rows: 50px;
        gap: 10px;
        padding: 3px;
        rotate: 1deg;
        pointer-events: none;
        z-index: 0;
        justify-content: space-evenly;
        align-content: space-evenly;
        contain: layout style paint; /* Performance hint for browser */
    }

    .circle {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        animation: spin 9s linear infinite;
        justify-self: center;
        align-self: center;
        will-change: transform; /* GPU acceleration hint */
        backface-visibility: hidden; /* Prevent flickering */
        transform: translateZ(0); /* Force GPU rendering */
    }

    .container[data-theme="light"] .circle {
        background: rgba(189, 255, 234, 0.16);
    }

    .container[data-theme="dark"] .circle {
        background: rgba(8, 77, 66, 0.16);
    }

    @keyframes spin {
        0% {
            transform: rotate(0) scale(1);
            transform-origin: left center;
        }
        25% {
            transform: rotate(90deg) scale(2);
            transform-origin: right center;
        }
        50% {
            transform: rotate(180deg) scale(1);
            transform-origin: left center;
        }
        75% {
            transform: rotate(270deg) scale(0.5);
            transform-origin: right center;
        }
    }

    /* Collabst logo */
    .logo-container {
        position: absolute;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 5;
        pointer-events: none;
        width: 200px;
        height: auto;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .logo-container img {
        width: 100%;
        height: auto;
    }

    .container[data-theme="light"] .logo-container img {
        filter: brightness(0) invert(1);
        opacity: 0.8;
    }

    .container[data-theme="dark"] .logo-container img {
        filter: brightness(0.11);
        opacity: 0.85;
    }

    /* Theme toggle button */
    .theme-toggle {
        position: absolute;
        top: 1.5rem;
        right: 1.5rem;
        z-index: 100;
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 8px;
        padding: 0.75rem;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
    }

    .container[data-theme="dark"] .theme-toggle {
        background: rgba(30, 30, 30, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .theme-toggle:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.05);
    }

    .container[data-theme="dark"] .theme-toggle:hover {
        background: rgba(30, 30, 30, 0.6);
    }

    .card {
        position: relative;
        z-index: 10;
        padding: 2rem;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
        width: 100%;
        max-width: 400px;
        transition: all 0.3s ease;
        backdrop-filter: blur(10px);
    }

    .container[data-theme="light"] .card {
        background: rgba(255, 255, 255, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.4);
        color: #333;
    }

    .container[data-theme="dark"] .card {
        background: rgba(30, 30, 30, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #e0e0e0;
    }

    /* Global form styles that apply to slotted content */
    .card :global(h1) {
        font-size: 22px;
        font-weight: bold;
        margin-bottom: 0.4rem;
        text-align: center;
    }

    .container[data-theme="light"] .card :global(h1) {
        color: #666;
    }

    .container[data-theme="dark"] .card :global(h1) {
        color: #aaa;
    }

    .card :global(h2) {
        font-size: 34px;
        margin-bottom: 2.8rem;
        text-align: center;
    }

    .container[data-theme="light"] .card :global(h2) {
        color: #333;
    }

    .container[data-theme="dark"] .card :global(h2) {
        color: #e0e0e0;
    }

    .card :global(.error) {
        padding: 0.75rem;
        border-radius: 6px;
        margin-bottom: 1rem;
    }

    .container[data-theme="light"] .card :global(.error) {
        background: #fee;
        color: #c33;
    }

    .container[data-theme="dark"] .card :global(.error) {
        background: rgba(200, 50, 50, 0.2);
        color: #ff6b6b;
        border: 1px solid rgba(200, 50, 50, 0.3);
    }

    .card :global(form) {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .card :global(.field) {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .card :global(label) {
        font-size: 16px;
        font-weight: 600;
    }

    .container[data-theme="light"] .card :global(label) {
        color: #333;
    }

    .container[data-theme="dark"] .card :global(label) {
        color: #e0e0e0;
    }

    .card :global(input) {
        padding: 0.75rem;
        border: 2px solid;
        border-radius: 6px;
        font-size: 14px;
        transition: all 0.2s ease;
    }

    .container[data-theme="light"] .card :global(input) {
        background: white;
        border-color: #e5e7eb;
        color: #333;
    }

    .container[data-theme="dark"] .card :global(input) {
        background: #061d1f;
        border-color: #3f524c;
        color: #e0e0e0;
    }

    .card :global(input:focus) {
        outline: none;
    }

    .container[data-theme="light"] .card :global(input:focus) {
        border-color: #5fd6b5;
    }

    .container[data-theme="dark"] .card :global(input:focus) {
        border-color: #57afd1;
    }

    .card :global(button[type="submit"]) {
        border: none;
        padding: 0.75rem;
        border-radius: 6px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 1rem;
        transition: all 0.2s ease;
    }

    .container[data-theme="light"] .card :global(button[type="submit"]) {
        color: white;
        background: #5fd6b5;
    }

    .container[data-theme="light"]
        .card
        :global(button[type="submit"]:hover:not(:disabled)) {
        background: #23cd9d;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(36, 196, 151, 0.5);
    }

    .container[data-theme="dark"] .card :global(button[type="submit"]) {
        color: black;
        background: #45ae92;
    }

    .container[data-theme="dark"]
        .card
        :global(button[type="submit"]:hover:not(:disabled)) {
        background: #40c39e;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(13, 161, 121, 0.5);
    }

    .card :global(button[type="submit"]:disabled) {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .card :global(.footer) {
        margin-top: 1.5rem;
        text-align: center;
        font-size: 16px;
    }

    .container[data-theme="light"] .card :global(.footer) {
        color: #666;
    }

    .container[data-theme="dark"] .card :global(.footer) {
        color: #aaa;
    }

    .card :global(.footer a) {
        color: #56ceac;
        text-decoration: none;
        font-weight: 600;
        transition: all 0.2s ease;
    }

    .card :global(.footer a:hover) {
        text-decoration: underline;
        color: #57afd1;
    }
</style>

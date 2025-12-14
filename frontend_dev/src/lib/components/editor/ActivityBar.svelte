<script lang="ts">
  import { Tooltip } from '$lib/components/ui'
  import Archive from '@lucide/svelte/icons/archive'
  import Search from '@lucide/svelte/icons/search'
  import Map from '@lucide/svelte/icons/map'
  import CircleAlert from '@lucide/svelte/icons/circle-alert'
  import MessageCircleMore from '@lucide/svelte/icons/message-square-more'
  import CircleHelp from '@lucide/svelte/icons/circle-help'
  import Rocket from '@lucide/svelte/icons/rocket'
  import Settings from '@lucide/svelte/icons/settings'
  import collabstLogo from '../../../assets/collabst-text-vertical.svg'

  export let activePanel: string | null = 'files'
  export let onActivityClick: (activity: string) => void

  type Activity = {
    id: string
    icon: any
    label: string
    href?: string
  }

  const topActivities: Activity[] = [
    { id: 'files', icon: Archive, label: 'Files' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'outline', icon: Map, label: 'Outline' },
    { id: 'issues', icon: CircleAlert, label: 'Issues and Suggestions' },
    { id: 'comments', icon: MessageCircleMore, label: 'Comments' }
  ]

  const bottomActivities: Activity[] = [
    { id: 'settings', icon: Settings, label: 'Settings' },
    { id: 'universe', icon: Rocket, label: 'Typst Universe', href: 'https://typst.app/universe' },
    { id: 'help', icon: CircleHelp, label: 'Help', href: 'https://typst.app/docs' }
  ]

  function handleClick(activity: Activity) {
    if (activity.href) {
      window.open(activity.href, '_blank')
    } else {
      onActivityClick(activity.id)
    }
  }
</script>

<div class="activity-bar">
  <div class="top-activities">
    {#each topActivities as activity (activity.id)}
      <Tooltip text={activity.label} position="right">
        <button
          class="activity-btn"
          class:active={activePanel === activity.id}
          on:click={() => handleClick(activity)}
          aria-label={activity.label}
        >
          <svelte:component this={activity.icon} size={24} />
        </button>
      </Tooltip>
    {/each}
  </div>
  
  <div class="bottom-activities">
    {#each bottomActivities as activity (activity.id)}
      <Tooltip text={activity.label} position="right">
        {#if activity.href}
          <a
            class="activity-btn"
            href={activity.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={activity.label}
          >
            <svelte:component this={activity.icon} size={24} />
          </a>
        {:else}
          <button
            class="activity-btn"
            class:active={activePanel === activity.id}
            on:click={() => handleClick(activity)}
            aria-label={activity.label}
          >
            <svelte:component this={activity.icon} size={24} />
          </button>
        {/if}
      </Tooltip>
    {/each}
    
    <div class="logo-container">
      <img src={collabstLogo} alt="collabst" class="collabst-logo" />
    </div>
  </div>
</div>

<style>
  .activity-bar {
    width: 56px;
    background: var(--bg-top-bar);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 0 0 var(--space-3) 0;
  }

  .top-activities {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .bottom-activities {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .activity-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s;
    text-decoration: none;
  }

  .activity-btn:hover {
    color: var(--text-primary);
    background: var(--surface-hover);
  }

  .activity-btn.active {
    color: var(--text-primary);
    background: var(--surface-hover);
  }

  .logo-container {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: var(--space-4);
    padding-bottom: var(--space-4);
  }

  .collabst-logo {
    width: auto;
    height: 110px;
    filter: brightness(0) saturate(100%) invert(60%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(95%) contrast(90%);
    pointer-events: none;
    user-select: none;
  }

  :global([data-theme="light"]) .collabst-logo {
    filter: brightness(0) saturate(100%) invert(40%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(90%) contrast(85%);
  }
</style>

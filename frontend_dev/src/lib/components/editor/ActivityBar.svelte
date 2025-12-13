<script lang="ts">
  import { Tooltip } from '$lib/components/ui'
  import Archive from '@lucide/svelte/icons/archive'
  import Search from '@lucide/svelte/icons/search'
  import Map from '@lucide/svelte/icons/map'
  import CircleAlert from '@lucide/svelte/icons/circle-alert'
  import MessageCircleMore from '@lucide/svelte/icons/message-circle-more'
  import CircleHelp from '@lucide/svelte/icons/circle-help'
  import Rocket from '@lucide/svelte/icons/rocket'
  import Settings from '@lucide/svelte/icons/settings'

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
      <Tooltip text={activity.label} position="right" delay={600}>
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
      <Tooltip text={activity.label} position="right" delay={600}>
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
</div>

<style>
  .activity-bar {
    width: 48px;
    background: var(--bg-top-bar);
    border-right: 1px solid var(--border-primary);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: var(--space-3) 0;
  }

  .top-activities,
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
  }

  .activity-btn:hover {
    color: var(--text-primary);
    background: var(--surface-hover);
  }

  .activity-btn.active {
    color: var(--text-primary);
    background: var(--surface-hover);
  }
</style>

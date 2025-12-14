<script lang="ts">
  import { theme } from '$lib/stores/theme'
  import { IconButton, Tooltip } from '$lib/components/ui'
  import Sun from '@lucide/svelte/icons/sun'
  import Moon from '@lucide/svelte/icons/moon'
  
  let currentTheme = $state($theme)
  
  $effect(() => {
    currentTheme = $theme
  })
  
  function toggle() {
    theme.toggle()
  }
</script>

<Tooltip text={currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} position="bottom">
  <IconButton 
    icon={currentTheme === 'dark' ? Sun : Moon}
    variant="ghost"
    size="md"
    onclick={toggle}
  />
</Tooltip>

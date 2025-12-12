<script lang="ts">
  import { theme } from '$lib/stores/theme'
  import { IconButton } from '$lib/components/ui'
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

<IconButton 
  icon={currentTheme === 'dark' ? Sun : Moon}
  variant="ghost"
  size="md"
  title={currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
  onclick={toggle}
/>

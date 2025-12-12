<script lang="ts">
  import type { ComponentType } from 'svelte'
  
  interface IconProps {
    icon: ComponentType
    size?: number | string
    color?: string
    strokeWidth?: number
    class?: string
  }
  
  let {
    icon,
    size = 24,
    color = 'currentColor',
    strokeWidth = 2,
    class: className = '',
    ...restProps
  }: IconProps = $props()
</script>

<svelte:component 
  this={icon} 
  {size}
  {color}
  {strokeWidth}
  class={className}
  {...restProps}
/>

<style>
  :global(.icon) {
    display: inline-block;
    vertical-align: middle;
  }
</style>

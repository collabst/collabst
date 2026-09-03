<script lang="ts">
  import Header from './Header.svelte';
  import Content from './Content.svelte';
</script>

<div class="comments">
  <Header />
  <Content />
</div>

<style>
  .comments {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
</style>

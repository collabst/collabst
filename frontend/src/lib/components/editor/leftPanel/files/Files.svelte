<script lang="ts">
  import Header from "./Header.svelte";
  import Content from "./Content.svelte";
</script>

<div class="files">
  <Header />
  <Content />
</div>

<style>
  .files {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
</style>

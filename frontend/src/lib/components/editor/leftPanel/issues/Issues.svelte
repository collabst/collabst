<script lang="ts">
  import Content from "./Content.svelte";
  import Header from "./Header.svelte";
</script>

<div class="issues">
  <Header />
  <Content />
</div>

<style>
  .issues {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
</style>

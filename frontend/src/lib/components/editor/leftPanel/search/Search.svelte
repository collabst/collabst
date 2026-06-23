<script lang="ts">
  import Content from "./Content.svelte";
  import Header from "./Header.svelte";
</script>

<div class="search">
  <Header />
  <Content />
</div>

<style>
  .search {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  }
</style>
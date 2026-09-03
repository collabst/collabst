<script lang="ts">
  import Content from "./Content.svelte";
  import Header from "./Header.svelte";
</script>

<div class="outline">
  <Header />
  <Content />
</div>

<style>
  .outline {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
</style>

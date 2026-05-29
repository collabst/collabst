<script lang="ts">
  import { File, Map, MessageSquareText, Search, TriangleAlert } from "@lucide/svelte";
  import Button from "./Button.svelte";

</script>

<div class="container">
  <div class="nav-bar">
    <Button icon={File} selected={true} />
    <Button icon={Search} />
    <Button icon={Map} />
    <Button icon={TriangleAlert} />
    <Button icon={MessageSquareText} />
  </div>
</div>

<style>
  .container {
    position: absolute;
    bottom: 0;
    left: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    margin: 1rem 0;
  }

  .nav-bar {
    display: flex;
    gap: 1rem;
    background-color: #f6fbfb;
    border: 1px solid #00ac97;
    border-radius: 1rem;
    padding: 0.5rem 1rem;
  }
</style>

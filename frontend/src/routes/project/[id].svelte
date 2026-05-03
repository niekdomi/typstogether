<script lang="ts">
  import { route } from "sv-router/generated";

  const id = $derived(route.params.id);
</script>

<main>
  <h1>Project {id}</h1>
</main>

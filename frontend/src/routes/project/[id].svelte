<script lang="ts">
  import { routes } from "sv-router/generated";

  const id = $derived(routes.params.id);
</script>

<main>
  <h1>Project {id}</h1>
</main>

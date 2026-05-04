import { useParams } from "@solidjs/router";

export default function Project() {
  const params = useParams<{ id: string }>();
  return (
    <main>
      <h1>Project {params.id}</h1>
    </main>
  );
}

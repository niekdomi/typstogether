/** A small inline loading spinner (CSS-only, no icon dependency). */
export function Spinner(props: { class?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      class={`border-muted-foreground/30 border-t-muted-foreground inline-block size-4 animate-spin rounded-full border-2 ${props.class ?? ""}`}
    />
  );
}

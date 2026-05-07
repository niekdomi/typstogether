interface LogoProps {
  size?: number;
}

export default function Logo(props: LogoProps) {
  return (
    <span
      class="inline-flex items-baseline font-medium tracking-[-0.02em]"
      style={{ "font-size": `${String(props.size ?? 22)}px` }}
    >
      Typs<span class="text-brand">together</span>
    </span>
  );
}

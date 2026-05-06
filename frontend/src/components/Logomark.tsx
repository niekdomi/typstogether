import "./Logomark.css";

interface LogomarkProps {
  size?: number;
}

export default function Logomark(props: LogomarkProps) {
  return (
    <span class="logomark" style={{ "font-size": `${String(props.size ?? 22)}px` }}>
      <span class="t1">T</span>
      <span>ypst</span>
      <span class="dot">·</span>
      <span>together</span>
    </span>
  );
}

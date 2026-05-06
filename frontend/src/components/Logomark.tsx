import "./Logomark.css";

interface LogomarkProps {
  size?: number;
}

export default function Logomark(props: LogomarkProps) {
  return (
    <span class="logomark" style={{ "font-size": `${String(props.size ?? 22)}px` }}>
      Typs<span class="together">together</span>
    </span>
  );
}

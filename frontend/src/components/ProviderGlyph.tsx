import { Match, Switch } from "solid-js";

type ProviderName = "github" | "gitlab" | "google";

interface ProviderGlyphProps {
  name: ProviderName;
}

export default function ProviderGlyph(props: ProviderGlyphProps) {
  const baseStyle = { width: "18px", height: "18px", "flex-shrink": 0 } as const;

  return (
    <Switch>
      <Match when={props.name === "github"}>
        <svg viewBox="0 0 16 16" style={{ ...baseStyle, fill: "currentColor" }}>
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
        </svg>
      </Match>
      <Match when={props.name === "gitlab"}>
        <svg viewBox="0 0 16 16" style={{ ...baseStyle, fill: "none" }}>
          <path d="m8 14.5 2.95-9.07h-5.9L8 14.5Z" fill="#E24329" />
          <path d="M8 14.5 5.05 5.43H.92L8 14.5Z" fill="#FC6D26" />
          <path d="M.92 5.43.02 8.2a.61.61 0 0 0 .22.69L8 14.5.92 5.43Z" fill="#FCA326" />
          <path d="M.92 5.43h4.13L3.27 0a.31.31 0 0 0-.59 0L.92 5.43Z" fill="#E24329" />
          <path d="M8 14.5 10.95 5.43h4.13L8 14.5Z" fill="#FC6D26" />
          <path d="m15.08 5.43.9 2.77a.61.61 0 0 1-.22.69L8 14.5l7.08-9.07Z" fill="#FCA326" />
          <path d="M15.08 5.43h-4.13L13.32 0a.31.31 0 0 1 .59 0l1.17 5.43Z" fill="#E24329" />
        </svg>
      </Match>
      <Match when={props.name === "google"}>
        <svg viewBox="0 0 16 16" style={{ ...baseStyle, fill: "none" }}>
          <path
            d="M15.68 8.18c0-.57-.05-1.11-.14-1.64H8v3.1h4.31a3.69 3.69 0 0 1-1.6 2.42v2.01h2.59c1.51-1.4 2.38-3.46 2.38-5.89Z"
            fill="#4285F4"
          />
          <path
            d="M8 16c2.16 0 3.97-.72 5.3-1.94l-2.59-2A4.79 4.79 0 0 1 8 12.71a4.79 4.79 0 0 1-4.5-3.31H.82v2.07A8 8 0 0 0 8 16Z"
            fill="#34A853"
          />
          <path
            d="M3.5 9.4a4.79 4.79 0 0 1 0-3.05V4.27H.82a8 8 0 0 0 0 7.18L3.5 9.4Z"
            fill="#FBBC04"
          />
          <path
            d="M8 3.18c1.18 0 2.24.41 3.07 1.2l2.3-2.3A8 8 0 0 0 .81 4.28L3.5 6.35A4.79 4.79 0 0 1 8 3.18Z"
            fill="#EA4335"
          />
        </svg>
      </Match>
    </Switch>
  );
}

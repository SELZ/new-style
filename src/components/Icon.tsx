import type { CSSProperties } from "react";

export type IconName =
  | "search"
  | "bag"
  | "heart"
  | "arrow"
  | "arrow-up-right"
  | "chevron"
  | "close"
  | "grid"
  | "headphones"
  | "home"
  | "watch"
  | "shirt"
  | "sliders"
  | "check"
  | "plus"
  | "minus"
  | "star"
  | "truck"
  | "shield"
  | "return"
  | "sparkles";

const paths: Record<IconName, React.ReactNode> = {
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  bag: (
    <>
      <path d="M5 7.5h14l1 13H4l1-13Z" />
      <path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2" />
    </>
  ),
  heart: (
    <path d="M20.1 5.1a5.1 5.1 0 0 0-7.2 0l-.9.9-.9-.9a5.1 5.1 0 0 0-7.2 7.2L12 21l8.1-8.7a5.1 5.1 0 0 0 0-7.2Z" />
  ),
  arrow: (
    <>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </>
  ),
  "arrow-up-right": <path d="M6 18 18 6M6 6h12v12" />,
  chevron: <path d="m8 5 7 7-7 7" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  grid: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </>
  ),
  headphones: (
    <>
      <path d="M4 14v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="12" width="5" height="9" rx="2" />
      <rect x="16" y="12" width="5" height="9" rx="2" />
    </>
  ),
  home: (
    <>
      <path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8" />
    </>
  ),
  watch: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="4" />
      <path d="m9 6 1-4h4l1 4M9 18l1 4h4l1-4M12 9v3l2 1" />
    </>
  ),
  shirt: <path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4a4 4 0 0 1-8 0Z" />,
  sliders: (
    <>
      <path d="M4 7h9m4 0h3M4 17h3m4 0h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  plus: <path d="M5 12h14M12 5v14" />,
  minus: <path d="M5 12h14" />,
  star: (
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
  ),
  truck: (
    <>
      <path d="M3 5h11v12H3V5Zm11 5h4l3 4v3h-7" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  return: (
    <>
      <path d="M4 10h10a6 6 0 0 1 0 12M8 5l-5 5 5 5" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />
      <path d="M20 2v4M18 4h4" />
    </>
  ),
};

export default function Icon({
  name,
  size = 20,
  className = "",
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {paths[name]}
    </svg>
  );
}

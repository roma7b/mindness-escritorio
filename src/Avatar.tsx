import type { BotShape } from "../shared/office";

type AvatarProps = {
  id: string;
  color: string;
  accent: string;
  shape?: BotShape;
  gradient?: boolean;
  avatar?: string;
  size?: number;
};

function Eyes({ y = 46 }: { y?: number }) {
  return (
    <>
      <ellipse cx="38" cy={y} rx="8" ry="5.5" fill="#fffaf6" />
      <ellipse cx="62" cy={y} rx="8" ry="5.5" fill="#fffaf6" />
    </>
  );
}

export function Avatar({ id, color, accent, shape = "round", gradient, avatar, size = 28 }: AvatarProps) {
  if (avatar) {
    return <img className="avatar" src={avatar} alt="" width={size} height={size} />;
  }
  const fill = gradient ? `url(#grad-${id})` : color;
  const gradientDef = gradient ? (
    <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor={color} />
      <stop offset="1" stopColor={accent} />
    </linearGradient>
  ) : null;
  if (shape === "helmet") {
    return (
      <svg className="avatar" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="50" fill="#101014" />
        <ellipse cx="50" cy="34" rx="34" ry="7" fill="#1c1c22" />
        <rect x="28" y="12" width="44" height="22" rx="4" fill="#18181c" />
        <rect x="28" y="28" width="44" height="5" fill="#8b1530" />
        <circle cx="50" cy="58" r="26" fill="#141418" />
        <rect x="28" y="52" width="44" height="12" rx="6" fill="#0c0c10" />
        <ellipse cx="40" cy="58" rx="6" ry="3.4" fill="#ff2a2a" />
        <ellipse cx="60" cy="58" rx="6" ry="3.4" fill="#ff2a2a" />
      </svg>
    );
  }
  if (shape === "square") {
    return (
      <svg className="avatar" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
        {gradientDef}
        <rect x="6" y="6" width="88" height="88" rx="28" fill={fill} />
        <Eyes />
      </svg>
    );
  }
  if (shape === "drop") {
    return (
      <svg className="avatar" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
        {gradientDef}
        <path d="M50 4C74 28 96 52 90 74C84 96 16 96 10 74C4 52 26 28 50 4Z" fill={fill} />
        <Eyes y={58} />
      </svg>
    );
  }
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {gradientDef}
      <circle cx="50" cy="50" r="46" fill={fill} />
      <Eyes />
    </svg>
  );
}

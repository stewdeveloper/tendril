import type { Severity } from '@tendril/core';
import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * The design's hand-drawn glyphs (Lucide geometry, copied path for path from the frames). Generic
 * icons (X, Info, Phone and so on) come from lucide-react-native. Import each from
 * `lucide-react-native/icons/<name>`: the package root pulls in all 1,500 icons, which slows both
 * the dev bundle and every jest suite that loads it.
 */
export interface IconProps {
  size?: number;
  color: string;
  strokeWidth?: number;
}

interface BaseProps extends IconProps {
  width?: number;
  height?: number;
  viewBox?: string;
  children: ReactNode;
}

/** 24-grid stroke icon. Decorative: the control that wraps it carries the accessible name. */
function Glyph({
  size = 24,
  color,
  strokeWidth = 2,
  width = size,
  height = size,
  viewBox = '0 0 24 24',
  children,
}: BaseProps) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox={viewBox}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      {children}
    </Svg>
  );
}

/** Streak flame (4b, 4g). */
export function FlameIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Glyph>
  );
}

/** Rarity leaf (4ab). The rarity badges draw it at 14 pt with a heavier 2.4 stroke. */
export function LeafIcon({ strokeWidth = 2.4, ...props }: IconProps) {
  return (
    <Glyph strokeWidth={strokeWidth} {...props}>
      <Path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <Path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </Glyph>
  );
}

/** Legendary rarity flower (4al). */
export function FlowerIcon({ strokeWidth = 2.4, ...props }: IconProps) {
  return (
    <Glyph strokeWidth={strokeWidth} {...props}>
      <Circle cx={12} cy={12} r={3} />
      <Path d="M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5" />
    </Glyph>
  );
}

/** The streak calendar's freeze glyph (4g). */
export function FreezeIcon({ strokeWidth = 2.4, ...props }: IconProps) {
  return (
    <Glyph strokeWidth={strokeWidth} {...props}>
      <Path d="M2 12h20" />
      <Path d="M12 2v20" />
      <Path d="m20 16-4-4 4-4" />
      <Path d="m4 8 4 4-4 4" />
      <Path d="m16 4-4 4-4-4" />
      <Path d="m8 20 4-4 4 4" />
    </Glyph>
  );
}

/**
 * Verdict chip glyph. The shape carries the severity as well as the colour: question circle
 * (unknown), check circle (none), triangle (mild), diamond (moderate), octagon (severe).
 */
export function VerdictIcon({ severity, ...props }: IconProps & { severity: Severity }) {
  switch (severity) {
    case 'unknown':
      return (
        <Glyph {...props}>
          <Circle cx={12} cy={12} r={10} />
          <Path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <Path d="M12 17h.01" />
        </Glyph>
      );
    case 'none':
      return (
        <Glyph {...props}>
          <Circle cx={12} cy={12} r={10} />
          <Path d="m9 12 2 2 4-4" />
        </Glyph>
      );
    case 'mild':
      return (
        <Glyph {...props}>
          <Path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
          <Path d="M12 9v4" />
          <Path d="M12 17h.01" />
        </Glyph>
      );
    case 'moderate':
      return (
        <Glyph {...props}>
          <Path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0z" />
          <Path d="M12 8v4" />
          <Path d="M12 16h.01" />
        </Glyph>
      );
    case 'severe':
      return (
        <Glyph {...props}>
          <Path d="M12 16h.01" />
          <Path d="M12 8v4" />
          <Path d="M15.31 2a2 2 0 0 1 1.42.59l4.68 4.68A2 2 0 0 1 22 8.69v6.62a2 2 0 0 1-.59 1.42l-4.68 4.68a2 2 0 0 1-1.42.59H8.69a2 2 0 0 1-1.42-.59l-4.68-4.68A2 2 0 0 1 2 15.31V8.69a2 2 0 0 1 .59-1.42l4.68-4.68A2 2 0 0 1 8.69 2z" />
        </Glyph>
      );
  }
}

/** The empty-state line drawing (4a). `size` is its width; it keeps the 132x110 proportions. */
export function TendrilDrawing({ size = 132, color, strokeWidth = 3 }: IconProps) {
  return (
    <Glyph
      color={color}
      strokeWidth={strokeWidth}
      viewBox="0 0 132 110"
      width={size}
      height={(size * 110) / 132}
    >
      <Path d="M12 104c14-34 36-46 58-46s30-16 24-32-28-14-28 4 16 20 30 10" />
      <Path d="M64 58c-4-16 4-28 18-34" />
      <Path d="M38 80c-8-4-12-12-10-20" />
    </Glyph>
  );
}

/* Tab bar icons (4b). */

export function CalendarIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Rect x={3} y={4} width={18} height={18} rx={2} />
      <Path d="M16 2v4" />
      <Path d="M8 2v4" />
      <Path d="M3 10h18" />
    </Glyph>
  );
}

export function PlantsIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M7 20h10" />
      <Path d="M10 20c5.5-2.5.8-6.4 3-10" />
      <Path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
      <Path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
    </Glyph>
  );
}

export function ScanCameraIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <Circle cx={12} cy={13} r={3} />
    </Glyph>
  );
}

export function CollectionIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Rect x={3} y={3} width={7} height={7} rx={1} />
      <Rect x={14} y={3} width={7} height={7} rx={1} />
      <Rect x={14} y={14} width={7} height={7} rx={1} />
      <Rect x={3} y={14} width={7} height={7} rx={1} />
    </Glyph>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <Path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <Path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <Path d="M4 22h16" />
      <Path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <Path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <Path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </Glyph>
  );
}

import { render, screen } from '@testing-library/react-native';
import type { ComponentType } from 'react';
import type { Severity } from '@tendril/core';
import {
  CalendarIcon,
  CollectionIcon,
  FlameIcon,
  FlowerIcon,
  FreezeIcon,
  LeafIcon,
  PlantsIcon,
  ScanCameraIcon,
  TendrilDrawing,
  TrophyIcon,
  VerdictIcon,
  type IconProps,
} from './icons';

interface Node {
  type: string;
  props: Record<string, unknown>;
  children?: (Node | string)[] | null;
}

const SHAPES = new Set(['RNSVGPath', 'RNSVGCircle', 'RNSVGRect']);

function shapes(node: Node, out: Node[] = []): Node[] {
  if (SHAPES.has(node.type)) out.push(node);
  for (const child of node.children ?? []) if (typeof child !== 'string') shapes(child, out);
  return out;
}

/** Renders one glyph and reads back the svg it drew. */
async function draw(ui: React.ReactElement) {
  await render(ui);
  const svg = screen.toJSON() as unknown as Node;
  return { svg, shapes: shapes(svg) };
}

describe('icons', () => {
  const glyphs: [string, ComponentType<IconProps>, number][] = [
    ['FlameIcon', FlameIcon, 1],
    ['LeafIcon', LeafIcon, 2],
    ['FlowerIcon', FlowerIcon, 2],
    ['FreezeIcon', FreezeIcon, 6],
    ['CalendarIcon', CalendarIcon, 4],
    ['PlantsIcon', PlantsIcon, 4],
    ['ScanCameraIcon', ScanCameraIcon, 2],
    ['CollectionIcon', CollectionIcon, 4],
    ['TrophyIcon', TrophyIcon, 6],
  ];

  it.each(glyphs)(
    '%s draws its shapes at the requested size, colour and weight',
    async (_n, Icon, count) => {
      const { svg, shapes: drawn } = await draw(
        <Icon size={18} color="#2E6B4E" strokeWidth={1.5} />,
      );
      expect(drawn).toHaveLength(count);
      expect(svg.props).toMatchObject({
        width: 18,
        height: 18,
        stroke: '#2E6B4E',
        strokeWidth: 1.5,
      });
    },
  );

  it('draws 24 pt glyphs at stroke 2 by default, and rarity glyphs heavier', async () => {
    expect((await draw(<CalendarIcon color="#000000" />)).svg.props).toMatchObject({
      width: 24,
      height: 24,
      strokeWidth: 2,
    });
    expect((await draw(<LeafIcon color="#000000" />)).svg.props).toMatchObject({
      strokeWidth: 2.4,
    });
    expect((await draw(<FlowerIcon color="#000000" />)).svg.props).toMatchObject({
      strokeWidth: 2.4,
    });
  });

  it('TendrilDrawing keeps the 132x110 proportions and its 3 strokes', async () => {
    const { svg, shapes: drawn } = await draw(<TendrilDrawing color="#2E6B4E" />);
    expect(drawn).toHaveLength(3);
    expect(svg.props).toMatchObject({
      width: 132,
      height: 110,
      strokeWidth: 3,
      vbWidth: 132,
      vbHeight: 110,
    });
    expect((await draw(<TendrilDrawing color="#2E6B4E" size={66} />)).svg.props).toMatchObject({
      width: 66,
      height: 55,
    });
  });

  it('VerdictIcon draws a different shape for every severity', async () => {
    const severities: Severity[] = ['unknown', 'none', 'mild', 'moderate', 'severe'];
    const outlines = new Set<string>();
    for (const severity of severities) {
      const { shapes: drawn } = await draw(
        <VerdictIcon severity={severity} color="#FFFFFF" size={18} />,
      );
      expect(drawn.length).toBeGreaterThanOrEqual(2);
      outlines.add(JSON.stringify(drawn.map((d) => [d.type, d.props.d ?? d.props.r])));
    }
    expect(outlines.size).toBe(5);
  });

  it('hides glyphs from assistive tech (the control that holds them is the label)', async () => {
    const { svg } = await draw(<FlameIcon color="#A36100" />);
    expect(svg.props).toMatchObject({
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
  });
});

import Svg, { Path } from 'react-native-svg';

import { iconShapes, type IconName } from './icon-paths';

export type { IconName } from './icon-paths';

type IconProps = {
  name: IconName;
  size?: number;
  color: string;
  /** The soft background shape; off for tiny inline icons where it reads as smudge. */
  duotone?: boolean;
};

/** A Phosphor-style duotone icon (or one of ours drawn to match), in any color. */
export function Icon({ name, size = 24, color, duotone = true }: IconProps) {
  const { duo, solid, stroke } = iconShapes(name);

  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" accessible={false}>
      {duotone && duo.map((d) => <Path key={d} d={d} fill={color} opacity={0.2} />)}
      {solid.map((d) => (
        <Path key={d} d={d} fill={color} />
      ))}
      {stroke.map((d) => (
        <Path
          key={d}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={16}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

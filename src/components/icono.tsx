import type { ReactNode } from 'react';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

/**
 * Iconos propios de Playeo. Todos comparten rejilla de 24 pt, trazo de 1,75 pt y
 * extremos redondeados, para que viento, mar, UV, calima y servicios se lean como
 * una sola familia. Los de interfaz (flechas, cerrar) son Feather, del mismo trazo.
 */
const TRAZOS = {
  viento: (
    <Path d="M9.6 4.6A2 2 0 1 1 11 8H2m10.6 11.4A2 2 0 1 0 14 16H2m15.7-8.3A2.5 2.5 0 1 1 19.5 12H2" />
  ),
  ola: (
    <>
      <Path d="M2 10c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3" />
      <Path d="M2 17c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3" />
    </>
  ),
  uv: (
    <>
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </>
  ),
  calima: (
    <>
      <Path d="M7.5 12a4.5 4.5 0 0 1 9 0" />
      <Path d="M12 3v1.8M5.3 5.8l1.3 1.3M18.7 5.8l-1.3 1.3" />
      <Path d="M3 15.5h18M5.5 19h13M9 22.2h6" />
    </>
  ),
  agua: <Path d="M12 2.7l5.7 5.6a8 8 0 1 1-11.4 0z" />,
  ninos: (
    <>
      <Path d="M5.5 10h13l-1.6 10.5H7.1z" />
      <Path d="M7 10a5 5 0 0 1 10 0" />
      <Path d="M9.5 14.5h5" />
    </>
  ),
  surf: (
    <>
      <Ellipse cx={12} cy={12} rx={3.6} ry={10} transform="rotate(35 12 12)" />
      <Path d="M17 4.9L7 19.1" />
    </>
  ),
  snorkel: (
    <>
      <Path d="M3 9.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2V12a3.5 3.5 0 0 1-3.5 3.5H12l-2.5-2-2.5 2h-.5A3.5 3.5 0 0 1 3 12z" />
      <Path d="M20.5 3.5V15a4.5 4.5 0 0 1-4.5 4.5h-3" />
    </>
  ),
  socorrista: (
    <>
      <Circle cx={12} cy={12} r={9.5} />
      <Circle cx={12} cy={12} r={3.8} />
      <Path d="M5.3 5.3l4 4M14.7 14.7l4 4M18.7 5.3l-4 4M9.3 14.7l-4 4" />
    </>
  ),
  resguardada: <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  rumbo: <Path d="M12 2.5l6.5 18L12 16.8l-6.5 3.7z" />,
  ubicacion: (
    <>
      <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <Circle cx={12} cy={10} r={2.8} />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type NombreIcono = keyof typeof TRAZOS;

interface Props {
  nombre: NombreIcono;
  tamano?: number;
  color: string;
}

/** Decorativo por defecto: el texto de al lado o la etiqueta del contenedor lo describe. */
export function Icono({ nombre, tamano = 24, color }: Props) {
  return (
    <Svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {TRAZOS[nombre]}
    </Svg>
  );
}

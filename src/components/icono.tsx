import type { ReactNode } from 'react';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

/**
 * Iconos propios de Planeo. Todos comparten rejilla de 24 pt, trazo de 1,75 pt y
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
  lluvia: (
    <>
      <Path d="M7 15a4.5 4.5 0 0 1 .6-9 6 6 0 0 1 11.3 1.7A3.7 3.7 0 0 1 18 15z" />
      <Path d="M8.5 18.5v2.5M12 18.5v2.5M15.5 18.5v2.5" />
    </>
  ),
  temperatura: (
    <>
      <Path d="M14 14.5V5a2 2 0 0 0-4 0v9.5a4 4 0 1 0 4 0z" />
      <Path d="M12 9v7" />
    </>
  ),
  sombrilla: (
    <>
      <Path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z" />
      <Path d="M12 12v7.5a1.75 1.75 0 0 0 3.5 0" />
    </>
  ),
  senderismo: <Path d="M2.5 20L9 8l4.5 7.5 2.5-3.5 5.5 8z" />,
  futbol: (
    <>
      <Circle cx={12} cy={12} r={9.5} />
      <Path d="M12 8l3.6 2.6-1.4 4.2H9.8l-1.4-4.2z" />
      <Path d="M12 8V2.6M15.6 10.6l5-1.7M14.2 14.8l3.1 4.3M9.8 14.8l-3.1 4.3M8.4 10.6l-5-1.7" />
    </>
  ),
  baloncesto: (
    <>
      <Circle cx={12} cy={12} r={9.5} />
      <Path d="M12 2.5v19M2.5 12h19" />
      <Path d="M5.3 5.3a9.5 9.5 0 0 1 0 13.4M18.7 5.3a9.5 9.5 0 0 0 0 13.4" />
    </>
  ),
  padel: (
    <>
      <Ellipse cx={10} cy={9} rx={6} ry={7} transform="rotate(-35 10 9)" />
      <Path d="M14.2 14.6l6 6.2" />
      <Path d="M8 7.5h.01M11 6.5h.01M9 10.5h.01M12 9.5h.01" />
    </>
  ),
  baile: (
    <>
      <Path d="M9 18V5.5l11-2.3V16" />
      <Circle cx={6} cy={18} r={3} />
      <Circle cx={17} cy={16} r={3} />
    </>
  ),
  pilates: (
    <>
      <Circle cx={12} cy={4.8} r={2.2} />
      <Path d="M4 20c2-5.5 4.5-8 8-8s6 2.5 8 8" />
      <Path d="M7.5 11.5L12 13l4.5-1.5" />
    </>
  ),
  otros: (
    <>
      <Circle cx={12} cy={12} r={9.5} />
      <Path d="M12 7.5v9M7.5 12h9" />
    </>
  ),
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

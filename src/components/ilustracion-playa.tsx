import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { TipoPlaya } from '@/data/playas';

/** Color del cielo en lo alto de la ilustración; la cabecera del detalle lo continúa. */
export const CIELO_ALTO = '#0B5C8A';

function Orilla({ tipo }: { tipo: TipoPlaya }) {
  if (tipo === 'arena') {
    return (
      <>
        <Path d="M0 88 C26 78 66 98 120 80 L120 120 L0 120 Z" fill="#FFFFFF" opacity={0.55} />
        <Path d="M0 92 C28 82 68 102 120 85 L120 120 L0 120 Z" fill="#EBD3A0" />
        <Path d="M0 106 C40 98 84 112 120 102 L120 120 L0 120 Z" fill="#DDBF83" />
      </>
    );
  }
  if (tipo === 'callaos') {
    return (
      <>
        <Path d="M0 92 C34 84 78 98 120 88 L120 120 L0 120 Z" fill="#FFFFFF" opacity={0.45} />
        <Path d="M0 96 C36 88 80 102 120 92 L120 120 L0 120 Z" fill="#33383E" />
        <Ellipse cx={22} cy={106} rx={13} ry={7} fill="#5B636B" />
        <Ellipse cx={50} cy={112} rx={10} ry={6} fill="#23272B" />
        <Ellipse cx={74} cy={104} rx={12} ry={6.5} fill="#767F88" />
        <Ellipse cx={100} cy={111} rx={14} ry={7} fill="#4A5158" />
        <Ellipse cx={38} cy={99} rx={7} ry={4} fill="#8A939B" />
      </>
    );
  }
  return (
    <>
      <Path
        d="M0 84 L14 76 L30 82 L44 72 L62 78 L80 70 L98 79 L120 72 L120 120 L0 120 Z"
        fill="#2B2F34"
      />
      <Path d="M0 98 L22 92 L120 96 L120 120 L0 120 Z" fill="#1E2125" />
      <Ellipse cx={60} cy={99} rx={36} ry={11} fill="#2FB5B2" />
      <Ellipse cx={54} cy={96} rx={20} ry={4.5} fill="#7FE0D8" opacity={0.7} />
    </>
  );
}

interface Props {
  tipo: TipoPlaya;
  /** Ancho entre alto del contenedor. Menor que 1 para la miniatura, mayor para la cabecera. */
  proporcion: number;
}

/**
 * Estampa de la playa según su tipo: arena, callaos o piscina natural.
 * El encuadre se calcula a partir de la proporción del contenedor: la miniatura recorta
 * los lados y la cabecera panorámica se queda con la franja de la orilla.
 */
export function IlustracionPlaya({ tipo, proporcion }: Props) {
  const panoramica = proporcion > 1;
  const anchoVista = panoramica ? 120 : 120 * proporcion;
  const altoVista = panoramica ? 120 / proporcion : 120;
  const x = (120 - anchoVista) / 2;
  const y = 120 - altoVista;
  // En panorámica el sol baja hasta el horizonte para no quedar fuera del encuadre.
  const solY = panoramica ? 60 : 36;
  // Ids únicos por estampa: varias en pantalla no deben compartir el mismo degradado.
  const sufijo = useId().replace(/:/g, '');
  const idCielo = `cielo-${sufijo}`;
  const idMar = `mar-${sufijo}`;

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox={`${x} ${y} ${anchoVista} ${altoVista}`}
      // Si el contenedor no tiene justo la proporción prevista, se recorta: nunca se deforma.
      preserveAspectRatio="xMidYMax slice"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id={idCielo} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={CIELO_ALTO} />
          <Stop offset="1" stopColor="#9BD8E6" />
        </LinearGradient>
        <LinearGradient id={idMar} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0E6F9E" />
          <Stop offset="1" stopColor="#3DBFC4" />
        </LinearGradient>
      </Defs>
      <Rect width={120} height={120} fill={`url(#${idCielo})`} />
      <Circle cx={88} cy={solY} r={22} fill="#FFD23F" opacity={0.2} />
      <Circle cx={88} cy={solY} r={12} fill="#FFD23F" />
      <Rect y={60} width={120} height={60} fill={`url(#${idMar})`} />
      <Path d="M0 68 H46" stroke="#FFFFFF" strokeWidth={1.2} opacity={0.35} strokeLinecap="round" />
      <Path
        d="M62 74 H120"
        stroke="#FFFFFF"
        strokeWidth={1.2}
        opacity={0.3}
        strokeLinecap="round"
      />
      <Orilla tipo={tipo} />
    </Svg>
  );
}

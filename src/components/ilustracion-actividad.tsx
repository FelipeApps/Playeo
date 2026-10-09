import { useId, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { CIELO_ALTO, IlustracionPlaya } from '@/components/ilustracion-playa';

/**
 * Estampas de las actividades que no tienen foto: el monte, cada cancha y los planes
 * con sitio a mano. Comparten trazo y paleta con la estampa de playa y con el icono de
 * la app, para que todo lo ilustrado se lea como una sola familia.
 */

interface PropsLienzo {
  /** Ancho entre alto del contenedor. */
  proporcion: number;
  /** Qué parte se conserva al recortar: el suelo (paisajes) o el centro (canchas). */
  ancla: 'abajo' | 'centro';
  children: ReactNode;
}

/** Lienzo de 120 x 120 que se recorta a la proporción del contenedor, sin deformarse. */
function Lienzo({ proporcion, ancla, children }: PropsLienzo) {
  const ancho = proporcion >= 1 ? 120 : 120 * proporcion;
  const alto = proporcion >= 1 ? 120 / proporcion : 120;
  const x = (120 - ancho) / 2;
  const y = ancla === 'abajo' ? 120 - alto : (120 - alto) / 2;

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      viewBox={`${x} ${y} ${ancho} ${alto}`}
      preserveAspectRatio={ancla === 'abajo' ? 'xMidYMax slice' : 'xMidYMid slice'}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {children}
    </Svg>
  );
}

function Cielo() {
  // Id único por estampa: varias en pantalla no deben compartir el mismo degradado.
  const id = `cielo-${useId().replace(/:/g, '')}`;
  return (
    <>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={CIELO_ALTO} />
          <Stop offset="1" stopColor="#9BD8E6" />
        </LinearGradient>
      </Defs>
      <Rect width={120} height={120} fill={`url(#${id})`} />
    </>
  );
}

/** Cumbres volcánicas en tres planos, con el sendero subiendo por la más cercana. */
function Monte({ proporcion }: { proporcion: number }) {
  // En formato apaisado solo se ve la mitad inferior: el sol baja para seguir a la vista.
  const solY = proporcion > 1.2 ? 60 : 34;
  return (
    <Lienzo proporcion={proporcion} ancla="abajo">
      <Cielo />
      <Circle cx={90} cy={solY} r={21} fill="#FFD23F" opacity={0.2} />
      <Circle cx={90} cy={solY} r={11} fill="#FFD23F" />
      <Path d="M0 80 L20 64 L38 74 L60 52 L82 72 L102 58 L120 68 V120 H0 Z" fill="#4A8FB3" />
      <Path d="M60 52 L67 61 L61 63 L57 60 L52 62 Z" fill="#F1E6CF" />
      <Path d="M0 94 L18 78 L34 88 L54 68 L78 90 L96 76 L120 92 V120 H0 Z" fill="#1B5E78" />
      <Path d="M0 106 L28 84 L48 98 L70 82 L92 102 L120 88 V120 H0 Z" fill="#0A2A3F" />
      <Path
        d="M16 120 C30 112 38 108 50 104 S66 96 70 84"
        fill="none"
        stroke="#F1E6CF"
        strokeWidth={1.6}
        strokeDasharray="3 3.5"
        strokeLinecap="round"
      />
    </Lienzo>
  );
}

const LINEA = { fill: 'none', stroke: '#FFFFFF', strokeWidth: 1.5, opacity: 0.92 } as const;

/** Campo de fútbol visto desde arriba. */
function Futbol({ proporcion }: { proporcion: number }) {
  return (
    <Lienzo proporcion={proporcion} ancla="centro">
      <Rect width={120} height={120} fill="#147A6C" />
      {/* Franjas del césped. */}
      {[0, 2, 4].map((franja) => (
        <Rect key={franja} x={franja * 24} width={24} height={120} fill="#178876" />
      ))}
      <Rect x={12} y={30} width={96} height={60} {...LINEA} />
      <Path d="M60 30 V90" {...LINEA} />
      <Circle cx={60} cy={60} r={10} {...LINEA} />
      <Rect x={12} y={45} width={14} height={30} {...LINEA} />
      <Rect x={94} y={45} width={14} height={30} {...LINEA} />
      <Circle cx={60} cy={60} r={1.6} fill="#FFFFFF" />
    </Lienzo>
  );
}

/** Media cancha de baloncesto vista desde arriba. */
function Baloncesto({ proporcion }: { proporcion: number }) {
  return (
    <Lienzo proporcion={proporcion} ancla="centro">
      <Rect width={120} height={120} fill="#B8641C" />
      <Rect x={18} y={26} width={84} height={68} fill="#C9772B" />
      <Rect x={18} y={26} width={84} height={68} {...LINEA} />
      <Path d="M26 94 V78 A34 34 0 0 1 94 78 V94" {...LINEA} />
      <Rect x={48} y={64} width={24} height={30} {...LINEA} />
      <Path d="M48 64 A12 12 0 0 1 72 64" {...LINEA} />
      <Circle cx={60} cy={88} r={3} {...LINEA} />
      <Path d="M18 26 H102" {...LINEA} />
    </Lienzo>
  );
}

/** Pista de pádel vista desde arriba, con su red y sus cuadros de saque. */
function Padel({ proporcion }: { proporcion: number }) {
  return (
    <Lienzo proporcion={proporcion} ancla="centro">
      <Rect width={120} height={120} fill="#0A4F78" />
      <Rect x={22} y={32} width={76} height={56} fill="#0F6A98" />
      <Rect x={22} y={32} width={76} height={56} {...LINEA} />
      <Path d="M60 32 V88" {...LINEA} strokeWidth={2.4} />
      <Path d="M36 32 V88 M84 32 V88 M36 60 H84" {...LINEA} />
    </Lienzo>
  );
}

/** Sol sobre el mar y la arena: el paisaje de la marca, para planes con sitio a mano. */
function Plan({ proporcion }: { proporcion: number }) {
  const solY = proporcion > 1.2 ? 62 : 36;
  return (
    <Lienzo proporcion={proporcion} ancla="abajo">
      <Cielo />
      <Circle cx={88} cy={solY} r={22} fill="#FFD23F" opacity={0.2} />
      <Circle cx={88} cy={solY} r={12} fill="#FFD23F" />
      <Path d="M0 82 C20 74 40 90 60 82 S100 74 120 82 V120 H0 Z" fill="#1FA3A6" />
      <Path d="M0 100 C24 108 44 94 60 100 S100 108 120 100 V120 H0 Z" fill="#F1E6CF" />
    </Lienzo>
  );
}

interface Props {
  /** Id de la actividad: 'senderismo', 'futbol', 'baile'... */
  actividad: string;
  proporcion: number;
}

/** Estampa de una actividad. Rellena su contenedor, que debe recortar lo que sobre. */
export function IlustracionActividad({ actividad, proporcion }: Props) {
  switch (actividad) {
    case 'playa':
      return <IlustracionPlaya tipo="arena" proporcion={proporcion} />;
    case 'senderismo':
      return <Monte proporcion={proporcion} />;
    case 'futbol':
      return <Futbol proporcion={proporcion} />;
    case 'baloncesto':
      return <Baloncesto proporcion={proporcion} />;
    case 'padel':
      return <Padel proporcion={proporcion} />;
    default:
      return <Plan proporcion={proporcion} />;
  }
}

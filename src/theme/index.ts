import { useColorScheme } from 'react-native';

/**
 * Tema de Planeo.
 * Azules del Atlántico, arena y amarillo sol sobre una bruma muy clara; de noche,
 * el azul casi negro del mar abierto. La calima tiene su propio ocre para que el
 * aviso no se confunda con ningún otro estado.
 */
export interface Colores {
  fondo: string;
  superficie: string;
  /** Arena: superficies secundarias, chips y bloques destacados. */
  arena: string;
  sobreArena: string;
  texto: string;
  textoSecundario: string;
  borde: string;
  /** Azul atlántico: acciones y elementos activos. */
  primario: string;
  sobrePrimario: string;
  /** Turquesa del agua somera: datos del mar y franjas de ola. */
  turquesa: string;
  sol: string;
  /** Amarillo sol que no cambia con el tema, para usar sobre fotos y cielos. */
  solFijo: string;
  sobreSol: string;
  calima: string;
  fondoCalima: string;
  textoCalima: string;
  /** Escala de la puntuación, de mejor a peor. */
  excelente: string;
  bueno: string;
  regular: string;
  malo: string;
  error: string;
  esqueleto: string;
}

export const paleta: { claro: Colores; oscuro: Colores } = {
  claro: {
    fondo: '#F1F6F6',
    superficie: '#FFFFFF',
    arena: '#F1E6CF',
    sobreArena: '#4A3A14',
    texto: '#0A2A3F',
    textoSecundario: '#496170',
    borde: '#D3DFE2',
    primario: '#0B5C8A',
    sobrePrimario: '#FFFFFF',
    turquesa: '#1FA3A6',
    sol: '#F5B700',
    solFijo: '#FFD23F',
    sobreSol: '#3A2A00',
    calima: '#B8641C',
    fondoCalima: '#F8E3C8',
    textoCalima: '#6B3608',
    excelente: '#0B7F70',
    bueno: '#0B5C8A',
    regular: '#8A6100',
    malo: '#B83A24',
    error: '#B83A24',
    esqueleto: '#DCE6E8',
  },
  oscuro: {
    fondo: '#07141D',
    superficie: '#0F2230',
    arena: '#2B2618',
    sobreArena: '#EAD9AE',
    texto: '#EAF3F6',
    textoSecundario: '#9DB4C0',
    borde: '#213848',
    primario: '#5BB8E8',
    sobrePrimario: '#04202F',
    turquesa: '#3CCBB4',
    sol: '#FFC933',
    solFijo: '#FFD23F',
    sobreSol: '#3A2A00',
    calima: '#E39A52',
    fondoCalima: '#3A2412',
    textoCalima: '#F6D2A8',
    excelente: '#3CCBB4',
    bueno: '#5BB8E8',
    regular: '#FFC933',
    malo: '#F0806A',
    error: '#F0806A',
    esqueleto: '#17303F',
  },
};

export const fuentes = {
  titular: 'BricolageGrotesque_800ExtraBold',
  titulo: 'BricolageGrotesque_700Bold',
  texto: 'InstrumentSans_400Regular',
  textoMedio: 'InstrumentSans_500Medium',
  textoFuerte: 'InstrumentSans_600SemiBold',
} as const;

/** Ritmo de 4 pt. */
export const espacio = {
  xxs: 4,
  xs: 8,
  s: 12,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radio = {
  s: 10,
  m: 16,
  l: 24,
  xl: 28,
  completo: 999,
} as const;

/**
 * Sombra de las superficies elevadas, teñida de azul atlántico en vez de gris.
 * En oscuro no se ve: allí la elevación la marca el borde.
 */
export function sombra(esOscuro: boolean) {
  return esOscuro ? null : { boxShadow: '0 10px 24px rgba(10, 42, 63, 0.09)' };
}

/** Alto mínimo de cualquier elemento táctil (48 dp cubre iOS y Android). */
export const TACTIL_MINIMO = 48;

export function useTema() {
  const esOscuro = useColorScheme() === 'dark';
  return { colores: esOscuro ? paleta.oscuro : paleta.claro, esOscuro };
}

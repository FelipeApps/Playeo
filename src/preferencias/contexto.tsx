import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { PREFERENCIAS_POR_DEFECTO, type Preferencias } from '@/scoring/puntuacion';

const CLAVE = 'planeo/preferencias';

/** Qué viene a buscar la persona: decide por dónde empieza Explorar y qué destaca Inicio. */
export type Interes = 'playa' | 'senderismo' | 'todo';

/**
 * Preferencias de la app: las que usa la puntuación más el interés. `interes` no tiene
 * valor por defecto: mientras está sin definir, la app lo pregunta al abrirse.
 */
export interface PreferenciasApp extends Preferencias {
  interes?: Interes;
}

interface Valor {
  preferencias: PreferenciasApp;
  /** Falso mientras se leen del dispositivo las preferencias guardadas. */
  lista: boolean;
  cambiar: (cambios: Partial<PreferenciasApp>) => void;
}

const Contexto = createContext<Valor | null>(null);

/** Preferencias del usuario, guardadas en el dispositivo. */
export function ProveedorPreferencias({ children }: { children: ReactNode }) {
  const [preferencias, setPreferencias] = useState<PreferenciasApp>(PREFERENCIAS_POR_DEFECTO);
  const [lista, setLista] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CLAVE)
      .then((guardado) => {
        if (guardado) setPreferencias({ ...PREFERENCIAS_POR_DEFECTO, ...JSON.parse(guardado) });
      })
      .catch(() => {
        // Sin lectura posible nos quedamos con los valores por defecto.
      })
      .finally(() => setLista(true));
  }, []);

  const cambiar = (cambios: Partial<PreferenciasApp>) => {
    setPreferencias((anteriores) => {
      const nuevas = { ...anteriores, ...cambios };
      AsyncStorage.setItem(CLAVE, JSON.stringify(nuevas)).catch(() => {});
      return nuevas;
    });
  };

  return <Contexto value={{ preferencias, lista, cambiar }}>{children}</Contexto>;
}

export function usePreferencias() {
  const valor = use(Contexto);
  if (!valor) throw new Error('usePreferencias necesita un ProveedorPreferencias');
  return valor;
}

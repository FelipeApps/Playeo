import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { PREFERENCIAS_POR_DEFECTO, type Preferencias } from '@/scoring/puntuacion';

const CLAVE = 'playeo/preferencias';

interface Valor {
  preferencias: Preferencias;
  cambiar: (cambios: Partial<Preferencias>) => void;
}

const Contexto = createContext<Valor | null>(null);

/** Preferencias del usuario, guardadas en el dispositivo. */
export function ProveedorPreferencias({ children }: { children: ReactNode }) {
  const [preferencias, setPreferencias] = useState(PREFERENCIAS_POR_DEFECTO);

  useEffect(() => {
    AsyncStorage.getItem(CLAVE)
      .then((guardado) => {
        if (guardado) setPreferencias({ ...PREFERENCIAS_POR_DEFECTO, ...JSON.parse(guardado) });
      })
      .catch(() => {
        // Sin lectura posible nos quedamos con los valores por defecto.
      });
  }, []);

  const cambiar = (cambios: Partial<Preferencias>) => {
    setPreferencias((anteriores) => {
      const nuevas = { ...anteriores, ...cambios };
      AsyncStorage.setItem(CLAVE, JSON.stringify(nuevas)).catch(() => {});
      return nuevas;
    });
  };

  return <Contexto value={{ preferencias, cambiar }}>{children}</Contexto>;
}

export function usePreferencias() {
  const valor = use(Contexto);
  if (!valor) throw new Error('usePreferencias necesita un ProveedorPreferencias');
  return valor;
}

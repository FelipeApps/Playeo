import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { buscarZona, type Zona } from '@/data/zonas';

const CLAVE = 'planeo/zona';

interface Valor {
  /** Zona elegida, o `undefined` si aún no se ha elegido ninguna. */
  zona: Zona | undefined;
  /** Falso mientras se lee del dispositivo la zona guardada. */
  lista: boolean;
  elegir: (id: string) => void;
}

const Contexto = createContext<Valor | null>(null);

/** Zona de costa que el usuario quiere ver. Se elige al abrir la app por primera vez. */
export function ProveedorRegion({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  const [lista, setLista] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CLAVE)
      .then(setId)
      .catch(() => {})
      .finally(() => setLista(true));
  }, []);

  const elegir = (nuevo: string) => {
    setId(nuevo);
    AsyncStorage.setItem(CLAVE, nuevo).catch(() => {});
  };

  return <Contexto value={{ zona: buscarZona(id), lista, elegir }}>{children}</Contexto>;
}

export function useRegion() {
  const valor = use(Contexto);
  if (!valor) throw new Error('useRegion necesita un ProveedorRegion');
  return valor;
}

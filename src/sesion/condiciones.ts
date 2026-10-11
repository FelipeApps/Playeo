import { useSyncExternalStore } from 'react';

// La aceptación viaja del modal de lectura al formulario que lo abrió. Vive solo en
// memoria: si se cierra la app antes de terminar el registro, hay que volver a leerlas.
let aceptadas = false;
const oyentes = new Set<() => void>();

function publicar(valor: boolean) {
  aceptadas = valor;
  oyentes.forEach((avisar) => avisar());
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
  };
}

/** Las marca como leídas y aceptadas. Solo lo llama el modal, al llegar al final. */
export function aceptarCondiciones() {
  publicar(true);
}

/** Vuelve a dejarlas sin aceptar: al terminar el registro o al cambiar de cuenta. */
export function olvidarCondiciones() {
  publicar(false);
}

/** Verdadero cuando la persona ha leído hasta el final y ha pulsado aceptar. */
export function useCondicionesAceptadas() {
  return useSyncExternalStore(
    suscribir,
    () => aceptadas,
    () => false,
  );
}

// Lleva a la app los textos legales de la web, para que lo que se acepta en el registro
// sea exactamente lo publicado en planeoapp.es. La fuente es siempre el HTML de `web/`:
// tras cambiarlo, ejecutar `node scripts/generar-textos-legales.mjs`.
import { readFileSync, writeFileSync } from 'node:fs';

/** Cada documento de la app y las páginas de la web que lo forman. */
const DOCUMENTOS = {
  condiciones: ['terminos.html', 'normas.html'],
  privacidad: ['privacidad.html'],
  aviso: ['aviso-legal.html'],
};

function limpiar(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Convierte el <main> de una página en bloques de texto, en orden de lectura. */
function bloquesDe(archivo) {
  const html = readFileSync(`web/${archivo}`, 'utf8');
  const titulo = limpiar(html.match(/<h1>([\s\S]*?)<\/h1>/)[1]);
  const cuerpo = html.match(/<main>([\s\S]*?)<\/main>/)[1];
  const bloques = [{ tipo: 'titulo', texto: titulo }];

  const patron = /<(h2|h3|p|li|tr)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g;
  for (const [, etiqueta, interior] of cuerpo.matchAll(patron)) {
    if (etiqueta === 'tr') {
      // Las tablas se leen como una lista: las celdas de cada fila, unidas.
      if (interior.includes('<th')) continue;
      const celdas = [...interior.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => limpiar(c[1]));
      bloques.push({ tipo: 'li', texto: celdas.join(' — ') });
      continue;
    }
    const texto = limpiar(interior);
    if (texto) bloques.push({ tipo: etiqueta, texto });
  }
  return bloques;
}

const version = readFileSync('web/terminos.html', 'utf8').match(/Versión ([0-9-]+)/)[1];
const documentos = Object.fromEntries(
  Object.entries(DOCUMENTOS).map(([id, paginas]) => [id, paginas.flatMap(bloquesDe)]),
);

const salida = `// Generado por scripts/generar-textos-legales.mjs a partir de web/*.html. No editar a mano.

export type BloqueLegal = { tipo: 'titulo' | 'h2' | 'h3' | 'p' | 'li'; texto: string };

export type DocumentoLegal = ${Object.keys(DOCUMENTOS)
  .map((id) => `'${id}'`)
  .join(' | ')};

/** Versión de los Términos y las Normas que se guarda al aceptarlos. */
export const VERSION_CONDICIONES = '${version}';

export const TEXTOS_LEGALES: Record<DocumentoLegal, BloqueLegal[]> = ${JSON.stringify(documentos, null, 2)};
`;

writeFileSync('src/data/textos-legales.ts', salida);
console.log(
  `versión ${version}:`,
  Object.entries(documentos)
    .map(([id, bloques]) => `${id} ${bloques.length} bloques`)
    .join(', '),
);

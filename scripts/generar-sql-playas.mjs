// Genera la migración que carga las playas en el catálogo de lugares de la base de datos, a partir de
// los dos JSON de la app. Si el catálogo cambia, se vuelve a ejecutar con un nombre de
// migración nuevo:
//
//   node scripts/generar-sql-playas.mjs supabase/migrations/<fecha>_playas_catalogo.sql
import { readFileSync, writeFileSync } from 'node:fs';

const leer = (ruta) => JSON.parse(readFileSync(new URL(ruta, import.meta.url), 'utf8'));
const playas = [...leer('../src/data/playas.json'), ...leer('../src/data/playas-wikidata.json')];
const sql = (texto) => `'${String(texto).replace(/'/g, "''")}'`;

const filas = playas
  .map((playa) => `  (${sql(playa.id)}, ${sql(playa.nombre)}, ${sql(playa.region)})`)
  .join(',\n');

const contenido = `-- Catálogo de playas, generado por scripts/generar-sql-playas.mjs desde los JSON de la app.
-- ${playas.length} playas. No editar a mano: regenerar.

insert into public.lugares (id, nombre, region) values
${filas}
on conflict (id) do update set nombre = excluded.nombre, region = excluded.region;
`;

const destino = process.argv[2];
if (!destino) throw new Error('Falta la ruta de la migración de destino');
writeFileSync(destino, contenido);
console.log(`${playas.length} playas escritas en ${destino}`);

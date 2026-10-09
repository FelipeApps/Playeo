// Borra la cuenta de quien llama (derecho de supresión, RGPD).
// Al eliminar el usuario de auth.users, el resto de sus datos cae en cascada por las
// claves foráneas. Las fotos de Storage no cuelgan de ninguna clave, así que se borran aquí.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CABECERAS = { 'Content-Type': 'application/json' };

function responder(estado: number, cuerpo: Record<string, unknown>) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: CABECERAS });
}

Deno.serve(async (peticion) => {
  if (peticion.method !== 'POST') return responder(405, { error: 'Método no permitido' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const autorizacion = peticion.headers.get('Authorization') ?? '';

  // La identidad sale del token de la petición, nunca de un parámetro: nadie puede
  // pedir el borrado de otra cuenta.
  const comoUsuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: autorizacion } },
  });
  const { data, error: errorSesion } = await comoUsuario.auth.getUser();
  if (errorSesion || !data.user) return responder(401, { error: 'Sesión no válida' });
  const usuario = data.user;

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: fotos } = await admin.storage.from('avatares').list(usuario.id);
  if (fotos && fotos.length > 0) {
    await admin.storage.from('avatares').remove(fotos.map((foto) => `${usuario.id}/${foto.name}`));
  }

  // Notas de voz: una carpeta por conversación dentro de la del usuario.
  const { data: carpetas } = await admin.storage.from('notas-voz').list(usuario.id);
  for (const carpeta of carpetas ?? []) {
    const base = `${usuario.id}/${carpeta.name}`;
    const { data: notas } = await admin.storage.from('notas-voz').list(base, { limit: 1000 });
    if (notas && notas.length > 0) {
      await admin.storage.from('notas-voz').remove(notas.map((nota) => `${base}/${nota.name}`));
    }
  }

  const { error } = await admin.auth.admin.deleteUser(usuario.id);
  if (error) return responder(500, { error: 'No se pudo borrar la cuenta' });

  return responder(200, { borrada: true });
});

-- Notas de voz en el chat. El audio vive en un bucket privado y el mensaje guarda su
-- ruta y su duración. Un audio solo se puede oír mientras existe su mensaje y quien lo
-- pide podría leer ese mensaje: mismas reglas que el texto, bloqueos incluidos.

-- ---------------------------------------------------------------------------
-- Mensajes
-- ---------------------------------------------------------------------------

alter table public.mensajes
  -- <id del autor>/<id de la conversación>/<nombre>.<extensión>
  add column audio_ruta text,
  add column audio_duracion_ms integer,
  add constraint mensaje_audio_completo check (
    (audio_ruta is null) = (audio_duracion_ms is null)
  ),
  -- Dos minutos como mucho: es una nota, no un pódcast.
  add constraint mensaje_audio_duracion check (
    audio_duracion_ms is null or audio_duracion_ms between 500 and 120000
  ),
  -- La ruta tiene que ser de la carpeta del autor y de esta conversación.
  add constraint mensaje_audio_en_su_carpeta check (
    audio_ruta is null
    or audio_ruta like autor_id::text || '/' || conversacion_id::text || '/_%'
  );

-- Un archivo pertenece a un único mensaje. También sirve a la política de lectura del
-- bucket, que busca el mensaje por su ruta.
create unique index mensajes_audio_ruta_idx on public.mensajes (audio_ruta)
  where audio_ruta is not null;

-- Una nota de voz no trae texto: se le pone uno fijo, que es lo que enseñan la lista de
-- chats y las notificaciones. Y el archivo tiene que estar subido antes de mandarla.
create function private.preparar_nota_de_voz()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.audio_ruta is null then
    return new;
  end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'notas-voz' and o.name = new.audio_ruta
  ) then
    raise exception 'La nota de voz no se ha subido' using errcode = 'check_violation';
  end if;

  new.cuerpo := 'Nota de voz';
  return new;
end;
$$;

create trigger mensajes_preparan_nota_de_voz
  before insert on public.mensajes
  for each row execute function private.preparar_nota_de_voz();

grant insert (audio_ruta, audio_duracion_ms) on public.mensajes to authenticated;

-- ---------------------------------------------------------------------------
-- Bucket
-- ---------------------------------------------------------------------------

-- 2 MB sobran para dos minutos de voz en mono. `audio/webm` es lo que graba la web.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'notas-voz',
  'notas-voz',
  false,
  2097152,
  array['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/webm']
);

-- Subir exige poder escribir en la conversación que indica la ruta. Una ruta mal
-- formada no pasa.
create function private.puedo_subir_nota(ruta text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  carpetas text[] := string_to_array(ruta, '/');
  conversacion uuid;
begin
  if array_length(carpetas, 1) <> 3 or carpetas[1] <> (select auth.uid())::text then
    return false;
  end if;
  begin
    conversacion := carpetas[2]::uuid;
  exception when others then
    return false;
  end;
  return private.puedo_escribir_en(conversacion);
end;
$$;

-- Oír exige que exista el mensaje y que yo pueda leerlo. Si el mensaje se borra (lo
-- borra su autor, moderación o desaparece la conversación), el audio deja de ser
-- accesible aunque el archivo siga un tiempo en el bucket.
create function private.puedo_oir_nota(ruta text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.mensajes m
    where m.audio_ruta = ruta
      and private.soy_miembro_de_conversacion(m.conversacion_id)
      and (m.autor_id = (select auth.uid()) or not private.hay_bloqueo_con(m.autor_id))
  );
$$;

revoke all on function private.preparar_nota_de_voz() from public, anon, authenticated;
revoke all on function private.puedo_subir_nota(text) from public, anon;
revoke all on function private.puedo_oir_nota(text) from public, anon;
grant execute on function private.puedo_subir_nota(text) to authenticated;
grant execute on function private.puedo_oir_nota(text) to authenticated;

create policy "Subir notas de voz a mis conversaciones"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'notas-voz' and (select private.puedo_subir_nota(name)));

-- Quien la sube también la ve, aunque aún no tenga mensaje: lo necesita la propia
-- subida y permite borrarla si el envío del mensaje falla.
create policy "Oír las notas de voz de los mensajes que puedo leer"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'notas-voz'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or private.puedo_oir_nota(name)
    )
  );

create policy "Borrar mis notas de voz"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'notas-voz'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

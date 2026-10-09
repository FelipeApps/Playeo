begin;
select plan(17);

delete from private.ajustes;

select tests.crear_usuario('ana');
select tests.crear_usuario('beto');
select tests.crear_usuario('mode');
insert into private.moderadores (usuario_id) values (tests.id_de('mode'));
insert into public.amistades (solicitante_id, destinatario_id, estado)
values (tests.id_de('ana'), tests.id_de('beto'), 'aceptada');
insert into public.lugares (id, nombre, region) values ('playa-de-prueba', 'Playa de prueba', 'zona-de-prueba');

create temp table contexto (clave text primary key, id uuid, numero bigint);
grant all on contexto to authenticated;

-- Ana escribe a Beto y Beto reporta el mensaje.
select tests.entrar_como('ana');
insert into contexto (clave, id) select 'chat', public.abrir_conversacion_directa(tests.id_de('beto'));
insert into public.mensajes (conversacion_id, autor_id, cuerpo)
values ((select id from contexto where clave = 'chat'), tests.id_de('ana'), 'Mensaje ofensivo');
select tests.entrar_como('beto');
insert into public.reportes (reportante_id, usuario_reportado_id, mensaje_id, contenido, motivo)
select tests.id_de('beto'), tests.id_de('ana'), m.id, m.cuerpo, 'acoso' from public.mensajes m;
select tests.salir();
insert into contexto (clave, numero)
select 'reporte', id from public.reportes where usuario_reportado_id = tests.id_de('ana');

-- ------------------------------------------------------------- Quien no modera
select tests.entrar_como('ana');
select is(public.soy_moderador(), false, 'Un usuario normal no es moderador');
select is(
  (select count(*) from public.reportes_para_moderar()),
  0::bigint,
  'Quien no modera no ve la cola de moderación'
);
select is(
  (select count(*) from public.reportes),
  0::bigint,
  'La persona reportada sigue sin ver el reporte'
);
update public.reportes set estado = 'cerrado';
select tests.salir();
select is(
  (select estado from public.reportes where id = (select numero from contexto where clave = 'reporte')),
  'abierto'::public.estado_reporte,
  'Quien no modera no puede cerrar un reporte, ni siquiera el que va contra él'
);
select tests.entrar_como('ana');
select throws_ok(
  format('select public.moderar_borrar_mensaje(%s)', (select numero from contexto where clave = 'reporte')),
  '42501',
  null,
  'Quien no modera no puede retirar mensajes'
);
select throws_ok(
  $$ insert into private.moderadores (usuario_id) values (tests.id_de('ana')) $$,
  '42501',
  null,
  'Nadie puede nombrarse moderador desde la app'
);

-- ------------------------------------------------------------------ Moderador
select tests.entrar_como('mode');
select is(public.soy_moderador(), true, 'El moderador se reconoce como tal');
select is(
  (select reportado_nombre from public.reportes_para_moderar()
   where id = (select numero from contexto where clave = 'reporte')),
  'Ana',
  'El moderador ve el reporte con la persona reportada'
);
select is(
  (select mensaje_existe from public.reportes_para_moderar()
   where id = (select numero from contexto where clave = 'reporte')),
  true,
  'Y sabe que el mensaje sigue publicado'
);
select is(
  (select count(*) from public.mensajes),
  0::bigint,
  'Ser moderador no da acceso a leer chats ajenos'
);
select lives_ok(
  format('select public.moderar_borrar_mensaje(%s)', (select numero from contexto where clave = 'reporte')),
  'El moderador retira el mensaje reportado'
);
select tests.salir();
select is(
  (select count(*) from public.mensajes where autor_id = tests.id_de('ana')),
  0::bigint,
  'El mensaje ya no existe'
);
select is(
  (select estado from public.reportes where id = (select numero from contexto where clave = 'reporte')),
  'revisado'::public.estado_reporte,
  'Y el reporte queda como revisado, con la copia del texto'
);

-- ---------------------------------------------------- Fotos de perfil y bloqueos
insert into storage.objects (bucket_id, name, owner)
values ('avatares', tests.id_de('ana')::text || '/foto.jpg', tests.id_de('ana'));

select tests.entrar_como('beto');
select is(
  (select count(*) from storage.objects where bucket_id = 'avatares'
   and name = tests.id_de('ana')::text || '/foto.jpg'),
  1::bigint,
  'Sin bloqueo, la foto de perfil de Ana se puede ver'
);
insert into public.bloqueos (bloqueador_id, bloqueado_id)
values (tests.id_de('beto'), tests.id_de('ana'));
select tests.entrar_como('ana');
select is(
  (select count(*) from storage.objects where bucket_id = 'avatares'
   and name = tests.id_de('ana')::text || '/foto.jpg'),
  1::bigint,
  'Cada uno ve siempre su propia foto'
);
select tests.salir();
insert into storage.objects (bucket_id, name, owner)
values ('avatares', tests.id_de('beto')::text || '/foto.jpg', tests.id_de('beto'));
select tests.entrar_como('ana');
select is(
  (select count(*) from storage.objects where bucket_id = 'avatares'
   and name = tests.id_de('beto')::text || '/foto.jpg'),
  0::bigint,
  'La bloqueada no puede descargar la foto de quien la bloqueó'
);

-- ------------------------------------------- Quedadas: el enlace para quien organiza
select tests.salir();
delete from public.bloqueos;
select tests.entrar_como('ana');
with nuevo as (
  insert into public.eventos (creador_id, lugar_id, titulo, empieza, visibilidad, enlace_whatsapp)
  values (tests.id_de('ana'), 'playa-de-prueba', 'Con enlace', now() + interval '2 days', 'amigos',
          'https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv')
  returning id
)
insert into contexto (clave, id) select 'evento', id from nuevo;
update public.asistencias_evento set respuesta = 'no_voy' where usuario_id = tests.id_de('ana');
select isnt(
  (select enlace_whatsapp from public.detalle_evento((select id from contexto where clave = 'evento'))),
  null,
  'Quien organiza ve el enlace de WhatsApp aunque marque que no va'
);
select tests.salir();

select * from finish();
rollback;

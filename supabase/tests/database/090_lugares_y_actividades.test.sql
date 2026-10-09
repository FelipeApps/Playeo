begin;
select plan(16);

delete from private.ajustes;

select tests.crear_usuario('ana');
select tests.crear_usuario('beto');
insert into public.amistades (solicitante_id, destinatario_id, estado)
values (tests.id_de('ana'), tests.id_de('beto'), 'aceptada');
insert into public.lugares (id, nombre, region) values ('playa-de-prueba', 'Playa de prueba', 'zona-de-prueba');

create temp table contexto (clave text primary key, id uuid);
grant all on contexto to authenticated;

-- ------------------------------------------------------------------ Catálogo
select tests.entrar_como_anonimo();
select is(
  (select count(*) from public.actividades),
  8::bigint,
  'Sin sesión se puede leer el catálogo de actividades'
);
select cmp_ok(
  (select count(*) from public.lugares where tipo = 'playa'),
  '>=',
  376::bigint,
  'Y el de lugares, con las playas que ya existían'
);
select throws_ok(
  $$ insert into public.lugares (id, nombre, region) values ('colado', 'Colado', 'zona') $$,
  '42501',
  null,
  'Pero nadie puede añadir lugares desde la app'
);
select tests.salir();

-- ------------------------------------------------- Quedadas con lugar de catálogo
select tests.entrar_como('ana');
with nuevo as (
  insert into public.eventos (creador_id, lugar_id, titulo, empieza, visibilidad, region)
  values (tests.id_de('ana'), 'playa-de-prueba', 'Baño', now() + interval '2 days', 'amigos', 'zona-inventada')
  returning id
)
insert into contexto select 'playa', id from nuevo;
select is(
  (select region from public.eventos where id = (select id from contexto where clave = 'playa')),
  'zona-de-prueba',
  'La zona de la quedada es la de su lugar, diga lo que diga la app'
);
select is(
  (select actividad_id from public.eventos where id = (select id from contexto where clave = 'playa')),
  'playa',
  'Una quedada sin actividad indicada sigue siendo de playa, como antes'
);
select throws_ok(
  $$ insert into public.eventos (creador_id, lugar_id, actividad_id, titulo, empieza, visibilidad)
     values (tests.id_de('ana'), 'playa-de-prueba', 'futbol', 'Fútbol en la arena', now() + interval '2 days', 'amigos') $$,
  '23514',
  null,
  'No se puede usar una playa como lugar de otra actividad'
);

-- ------------------------------------------------- Quedadas con ubicación a mano
select throws_ok(
  $$ insert into public.eventos (creador_id, actividad_id, titulo, empieza, visibilidad)
     values (tests.id_de('ana'), 'pilates', 'Sin sitio', now() + interval '2 days', 'amigos') $$,
  '23514',
  null,
  'Una quedada necesita un lugar o una ubicación'
);
select throws_ok(
  $$ insert into public.eventos (creador_id, actividad_id, ubicacion_nombre, titulo, empieza, visibilidad)
     values (tests.id_de('ana'), 'otros', 'Parque', 'Sin decir qué', now() + interval '2 days', 'amigos') $$,
  '23514',
  null,
  'Con la actividad "otros" hay que decir cuál es'
);
select throws_ok(
  $$ insert into public.eventos (creador_id, actividad_id, actividad_otra, ubicacion_nombre, titulo, empieza, visibilidad)
     values (tests.id_de('ana'), 'baile', 'Salsa', 'Sala', 'Sobra el nombre', now() + interval '2 days', 'amigos') $$,
  '23514',
  null,
  'Y solo con "otros" se escribe el nombre de la actividad'
);
select lives_ok(
  $$ with nuevo as (
       insert into public.eventos (creador_id, actividad_id, ubicacion_nombre, ubicacion_direccion, region, titulo, empieza, visibilidad)
       values (tests.id_de('ana'), 'pilates', 'Estudio Mar', 'Calle Falsa 123, 2ºB', 'gran-canaria',
               'Pilates al amanecer', now() + interval '2 days', 'amigos')
       returning id
     )
     insert into contexto select 'pilates', id from nuevo $$,
  'Ana crea una quedada de pilates con la ubicación escrita a mano'
);
select is(
  (select ubicacion_direccion from public.detalle_evento((select id from contexto where clave = 'pilates'))),
  'Calle Falsa 123, 2ºB',
  'Quien organiza ve la dirección exacta'
);

-- ------------------------------------------------- La dirección, solo para quien va
select tests.entrar_como('beto');
select throws_ok(
  $$ select ubicacion_direccion from public.eventos $$,
  '42501',
  null,
  'La dirección exacta no se puede leer de la tabla'
);
select is(
  (select lugar_nombre from public.detalle_evento((select id from contexto where clave = 'pilates'))),
  'Estudio Mar',
  'Quien aún no se ha apuntado ve el nombre del sitio'
);
select is(
  (select ubicacion_direccion from public.detalle_evento((select id from contexto where clave = 'pilates'))),
  null,
  'Pero no la dirección exacta'
);
insert into public.asistencias_evento (evento_id, usuario_id, respuesta)
values ((select id from contexto where clave = 'pilates'), tests.id_de('beto'), 'voy');
select is(
  (select ubicacion_direccion from public.detalle_evento((select id from contexto where clave = 'pilates'))),
  'Calle Falsa 123, 2ºB',
  'Al apuntarse ya ve la dirección'
);
select is(
  (select actividad_nombre from public.eventos_visibles('gran-canaria') where titulo = 'Pilates al amanecer'),
  'Pilates',
  'La lista de quedadas de la zona incluye la de ubicación a mano, con su actividad'
);
select tests.salir();

select * from finish();
rollback;

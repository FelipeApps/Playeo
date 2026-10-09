begin;
select plan(6);

select tests.crear_usuario('ana');
select tests.crear_usuario('beto');
insert into public.amistades (solicitante_id, destinatario_id, estado)
values (tests.id_de('ana'), tests.id_de('beto'), 'aceptada');

create temp table contexto (grupo uuid);
grant all on contexto to authenticated;

select tests.entrar_como('ana');
insert into contexto select public.crear_grupo('Con WhatsApp');
select lives_ok(
  $$ update public.grupos set enlace_whatsapp = 'https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv'
     where id = (select grupo from contexto) $$,
  'La administradora guarda el enlace de WhatsApp'
);
select throws_ok(
  $$ update public.grupos set enlace_whatsapp = 'https://sitio-raro.example/unete'
     where id = (select grupo from contexto) $$,
  '23514',
  null,
  'Solo se aceptan enlaces de invitación de WhatsApp'
);
select is(
  (select enlace_whatsapp from public.mis_grupos()),
  'https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv',
  'Los miembros ven el enlace'
);
insert into public.invitaciones_grupo (grupo_id, invitado_id, invitador_id)
values ((select grupo from contexto), tests.id_de('beto'), tests.id_de('ana'));

select tests.entrar_como('beto');
select is(
  (select count(*) from public.grupos where id = (select grupo from contexto)),
  1::bigint,
  'El invitado ve que el grupo existe'
);
select throws_ok(
  $$ select enlace_whatsapp from public.grupos $$,
  '42501',
  null,
  'Pero no puede leer el enlace de WhatsApp desde la tabla'
);
select is(
  (select count(*) from public.mis_grupos()),
  0::bigint,
  'Ni a través de mis_grupos() mientras no acepte la invitación'
);
select tests.salir();

select * from finish();
rollback;

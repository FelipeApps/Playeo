-- El perfil deja de guardar una isla canaria y pasa a guardar la zona elegida en la app,
-- que ahora cubre también Baleares, la península y Portugal. El catálogo de zonas vive
-- en la app (src/data/zonas.ts); aquí solo se valida la forma del identificador.

alter table public.perfiles drop constraint isla_valida;
alter table public.perfiles rename column isla to zona;
update public.perfiles set zona = null;
alter table public.perfiles
  add constraint zona_formato check (zona ~ '^[a-z0-9-]{2,40}$');

comment on column public.perfiles.zona is
  'Identificador de la zona de costa del usuario, por ejemplo gran-canaria o algarve.';

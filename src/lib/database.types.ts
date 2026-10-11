
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "actividades": {
                  Row: {
                    "id": string,"nombre": string,"orden": number,"tipo_sitio": Database["public"]['Enums']["tipo_sitio"]
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"nombre": string,"orden": number,"tipo_sitio": Database["public"]['Enums']["tipo_sitio"]
                  }
                  Update: {
                    "id"?: string,"nombre"?: string,"orden"?: number,"tipo_sitio"?: Database["public"]['Enums']["tipo_sitio"]
                  }
                  Relationships: [
                    
                  ]
                },"amistades": {
                  Row: {
                    "creada": string,"destinatario_id": string,"estado": Database["public"]['Enums']["estado_amistad"],"respondida": string | null,"solicitante_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creada"?: string,"destinatario_id": string,"estado"?: Database["public"]['Enums']["estado_amistad"],"respondida"?: string | null,"solicitante_id": string
                  }
                  Update: {
                    "creada"?: string,"destinatario_id"?: string,"estado"?: Database["public"]['Enums']["estado_amistad"],"respondida"?: string | null,"solicitante_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "amistades_destinatario_id_fkey"
      columns: ["destinatario_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "amistades_solicitante_id_fkey"
      columns: ["solicitante_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"asistencias_evento": {
                  Row: {
                    "actualizada": string,"evento_id": string,"respuesta": Database["public"]['Enums']["respuesta_evento"],"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizada"?: string,"evento_id": string,"respuesta": Database["public"]['Enums']["respuesta_evento"],"usuario_id": string
                  }
                  Update: {
                    "actualizada"?: string,"evento_id"?: string,"respuesta"?: Database["public"]['Enums']["respuesta_evento"],"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "asistencias_evento_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: false
      referencedRelation: "eventos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "asistencias_evento_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"bloqueos": {
                  Row: {
                    "bloqueado_id": string,"bloqueador_id": string,"creado": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bloqueado_id": string,"bloqueador_id": string,"creado"?: string
                  }
                  Update: {
                    "bloqueado_id"?: string,"bloqueador_id"?: string,"creado"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bloqueos_bloqueado_id_fkey"
      columns: ["bloqueado_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bloqueos_bloqueador_id_fkey"
      columns: ["bloqueador_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversaciones": {
                  Row: {
                    "clave_directa": string | null,"creada": string,"evento_id": string | null,"grupo_id": string | null,"id": string,"tipo": Database["public"]['Enums']["tipo_conversacion"],"ultimo_mensaje": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "clave_directa"?: string | null,"creada"?: string,"evento_id"?: string | null,"grupo_id"?: string | null,"id"?: string,"tipo": Database["public"]['Enums']["tipo_conversacion"],"ultimo_mensaje"?: string | null
                  }
                  Update: {
                    "clave_directa"?: string | null,"creada"?: string,"evento_id"?: string | null,"grupo_id"?: string | null,"id"?: string,"tipo"?: Database["public"]['Enums']["tipo_conversacion"],"ultimo_mensaje"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversaciones_evento_fk"
      columns: ["evento_id"]
isOneToOne: true
      referencedRelation: "eventos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversaciones_grupo_id_fkey"
      columns: ["grupo_id"]
isOneToOne: true
      referencedRelation: "grupos"
      referencedColumns: ["id"]
    }
                  ]
                },"eventos": {
                  Row: {
                    "actividad_id": string,"actividad_otra": string | null,"actualizado": string,"creado": string,"creador_id": string,"descripcion": string | null,"empieza": string,"enlace_whatsapp": string | null,"grupo_id": string | null,"id": string,"lugar_id": string | null,"plazas_maximas": number | null,"recordado": string | null,"region": string | null,"titulo": string,"ubicacion_direccion": string | null,"ubicacion_nombre": string | null,"visibilidad": Database["public"]['Enums']["visibilidad_evento"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actividad_id"?: string,"actividad_otra"?: string | null,"actualizado"?: string,"creado"?: string,"creador_id": string,"descripcion"?: string | null,"empieza": string,"enlace_whatsapp"?: string | null,"grupo_id"?: string | null,"id"?: string,"lugar_id"?: string | null,"plazas_maximas"?: number | null,"recordado"?: string | null,"region"?: string | null,"titulo": string,"ubicacion_direccion"?: string | null,"ubicacion_nombre"?: string | null,"visibilidad"?: Database["public"]['Enums']["visibilidad_evento"]
                  }
                  Update: {
                    "actividad_id"?: string,"actividad_otra"?: string | null,"actualizado"?: string,"creado"?: string,"creador_id"?: string,"descripcion"?: string | null,"empieza"?: string,"enlace_whatsapp"?: string | null,"grupo_id"?: string | null,"id"?: string,"lugar_id"?: string | null,"plazas_maximas"?: number | null,"recordado"?: string | null,"region"?: string | null,"titulo"?: string,"ubicacion_direccion"?: string | null,"ubicacion_nombre"?: string | null,"visibilidad"?: Database["public"]['Enums']["visibilidad_evento"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "eventos_actividad_id_fkey"
      columns: ["actividad_id"]
isOneToOne: false
      referencedRelation: "actividades"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eventos_creador_id_fkey"
      columns: ["creador_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eventos_grupo_id_fkey"
      columns: ["grupo_id"]
isOneToOne: false
      referencedRelation: "grupos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eventos_lugar_id_fkey"
      columns: ["lugar_id"]
isOneToOne: false
      referencedRelation: "lugares"
      referencedColumns: ["id"]
    }
                  ]
                },"grupos": {
                  Row: {
                    "actualizado": string,"creado": string,"creado_por": string | null,"descripcion": string | null,"enlace_whatsapp": string | null,"id": string,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado"?: string,"creado"?: string,"creado_por"?: string | null,"descripcion"?: string | null,"enlace_whatsapp"?: string | null,"id"?: string,"nombre": string
                  }
                  Update: {
                    "actualizado"?: string,"creado"?: string,"creado_por"?: string | null,"descripcion"?: string | null,"enlace_whatsapp"?: string | null,"id"?: string,"nombre"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "grupos_creado_por_fkey"
      columns: ["creado_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"invitaciones_evento": {
                  Row: {
                    "creada": string,"evento_id": string,"invitado_id": string,"invitador_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creada"?: string,"evento_id": string,"invitado_id": string,"invitador_id": string
                  }
                  Update: {
                    "creada"?: string,"evento_id"?: string,"invitado_id"?: string,"invitador_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitaciones_evento_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: false
      referencedRelation: "eventos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitaciones_evento_invitado_id_fkey"
      columns: ["invitado_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitaciones_evento_invitador_id_fkey"
      columns: ["invitador_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"invitaciones_grupo": {
                  Row: {
                    "creada": string,"grupo_id": string,"invitado_id": string,"invitador_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "creada"?: string,"grupo_id": string,"invitado_id": string,"invitador_id": string
                  }
                  Update: {
                    "creada"?: string,"grupo_id"?: string,"invitado_id"?: string,"invitador_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitaciones_grupo_grupo_id_fkey"
      columns: ["grupo_id"]
isOneToOne: false
      referencedRelation: "grupos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitaciones_grupo_invitado_id_fkey"
      columns: ["invitado_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitaciones_grupo_invitador_id_fkey"
      columns: ["invitador_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"lugares": {
                  Row: {
                    "actividad_id": string,"datos": NonNullable<Json>,"id": string,"lat": number | null,"lon": number | null,"nombre": string,"region": string,"tipo": Database["public"]['Enums']["tipo_lugar"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actividad_id"?: string,"datos"?: NonNullable<Json>,"id": string,"lat"?: number | null,"lon"?: number | null,"nombre": string,"region": string,"tipo"?: Database["public"]['Enums']["tipo_lugar"]
                  }
                  Update: {
                    "actividad_id"?: string,"datos"?: NonNullable<Json>,"id"?: string,"lat"?: number | null,"lon"?: number | null,"nombre"?: string,"region"?: string,"tipo"?: Database["public"]['Enums']["tipo_lugar"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "lugares_actividad_id_fkey"
      columns: ["actividad_id"]
isOneToOne: false
      referencedRelation: "actividades"
      referencedColumns: ["id"]
    }
                  ]
                },"mensajes": {
                  Row: {
                    "audio_duracion_ms": number | null,"audio_ruta": string | null,"autor_id": string,"conversacion_id": string,"creado": string,"cuerpo": string,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "audio_duracion_ms"?: number | null,"audio_ruta"?: string | null,"autor_id": string,"conversacion_id": string,"creado"?: string,"cuerpo": string,"id"?: never
                  }
                  Update: {
                    "audio_duracion_ms"?: number | null,"audio_ruta"?: string | null,"autor_id"?: string,"conversacion_id"?: string,"creado"?: string,"cuerpo"?: string,"id"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "mensajes_autor_id_fkey"
      columns: ["autor_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mensajes_conversacion_id_fkey"
      columns: ["conversacion_id"]
isOneToOne: false
      referencedRelation: "conversaciones"
      referencedColumns: ["id"]
    }
                  ]
                },"miembros_conversacion": {
                  Row: {
                    "conversacion_id": string,"leido_hasta": string,"unido": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversacion_id": string,"leido_hasta"?: string,"unido"?: string,"usuario_id": string
                  }
                  Update: {
                    "conversacion_id"?: string,"leido_hasta"?: string,"unido"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "miembros_conversacion_conversacion_id_fkey"
      columns: ["conversacion_id"]
isOneToOne: false
      referencedRelation: "conversaciones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "miembros_conversacion_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"miembros_grupo": {
                  Row: {
                    "grupo_id": string,"rol": Database["public"]['Enums']["rol_grupo"],"unido": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "grupo_id": string,"rol"?: Database["public"]['Enums']["rol_grupo"],"unido"?: string,"usuario_id": string
                  }
                  Update: {
                    "grupo_id"?: string,"rol"?: Database["public"]['Enums']["rol_grupo"],"unido"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "miembros_grupo_grupo_id_fkey"
      columns: ["grupo_id"]
isOneToOne: false
      referencedRelation: "grupos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "miembros_grupo_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notificaciones": {
                  Row: {
                    "actor_id": string | null,"creada": string,"datos": NonNullable<Json>,"id": number,"leida": string | null,"tipo": Database["public"]['Enums']["tipo_notificacion"],"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"creada"?: string,"datos"?: NonNullable<Json>,"id"?: never,"leida"?: string | null,"tipo": Database["public"]['Enums']["tipo_notificacion"],"usuario_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"creada"?: string,"datos"?: NonNullable<Json>,"id"?: never,"leida"?: string | null,"tipo"?: Database["public"]['Enums']["tipo_notificacion"],"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notificaciones_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notificaciones_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"perfiles": {
                  Row: {
                    "actualizado": string,"bio": string | null,"condiciones_aceptadas": string | null,"condiciones_version": string | null,"creado": string,"id": string,"mayoria_edad_confirmada": string | null,"nombre_usuario": string,"nombre_visible": string,"preferencias_playa": NonNullable<Json>,"privacidad": Database["public"]['Enums']["privacidad_perfil"],"ruta_foto": string | null,"zona": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado"?: string,"bio"?: string | null,"condiciones_aceptadas"?: string | null,"condiciones_version"?: string | null,"creado"?: string,"id": string,"mayoria_edad_confirmada"?: string | null,"nombre_usuario": string,"nombre_visible": string,"preferencias_playa"?: NonNullable<Json>,"privacidad"?: Database["public"]['Enums']["privacidad_perfil"],"ruta_foto"?: string | null,"zona"?: string | null
                  }
                  Update: {
                    "actualizado"?: string,"bio"?: string | null,"condiciones_aceptadas"?: string | null,"condiciones_version"?: string | null,"creado"?: string,"id"?: string,"mayoria_edad_confirmada"?: string | null,"nombre_usuario"?: string,"nombre_visible"?: string,"preferencias_playa"?: NonNullable<Json>,"privacidad"?: Database["public"]['Enums']["privacidad_perfil"],"ruta_foto"?: string | null,"zona"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"reportes": {
                  Row: {
                    "contenido": string | null,"creado": string,"detalles": string | null,"estado": Database["public"]['Enums']["estado_reporte"],"id": number,"mensaje_id": number | null,"motivo": Database["public"]['Enums']["motivo_reporte"],"reportante_id": string | null,"usuario_reportado_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "contenido"?: string | null,"creado"?: string,"detalles"?: string | null,"estado"?: Database["public"]['Enums']["estado_reporte"],"id"?: never,"mensaje_id"?: number | null,"motivo": Database["public"]['Enums']["motivo_reporte"],"reportante_id"?: string | null,"usuario_reportado_id"?: string | null
                  }
                  Update: {
                    "contenido"?: string | null,"creado"?: string,"detalles"?: string | null,"estado"?: Database["public"]['Enums']["estado_reporte"],"id"?: never,"mensaje_id"?: number | null,"motivo"?: Database["public"]['Enums']["motivo_reporte"],"reportante_id"?: string | null,"usuario_reportado_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reportes_mensaje_fk"
      columns: ["mensaje_id"]
isOneToOne: false
      referencedRelation: "mensajes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reportes_reportante_id_fkey"
      columns: ["reportante_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reportes_usuario_reportado_id_fkey"
      columns: ["usuario_reportado_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"tokens_push": {
                  Row: {
                    "actualizado": string,"plataforma": string,"token": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actualizado"?: string,"plataforma": string,"token": string,"usuario_id": string
                  }
                  Update: {
                    "actualizado"?: string,"plataforma"?: string,"token"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tokens_push_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "abrir_conversacion_directa":
{ Args: { "otro": string }; Returns: string
                           },
"aceptar_condiciones":
{ Args: { "version": string }; Returns: undefined
                           },
"aceptar_invitacion_grupo":
{ Args: { "grupo": string }; Returns: undefined
                           },
"amigos_invitables":
{ Args: { "grupo": string }; Returns: {
              "id": string,"nombre_usuario": string,"nombre_visible": string,"ruta_foto": string
            }[]
                           },
"amigos_invitables_evento":
{ Args: { "evento": string }; Returns: {
              "id": string,"nombre_usuario": string,"nombre_visible": string,"ruta_foto": string
            }[]
                           },
"asistentes_evento":
{ Args: { "evento": string }; Returns: {
              "id": string,"nombre_usuario": string,"nombre_visible": string,"respuesta": Database["public"]['Enums']["respuesta_evento"],"ruta_foto": string
            }[]
                           },
"buscar_usuarios":
{ Args: { "texto": string }; Returns: {
              "id": string,"nombre_usuario": string,"nombre_visible": string,"relacion": Database["public"]['Enums']["relacion_usuario"],"ruta_foto": string
            }[]
                           },
"confirmar_mayoria_edad":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"crear_grupo":
{ Args: { "descripcion"?: string,"nombre": string }; Returns: string
                           },
"detalle_evento":
{ Args: { "evento": string }; Returns: {
              "actividad_id": string,"actividad_nombre": string,"conversacion_id": string,"creador_foto": string,"creador_id": string,"creador_nombre": string,"creador_usuario": string,"descripcion": string,"empieza": string,"enlace_whatsapp": string,"grupo_id": string,"grupo_nombre": string,"id": string,"lugar_id": string,"lugar_nombre": string,"me_han_invitado": boolean,"mi_respuesta": Database["public"]['Enums']["respuesta_evento"],"plazas_maximas": number,"region": string,"tipo_sitio": Database["public"]['Enums']["tipo_sitio"],"titulo": string,"ubicacion_direccion": string,"van": number,"visibilidad": Database["public"]['Enums']["visibilidad_evento"]
            }[]
                           },
"eventos_visibles":
{ Args: { "region"?: string }; Returns: {
              "actividad_id": string,"actividad_nombre": string,"creador_id": string,"creador_nombre": string,"empieza": string,"grupo_nombre": string,"id": string,"lugar_id": string,"lugar_nombre": string,"me_han_invitado": boolean,"mi_respuesta": Database["public"]['Enums']["respuesta_evento"],"plazas_maximas": number,"titulo": string,"van": number,"visibilidad": Database["public"]['Enums']["visibilidad_evento"]
            }[]
                           },
"exportar_mis_datos":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"marcar_conversacion_leida":
{ Args: { "conversacion": string }; Returns: undefined
                           },
"miembros_de_grupo":
{ Args: { "grupo": string }; Returns: {
              "id": string,"nombre_usuario": string,"nombre_visible": string,"rol": Database["public"]['Enums']["rol_grupo"],"ruta_foto": string,"unido": string
            }[]
                           },
"mis_bloqueados":
{ Args: Record<PropertyKey, never>; Returns: {
              "desde": string,"id": string,"nombre_usuario": string,"nombre_visible": string,"ruta_foto": string
            }[]
                           },
"mis_conversaciones":
{ Args: Record<PropertyKey, never>; Returns: {
              "evento_id": string,"grupo_id": string,"id": string,"no_leidos": number,"otro_id": string,"puedo_escribir": boolean,"ruta_foto": string,"tipo": Database["public"]['Enums']["tipo_conversacion"],"titulo": string,"ultimo_cuerpo": string,"ultimo_mensaje": string,"ultimo_mio": boolean
            }[]
                           },
"mis_grupos":
{ Args: Record<PropertyKey, never>; Returns: {
              "descripcion": string,"enlace_whatsapp": string,"id": string,"mi_rol": Database["public"]['Enums']["rol_grupo"],"miembros": number,"nombre": string
            }[]
                           },
"mis_invitaciones_grupo":
{ Args: Record<PropertyKey, never>; Returns: {
              "creada": string,"grupo_descripcion": string,"grupo_id": string,"grupo_nombre": string,"invitador_nombre": string
            }[]
                           },
"mis_notificaciones":
{ Args: Record<PropertyKey, never>; Returns: {
              "actor_foto": string,"actor_id": string,"actor_nombre": string,"creada": string,"datos": Json,"id": number,"leida": string,"tipo": Database["public"]['Enums']["tipo_notificacion"]
            }[]
                           },
"mis_relaciones":
{ Args: Record<PropertyKey, never>; Returns: {
              "desde": string,"id": string,"nombre_usuario": string,"nombre_visible": string,"relacion": Database["public"]['Enums']["relacion_usuario"],"ruta_foto": string
            }[]
                           },
"moderar_borrar_mensaje":
{ Args: { "reporte": number }; Returns: undefined
                           },
"nombre_usuario_disponible":
{ Args: { "nombre": string }; Returns: boolean
                           },
"participantes_conversacion":
{ Args: { "conversacion": string }; Returns: {
              "id": string,"leido_hasta": string,"nombre_usuario": string,"nombre_visible": string,"ruta_foto": string
            }[]
                           },
"registrar_token_push":
{ Args: { "plataforma": string,"token": string }; Returns: undefined
                           },
"reportes_para_moderar":
{ Args: { "solo_abiertos"?: boolean }; Returns: {
              "contenido": string,"creado": string,"detalles": string,"estado": Database["public"]['Enums']["estado_reporte"],"id": number,"mensaje_existe": boolean,"mensaje_id": number,"motivo": Database["public"]['Enums']["motivo_reporte"],"reportado_id": string,"reportado_nombre": string,"reportado_usuario": string,"reportante_nombre": string,"reportes_previos": number
            }[]
                           },
"soy_moderador":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"ver_usuario":
{ Args: { "usuario": string }; Returns: {
              "bio": string,"id": string,"nombre_usuario": string,"nombre_visible": string,"perfil_visible": boolean,"relacion": Database["public"]['Enums']["relacion_usuario"],"ruta_foto": string,"zona": string
            }[]
                           }
          }
          Enums: {
            "estado_amistad": "pendiente"|"aceptada","estado_reporte": "abierto"|"revisado"|"cerrado","motivo_reporte": "spam"|"acoso"|"contenido_inapropiado"|"suplantacion"|"otro","privacidad_perfil": "publico"|"amigos","relacion_usuario": "yo"|"ninguna"|"amigo"|"solicitud_enviada"|"solicitud_recibida"|"bloqueado","respuesta_evento": "voy"|"quiza"|"no_voy","rol_grupo": "admin"|"miembro","tipo_conversacion": "directa"|"grupo"|"evento","tipo_lugar": "playa"|"ruta"|"cancha","tipo_notificacion": "solicitud_amistad"|"amistad_aceptada"|"invitacion_grupo"|"invitacion_evento"|"mensaje_nuevo"|"asistencia_evento"|"evento_cambiado"|"evento_cancelado"|"recordatorio_evento"|"miembro_grupo","tipo_sitio": "catalogo_con_estado"|"catalogo"|"manual","visibilidad_evento": "amigos"|"grupo"|"publico"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "estado_amistad": ["pendiente", "aceptada"],"estado_reporte": ["abierto", "revisado", "cerrado"],"motivo_reporte": ["spam", "acoso", "contenido_inapropiado", "suplantacion", "otro"],"privacidad_perfil": ["publico", "amigos"],"relacion_usuario": ["yo", "ninguna", "amigo", "solicitud_enviada", "solicitud_recibida", "bloqueado"],"respuesta_evento": ["voy", "quiza", "no_voy"],"rol_grupo": ["admin", "miembro"],"tipo_conversacion": ["directa", "grupo", "evento"],"tipo_lugar": ["playa", "ruta", "cancha"],"tipo_notificacion": ["solicitud_amistad", "amistad_aceptada", "invitacion_grupo", "invitacion_evento", "mensaje_nuevo", "asistencia_evento", "evento_cambiado", "evento_cancelado", "recordatorio_evento", "miembro_grupo"],"tipo_sitio": ["catalogo_con_estado", "catalogo", "manual"],"visibilidad_evento": ["amigos", "grupo", "publico"]
          }
        }
} as const

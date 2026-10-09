import {
  intensidadCalima,
  mejorFranja,
  PESOS_MONTE,
  puntuarSenderismo,
  type DatosMonte,
  nivelCalima,
  nivelPuntuacion,
  olaEfectiva,
  PESOS,
  PREFERENCIAS_POR_DEFECTO,
  puntuar,
  type DatosPlaya,
  type DatosTiempo,
  type Plan,
} from './puntuacion';

const diaPerfecto: DatosTiempo = {
  viento: 6,
  rachas: 10,
  nubosidad: 5,
  uv: 4,
  olaAltura: 0.3,
  olaPeriodo: 8,
  polvo: 0,
  aod: 0.08,
};

const playaCompleta: DatosPlaya = { ninos: true, surf: true, snorkel: true, resguardada: false };

function conPlan(plan: Plan) {
  return { ...PREFERENCIAS_POR_DEFECTO, plan };
}

describe('puntuar', () => {
  it('da una nota muy alta a un día perfecto de baño', () => {
    expect(puntuar(diaPerfecto, playaCompleta, conPlan('bano')).total).toBeGreaterThanOrEqual(95);
  });

  it('se mantiene siempre entre 0 y 100', () => {
    const temporal: DatosTiempo = {
      viento: 90,
      rachas: 130,
      nubosidad: 100,
      uv: 12,
      olaAltura: 6,
      olaPeriodo: 4,
      polvo: 900,
      aod: 2,
    };
    for (const plan of Object.keys(PESOS) as Plan[]) {
      const { total } = puntuar(temporal, playaCompleta, conPlan(plan));
      expect(total).toBeGreaterThanOrEqual(0);
      expect(total).toBeLessThanOrEqual(100);
    }
    expect(puntuar(temporal, playaCompleta, conPlan('bano')).total).toBeLessThan(15);
  });

  it('los pesos de cada plan suman 1', () => {
    for (const pesos of Object.values(PESOS)) {
      const suma = Object.values(pesos).reduce((a, b) => a + b, 0);
      expect(suma).toBeCloseTo(1);
    }
  });

  it('el oleaje suma para surf y resta con niños', () => {
    const conOlas = { ...diaPerfecto, olaAltura: 1.6, olaPeriodo: 11 };
    const surf = puntuar(conOlas, playaCompleta, conPlan('surf')).total;
    const surfSinOlas = puntuar(diaPerfecto, playaCompleta, conPlan('surf')).total;
    const ninos = puntuar(conOlas, playaCompleta, conPlan('ninos')).total;
    const ninosSinOlas = puntuar(diaPerfecto, playaCompleta, conPlan('ninos')).total;

    expect(surf).toBeGreaterThan(surfSinOlas);
    expect(ninos).toBeLessThan(ninosSinOlas);
  });

  it('una playa resguardada aguanta mejor el mar de fondo', () => {
    const marMovido = { ...diaPerfecto, olaAltura: 1.8 };
    const abierta = puntuar(marMovido, playaCompleta, conPlan('bano')).total;
    const resguardada = puntuar(
      marMovido,
      { ...playaCompleta, resguardada: true },
      conPlan('bano'),
    ).total;
    expect(resguardada).toBeGreaterThan(abierta);
  });

  it('más tolerancia al viento mejora la nota de un día ventoso', () => {
    const ventoso = { ...diaPerfecto, viento: 28, rachas: 40 };
    const baja = puntuar(ventoso, playaCompleta, {
      ...PREFERENCIAS_POR_DEFECTO,
      toleranciaViento: 'baja',
    }).total;
    const alta = puntuar(ventoso, playaCompleta, {
      ...PREFERENCIAS_POR_DEFECTO,
      toleranciaViento: 'alta',
    }).total;
    expect(alta).toBeGreaterThan(baja);
  });

  it('penaliza una playa que no encaja con el plan', () => {
    const sinSnorkel = { ...playaCompleta, snorkel: false };
    expect(puntuar(diaPerfecto, sinSnorkel, conPlan('snorkel')).total).toBeLessThan(
      puntuar(diaPerfecto, playaCompleta, conPlan('snorkel')).total,
    );
  });

  it('limita la nota con calima fuerte a quien es sensible', () => {
    const calima = { ...diaPerfecto, polvo: 400, aod: 1.2 };
    const sensible = puntuar(calima, playaCompleta, {
      ...PREFERENCIAS_POR_DEFECTO,
      sensibleCalima: true,
    }).total;
    const noSensible = puntuar(calima, playaCompleta, PREFERENCIAS_POR_DEFECTO).total;

    expect(sensible).toBeLessThanOrEqual(45);
    expect(noSensible).toBeGreaterThan(sensible);
  });

  it('no penaliza una playa de la que no se conocen las características', () => {
    expect(puntuar(diaPerfecto, null, conPlan('surf')).total).toBe(
      puntuar(diaPerfecto, playaCompleta, conPlan('surf')).total,
    );
  });

  it('trata la falta de datos del mar como neutra', () => {
    const sinMar = { ...diaPerfecto, olaAltura: null, olaPeriodo: null };
    expect(puntuar(sinMar, playaCompleta, conPlan('bano')).factores.oleaje).toBe(0.5);
  });
});

describe('calima', () => {
  it('no hay calima con aire limpio', () => {
    expect(nivelCalima(intensidadCalima(5, 0.1))).toBe('ninguna');
    expect(nivelCalima(intensidadCalima(null, null))).toBe('ninguna');
  });

  it('distingue ligera de fuerte', () => {
    expect(nivelCalima(intensidadCalima(100, 0.2))).toBe('ligera');
    expect(nivelCalima(intensidadCalima(300, 0.4))).toBe('fuerte');
  });

  it('basta una de las dos señales', () => {
    expect(nivelCalima(intensidadCalima(0, 0.9))).toBe('fuerte');
  });
});

describe('auxiliares', () => {
  it('atenúa la ola solo en playas resguardadas', () => {
    expect(olaEfectiva(2, false)).toBe(2);
    expect(olaEfectiva(2, true)).toBeCloseTo(0.8);
    expect(olaEfectiva(null, true)).toBeNull();
  });

  it('clasifica la puntuación por tramos', () => {
    expect(nivelPuntuacion(92)).toBe('excelente');
    expect(nivelPuntuacion(65)).toBe('bueno');
    expect(nivelPuntuacion(45)).toBe('regular');
    expect(nivelPuntuacion(10)).toBe('malo');
  });
});

describe('mejorFranja', () => {
  const dia = (nota: (hora: number) => number) =>
    Array.from({ length: 24 }, (_, hora) => ({ hora, total: nota(hora) }));

  it('elige las tres horas seguidas con mejor media', () => {
    const franja = mejorFranja(dia((hora) => (hora >= 11 && hora <= 13 ? 90 : 50)));
    expect(franja).toEqual({ desde: 11, hasta: 14, media: 90 });
  });

  it('ignora la noche aunque puntúe mejor', () => {
    const franja = mejorFranja(dia((hora) => (hora < 6 ? 100 : 40)));
    expect(franja?.desde).toBeGreaterThanOrEqual(8);
  });

  it('a igualdad, prefiere la más temprana', () => {
    expect(mejorFranja(dia(() => 70))?.desde).toBe(8);
  });

  it('no recomienda nada si faltan horas seguidas', () => {
    expect(
      mejorFranja([
        { hora: 9, total: 80 },
        { hora: 12, total: 80 },
        { hora: 15, total: 80 },
      ]),
    ).toBeNull();
    expect(mejorFranja([])).toBeNull();
  });
});

describe('puntuarSenderismo', () => {
  const diaDeMonte: DatosMonte = {
    viento: 6,
    rachas: 10,
    sensacion: 17,
    lluvia: 0,
    probLluvia: 0,
    nubesBajas: 10,
    visibilidad: 30000,
    uv: 4,
    polvo: 0,
    aod: 0.08,
  };
  const normal = { toleranciaViento: 'media', sensibleCalima: false } as const;

  it('da una nota muy alta a un día seco, templado y despejado', () => {
    expect(puntuarSenderismo(diaDeMonte, normal).total).toBeGreaterThanOrEqual(95);
  });

  it('los pesos suman 1', () => {
    expect(Object.values(PESOS_MONTE).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('la lluvia hunde la nota, caiga ya o sea muy probable', () => {
    const seco = puntuarSenderismo(diaDeMonte, normal).total;
    expect(puntuarSenderismo({ ...diaDeMonte, lluvia: 4 }, normal).total).toBeLessThan(seco - 25);
    expect(puntuarSenderismo({ ...diaDeMonte, probLluvia: 90 }, normal).total).toBeLessThan(
      seco - 15,
    );
  });

  it('penaliza tanto el frío como el calor', () => {
    const templado = puntuarSenderismo(diaDeMonte, normal).factores.temperatura;
    const frio = puntuarSenderismo({ ...diaDeMonte, sensacion: 2 }, normal).factores.temperatura;
    const calor = puntuarSenderismo({ ...diaDeMonte, sensacion: 31 }, normal).factores.temperatura;
    expect(frio).toBeLessThan(templado);
    expect(calor).toBeLessThan(templado);
  });

  it('las nubes bajas y la niebla restan visibilidad', () => {
    const cubierto = puntuarSenderismo({ ...diaDeMonte, nubesBajas: 100 }, normal).factores
      .visibilidad;
    const conNiebla = puntuarSenderismo(
      { ...diaDeMonte, nubesBajas: 100, visibilidad: 300 },
      normal,
    ).factores.visibilidad;
    expect(cubierto).toBeLessThan(0.5);
    expect(conNiebla).toBeLessThan(cubierto);
  });

  it('se mantiene entre 0 y 100 y respeta el tope de calima para sensibles', () => {
    const temporal: DatosMonte = {
      viento: 90,
      rachas: 130,
      sensacion: -5,
      lluvia: 20,
      probLluvia: 100,
      nubesBajas: 100,
      visibilidad: 50,
      uv: 12,
      polvo: 900,
      aod: 2,
    };
    expect(puntuarSenderismo(temporal, normal).total).toBeGreaterThanOrEqual(0);
    expect(
      puntuarSenderismo(
        { ...diaDeMonte, polvo: 400, aod: 1.2 },
        { ...normal, sensibleCalima: true },
      ).total,
    ).toBeLessThanOrEqual(45);
  });
});

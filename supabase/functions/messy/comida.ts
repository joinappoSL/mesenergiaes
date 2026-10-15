// «¡Hora de comer!»: cada día activo a la hora de comer (15:00) Messy manda al
// grupo la gráfica del mes con el acumulado, el ritmo del objetivo y la
// proyección. Solo cifras del equipo: ningún dato de clientes.
import { admin, leerConfig, mensajeDeError, type Progreso } from './entorno.ts';
import { graficaMes, type DiaMes } from './grafica.ts';
import { enviarImagen } from './whapi.ts';

interface EstadisticasMes {
  hoy: string;
  hora: string;
  dias: DiaMes[];
  reservas_hoy: number;
  firmadas_mes: number;
  hora_punta: number | null;
  progreso: Progreso;
}

interface Informe {
  id: number;
  tipo: 'comida';
  clave: string;
  intentos: number;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DESPEDIDAS = [
  '¡Buen provecho y a por la tarde! 💪',
  '¡Recargad pilas, que la tarde es nuestra! ⚡',
  '¡A comer bien, que luego toca apretar! 🔥',
  '¡Buen provecho, equipo! La tarde la petamos 🚀',
];

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export async function informeComida(): Promise<{ texto: string; png: Uint8Array }> {
  const { data, error } = await admin.rpc('messy_estadisticas_mes', { p_fecha: null });
  if (error) throw error;
  const e = data as EstadisticasMes;
  const p = e.progreso;

  const png = await graficaMes({
    hoy: e.hoy,
    hora: e.hora,
    dias: e.dias,
    objetivo: p.objetivo,
    llevamos: p.llevamos,
    ajuste: p.ajuste,
    quedan: p.quedan,
    pctHecho: p.pct_hecho,
    firmadasMes: e.firmadas_mes,
    horaPunta: e.hora_punta,
  });

  const transcurridos = Math.max(1, e.dias.findIndex((x) => x.dia === e.hoy) + 1);
  const proyeccion = Math.round((p.llevamos / transcurridos) * e.dias.length);
  const mes = MESES[Number(e.hoy.slice(5, 7)) - 1];
  const lineas = [
    `🍽️ *¡Hora de comer, equipo!* Así vamos en ${mes} 📊`,
    '',
    p.quedan
      ? `🎯 Llevamos *${p.llevamos}/${p.objetivo}* · quedan *${p.quedan}* (${p.pct_quedan} %)`
      : `🏆 *¡Objetivo cumplido!* Llevamos *${p.llevamos}/${p.objetivo}*`,
    `☀️ Hoy van *${plural(e.reservas_hoy, 'reserva de plaza', 'reservas de plaza')}*`,
    proyeccion >= p.objetivo
      ? `📈 A este ritmo cerramos el mes con *~${proyeccion}*: ¡por encima del objetivo! 🏆`
      : `📈 A este ritmo cerramos el mes con *~${proyeccion}*: faltarían ${p.objetivo - proyeccion}, ¡a apretar por la tarde!`,
    `✍️ Vamos *${plural(e.firmadas_mes, 'firmada', 'firmadas')}* este mes`,
    '',
    DESPEDIDAS[new Date().getDate() % DESPEDIDAS.length],
  ];
  return { texto: lineas.join('\n'), png };
}

async function cerrar(id: number, cambios: Record<string, unknown>) {
  const { error } = await admin.from('messy_informes').update(cambios).eq('id', id);
  if (error) console.error('Messy: no se ha podido actualizar el informe', id, error.message);
}

export async function procesarInformes(): Promise<{ procesados: number }> {
  const { data, error } = await admin.rpc('messy_reclamar_informes');
  if (error) throw error;
  const lista = (data ?? []) as Informe[];
  if (!lista.length) return { procesados: 0 };

  const cfg = await leerConfig();
  for (const r of lista) {
    try {
      if (!cfg.activo || !cfg.grupo_chat_id) {
        await cerrar(r.id, { estado: 'descartado', error: 'Messy está en pausa o no tiene grupo configurado' });
        continue;
      }
      const { texto, png } = await informeComida();
      await enviarImagen(cfg.grupo_chat_id, png, texto);
      await cerrar(r.id, { estado: 'enviado', mensaje: texto, error: null });
    } catch (e) {
      const msg = mensajeDeError(e);
      console.error(`Messy: fallo en ${r.clave}`, msg);
      await cerrar(r.id, { estado: r.intentos >= 5 ? 'error' : 'pendiente', error: msg.slice(0, 500) });
    }
  }
  return { procesados: lista.length };
}

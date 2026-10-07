import { useMemo, useRef, useState, useCallback } from 'react';
import { TIPOS, generarEjercicio, corregir } from '@/tools/entera-binaria/domain/generador.js';
import Ejercicio from '@/tools/entera-binaria/components/Ejercicio.jsx';
import Retroalimentacion from '@/tools/entera-binaria/components/Retroalimentacion.jsx';
import { respuestaLista, respuestaParaCorregir } from '@/tools/entera-binaria/components/ControlRespuesta.jsx';
import Segmented from '@/ui/Segmented.jsx';
import Toast from '@/ui/Toast.jsx';
import { filtrar, alCambiar, propsEntero } from '@/shared/campos.js';
import { useProgress } from '@/app/ProgressContext.jsx';
import { hrefTopic } from '@/app/router.js';
import '@/tools/entera-binaria/practica.css';

const TEMA = 'entera-binaria';
const ETIQUETAS = {
  modelar: 'Plantear una condición', factible: '¿Es factible?', valorZ: 'Calcular Z',
  enumeracion: 'Combinaciones factibles', optimo: 'Elegir el óptimo', trampa: 'Costo mínimo', aditivo: 'Método aditivo',
};
const OPCIONES = [{ id: 'todos', label: 'Todos' }, ...TIPOS.map((t) => ({ id: t, label: ETIQUETAS[t] }))];
const semillaNueva = () => Math.floor(Math.random() * 9000) + 1000;

export default function Practica() {
  const { studied, toggle } = useProgress();
  const [modo, setModo] = useState('todos');
  const [rot, setRot] = useState(0); // posición en la rotación de «Todos»
  const [semilla, setSemilla] = useState(semillaNueva);
  const [resp, setResp] = useState(undefined);
  const [resultado, setResultado] = useState(null);
  const [sesion, setSesion] = useState({ a: 0, b: 0 });
  const [entradaSemilla, setEntradaSemilla] = useState('');
  const [aviso, setAviso] = useState('');
  const marcado = useRef(false);
  const limpiarAviso = useCallback(() => setAviso(''), []);

  const tipo = modo === 'todos' ? TIPOS[rot % TIPOS.length] : modo;
  const ej = useMemo(() => generarEjercicio(tipo, semilla), [tipo, semilla]);

  const limpiar = () => { setResp(undefined); setResultado(null); };
  const otro = () => {
    if (modo === 'todos') setRot((r) => r + 1);
    setSemilla(semillaNueva());
    limpiar();
  };
  const cambiarModo = (m) => { setModo(m); setSemilla(semillaNueva()); limpiar(); };
  const usarSemilla = (ev) => {
    ev.preventDefault();
    const s = Number(entradaSemilla.trim());
    if (!Number.isInteger(s) || s < 1 || s > 999999999) { setAviso('Escribe una semilla entera entre 1 y 999999999.'); return; }
    setSemilla(s); limpiar(); setEntradaSemilla('');
  };

  const puedeRevisar = respuestaLista(ej.entrada, resp);
  const revisar = () => {
    if (!puedeRevisar || resultado) return;
    const r = corregir(ej, respuestaParaCorregir(ej.entrada, resp));
    setResultado(r);
    setSesion((p) => ({ a: p.a + (r.correcta ? 1 : 0), b: p.b + 1 }));
    if (r.correcta && !marcado.current) {
      marcado.current = true;
      if (!studied.has(TEMA)) { toggle(TEMA); setAviso('Tema marcado como estudiado.'); }
    }
  };

  return (
    <div className="pb">
      <div className="pb-tipos">
        <Segmented options={OPCIONES} value={modo} onChange={cambiarModo} label="Tipo de ejercicio" />
      </div>
      <div className="pb-barra">
        <form className="inline-field" onSubmit={usarSemilla}>
          <label htmlFor="pb-semilla">Repetir semilla</label>
          <input id="pb-semilla" {...propsEntero} value={entradaSemilla} onChange={alCambiar(filtrar.semilla, setEntradaSemilla)} placeholder="4821" />
          <button type="submit" className="btn btn--sm">Ir</button>
        </form>
        <span className="pb-sesion" aria-live="polite">Correctas: {sesion.a} de {sesion.b}</span>
      </div>

      <Ejercicio
        key={ej.id}
        ej={ej}
        etiqueta={ETIQUETAS[ej.tipo]}
        resp={resp}
        onChange={setResp}
        bloqueado={!!resultado}
        puedeRevisar={puedeRevisar}
        onRevisar={revisar}
      >
        <div className="pb-acciones">
          <button type="button" className="btn btn--primary" disabled={!puedeRevisar || !!resultado} onClick={revisar}>Revisar</button>
          {resultado && <button type="button" className="btn" onClick={limpiar}>Intentar de nuevo</button>}
          <button type="button" className="btn" onClick={otro}>Otro ejercicio</button>
        </div>
        {resultado && <Retroalimentacion ej={ej} resultado={resultado} />}
      </Ejercicio>

      <p className="pb-enlaces">
        <span>¿Quieres comprobarlo con tu propio modelo?</span>
        <a href={hrefTopic(TEMA, 'resuelve')}>Ve a Resuelve el tuyo</a>
        <span>Repasa el método en</span>
        <a href={hrefTopic(TEMA, 'paso')}>Paso a paso</a>
      </p>
      <Toast message={aviso} onDone={limpiarAviso} />
    </div>
  );
}

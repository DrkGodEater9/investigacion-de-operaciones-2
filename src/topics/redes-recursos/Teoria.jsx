import { Article, Section, Callout, Figure, Formula } from '@/ui/Article.jsx';
import { hrefTopic } from '@/app/router.js';
import { compilar, cpm } from '@/tools/recursos/domain/cpm.js';
import { nivelar } from '@/tools/recursos/domain/nivelar.js';
import { asignar } from '@/tools/recursos/domain/asignar.js';
import { EJEMPLOS } from '@/tools/recursos/domain/ejemplos.js';
import Cronograma, { Histograma } from '@/tools/recursos/components/Graficos.jsx';
import { Leyenda, TablaActividades } from '@/tools/recursos/components/Piezas.jsx';
import '@/tools/recursos/recursos.css';

/* Los dibujos salen del mismo dominio que usan las otras pestañas: los números no se escriben a mano. */
const E1 = EJEMPLOS[0].modelo; // bodega: nivelar
const E2 = EJEMPLOS[1].modelo; // taller: recursos limitados
const red1 = compilar(E1);
const base1 = cpm(red1);
const niv = nivelar(red1);
const red2 = compilar(E2);
const base2 = cpm(red2);
const asig = asignar(red2, { regla: 'holgura' });
const asigLF = asignar(red2, { regla: 'lf' });

export default function Teoria() {
  return (
    <Article>
      <Section title="El problema">
        <p>
          El método de la ruta crítica calcula cuándo puede empezar cada actividad suponiendo que los recursos (obreros, máquinas, dinero) alcanzan para todo lo que ocurre al mismo tiempo. En la práctica no siempre es así. Este tema responde dos preguntas con el mismo cronograma:
        </p>
        <ul className="defs">
          <li><strong>Nivelación:</strong> hay recursos suficientes en total, pero el consumo sube y baja mucho. Se mueven actividades no críticas dentro de su holgura para emparejar el consumo, sin alargar el proyecto.</li>
          <li><strong>Asignación con recursos limitados:</strong> hay un límite que no se puede pasar en ningún período. Si no cabe, una actividad espera, y el proyecto puede durar más.</li>
        </ul>
        <p>
          Se necesitan los tiempos del tema <a href={hrefTopic('redes-tiempos')}>3.2 Tiempos y ruta crítica</a>: comienzo temprano (ES), comienzo tardío (LS) y holgura total = LS − ES.
        </p>
      </Section>

      <Section title="Gantt e histograma de recursos">
        <p>
          Cada actividad tiene una duración <em>d</em>, predecesoras y un requerimiento de recurso por período <em>r</em>. Si empieza en el tiempo <em>s</em>, ocupa los períodos <em>s</em> + 1, …, <em>s</em> + <em>d</em> (el período <em>t</em> es el intervalo de tiempo (<em>t</em> − 1, <em>t</em>]). El <strong>histograma</strong> suma, período a período, lo que consumen las actividades en curso:
        </p>
        <Formula>uso(<em>t</em>) = Σ <em>r</em><sub><em>i</em></sub> sobre las actividades <em>i</em> en curso en el período <em>t</em></Formula>
        <p>
          Ejemplo: seis actividades de un taller comparten una cuadrilla de 9 obreros. Cada una usa los obreros indicados en cada período que dura.
        </p>
        <TablaActividades red={red2} base={base2} />
        <p>
          La ruta crítica dura {base2.T} períodos (actividades B y F). Con todo en su comienzo temprano, el consumo por período es <strong>12, 12, 12, 8, 7, 7, 7, 3</strong>: en los períodos 1, 2 y 3 se piden 12 obreros y solo hay 9. Esos tres períodos son los <strong>picos</strong> sobre el límite.
        </p>
        <Figure caption="Figura 1. Diagrama de Gantt con los comienzos tempranos (arriba) e histograma de obreros (abajo). Las barras rojas superan el límite de 9. Las actividades negras son críticas; las rayadas en gris muestran su holgura.">
          <div className="rc-fig">
            <Leyenda />
            <Cronograma red={red2} base={base2} starts={base2.ES} horizonte={base2.T} />
          </div>
        </Figure>
      </Section>

      <Section title="Nivelación de recursos">
        <p>
          Se mueven actividades <em>no críticas</em> dentro de su holgura. Solo se acepta un movimiento si no sube el pico de consumo. Mientras cada una empiece después de que terminen sus predecesoras y termine antes de que empiecen sus sucesoras, el proyecto sigue durando lo mismo.
        </p>
        <ol>
          <li>Se parte del cronograma temprano.</li>
          <li>Se recorren las actividades de atrás hacia adelante. Para cada una se calcula su ventana de comienzos posibles.</li>
          <li>Se mide la carga que ya existe en los períodos que ocuparía en cada comienzo posible y se coloca donde es menor (si no mejora, se queda).</li>
          <li>Se repite hasta que una pasada completa no mueva nada.</li>
        </ol>
        <p>
          Ejemplo (bodega): siete actividades con una cuadrilla de obreros. El cronograma temprano dura {base1.T} períodos y pide 11, 9, 5, 4, 2, 2, 1 obreros: un pico de 11 al principio y casi nada al final. Varias actividades tienen holgura (entre otras B, F y G). Al nivelar se mueven B (de 0 a 4), F (de 4 a 5) y G (de 1 a 6): el consumo queda en 6, 6, 5, 4, 6, 2, 5, con pico 6 y la misma duración de {niv.T} períodos.
        </p>
        <Figure caption="Figura 2. Histograma de obreros de la bodega antes (arriba) y después de nivelar (abajo). La duración no cambia; el pico baja de 11 a 6.">
          <div className="rc-fig">
            <p className="rc-nota">Antes: cronograma temprano</p>
            <Histograma red={red1} starts={base1.ES} k={0} horizonte={base1.T} titulo="Antes de nivelar" />
            <p className="rc-nota">Después de nivelar</p>
            <Histograma red={red1} starts={niv.starts} k={0} horizonte={base1.T} titulo="Después de nivelar" />
          </div>
        </Figure>
        <Callout tone="ojo" title="La nivelación no mira el límite">
          Nivelar nunca sube el pico y suele bajarlo, pero no garantiza quedar por debajo de un límite. Si después de nivelar el consumo sigue pasando el límite, hace falta la asignación con recursos limitados (que sí puede alargar el proyecto).
        </Callout>
      </Section>

      <Section title="Asignación con recursos limitados">
        <p>
          Aquí el límite es duro. El método avanza período por período:
        </p>
        <ol>
          <li><strong>Elegibles:</strong> las actividades sin programar cuyas predecesoras ya terminaron.</li>
          <li><strong>Prioridad:</strong> se ordenan con una regla. La más usada es la <strong>menor holgura total</strong> (la más urgente primero). Otras: menor LS, menor LF, mayor duración, mayor demanda.</li>
          <li><strong>Decisión:</strong> en ese orden, cada una empieza si cabe, junto con las que ya están en curso, en todos los recursos. Si no cabe, se <strong>retrasa</strong> y se vuelve a intentar en el período siguiente.</li>
          <li>La duración resultante es la mayor terminación.</li>
        </ol>
        <Callout tone="regla" title="Desempate explícito">
          Si dos actividades empatan en la regla, se desempata por menor LS, luego por menor holgura y por último por el orden de la tabla. Así el resultado siempre es el mismo.
        </Callout>
        <p>
          Ejemplo (taller, límite 9). En el período 1 son elegibles A, B y C. Por holgura: B (0), A (1) y C (1); A y C empatan en holgura y en LS, y gana A por el orden de la tabla. B usa 4 y A 5: suman 9, caben. C necesita 3 más: 9 + 3 = 12 &gt; 9, se retrasa. C solo cabe cuando termina A, en el período 4. El resto se encadena (F, D y E) y el proyecto termina en el período <strong>{asig.T}</strong> en vez de {base2.T}.
        </p>
        <Figure caption={`Figura 3. Taller con 9 obreros y la regla de menor holgura: el consumo nunca pasa de 9 y el proyecto dura ${asig.T} períodos (sin límite duraba ${base2.T}). Las líneas punteadas muestran dónde empezaban las actividades antes.`}>
          <div className="rc-fig">
            <Cronograma red={red2} base={base2} starts={asig.starts} fantasma={base2.ES} horizonte={asig.T} />
          </div>
        </Figure>
        <Callout tone="ojo" title="La regla cambia el resultado">
          El método no garantiza la duración mínima. En el mismo taller, la regla de menor LF da {asigLF.T} períodos en vez de {asig.T}. La duración nunca baja de la cota inferior: la mayor entre la ruta crítica y el trabajo total entre el límite (Σ <em>d</em> · <em>r</em> ÷ límite, redondeado hacia arriba). Aquí la cota es {asig.cota}.
        </Callout>
      </Section>

      <Section title="Casos especiales">
        <ul className="defs">
          <li><strong>Una actividad que no cabe sola:</strong> si <em>r</em> es mayor que el límite, nunca se podrá programar; el problema es infactible. Hay que subir el límite o dividir la actividad.</li>
          <li><strong>Varios recursos:</strong> una actividad empieza solo si cabe en todos a la vez; basta que uno falle para que espere.</li>
          <li><strong>Sin picos:</strong> si el cronograma temprano ya respeta el límite, no se mueve nada y la duración no cambia.</li>
        </ul>
      </Section>

      <Section title="Errores frecuentes">
        <ol>
          <li><strong>Mover una actividad crítica.</strong> Una actividad con holgura 0 no se puede mover sin alargar el proyecto.</li>
          <li><strong>Usar la holgura de dos actividades seguidas a la vez.</strong> La holgura total se comparte con las que van en cadena; si mueves una, revisa que la siguiente siga cabiendo en su ventana.</li>
          <li><strong>Contar el período donde el consumo es igual al límite como pico.</strong> Solo se pasa del límite cuando el consumo es mayor.</li>
          <li><strong>Suponer que el límite no alarga el proyecto.</strong> Si el recurso es un cuello de botella, la duración sube aunque la ruta crítica sea corta.</li>
        </ol>
      </Section>

      <Section title="Fuentes y notación">
        <p>
          Esta pestaña sigue el método clásico de nivelación y de asignación por períodos con prioridad por holgura (Taha, <em>Investigación de operaciones</em>, 7.ª ed., administración de proyectos con PERT-CPM; Hillier y Lieberman, <em>Introducción a la investigación de operaciones</em>, 7.ª ed.). Las reglas de prioridad y la notación (ES, EF, LS, LF) están en un solo lugar del código y se ajustan con facilidad al material del curso.
        </p>
      </Section>

      <Section title="Pruébalo">
        <ul className="defs">
          <li><a href={hrefTopic('redes-recursos', 'resuelve')}>Resuelve el tuyo</a>: ingresas actividades y recursos y ves el histograma antes y después.</li>
          <li><a href={hrefTopic('redes-recursos', 'paso')}>Paso a paso</a>: ves la nivelación y la asignación avanzar período por período.</li>
          <li><a href={hrefTopic('redes-recursos', 'practica')}>Práctica</a>: ejercicios con corrección.</li>
        </ul>
      </Section>
    </Article>
  );
}

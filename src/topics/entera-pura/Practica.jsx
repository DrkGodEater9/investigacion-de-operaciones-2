import { useState, useMemo } from 'react';
import { generateExercise, gradeExercise } from '@/tools/entera/domain/ejercicios.js';
import Segmented from '@/ui/Segmented.jsx';
import '@/tools/entera/solver.css';

const SERIF = "'STIX Two Text', 'Times New Roman', serif";

const EXERCISE_TYPES = [
  { id: 'A', label: 'A. Redondear o no' },
  { id: 'B', label: 'B. Completar el árbol' },
  { id: 'C', label: 'C. Modelado en texto' },
  { id: 'D', label: 'D. Preguntas teóricas' },
];

export default function Practica() {
  const [activeType, setActiveType] = useState('A');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 9000) + 1000);

  // Respuestas del usuario
  const [answersA, setAnswersA] = useState({ r1: '', r2: '', isFeasible: null, optX1: '', optX2: '', optZ: '' });
  const [answersB, setAnswersB] = useState({ branchVar: '', leftBranch: '', rightBranch: '', p1Action: '', p2Action: '' });
  const [answersC, setAnswersC] = useState({ optionIndex: null, optX1: '', optX2: '', optZ: '' });
  const [answersD, setAnswersD] = useState({ answer: null });

  // Estado de calificación
  const [feedback, setFeedback] = useState(null);
  const [showSolution, setShowSolution] = useState(false);

  // Generar ejercicio según tipo y semilla
  const exercise = useMemo(() => {
    return generateExercise(activeType, seed);
  }, [activeType, seed]);

  // Cambiar de tipo de ejercicio
  const handleTypeChange = (newType) => {
    setActiveType(newType);
    setFeedback(null);
    setShowSolution(false);
  };

  // Botón «Otro ejercicio»
  const handleNextExercise = () => {
    setSeed(Math.floor(Math.random() * 9000) + 1000);
    setFeedback(null);
    setShowSolution(false);
    setAnswersA({ r1: '', r2: '', isFeasible: null, optX1: '', optX2: '', optZ: '' });
    setAnswersB({ branchVar: '', leftBranch: '', rightBranch: '', p1Action: '', p2Action: '' });
    setAnswersC({ optionIndex: null, optX1: '', optX2: '', optZ: '' });
    setAnswersD({ answer: null });
  };

  // Evaluar respuestas
  const handleCheck = () => {
    let currentAnswers = {};
    if (activeType === 'A') currentAnswers = answersA;
    if (activeType === 'B') currentAnswers = answersB;
    if (activeType === 'C') currentAnswers = answersC;
    if (activeType === 'D') currentAnswers = answersD;

    const result = gradeExercise(exercise, currentAnswers);
    setFeedback(result);
  };

  return (
    <div className="practica-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 0 40px' }}>
      {/* Encabezado */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--rule)',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: '20px', fontWeight: 600, color: 'var(--ink)' }}>
            Práctica con corrección
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
            Ejercicios interactivos con parámetros aleatorios, validación y retroalimentación matemática.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
            Semilla: <strong>{seed}</strong>
          </span>
          <button
            type="button"
            className="btn btn--sm"
            onClick={handleNextExercise}
            title="Genera un nuevo ejercicio con valores distintos"
          >
            Otro ejercicio
          </button>
        </div>
      </div>

      {/* Selector de tipo de ejercicio */}
      <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
        <Segmented
          options={EXERCISE_TYPES}
          value={activeType}
          onChange={handleTypeChange}
          label="Tipo de ejercicio de práctica"
        />
      </div>

      {/* Tarjeta del Ejercicio */}
      <div
        className="practica-card"
        style={{
          border: '1px solid var(--rule)',
          borderRadius: 'var(--radius)',
          background: '#ffffff',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
          <h3 style={{ margin: 0, fontFamily: SERIF, fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>
            {exercise.title}
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>
            {activeType === 'A' && 'Redondeo vs. Óptimo entero'}
            {activeType === 'B' && 'Ramificación y criterios de poda'}
            {activeType === 'C' && 'Traducción de enunciados a modelos IP'}
            {activeType === 'D' && 'Conceptos fundamentales'}
          </span>
        </div>

        {/* ------------------------------------------------------------------
            EJERCICIO TIPO A: Redondear o no
            ------------------------------------------------------------------ */}
        {activeType === 'A' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.5 }}>
              Considera el siguiente modelo de programación lineal entera pura:
            </p>

            <div
              style={{
                background: '#fbfbf9',
                border: '1px solid var(--rule)',
                borderLeft: '3px solid var(--accent)',
                padding: '10px 14px',
                borderRadius: 'var(--radius)',
                fontFamily: SERIF,
                fontSize: '15px',
                lineHeight: 1.5,
              }}
            >
              Maximizar <em>Z</em> = {exercise.model.c[0]}<em>x</em>₁ + {exercise.model.c[1]}<em>x</em>₂
              <br />
              sujeto a:
              <br />
              {exercise.model.constraints[0].a[0]}<em>x</em>₁ + {exercise.model.constraints[0].a[1]}<em>x</em>₂ ≤ {exercise.model.constraints[0].b}
              <br />
              {exercise.model.constraints[1].a[0]}<em>x</em>₁ + {exercise.model.constraints[1].a[1]}<em>x</em>₂ ≤ {exercise.model.constraints[1].b}
              <br />
              <em>x</em>₁, <em>x</em>₂ ≥ 0 y enteras (<em>x</em>ⱼ ∈ ℤ)
            </div>

            <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>
              La solución de la relajación lineal continua es: <em>x</em> = ({exercise.relaxation.x1}; {exercise.relaxation.x2}) con <em>Z</em> = {exercise.relaxation.z}.
            </p>

            {/* Formulario estudiante A */}
            <div style={{ display: 'grid', gap: '14px', borderTop: '1px solid var(--rule)', paddingTop: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, marginBottom: '6px' }}>
                  1. Redondeo de la relajación continua al número entero más cercano:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>(</span>
                  <input
                    type="number"
                    placeholder="x₁"
                    value={answersA.r1}
                    onChange={(e) => setAnswersA({ ...answersA, r1: e.target.value })}
                    style={{ width: '60px', padding: '4px 8px', border: '1px solid var(--rule-strong)', borderRadius: 'var(--radius)' }}
                  />
                  <span>;</span>
                  <input
                    type="number"
                    placeholder="x₂"
                    value={answersA.r2}
                    onChange={(e) => setAnswersA({ ...answersA, r2: e.target.value })}
                    style={{ width: '60px', padding: '4px 8px', border: '1px solid var(--rule-strong)', borderRadius: 'var(--radius)' }}
                  />
                  <span>)</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, marginBottom: '6px' }}>
                  2. ¿El punto redondeado anterior es factible para todas las restricciones?
                </label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="radio"
                      name="isFeasible"
                      checked={answersA.isFeasible === true}
                      onChange={() => setAnswersA({ ...answersA, isFeasible: true })}
                    />
                    Sí, es factible
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="radio"
                      name="isFeasible"
                      checked={answersA.isFeasible === false}
                      onChange={() => setAnswersA({ ...answersA, isFeasible: false })}
                    />
                    No, es infactible
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, marginBottom: '6px' }}>
                  3. Verdadero óptimo entero del problema:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span><em>x</em>* = (</span>
                  <input
                    type="number"
                    placeholder="x₁*"
                    value={answersA.optX1}
                    onChange={(e) => setAnswersA({ ...answersA, optX1: e.target.value })}
                    style={{ width: '60px', padding: '4px 8px', border: '1px solid var(--rule-strong)', borderRadius: 'var(--radius)' }}
                  />
                  <span>;</span>
                  <input
                    type="number"
                    placeholder="x₂*"
                    value={answersA.optX2}
                    onChange={(e) => setAnswersA({ ...answersA, optX2: e.target.value })}
                    style={{ width: '60px', padding: '4px 8px', border: '1px solid var(--rule-strong)', borderRadius: 'var(--radius)' }}
                  />
                  <span>) con <em>Z</em>* =</span>
                  <input
                    type="number"
                    placeholder="Z*"
                    value={answersA.optZ}
                    onChange={(e) => setAnswersA({ ...answersA, optZ: e.target.value })}
                    style={{ width: '70px', padding: '4px 8px', border: '1px solid var(--rule-strong)', borderRadius: 'var(--radius)' }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------
            EJERCICIO TIPO B: Completar el árbol
            ------------------------------------------------------------------ */}
        {activeType === 'B' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.5 }}>
              En el nodo raíz <strong>P0</strong> se resolvió la relajación continua con:
            </p>
            <div
              style={{
                background: '#fbfbf9',
                border: '1px solid var(--rule)',
                borderLeft: '3px solid var(--accent)',
                padding: '10px 14px',
                borderRadius: 'var(--radius)',
                fontFamily: SERIF,
                fontSize: '15px',
              }}
            >
              <em>x</em> = ({exercise.root.x1}; {exercise.root.x2}) · <em>Z</em> = {exercise.root.z}
              <br />
              <small style={{ color: 'var(--muted)', fontFamily: 'var(--ui)' }}>
                Partes fraccionarias: &#123;<em>x</em>₁&#125; = {exercise.root.frac1}, &#123;<em>x</em>₂&#125; = {exercise.root.frac2}
              </small>
            </div>

            <div style={{ display: 'grid', gap: '14px', borderTop: '1px solid var(--rule)', paddingTop: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, marginBottom: '6px' }}>
                  1. Según la regla estándar (mayor parte fraccionaria, desempate menor índice), ¿en cuál variable se debe ramificar?
                </label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="radio"
                      name="branchVar"
                      checked={answersB.branchVar === 'x1'}
                      onChange={() => setAnswersB({ ...answersB, branchVar: 'x1' })}
                    />
                    Variable <em>x</em>₁ (&#123;<em>x</em>₁&#125; = {exercise.root.frac1})
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                      type="radio"
                      name="branchVar"
                      checked={answersB.branchVar === 'x2'}
                      onChange={() => setAnswersB({ ...answersB, branchVar: 'x2' })}
                    />
                    Variable <em>x</em>₂ (&#123;<em>x</em>₂&#125; = {exercise.root.frac2})
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, marginBottom: '6px' }}>
                  2. Escribe las dos restricciones de rama generadas (ej. <code>x1 &lt;= 3</code> y <code>x1 &gt;= 4</code>):
                </label>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Rama izquierda:</span>
                    <input
                      type="text"
                      placeholder="x1 <= 3"
                      value={answersB.leftBranch}
                      onChange={(e) => setAnswersB({ ...answersB, leftBranch: e.target.value })}
                      style={{ width: '110px', padding: '4px 8px', border: '1px solid var(--rule-strong)', borderRadius: 'var(--radius)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Rama derecha:</span>
                    <input
                      type="text"
                      placeholder="x1 >= 4"
                      value={answersB.rightBranch}
                      onChange={(e) => setAnswersB({ ...answersB, rightBranch: e.target.value })}
                      style={{ width: '110px', padding: '4px 8px', border: '1px solid var(--rule-strong)', borderRadius: 'var(--radius)' }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, marginBottom: '6px' }}>
                  3. Acción / criterio de poda para cada nodo hijo:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                  {exercise.children.map((child, idx) => (
                    <div
                      key={child.label}
                      style={{
                        padding: '10px 12px',
                        border: '1px solid var(--rule)',
                        borderRadius: 'var(--radius)',
                        background: '#fafaf8',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: '14px' }}>
                        {child.label} ({child.branch})
                      </span>
                      <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                        Solución: {child.sol}
                      </span>
                      <select
                        value={idx === 0 ? answersB.p1Action : answersB.p2Action}
                        onChange={(e) => {
                          if (idx === 0) setAnswersB({ ...answersB, p1Action: e.target.value });
                          else setAnswersB({ ...answersB, p2Action: e.target.value });
                        }}
                        style={{ width: '100%', height: '30px', fontSize: '13px' }}
                      >
                        <option value="">-- Seleccionar acción --</option>
                        <option value="entera">Entera (nuevo incumbente)</option>
                        <option value="cota">Podado por cota</option>
                        <option value="infactible">Podado por infactibilidad</option>
                        <option value="ramificar">Subproblema abierto (seguir)</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------
            EJERCICIO TIPO C: Modelado en texto
            ------------------------------------------------------------------ */}
        {activeType === 'C' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.55 }}>
              {exercise.story}
            </p>

            <div style={{ display: 'grid', gap: '14px', borderTop: '1px solid var(--rule)', paddingTop: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, marginBottom: '8px' }}>
                  1. Selecciona la formulación matemática correcta:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {exercise.options.map((opt, idx) => (
                    <label
                      key={opt.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '10px 12px',
                        border: '1px solid var(--rule)',
                        borderRadius: 'var(--radius)',
                        background: answersC.optionIndex === idx ? '#f0f4fa' : '#ffffff',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="optionIndex"
                        checked={answersC.optionIndex === idx}
                        onChange={() => setAnswersC({ ...answersC, optionIndex: idx })}
                        style={{ marginTop: '3px' }}
                      />
                      <pre
                        style={{
                          margin: 0,
                          fontFamily: SERIF,
                          fontSize: '13.5px',
                          lineHeight: 1.45,
                          whiteSpace: 'pre-wrap',
                          color: 'var(--ink)',
                        }}
                      >
                        {opt.text}
                      </pre>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, marginBottom: '6px' }}>
                  2. Solución óptima entera del problema:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span><em>x</em>₁* =</span>
                  <input
                    type="number"
                    placeholder="x₁*"
                    value={answersC.optX1}
                    onChange={(e) => setAnswersC({ ...answersC, optX1: e.target.value })}
                    style={{ width: '60px', padding: '4px 8px', border: '1px solid var(--rule-strong)', borderRadius: 'var(--radius)' }}
                  />
                  <span>, <em>x</em>₂* =</span>
                  <input
                    type="number"
                    placeholder="x₂*"
                    value={answersC.optX2}
                    onChange={(e) => setAnswersC({ ...answersC, optX2: e.target.value })}
                    style={{ width: '60px', padding: '4px 8px', border: '1px solid var(--rule-strong)', borderRadius: 'var(--radius)' }}
                  />
                  <span>con <em>Z</em>* =</span>
                  <input
                    type="number"
                    placeholder="Z*"
                    value={answersC.optZ}
                    onChange={(e) => setAnswersC({ ...answersC, optZ: e.target.value })}
                    style={{ width: '70px', padding: '4px 8px', border: '1px solid var(--rule-strong)', borderRadius: 'var(--radius)' }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------
            EJERCICIO TIPO D: Verdadero o Falso
            ------------------------------------------------------------------ */}
        {activeType === 'D' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                background: '#fbfbf9',
                border: '1px solid var(--rule)',
                borderLeft: '3px solid var(--accent)',
                padding: '14px 18px',
                borderRadius: 'var(--radius)',
                fontFamily: SERIF,
                fontSize: '16px',
                lineHeight: 1.5,
                color: 'var(--ink)',
              }}
            >
              «{exercise.statement}»
            </div>

            <div style={{ display: 'flex', gap: '16px', paddingTop: '6px' }}>
              <button
                type="button"
                className={`btn ${answersD.answer === true ? 'btn--primary' : ''}`}
                onClick={() => setAnswersD({ answer: true })}
                style={{ minWidth: '120px' }}
              >
                Verdadero
              </button>
              <button
                type="button"
                className={`btn ${answersD.answer === false ? 'btn--primary' : ''}`}
                onClick={() => setAnswersD({ answer: false })}
                style={{ minWidth: '120px' }}
              >
                Falso
              </button>
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--rule)' }}>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleCheck}
          >
            Comprobar respuesta
          </button>

          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setShowSolution(!showSolution)}
          >
            {showSolution ? 'Ocultar solución' : 'Ver solución explicada'}
          </button>
        </div>

        {/* Panel de retroalimentación pedagógica */}
        {feedback && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius)',
              border: `1px solid ${feedback.isCorrect ? '#1d3f8f' : '#b3261e'}`,
              background: feedback.isCorrect ? '#f5f7fc' : '#fdf3f2',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontWeight: 600,
                  fontSize: '14px',
                  color: feedback.isCorrect ? '#1d3f8f' : '#b3261e',
                  fontFamily: 'var(--ui)',
                }}
              >
                {feedback.isCorrect ? '¡Respuesta correcta!' : 'Revisa las siguientes observaciones:'}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                Puntaje: {feedback.score} / {feedback.maxScore}
              </span>
            </div>

            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13.5px', lineHeight: 1.5, color: 'var(--ink)' }}>
              {feedback.explanations.map((exp, i) => (
                <li key={i} style={{ marginBottom: '4px' }}>
                  {exp}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Panel con la solución completa explicada si el estudiante la solicita */}
        {showSolution && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--rule)',
              background: '#fcfcfb',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)', fontFamily: SERIF }}>
              Solución detallada del ejercicio:
            </span>
            {activeType === 'A' && (
              <div style={{ fontSize: '13.5px', lineHeight: 1.5, fontFamily: SERIF }}>
                • Relajación continua: <em>x</em> = ({exercise.relaxation.x1}; {exercise.relaxation.x2}) con <em>Z</em> = {exercise.relaxation.z}.
                <br />
                • Entero más cercano: ({exercise.nearestRounding.x1}, {exercise.nearestRounding.x2}).
                <br />
                • Factibilidad del redondeo: {exercise.nearestRounding.isFeasible ? `Factible con Z = ${exercise.nearestRounding.z}, pero subóptimo.` : `Infactible (${exercise.nearestRounding.violatedConstraint.formula}).`}
                <br />
                • Verdadero óptimo entero: <em>x</em>* = ({exercise.optimal.x1}, {exercise.optimal.x2}) con <em>Z</em>* = {exercise.optimal.z}.
              </div>
            )}
            {activeType === 'B' && (
              <div style={{ fontSize: '13.5px', lineHeight: 1.5, fontFamily: SERIF }}>
                • Ramificación: se elige <strong>{exercise.branchVar}</strong> porque tiene mayor parte fraccionaria ({exercise.root[exercise.branchVar === 'x1' ? 'frac1' : 'frac2']}).
                <br />
                • Ramas: {exercise.leftBranch.var} ≤ {exercise.leftBranch.bound} y {exercise.rightBranch.var} ≥ {exercise.rightBranch.bound}.
                <br />
                • Hijos: P1 es <strong>{exercise.children[0].expectedAction}</strong>, P2 es <strong>{exercise.children[1].expectedAction}</strong>.
                <br />
                • Óptimo entero final: <em>x</em>* = ({exercise.optimal.x1}, {exercise.optimal.x2}) con <em>Z</em>* = {exercise.optimal.z}.
              </div>
            )}
            {activeType === 'C' && (
              <div style={{ fontSize: '13.5px', lineHeight: 1.5, fontFamily: SERIF }}>
                • Modelo correcto: Opción {exercise.correctOptionIndex + 1}.
                <br />
                • Óptimo entero: <em>x</em>₁* = {exercise.optimal.x1}, <em>x</em>₂* = {exercise.optimal.x2} con <em>Z</em>* = {exercise.optimal.z}.
              </div>
            )}
            {activeType === 'D' && (
              <div style={{ fontSize: '13.5px', lineHeight: 1.5, fontFamily: SERIF }}>
                • Respuesta: <strong>{exercise.expectedAnswer ? 'Verdadero' : 'Falso'}</strong>.
                <br />
                • Justificación: {exercise.explanation}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useCallback } from 'react';
import { EXAMPLES } from '../domain/examples.js';
import { parseModelFromMarkdown } from '../domain/parser.js';

export function useModel(initialExampleId = 'tema', defaultAllInteger = true) {
  const findExample = (id) => EXAMPLES.find((e) => e.id === id) || EXAMPLES[0];
  const initial = findExample(initialExampleId);

  const [model, setModel] = useState(() => ({
    title: initial.title,
    sense: initial.sense,
    numVars: initial.numVars,
    c: [...initial.c],
    constraints: initial.constraints.map((ct) => ({
      a: [...ct.a],
      op: ct.op,
      b: ct.b,
    })),
    integer: defaultAllInteger
      ? Array(initial.numVars).fill(true)
      : [...initial.integer],
    options: { ...initial.options },
  }));

  const setSense = useCallback((sense) => {
    setModel((m) => ({ ...m, sense }));
  }, []);

  const setNumVars = useCallback((n) => {
    const num = Math.min(4, Math.max(2, n));
    setModel((m) => {
      const currentN = m.numVars;
      if (currentN === num) return m;

      // Ajustar c
      const newC = Array.from({ length: num }, (_, j) => m.c[j] || '0');

      // Ajustar restricciones
      const newCts = m.constraints.map((ct) => ({
        ...ct,
        a: Array.from({ length: num }, (_, j) => ct.a[j] || '0'),
      }));

      // Ajustar integer
      const newInt = Array.from({ length: num }, (_, j) =>
        defaultAllInteger ? true : m.integer[j] !== undefined ? m.integer[j] : true
      );

      return {
        ...m,
        numVars: num,
        c: newC,
        constraints: newCts,
        integer: newInt,
      };
    });
  }, [defaultAllInteger]);

  const setC = useCallback((index, val) => {
    setModel((m) => {
      const newC = [...m.c];
      newC[index] = val;
      return { ...m, c: newC };
    });
  }, []);

  const addConstraint = useCallback(() => {
    setModel((m) => ({
      ...m,
      constraints: [
        ...m.constraints,
        { a: Array(m.numVars).fill('0'), op: '<=', b: '0' },
      ],
    }));
  }, []);

  const removeConstraint = useCallback((index) => {
    setModel((m) => {
      if (m.constraints.length <= 1) return m; // Al menos 1 restricción
      const nextCts = m.constraints.filter((_, i) => i !== index);
      return { ...m, constraints: nextCts };
    });
  }, []);

  const setConstraintA = useCallback((rowIdx, colIdx, val) => {
    setModel((m) => {
      const nextCts = m.constraints.map((ct, i) => {
        if (i !== rowIdx) return ct;
        const newA = [...ct.a];
        newA[colIdx] = val;
        return { ...ct, a: newA };
      });
      return { ...m, constraints: nextCts };
    });
  }, []);

  const setConstraintOp = useCallback((rowIdx, op) => {
    setModel((m) => {
      const nextCts = m.constraints.map((ct, i) => {
        if (i !== rowIdx) return ct;
        return { ...ct, op };
      });
      return { ...m, constraints: nextCts };
    });
  }, []);

  const setConstraintB = useCallback((rowIdx, val) => {
    setModel((m) => {
      const nextCts = m.constraints.map((ct, i) => {
        if (i !== rowIdx) return ct;
        return { ...ct, b: val };
      });
      return { ...m, constraints: nextCts };
    });
  }, []);

  const setInteger = useCallback((varIdx, isInt) => {
    if (defaultAllInteger) return; // En entera pura no se desmarca
    setModel((m) => {
      const nextInt = [...m.integer];
      nextInt[varIdx] = isInt;
      return { ...m, integer: nextInt };
    });
  }, [defaultAllInteger]);

  const setOptions = useCallback((newOpts) => {
    setModel((m) => ({
      ...m,
      options: { ...m.options, ...newOpts },
    }));
  }, []);

  const loadExample = useCallback((exampleId) => {
    const ex = findExample(exampleId);
    setModel({
      title: ex.title,
      sense: ex.sense,
      numVars: ex.numVars,
      c: [...ex.c],
      constraints: ex.constraints.map((ct) => ({
        a: [...ct.a],
        op: ct.op,
        b: ct.b,
      })),
      integer: defaultAllInteger
        ? Array(ex.numVars).fill(true)
        : [...ex.integer],
      options: { ...ex.options },
    });
  }, [defaultAllInteger]);

  const loadFromMarkdown = useCallback((text) => {
    const parsed = parseModelFromMarkdown(text);
    if (!parsed) return false;
    setModel({
      title: 'Modelo importado',
      sense: parsed.sense,
      numVars: parsed.numVars,
      c: [...parsed.c],
      constraints: parsed.constraints.map((ct) => ({
        a: [...ct.a],
        op: ct.op,
        b: ct.b,
      })),
      integer: defaultAllInteger
        ? Array(parsed.numVars).fill(true)
        : [...parsed.integer],
      options: {
        branchRule: 'mostFractional',
        childOrder: 'bestZ',
        pruneWithFloor: true,
      },
    });
    return true;
  }, [defaultAllInteger]);

  return {
    model,
    setSense,
    setNumVars,
    setC,
    addConstraint,
    removeConstraint,
    setConstraintA,
    setConstraintOp,
    setConstraintB,
    setInteger,
    setOptions,
    loadExample,
    loadFromMarkdown,
  };
}

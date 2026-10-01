import { memo } from 'react';
import { SERIF } from './theme.js';

/** Flecha de actividad (continua) o ficticia (discontinua) con su etiqueta. */
function ActivityArrow({ geometry, kind, name, duration, color, width, showDummyLabel, dummyLabel, hovered, onEnter, onLeave }) {
  const { d, head, label } = geometry;
  const dummy = kind === 'dummy';
  return (
    <g className={'arrow' + (hovered ? ' is-hover' : '')} onPointerEnter={onEnter} onPointerLeave={onLeave}>
      <path d={d} fill="none" stroke="transparent" strokeWidth="14" data-ui />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={dummy ? '6 4' : undefined}
        strokeLinecap="butt"
      />
      <path d={head} fill={color} stroke={color} strokeWidth="0.6" strokeLinejoin="miter" />
      {!dummy && (
        <>
          <text
            x={label.x}
            y={label.y - 9}
            textAnchor="middle"
            fontFamily={SERIF}
            fontSize="15"
            fill={color}
            stroke="#fff"
            strokeWidth="4"
            paintOrder="stroke"
            strokeLinejoin="round"
          >
            {name}
          </text>
          {duration != null && (
            <text
              x={label.x}
              y={label.y + 17}
              textAnchor="middle"
              fontFamily={SERIF}
              fontSize="12.5"
              fill={color}
              stroke="#fff"
              strokeWidth="4"
              paintOrder="stroke"
              strokeLinejoin="round"
            >
              {duration}
            </text>
          )}
        </>
      )}
      {dummy && showDummyLabel && (
        <text x={label.x} y={label.y - 7} textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontSize="11" fill={color} stroke="#fff" strokeWidth="3" paintOrder="stroke">
          {dummyLabel}
        </text>
      )}
    </g>
  );
}

export default memo(ActivityArrow);

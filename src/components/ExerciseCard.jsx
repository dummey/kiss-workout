import React from 'react'

export default function ExerciseCard({ ex, exIdx, sessionDate, onUpdate }) {
  return (
    <div className={'card' + (ex.tier === 'T1' ? ' t1-highlight' : '')}>
      <div className="card-head">
        <div className="card-name">{ex.name}</div>
        {ex.tier && <span className={'tier-badge tier-' + ex.tier}>{ex.tier}</span>}
      </div>
      <div className="card-tags">
        {ex.setup && <span className="tag setup">{ex.setup}</span>}
        {ex.superset && <span className="tag ss">{ex.superset}</span>}
        {ex.muscle && ex.muscle.map(m => (
          <span key={m} className="tag muscle">{m}</span>
        ))}
      </div>
      <div className="card-footer">
        <div className="edit-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              type="text"
              className="edit-input"
              placeholder="Weight"
              value={ex.weight}
              onChange={e => onUpdate(sessionDate, exIdx, 'weight', e.target.value)}
            />
            <div className="edit-lbl">Weight</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              type="text"
              className="edit-input"
              placeholder="Reps"
              value={ex.reps}
              onChange={e => onUpdate(sessionDate, exIdx, 'reps', e.target.value)}
            />
            <div className="edit-lbl">Reps</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              type="text"
              className="edit-input"
              placeholder="Sets"
              value={ex.sets || ''}
              onChange={e => onUpdate(sessionDate, exIdx, 'sets', e.target.value)}
            />
            <div className="edit-lbl">Sets</div>
          </div>
        </div>
      </div>
    </div>
  )
}

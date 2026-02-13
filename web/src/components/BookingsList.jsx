import React from 'react'

export default function BookingsList({ bookings = [], onCancel }){
  if(!bookings || bookings.length === 0) return <p className="muted">No bookings yet.</p>
  return (
    <div>
      {bookings.map(b=>{
        const key = b.id || b._localId
        return (
          <div className="booking-item" key={key}>
            <div>
              <strong>{b.name}</strong> — {b.service}
              <div className="muted">{b.date} @ {b.time} • {b.duration} min</div>
            </div>
            <div>
              <button onClick={()=>{ if(confirm('Cancel this booking?')) onCancel(b) }} style={{background:'transparent',color:'#e6eef8'}}>Cancel</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

import React, { useState } from 'react'

export default function BookingForm({ onCreate }){
  const [name, setName] = useState('')
  const [service, setService] = useState('Audio Engineering')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState(60)
  const [notes, setNotes] = useState('')
  const [msg, setMsg] = useState('')

  async function submit(e){
    e.preventDefault()
    setMsg('')
    const payload = { name, service, date, time, duration: Number(duration), notes }
    const res = await onCreate(payload)
    if(res.ok){ setMsg('Booking created!'); setName(''); setDate(''); setTime(''); setNotes(''); setDuration(60) }
    else setMsg(res.error || 'Error')
  }

  return (
    <form onSubmit={submit}>
      <div className="row">
        <label>Name<input value={name} onChange={e=>setName(e.target.value)} required /></label>
        <label>Service
          <select value={service} onChange={e=>setService(e.target.value)}>
            <option>Audio Engineering</option>
            <option>Videography</option>
          </select>
        </label>
      </div>
      <div className="row">
        <label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)} required /></label>
        <label>Time<input type="time" value={time} onChange={e=>setTime(e.target.value)} required /></label>
        <label>Duration (minutes)<input type="number" min="15" value={duration} onChange={e=>setDuration(e.target.value)} required /></label>
      </div>
      <label>Notes<textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} /></label>
      <div className="actions">
        <button type="submit">Request Booking</button>
      </div>
      <div className="muted">{msg}</div>
    </form>
  )
}

import React, { useEffect, useState } from 'react'
import BookingForm from './components/BookingForm'
import BookingsList from './components/BookingsList'

const STORAGE_KEY = 'ee_bookings_v1'

export default function App(){
  const [bookings, setBookings] = useState([])
  const [mode, setMode] = useState('server') // 'server' | 'local'

  useEffect(()=>{
    (async ()=>{
      try{
        const controller = new AbortController();
        const timeout = setTimeout(()=>controller.abort(), 2000);
        const res = await fetch('/api/bookings', { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeout);
        if(!res.ok) throw new Error('no api')
        setMode('server')
      }catch(e){
        setMode('local')
      }
    })()
  },[])

  useEffect(()=>{ load() }, [mode])

  // IntersectionObserver for reveal animations in React app
  useEffect(()=>{
    const obs = new IntersectionObserver((entries)=>{ entries.forEach(en=>{ if(en.isIntersecting) en.target.classList.add('is-visible') }) }, { threshold: 0.15 });
    document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));
    return ()=>obs.disconnect();
  }, [])

  async function load(){
    if(mode === 'server'){
      try{
        const res = await fetch('/api/bookings')
        if(!res.ok) throw new Error('server')
        const data = await res.json()
        setBookings(data)
        return
      }catch(e){
        setMode('local')
      }
    }
    const raw = localStorage.getItem(STORAGE_KEY)
    setBookings(raw ? JSON.parse(raw) : [])
  }

  async function addBooking(b){
    if(mode === 'server'){
      const res = await fetch('/api/bookings', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(b) })
      if(res.ok){ await load(); return { ok:true } }
      const data = await res.json().catch(()=>({ error: 'Unknown' }))
      return { ok:false, error: data.error }
    }
    const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    const _localId = Date.now() + Math.floor(Math.random()*1000)
    arr.push({ ...b, _localId })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
    setBookings(arr)
    return { ok:true }
  }

  async function removeBooking({ id, _localId }){
    if(mode === 'server' && id){
      await fetch(`/api/bookings/${id}`, { method: 'DELETE' })
      await load()
      return
    }
    const arr = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').filter(x=>x._localId !== _localId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
    setBookings(arr)
  }

  return (
    <div>
      <header className="site-header">
        <div className="container">
          <h1>Empyrean Enclave Entertainment</h1>
          <p className="tag">Audio Engineering • Videography • Booking & Scheduling</p>
          <div className="muted" style={{marginTop:8}}>{mode === 'local' ? 'Standalone mode — bookings saved in browser only' : ''}</div>
        </div>
      </header>

      <main className="container">
        <section className="services">
          <div className="card">
            <h2>Audio Engineering</h2>
            <p>Recording, mixing, mastering, studio sessions.</p>
          </div>
          <div className="card">
            <h2>Videography</h2>
            <p>Music videos, live event capture, editing.</p>
          </div>
        </section>

        <section className="booking">
          <h2>Book a Service</h2>
          <BookingForm onCreate={async (b)=>{ return await addBooking(b) }} />
        </section>

        <section className="schedule">
          <h2>Upcoming Bookings</h2>
          <BookingsList bookings={bookings} onCancel={removeBooking} />
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">© Empyrean Enclave Entertainment</div>
      </footer>
    </div>
  )
}

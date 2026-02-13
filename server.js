const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve two MP3 files placed at project root via explicit routes
app.get('/audio/achievements-test3.mp3', (req, res) => {
  res.sendFile(path.join(__dirname, 'Achievements test3.mp3'));
});

app.get('/audio/up-too-late.mp3', (req, res) => {
  res.sendFile(path.join(__dirname, 'Up Too Late.mp3'));
});
function toTimestamp(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}`).getTime();
}

app.get('/api/bookings', (req, res) => {
  const rows = db.prepare('SELECT * FROM bookings ORDER BY date, time').all();
  res.json(rows);
});

app.post('/api/bookings', (req, res) => {
  const { name, service, date, time, duration = 60, notes = '' } = req.body;
  if (!name || !service || !date || !time) return res.status(400).json({ error: 'Missing fields' });

  const newStart = toTimestamp(date, time);
  const newEnd = newStart + duration * 60000;

  const existing = db.prepare('SELECT * FROM bookings WHERE date = ? AND service = ?').all(date, service);
  for (const b of existing) {
    const bStart = toTimestamp(b.date, b.time);
    const bEnd = bStart + (b.duration || 60) * 60000;
    if (!(newEnd <= bStart || newStart >= bEnd)) {
      return res.status(409).json({ error: 'Time conflict with another booking for this service' });
    }
  }

  const stmt = db.prepare('INSERT INTO bookings (name, service, date, time, duration, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const info = stmt.run(name, service, date, time, duration, notes, new Date().toISOString());
  const created = db.prepare('SELECT * FROM bookings WHERE id = ?').get(info.lastInsertRowid);
  res.json(created);
});

app.delete('/api/bookings/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM bookings WHERE id = ?').run(id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

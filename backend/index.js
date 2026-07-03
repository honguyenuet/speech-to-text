require('dotenv').config();
const express = require('express');
const cors = require('cors');

require('./config/passport');
const authRoutes       = require('./routes/auth');
const transcribeRoutes = require('./routes/transcribe');

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth',       authRoutes);
app.use('/api/transcribe', transcribeRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend đang chạy' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server đang chạy tại http://localhost:${PORT}`);
});

//Users/mac/crimemap/backend-express/src/index.js

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');

const reportsRouter = require('./routes/reports');
const adminRouter   = require('./routes/admin');
const authorityRouter = require('./routes/authority');


const app  = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.use('/api/reports', reportsRouter);
app.use('/api/admin',   adminRouter);
app.use('/api/authority', authorityRouter);
app.use('/api/geocode', require('./routes/geocode'));

app.listen(PORT, () => {
  console.log(` Express corriendo en http://localhost:${PORT}`);
});

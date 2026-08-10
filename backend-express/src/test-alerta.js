require('dotenv').config({ path: '../.env' });
const { detectarDispositivoNuevoSospechoso } = require('./services/reputacion');

async function probar() {
  console.log('Probando detectarDispositivoNuevoSospechoso...');
  const hash = require('crypto').createHash('md5').update('prueba_sospechoso_fresco').digest('hex');
  const resultado = await detectarDispositivoNuevoSospechoso(hash);
  console.log('Resultado:', resultado);
  process.exit(0);
}

probar().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
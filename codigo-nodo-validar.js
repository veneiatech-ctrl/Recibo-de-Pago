// Correo donde TÚ recibes la copia de cada recibo.
const MI_CORREO = 'veneiatech@gmail.com';
// Logo que aparece en los correos (debe estar publicado en internet).
const LOGO_URL = 'https://veneiatech.de/logo-veneiatech.png';

const b = $input.first().json.body || {};
for (const k of ['numero', 'cliente', 'pdfBase64']) {
  if (!b[k]) throw new Error('Falta el campo ' + k);
}
const buf = Buffer.from(String(b.pdfBase64), 'base64');
if (buf.length < 500 || buf.subarray(0, 4).toString() !== '%PDF') {
  throw new Error('El archivo recibido no es un PDF válido');
}
if (buf.length > 5 * 1024 * 1024) throw new Error('PDF demasiado grande');

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (n) => {
  try { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: b.moneda || 'EUR' }).format(Number(n) || 0); }
  catch (e) { return (Number(n) || 0).toFixed(2) + ' ' + (b.moneda || ''); }
};
const fecha = b.fecha ? b.fecha.split('-').reverse().join('/') : '';
const servicio = (b.servicio || 'Servicio') + (b.concepto ? ' · ' + b.concepto : '');
const saldo = Number(b.saldo) || 0;
const pagado = (Number(b.previo) || 0) + (Number(b.abono) || 0);
const esPagoTotal = saldo <= 0.004;
const tabla = (filas) => "<table style='border-collapse:collapse;width:100%;font-size:14px'>" +
  filas.filter((r) => r[1]).map((r) => "<tr><td style='padding:6px 12px 6px 0;color:#5B6680;border-bottom:1px solid #E1E5EE'>" + r[0] +
  "</td><td style='padding:6px 0;font-weight:bold;text-align:right;border-bottom:1px solid #E1E5EE'>" + esc(r[1]) + '</td></tr>').join('') + '</table>';
const marco = (contenido) => "<div style='background:#EEF1F7;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#111B30'>" +
  "<div style='max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:10px;overflow:hidden'>" +
  "<table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='background:#03060F'><tr>" +
  "<td style='padding:16px 0 16px 24px;width:52px'><img src='" + LOGO_URL + "' width='44' height='44' alt='Veneiatech' style='display:block;border:0;border-radius:8px'></td>" +
  "<td style='padding:16px 24px 16px 12px;color:#FFFFFF;font-size:18px;font-weight:bold;letter-spacing:2px'>VENEIATECH</td></tr></table>" +
  "<div style='padding:24px'>" + contenido + '</div>' +
  "<div style='padding:14px 24px;background:#F6F7FB;font-size:11px;color:#6A7389'>Veneiatech · Dresden, Alemania · www.veneiatech.de<br>" +
  'Factura no válida para efectos legales fuera de la UE. Conforme al § 19 UStG no se factura IVA (Kleinunternehmer).</div></div></div>';

const filename = String(b.filename || ('Recibo_' + b.numero + '.pdf')).replace(/[^\w.\-À-ÿ]+/g, '_');
const binario = await this.helpers.prepareBinaryData(buf, filename, 'application/pdf');

// ---------- Copia para ti ----------
const clienteEmail = String(b.clienteEmail || '').trim();
const alCliente = b.enviarCliente === true && /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/.test(clienteEmail);
const items = [{
  json: {
    destino: MI_CORREO,
    asunto: (b.tipo || 'Recibo') + ' ' + b.numero + ' · ' + b.cliente + (alCliente ? ' (enviado al cliente)' : ''),
    html: marco("<h2 style='margin:0 0 4px;font-size:20px'>" + esc(b.tipo || 'Recibo') + ' ' + esc(b.numero) + '</h2>' +
      "<p style='margin:0 0 16px;color:#5B6680'>" + esc(fecha) + (alCliente ? ' · Copia enviada a ' + esc(clienteEmail) : ' · No se envió al cliente') + '</p>' +
      tabla([['Cliente', b.cliente], ['Identificación', b.identificacion], ['País', b.pais], ['Dirección', b.direccion], ['Servicio', servicio],
        ['Total del servicio', money(b.total)], ['Ingresó hoy', money(b.abono) + ' (' + (b.pct ?? 0) + ' %)'],
        ['Pagado antes', money(b.previo)], ['Saldo pendiente', money(saldo)], ['Método de pago', b.metodo]])),
    numero: b.numero,
    alCliente
  },
  binary: { data: binario }
}];

// ---------- Mensaje para el cliente ----------
if (alCliente) {
  const nombre = esc(b.cliente);
  const cuerpo = esPagoTotal
    ? "<h2 style='margin:0 0 12px;font-size:20px'>¡Gracias por su pago!</h2>" +
      '<p style="line-height:1.6">Hola ' + nombre + ',</p>' +
      '<p style="line-height:1.6">Hemos recibido su pago de <b>' + money(b.abono) + '</b>. Con él, el servicio <b>' + esc(servicio) + '</b> queda pagado en su totalidad.</p>' +
      '<p style="line-height:1.6">Muchas gracias por confiar en Veneiatech. Ha sido un gusto trabajar en su proyecto. Le adjuntamos su recibo de pago total.</p>' +
      tabla([['Cliente', b.cliente], ['Identificación', b.identificacion], ['Total del servicio', money(b.total)], ['Total pagado', money(pagado)], ['Saldo pendiente', money(0)]]) +
      '<p style="line-height:1.6;margin-top:18px">Si más adelante necesita soporte o tiene un nuevo proyecto en mente, con gusto le ayudamos. Puede responder directamente a este correo.</p>'
    : "<h2 style='margin:0 0 12px;font-size:20px'>Hemos recibido su abono</h2>" +
      '<p style="line-height:1.6">Hola ' + nombre + ',</p>' +
      '<p style="line-height:1.6">Le confirmamos que hemos recibido su abono de <b>' + money(b.abono) + '</b> para el servicio <b>' + esc(servicio) + '</b>. Gracias por su confianza.</p>' +
      '<p style="line-height:1.6">Seguimos trabajando en su proyecto y le mantendremos informado de cada avance. Le adjuntamos su recibo de abono.</p>' +
      tabla([['Cliente', b.cliente], ['Identificación', b.identificacion], ['Total del servicio', money(b.total)], ['Pagado hasta hoy', money(pagado)], ['Saldo pendiente', money(saldo)]]) +
      '<p style="line-height:1.6;margin-top:18px">Si tiene cualquier duda, puede responder directamente a este correo.</p>';
  items.push({
    json: {
      destino: clienteEmail,
      asunto: (esPagoTotal ? '¡Gracias por su pago! Recibo de pago total ' : 'Hemos recibido su abono · Recibo ') + b.numero + ' · Veneiatech',
      html: marco(cuerpo + '<p style="line-height:1.6;margin-top:18px">Atentamente,<br><b>Equipo Veneiatech</b></p>'),
      numero: b.numero,
      alCliente
    },
    binary: { data: binario }
  });
}
return items;

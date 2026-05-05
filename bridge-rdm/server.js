const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const os = require('os');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { print, getPrinters } = require('pdf-to-printer');

dotenv.config({ path: path.join(__dirname, '.env') });

const PORT = Number(process.env.PORT || 3011);
const DEFAULT_PRINTER = (process.env.DYMO_PRINTER_NAME || 'DYMO LABELWRITER 550').trim().toUpperCase();
const DEFAULT_PRESET = (process.env.DYMO_LABEL_PRESET || '100x212').trim().toLowerCase();

const LABEL_PRESETS_MM = {
  '100x212': { width: 54, height: 25.4 },
  '25x54': { width: 54, height: 25.4 },
};

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const mmToPt = (mm) => (mm * 72) / 25.4;
const toText = (value) => (value == null ? '' : String(value).trim());

const normalizeLabel = (label) => ({
  folio: toText(label?.folio),
  fecha: toText(label?.fecha),
  ensamble: toText(label?.ensamble),
  parte: toText(label?.parte).toUpperCase(),
  secuencia: toText(label?.secuencia || '--'),
  defecto: toText(label?.defecto || '--'),
  cantidad: toText(label?.cantidad),
});

const buildSingleLabelPdf = (filePath, label, presetKey) =>
  new Promise((resolve, reject) => {
    const preset = LABEL_PRESETS_MM[presetKey] || LABEL_PRESETS_MM['100x212'];
    const doc = new PDFDocument({
      size: [mmToPt(preset.width), mmToPt(preset.height)],
      margin: 0,
      compress: false,
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const baseX = mmToPt(2);
    let y = mmToPt(1.8);
    const lineGap = mmToPt(3.6);
    const fontSize = 7;

    doc.font('Helvetica').fontSize(fontSize).fillColor('#000000');

    const drawPair = (labelText, valueText) => {
      doc.text(`${labelText}: `, baseX, y, { continued: true });
      doc.font('Helvetica-Bold').text(valueText || '-');
      doc.font('Helvetica');
      y += lineGap;
    };

    const hasEnsamble = !!label.ensamble;
    const hasSecuencia = !!label.secuencia && label.secuencia !== '--' && label.secuencia !== 'N/A';

    drawPair('Folio Reorden', label.folio);
    drawPair('Fecha y Hora', label.fecha);

    if (!hasSecuencia && hasEnsamble) {
      // Caso 1: sin secuencia, con ensamble
      drawPair('Ensamble', label.ensamble);
      drawPair('Parte', label.parte);
      doc.text('Secuencia: ', baseX, y, { continued: true });
      doc.font('Helvetica-Bold').text('--', { continued: true });
      doc.font('Helvetica').text('   Defecto: ', { continued: true });
      doc.font('Helvetica-Bold').text(label.defecto || '--');
      doc.font('Helvetica');
      y += lineGap;
      drawPair('Cantidad', label.cantidad);
    } else if (hasSecuencia && !hasEnsamble) {
      // Caso 2: con secuencia, sin ensamble
      drawPair('Parte', label.parte);
      drawPair('Secuencia', label.secuencia);
      drawPair('Defecto', label.defecto);
      drawPair('Cantidad', label.cantidad);
    } else {
      // Caso 3: con secuencia y con ensamble (o fallback)
      if (hasEnsamble) drawPair('Ensamble', label.ensamble);
      drawPair('Parte', label.parte);
      drawPair('Secuencia', label.secuencia);
      doc.text('Defecto: ', baseX, y, { continued: true });
      doc.font('Helvetica-Bold').text(label.defecto || '--', { continued: true });
      doc.font('Helvetica').text('   Cantidad: ', { continued: true });
      doc.font('Helvetica-Bold').text(label.cantidad || '-');
      doc.font('Helvetica');
      y += lineGap;
    }

    doc.end();

    stream.on('finish', resolve);
    stream.on('error', reject);
  });

app.get('/api/rdm/health', (_req, res) => {
  res.json({ ok: true, service: 'rdm-dymo-bridge' });
});

app.get('/api/rdm/printers', async (_req, res) => {
  try {
    const printers = await getPrinters();
    res.json({ printers });
  } catch (error) {
    res.status(500).json({
      message: 'No fue posible obtener impresoras.',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post('/api/rdm/print', async (req, res) => {
  const labels = Array.isArray(req.body?.labels) ? req.body.labels.map(normalizeLabel) : [];
  const labelPreset = toText(req.body?.labelPreset || DEFAULT_PRESET).toLowerCase();
  const requestedPrinter = toText(req.body?.printerName).toUpperCase();
  const printerName = requestedPrinter || DEFAULT_PRINTER;

  if (labels.length === 0) {
    res.status(400).json({ message: 'labels no puede ir vacio.' });
    return;
  }

  try {
    const printers = await getPrinters();
    const printerNames = printers.map((p) => (p.deviceId || p.name || '').toString().toUpperCase()).filter(Boolean);
    const printerExists = printerNames.some((name) => name === printerName);

    if (!printerExists) {
      res.status(404).json({
        message: `No se encontro la impresora ${printerName}.`,
        availablePrinters: printerNames,
      });
      return;
    }

    let printed = 0;
    for (const label of labels) {
      const tempPdfPath = path.join(
        os.tmpdir(),
        `rdm-label-${Date.now()}-${Math.round(Math.random() * 10000)}.pdf`,
      );

      try {
        await buildSingleLabelPdf(tempPdfPath, label, labelPreset);
        await print(tempPdfPath, {
          printer: printerName,
          scale: 'noscale',
          side: 'simplex',
          copies: 1,
        });
        printed += 1;
      } finally {
        fs.promises.unlink(tempPdfPath).catch(() => {});
      }
    }

    res.json({ ok: true, printed, printerName, labelPreset });
  } catch (error) {
    res.status(500).json({
      message: 'No fue posible imprimir en DYMO.',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.listen(PORT, () => {
  console.log(`RDM bridge activo en http://localhost:${PORT}`);
  console.log(`Impresora predeterminada: ${DEFAULT_PRINTER}`);
  console.log(`Preset por defecto: ${DEFAULT_PRESET}`);
});

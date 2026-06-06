const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const os = require('os');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { print, getPrinters } = require('pdf-to-printer');

// Cuando corre como .exe (pkg), los archivos viven junto al ejecutable
const IS_PKG = !!process.pkg;
const EXE_DIR = IS_PKG ? path.dirname(process.execPath) : __dirname;
const SUMATRA_PATH = IS_PKG
  ? path.join(EXE_DIR, 'SumatraPDF-3.4.6-32.exe')
  : null; // pdf-to-printer usa su ruta interna por defecto

dotenv.config({ path: path.join(EXE_DIR, '.env') });

const PORT = Number(process.env.PORT || 3011);
const DEFAULT_PRINTER_RAW = (process.env.DYMO_PRINTER_NAME || 'DYMO LABELWRITER 550').trim();
const DEFAULT_PRINTER = DEFAULT_PRINTER_RAW.toUpperCase();
const DEFAULT_PRESET = (process.env.DYMO_LABEL_PRESET || '100x212').trim().toLowerCase();

const LABEL_PRESETS_MM = {
  '100x212': { width: 54, height: 25.4 },
  '25x54': { width: 54, height: 25.4 },
};

const BRIDGE_NAME = (process.env.BRIDGE_NAME || 'DYMO Sin Nombre').trim();
const BRIDGE_LOCATION = (process.env.BRIDGE_LOCATION || 'localhost').trim();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const mmToPt = (mm) => (mm * 72) / 25.4;
const toText = (value) => (value == null ? '' : String(value).trim());
const toBool = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'si' || normalized === 'yes';
  }
  return false;
};

const removeDiacritics = (s) => s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s;
const normalizePrinterName = (value) =>
  toText(value)
    .normalize ? removeDiacritics(toText(value)) : toText(value)
;

const compact = (s) =>
  toText(s)
    .replace(/[^0-9A-Za-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const levenshtein = (a, b) => {
  if (!a || !b) return Math.max(a ? a.length : 0, b ? b.length : 0);
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
};

const similarity = (a, b) => {
  const A = compact(removeDiacritics(a || ''));
  const B = compact(removeDiacritics(b || ''));
  if (!A && !B) return 1;
  const dist = levenshtein(A, B);
  const maxLen = Math.max(A.length, B.length) || 1;
  return 1 - dist / maxLen;
};

const resolvePrinterName = (printers, requestedPrinter, fallbackPrinter) => {
  const reqNorm = compact(removeDiacritics(requestedPrinter || ''));
  const fbNorm = compact(removeDiacritics(fallbackPrinter || ''));

  const normalizedPrinters = printers
    .map((printer) => {
      const display = printer?.name || printer?.deviceId || '';
      const norm = compact(removeDiacritics(display));
      return norm ? { original: printer, display, norm } : null;
    })
    .filter(Boolean);

  // exact requested
  const byExactRequested = normalizedPrinters.find((p) => p.norm === reqNorm && reqNorm);
  if (byExactRequested) return { selected: byExactRequested.display, reason: 'exact-requested' };

  // exact fallback
  const byExactFallback = normalizedPrinters.find((p) => p.norm === fbNorm && fbNorm);
  if (byExactFallback) return { selected: byExactFallback.display, reason: 'exact-default' };

  // contains requested
  const byContainsRequested = reqNorm ? normalizedPrinters.find((p) => p.norm.includes(reqNorm)) : null;
  if (byContainsRequested) return { selected: byContainsRequested.display, reason: 'contains-requested' };

  // contains fallback
  const byContainsFallback = fbNorm ? normalizedPrinters.find((p) => p.norm.includes(fbNorm)) : null;
  if (byContainsFallback) return { selected: byContainsFallback.display, reason: 'contains-default' };

  // similarity check (tolerate typos)
  if (reqNorm) {
    let best = null;
    for (const p of normalizedPrinters) {
      const sim = similarity(reqNorm, p.norm);
      if (!best || sim > best.sim) best = { p, sim };
    }
    if (best && best.sim >= 0.7) return { selected: best.p.display, reason: 'similarity-requested' };
  }

  // fallback similarity
  if (fbNorm) {
    let best = null;
    for (const p of normalizedPrinters) {
      const sim = similarity(fbNorm, p.norm);
      if (!best || sim > best.sim) best = { p, sim };
    }
    if (best && best.sim >= 0.7) return { selected: best.p.display, reason: 'similarity-default' };
  }

  const dymoPrinter = normalizedPrinters.find((p) => p.norm.includes('DYMO'));
  if (dymoPrinter) return { selected: dymoPrinter.display, reason: 'dymo-fallback' };

  if (normalizedPrinters.length === 1) return { selected: normalizedPrinters[0].display, reason: 'single-printer-fallback' };

  return { selected: '', reason: 'not-found' };
};

const normalizeLabel = (label) => ({
  folio: toText(label?.folio),
  fecha: toText(label?.fecha),
  ensamble: toText(label?.ensamble),
  parte: toText(label?.parte).toUpperCase(),
  programa: toText(label?.programa),
  secuencia: toText(label?.secuencia || '--'),
  defecto: toText(label?.defecto || '--'),
  cantidad: toText(label?.cantidad),
  porPrograma: toBool(label?.porPrograma),
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

    const splitProgram = (value) => {
      const text = toText(value);
      if (text.length <= 20) {
        return [text, ''];
      }

      return [text.slice(0, 20), text.slice(20)];
    };

    const [programLine1, programLine2] = splitProgram(label.programa);

    const hasEnsamble = !!label.ensamble;
    const hasSecuencia = !!label.secuencia && label.secuencia !== '--' && label.secuencia !== 'N/A';

    if (label.porPrograma) {
      doc.text('Reorden', baseX, y);
      y += lineGap;
      drawPair('Fecha', label.fecha);
      doc.text('Programa: ', baseX, y, { continued: true });
      doc.font('Helvetica-Bold').text(programLine1 || '-');
      doc.font('Helvetica');
      y += lineGap;
      if (programLine2) {
        doc.text(programLine2, baseX, y);
        y += lineGap;
      }
      drawPair('Secuencia', 'Varias');
      doc.text('Defecto: ', baseX, y, { continued: true });
      doc.font('Helvetica-Bold').text(label.defecto || '--', { continued: true });
      doc.font('Helvetica').text('   Cantidad: ', { continued: true });
      doc.font('Helvetica-Bold').text(label.cantidad || '-');
      doc.font('Helvetica');
      y += lineGap;
      doc.text('*PROGRAMA COMPLETO*', baseX, y);
      doc.end();

      stream.on('finish', resolve);
      stream.on('error', reject);
      return;
    }

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

app.get('/api/rdm/info', (_req, res) => {
  res.json({
    name: BRIDGE_NAME,
    port: PORT,
    location: BRIDGE_LOCATION,
    printer: DEFAULT_PRINTER,
    preset: DEFAULT_PRESET,
  });
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
  const requestedPrinter = toText(req.body?.printerName);

  if (labels.length === 0) {
    res.status(400).json({ message: 'labels no puede ir vacio.' });
    return;
  }

  try {
    const printers = await getPrinters();
    const availablePrinters = printers.map((p) => p?.name || p?.deviceId || '');
    const requestedNorm = compact(removeDiacritics(requestedPrinter || ''));
    const defaultNorm = compact(removeDiacritics(DEFAULT_PRINTER || ''));
    const { selected: printerName, reason: printerSelectionReason } = resolvePrinterName(
      printers,
      requestedPrinter,
      DEFAULT_PRINTER,
    );

    console.log('[print] request', {
      labels: labels.length,
      requestedPrinterRaw: requestedPrinter,
      requestedPrinterNorm: requestedNorm,
      defaultPrinterRaw: DEFAULT_PRINTER_RAW,
      defaultPrinterNorm: defaultNorm,
      availablePrinters,
      selectedPrinter: printerName,
      selectionReason: printerSelectionReason,
      bridge: `${BRIDGE_NAME} (${BRIDGE_LOCATION}:${PORT})`,
    });

    if (!printerName) {
      res.status(404).json({
        message: `No se encontro una impresora valida para imprimir.`,
        requestedPrinter: requestedPrinter,
        defaultPrinter: DEFAULT_PRINTER_RAW,
        availablePrinters,
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
          ...(SUMATRA_PATH ? { sumatraPdfPath: SUMATRA_PATH } : {}),
          scale: 'noscale',
          side: 'simplex',
          copies: 1,
        });
        printed += 1;
        console.log('[print] label sent', {
          folio: label.folio,
          parte: label.parte,
          printerName,
          printed,
        });
      } finally {
        fs.promises.unlink(tempPdfPath).catch(() => {});
      }
    }

    res.json({
      ok: true,
      printed,
      printerName,
      requestedPrinter: normalizePrinterName(requestedPrinter),
      labelPreset,
      bridge: {
        name: BRIDGE_NAME,
        location: BRIDGE_LOCATION,
        port: PORT,
      },
      printerSelectionReason,
    });
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
  console.log(`Bridge: ${BRIDGE_NAME}`);

  try {
    const envPath = path.join(EXE_DIR, '.env');
    console.log(`EXE_DIR: ${EXE_DIR}`);
    console.log(`.env existe en EXE_DIR: ${fs.existsSync(envPath)}`);
    console.log(`process.env.BRIDGE_NAME (raw): ${process.env.BRIDGE_NAME}`);
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        console.log('.env contenido:\n' + envContent.split('\n').slice(0, 40).join('\n'));
      } catch (e) {
        console.log('No se pudo leer .env: ' + (e && e.message));
      }
    }
  } catch (e) {
    console.log('Error diagnosticando .env: ' + (e && e.message));
  }
});

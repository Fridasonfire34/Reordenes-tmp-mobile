import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { API_ENDPOINTS, DYMO_ENDPOINTS } from '../config/api';
import { BridgeSelectorModal } from '../components/BridgeSelectorModal';
import { Bridge, getBridgeUrl } from '../utils/bridgeManager';

type ConsultarReordenesScreenProps = {
  onBack: () => void;
};

type ReordenRow = {
  folio: string;
  linea: string;
  ensamble: string;
  numeroParte: string;
  numeroPartePrograma: string;
  secuencia: string;
  materialint: string;
  calibreint: string;
  materialext: string;
  calibreext: string;
  defecto: string;
  causa: string;
  maquina: string;
  cantidad: string;
  comentarios: string;
  estatus: string;
  fecha: string;
  fechaSortMs: number;
  area: string;
  subArea: string;
  balloon: string;
  programa: string;
  tipoReorden: string;
  componente: string;
  turno: string;
  empleado: string;
  planta: string;
};

type PrintLabelData = {
  folio: string;
  fecha: string;
  ensamble: string;
  parte: string;
  programa: string;
  porPrograma: boolean;
  secuencia: string;
  defecto: string;
  cantidad: string;
};

type BridgeInfoResponse = {
  name?: string;
  port?: number;
  location?: string;
  printer?: string;
  preset?: string;
};

type PrintResponse = {
  ok?: boolean;
  printed?: number;
  printerName?: string;
  message?: string;
  details?: string;
  bridge?: {
    name?: string;
    location?: string;
    port?: number;
  };
};

const TARGET_STATUS = 'Pendiente por Programacion';

const getRowBgColor = (estatus: string): string | undefined => {
  const s = estatus.toLowerCase();
  if (s.includes('pendiente por programacion')) return '#ffb151'; // light orange
  if (s.includes('pendiente por ingenieria'))  return '#fff175'; // light yellow
  if (s.includes('completo'))                  return '#78a783'; // light green
  if (s.includes('cancelado'))                 return '#ff6978'; // light red
  if (s.includes('no reprocesar'))             return '#8fb1d4'; // light blue
  return undefined;
};

const GET_REORDENES_URL = API_ENDPOINTS.reorders;
const GET_REORDENES_PENDIENTES_URL = API_ENDPOINTS.reordersPendientes;
const DYMO_PRINT_API_URL = DYMO_ENDPOINTS.print;
const DYMO_LABEL_PRESET = '100x212';

const toText = (value: unknown): string => (value == null ? '' : String(value).trim());
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');

const toNormalized = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const formatDateField = (raw: string): string => {
  if (!raw) return '';
  // Si parece ISO 8601 (ej: 2026-05-14T10:30:00.000Z o 2026-05-14 10:30:00)
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(raw)) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = d.getHours();
      const min = String(d.getMinutes()).padStart(2, '0');
      const ampm = hh >= 12 ? 'PM' : 'AM';
      const h12 = hh % 12 || 12;
      return `${dd}/${mm}/${yyyy} ${h12}:${min} ${ampm}`;
    }
  }
  return raw;
};

const toSortTimestamp = (rawDate: string): number => {
  if (!rawDate) {
    return Number.MAX_SAFE_INTEGER;
  }

  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(rawDate)) {
    const isoDate = new Date(rawDate);
    if (!Number.isNaN(isoDate.getTime())) {
      return isoDate.getTime();
    }
  }

  const match = rawDate.match(
    /^(\d{2})\/(\d{2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i,
  );

  if (match) {
    const [, dd, mm, yyyyOrYY, hhText, minText, ampmText] = match;
    const year = yyyyOrYY.length === 2 ? Number(`20${yyyyOrYY}`) : Number(yyyyOrYY);
    let hour = Number(hhText);
    const minute = Number(minText);

    if (ampmText) {
      const ampm = ampmText.toUpperCase();
      if (ampm === 'PM' && hour < 12) {
        hour += 12;
      }
      if (ampm === 'AM' && hour === 12) {
        hour = 0;
      }
    }

    const parsed = new Date(year, Number(mm) - 1, Number(dd), hour, minute);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  return Number.MAX_SAFE_INTEGER;
};

const extractRows = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    for (const key of [
      'data',
      'rows',
      'items',
      'result',
      'results',
      'reordenes',
      'reorders',
      'records',
    ]) {
      if (Array.isArray(obj[key])) {
        return obj[key] as unknown[];
      }
    }

    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key])) {
        return obj[key] as unknown[];
      }
    }
  }

  return [];
};

const pickText = (record: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const text = toText(record[key]);
    if (text) {
      return text;
    }
  }
  return '';
};

export default function ConsultarReordenesScreen({ onBack }: ConsultarReordenesScreenProps) {
  const [rows, setRows] = useState<ReordenRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [isSendingToDymo, setIsSendingToDymo] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showBridgeSelector, setShowBridgeSelector] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [printLabelData, setPrintLabelData] = useState<PrintLabelData | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [selectedBridgeName, setSelectedBridgeName] = useState('');
  const [activeFilter, setActiveFilter] = useState<'recientes' | 'pendientes'>('recientes');

  const fetchReordenes = useCallback(async (url: string = GET_REORDENES_URL) => {
    setLoading(true);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const serverMessage =
          (payload as { message?: string; error?: string } | null)?.message ||
          (payload as { message?: string; error?: string } | null)?.error ||
          '';
        throw new Error(serverMessage || `Error ${response.status} al consultar.`);
      }

      const mapped = extractRows(payload)
        .filter(item => item && typeof item === 'object')
        .map(item => {
          const r = item as Record<string, unknown>;
          const rawFecha = pickText(r, [
            'Fecha y Hora',
            'fecha', 'Fecha', 'FechaHora', 'fechaHora',
            'captureDateTime', 'CaptureDateTime', 'capture_date_time',
            'fechaCaptura', 'FechaCaptura', 'fecha_captura',
            'createdAt', 'created_at', 'CreatedAt',
            'date', 'Date', 'datetime', 'DateTime', 'timestamp', 'Timestamp',
          ]);

          return {
            folio: pickText(r, ['folio', 'Folio', 'id', 'ID']),
            linea: pickText(r, ['linea', 'Linea', 'Línea']),
            ensamble: pickText(r, ['ensamble', 'Ensamble']),
            numeroParte: pickText(r, ['numeroParte', 'NumeroParte', 'numero_parte', 'Parte', 'Numero de Parte']),
            numeroPartePrograma: [
              pickText(r, ['numeroParte', 'NumeroParte', 'numero_parte', 'Parte', 'Numero de Parte']),
              pickText(r, ['programa', 'Programa', 'program', 'Program']),
            ].filter(Boolean).join(' / '),
            secuencia: pickText(r, ['secuencia', 'Secuencia', 'sequence', 'Sequence']),
            materialint: pickText(r, ['Material Interno', 'materialint', 'MaterialInt', 'material_interno', 'MaterialInterno']),
            calibreint: pickText(r, ['Calibre Interno', 'calibreint', 'CalibreInt', 'calibre_interno', 'CalibreInterno']),
            materialext: pickText(r, ['Material Externo', 'materialext', 'MaterialExt', 'material_externo', 'MaterialExterno']),
            calibreext: pickText(r, ['Calibre Externo', 'calibreext', 'CalibreExt', 'calibre_externo', 'CalibreExterno']),
            defecto: pickText(r, ['defecto', 'Defecto']),
            causa: pickText(r, ['causa', 'Causa']),
            maquina: pickText(r, ['maquina', 'Maquina', 'Máquina']),
            cantidad: pickText(r, ['cantidad', 'Cantidad']),
            comentarios: pickText(r, ['comentarios', 'Comentarios', 'comentario', 'Comentario']),
            estatus: pickText(r, ['estatus', 'Estatus', 'status', 'Status']),
            fecha: formatDateField(rawFecha),
            fechaSortMs: toSortTimestamp(rawFecha),
            area: pickText(r, ['area', 'Area', 'Área']),
            subArea: pickText(r, ['Sub Area', 'subArea', 'SubArea', 'sub_area', 'SubArea']),
            balloon: pickText(r, ['Balloon Number', 'balloon', 'Balloon', 'balloonNumber', 'BalloonNumber', 'balloon_number']),
            programa: pickText(r, ['programa', 'Programa', 'program', 'Program']),
            tipoReorden: pickText(r, ['Tipo Reorden', 'tipoReorden', 'TipoReorden', 'tipo_reorden', 'Tipo']),
            componente: pickText(r, ['componente', 'Componente', 'componentes', 'Componentes']),
            turno: pickText(r, ['turno', 'Turno', 'shift', 'Shift']),
            empleado: pickText(r, ['empleado', 'Empleado', 'employee', 'Employee', 'Usuario', 'usuario']),
            planta: pickText(r, ['planta', 'Planta', 'plant', 'Plant']),
          } as ReordenRow;
        });

      setRows(mapped);
      setSelectedRowIndex(null);
    } catch (error) {
      setRows([]);
      Alert.alert(
        'Consulta no disponible',
        error instanceof Error ? error.message : 'No se pudo cargar la consulta.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReordenes();
  }, [fetchReordenes]);

  const [searchQuery, setSearchQuery] = useState('');

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows
      .filter(row => {
        if (!q) return true;
        return (
          row.folio.toLowerCase().includes(q) ||
          row.linea.toLowerCase().includes(q) ||
          row.ensamble.toLowerCase().includes(q) ||
          row.numeroParte.toLowerCase().includes(q) ||
          row.numeroPartePrograma.toLowerCase().includes(q) ||
          row.secuencia.toLowerCase().includes(q) ||
          row.defecto.toLowerCase().includes(q) ||
          row.causa.toLowerCase().includes(q) ||
          row.maquina.toLowerCase().includes(q) ||
          row.estatus.toLowerCase().includes(q) ||
          row.materialint.toLowerCase().includes(q) ||
          row.materialext.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.fechaSortMs - a.fechaSortMs);
  }, [rows, searchQuery]);

  const selectedRow =
    selectedRowIndex != null && selectedRowIndex >= 0 && selectedRowIndex < filteredRows.length
      ? filteredRows[selectedRowIndex]
      : null;

  const buildPreviewHtml = (d: PrintLabelData): string => {
    const safe = {
      folio: escapeHtml(d.folio),
      fecha: escapeHtml(d.fecha),
      ensamble: escapeHtml(d.ensamble),
      parte: escapeHtml(d.parte),
      programa: escapeHtml(d.programa),
      secuencia: escapeHtml(d.secuencia),
      defecto: escapeHtml(d.defecto),
      cantidad: escapeHtml(d.cantidad),
    };

    const splitProgram = (value: string): [string, string] => {
      if (value.length <= 20) return [value, ''];
      return [value.slice(0, 20), value.slice(20)];
    };

    const [programLine1, programLine2] = splitProgram(safe.programa);

    if (d.porPrograma) {
      const continuation = programLine2 ? `<p class="programContinuation">${programLine2}</p>` : '';
      return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif;
              background: #e6e7e9;
              padding: 16px;
              color: #000000;
            }
            .title {
              text-align: center;
              font-weight: 700;
              color: #1b7d31;
              margin: 0 0 12px 0;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(250px, 1fr));
              gap: 12px;
            }
            .sheet {
              background: #f8f8f8;
              border: 1px solid #d1d5db;
              padding: 10px;
              min-height: 150px;
            }
            .sheet h4 {
              margin: 0 0 6px 0;
              font-size: 15px;
              text-transform: uppercase;
            }
            .sheet p {
              margin: 0 0 7px 0;
              font-size: 12px;
              line-height: 1.35;
            }
            .sheet span { color: #374151; }
            .sheet b { color: #111827; }
            .split {
              display: flex;
              justify-content: flex-start;
              gap: 18px;
              align-items: baseline;
              flex-wrap: wrap;
            }
            .programContinuation {
              margin-top: -2px;
              margin-bottom: 7px;
              font-size: 11px;
              font-weight: 600;
              letter-spacing: 0.02em;
            }
            .programFooter {
              margin-top: 10px;
              font-size: 11px;
              color: #0b57d0;
            }
            @media (max-width: 700px) {
              .grid { grid-template-columns: 1fr; }
            }
          </style>
        </head>
        <body>
          <h3 class="title">Vista previa de impresion</h3>
          <section class="grid">
            <article class="sheet">
              <h4>Reorden: ${safe.folio}</h4>
              <p><span>Fecha:</span> <b>${safe.fecha}</b></p>
              <p><span>Programa:</span> <b>${programLine1}</b></p>
              ${continuation}
              <p><span>Secuencia:</span> <b>Varias</b></p>
              <p class="split"><span>Defecto: <b>${safe.defecto}</b></span><span>Cantidad: <b>${safe.cantidad}</b></span></p>
              <p class="programFooter"><b>*PROGRAMA COMPLETO*</b></p>
            </article>
            <article class="sheet">
              <h4>Reorden: ${safe.folio}</h4>
              <p><span>Fecha:</span> <b>${safe.fecha}</b></p>
              <p><span>Programa:</span> <b>${programLine1}</b></p>
              ${continuation}
              <p><span>Secuencia:</span> <b>Varias</b></p>
              <p class="split"><span>Defecto: <b>${safe.defecto}</b></span><span>Cantidad: <b>${safe.cantidad}</b></span></p>
              <p class="programFooter"><b>*PROGRAMA COMPLETO*</b></p>
            </article>
          </section>
        </body>
      </html>
      `;
    }

    const hasEnsamble = !!d.ensamble;
    const hasSecuencia = !!d.secuencia && d.secuencia !== '--' && d.secuencia !== 'N/A';

    let bodyRows = '';
    if (!hasSecuencia && hasEnsamble) {
      bodyRows = `
        <p><span>Reorden:</span> <b>${safe.folio}</b></p>
        <p><span>Fecha:</span> <b>${safe.fecha}</b></p>
        <p><span>Ensamble:</span> <b>${safe.ensamble}</b></p>
        <p><span>Parte:</span> <b>${safe.parte}</b></p>
        <p class="split"><span>Secuencia: <b>--</b></span><span>Defecto: <b>${safe.defecto}</b></span></p>
        <p><span>Cantidad:</span> <b>${safe.cantidad}</b></p>
      `;
    } else if (hasSecuencia && !hasEnsamble) {
      bodyRows = `
        <p><span>Reorden:</span> <b>${safe.folio}</b></p>
        <p><span>Fecha:</span> <b>${safe.fecha}</b></p>
        <p><span>Parte:</span> <b>${safe.parte}</b></p>
        <p><span>Secuencia:</span> <b>${safe.secuencia}</b></p>
        <p><span>Defecto:</span> <b>${safe.defecto}</b></p>
        <p><span>Cantidad:</span> <b>${safe.cantidad}</b></p>
      `;
    } else {
      bodyRows = `
        <p><span>Reorden:</span> <b>${safe.folio}</b></p>
        <p><span>Fecha:</span> <b>${safe.fecha}</b></p>
        ${hasEnsamble ? `<p><span>Ensamble:</span> <b>${safe.ensamble}</b></p>` : ''}
        <p><span>Parte:</span> <b>${safe.parte}</b></p>
        <p><span>Secuencia:</span> <b>${safe.secuencia}</b></p>
        <p class="split"><span>Defecto: <b>${safe.defecto}</b></span><span>Cantidad: <b>${safe.cantidad}</b></span></p>
      `;
    }

    const card = `<article class="sheet">${bodyRows}</article>`;

    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif;
              background: #e6e7e9;
              padding: 16px;
              color: #000000;
            }
            .title {
              text-align: center;
              font-weight: 700;
              color: #1b7d31;
              margin: 0 0 12px 0;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(250px, 1fr));
              gap: 12px;
            }
            .sheet {
              background: #f8f8f8;
              border: 1px solid #d1d5db;
              padding: 10px;
              min-height: 150px;
            }
            .sheet p {
              margin: 0 0 7px 0;
              font-size: 12px;
              line-height: 1.35;
            }
            .sheet span { color: #374151; }
            .sheet b { color: #111827; }
            .split {
              display: flex;
              justify-content: flex-start;
              gap: 18px;
              align-items: baseline;
              flex-wrap: wrap;
            }
            @media (max-width: 700px) {
              .grid { grid-template-columns: 1fr; }
            }
          </style>
        </head>
        <body>
          <h3 class="title">Vista previa de impresion</h3>
          <section class="grid">${card}${card}</section>
        </body>
      </html>
    `;
  };

  const handlePrintSelected = () => {
    if (!selectedRow) {
      return;
    }

    const programaValue = selectedRow.programa.trim();
    const numeroParteValue = selectedRow.numeroParte.trim();
    const porPrograma = programaValue.length > 0;
    const normalizedPart = porPrograma ? programaValue.toUpperCase() : numeroParteValue.toUpperCase();
    if (!normalizedPart) {
      Alert.alert('Sin datos', porPrograma ? 'La fila seleccionada no tiene Programa valido.' : 'La fila seleccionada no tiene Numero de Parte valido.');
      return;
    }

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = now.getHours();
    const min = String(now.getMinutes()).padStart(2, '0');
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    const fecha = selectedRow.fecha || `${dd}/${mm}/${yyyy} ${h12}:${min} ${ampm}`;

    const labelData: PrintLabelData = {
      folio: selectedRow.folio || '',
      fecha,
      ensamble: selectedRow.ensamble || '',
      parte: porPrograma ? '' : normalizedPart,
      programa: porPrograma ? normalizedPart : '',
      porPrograma,
      secuencia: porPrograma ? 'Varias' : (selectedRow.secuencia || '--'),
      defecto: selectedRow.defecto || '--',
      cantidad: selectedRow.cantidad || '',
    };

    setPrintLabelData(labelData);
    setPreviewHtml(buildPreviewHtml(labelData));
    setShowPrintPreview(true);
  };

  const handleSendToDymo = async (bridge?: Bridge) => {
    if (!printLabelData) {
      return;
    }

    const labels = [
      {
        ...printLabelData,
      },
      {
        ...printLabelData,
      },
    ];

    setIsSendingToDymo(true);
    try {
      const targetPrintUrl = bridge
        ? `${getBridgeUrl(bridge.location, bridge.port)}/api/rdm/print`
        : DYMO_PRINT_API_URL;

      let explicitPrinterName = '';
      if (bridge) {
        const bridgeInfoUrl = `${getBridgeUrl(bridge.location, bridge.port)}/api/rdm/info`;
        const bridgeInfoResponse = await fetch(bridgeInfoUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (bridgeInfoResponse.ok) {
          const bridgeInfo = (await bridgeInfoResponse.json().catch(() => null)) as BridgeInfoResponse | null;
          explicitPrinterName = toText(bridgeInfo?.printer);
        }
      }

      const response = await fetch(targetPrintUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labels,
          labelPreset: DYMO_LABEL_PRESET,
          ...(explicitPrinterName ? { printerName: explicitPrinterName } : {}),
        }),
      });

      const payload = (await response.json().catch(() => null)) as PrintResponse | null;

      if (!response.ok) {
        const serverMessage =
          toText(payload?.message) || toText(payload?.details) || `Error ${response.status} al enviar a DYMO.`;
        throw new Error(serverMessage);
      }

      const printed = typeof payload?.printed === 'number' ? payload.printed : 0;
      if (printed <= 0) {
        throw new Error('El bridge respondio OK, pero no confirmo etiquetas impresas.');
      }

      const bridgeLabel = payload?.bridge?.name || bridge?.name || 'Bridge desconocido';
      const printerLabel = payload?.printerName || explicitPrinterName || 'Impresora no especificada';

      Alert.alert('Listo', `Impresas: ${printed}\nBridge: ${bridgeLabel}\nImpresora: ${printerLabel}`, [
        {
          text: 'OK',
          onPress: () => {
            setShowPrintPreview(false);
            if (bridge) {
              setSelectedBridgeName(bridge.name);
            }
          },
        },
      ]);
    } catch (error) {
      Alert.alert(
        'Error de impresion',
        error instanceof Error ? error.message : 'No fue posible enviar a DYMO.',
      );
    } finally {
      setIsSendingToDymo(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.85}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Consultar reordenes</Text>
        <TouchableOpacity onPress={() => void fetchReordenes()} style={styles.refreshButton} activeOpacity={0.85}>
          <Text style={styles.refreshButtonText}>Recargar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={text => {
            setSearchQuery(text);
            setSelectedRowIndex(null);
          }}
          clearButtonMode="while-editing"
        />
        <TouchableOpacity
          style={[styles.filterBtn, activeFilter === 'pendientes' && styles.filterBtnActive]}
          onPress={() => {
            setActiveFilter('pendientes');
            void fetchReordenes(GET_REORDENES_PENDIENTES_URL);
          }}
          activeOpacity={0.85}
        >
          <Text style={[styles.filterBtnText, activeFilter === 'pendientes' && { color: '#FFFFFF' }]}>Pendientes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, activeFilter === 'recientes' && styles.filterBtnActive]}
          onPress={() => {
            setActiveFilter('recientes');
            void fetchReordenes();
          }}
          activeOpacity={0.85}
        >
          <Text style={[styles.filterBtnText, activeFilter === 'recientes' && { color: '#FFFFFF' }]}>Más Recientes</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color="#1A49D8" />
          <Text style={styles.centeredText}>Cargando reordenes...</Text>
        </View>
      ) : filteredRows.length === 0 ? (
        <View style={styles.centeredState}>
          <Text style={styles.centeredText}>No hay reordenes disponibles.</Text>
        </View>
      ) : (
        <ScrollView horizontal contentContainerStyle={styles.tableWrap}>
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.colEstatus]}>Estatus</Text>
              <Text style={[styles.th, styles.colFolio]}>Folio</Text>
              <Text style={[styles.th, styles.colLinea]}>Linea</Text>
              <Text style={[styles.th, styles.colEnsamble]}>Ensamble</Text>
              <Text style={[styles.th, styles.colParte]}>Numero de Parte/Programa</Text>
              <Text style={[styles.th, styles.colSecuencia]}>Secuencia</Text>
              <Text style={[styles.th, styles.colMaterialInt]}>Material Interno</Text>
              <Text style={[styles.th, styles.colCalibreInt]}>Calibre Interno</Text>
              <Text style={[styles.th, styles.colMaterialExt]}>Material Externo</Text>
              <Text style={[styles.th, styles.colCalibreExt]}>Calibre Externo</Text>
              <Text style={[styles.th, styles.colDefecto]}>Defecto</Text>
              <Text style={[styles.th, styles.colCausa]}>Causa</Text>
              <Text style={[styles.th, styles.colMaquina]}>Maquina</Text>
              <Text style={[styles.th, styles.colCantidad]}>Cantidad</Text>
              <Text style={[styles.th, styles.colComentarios]}>Comentarios</Text>
              <Text style={[styles.th, styles.colFechaHora]}>Fecha y Hora de Captura</Text>
            </View>
            <ScrollView style={styles.rowsScroll}>
              {filteredRows.map((row, index) => (
                <TouchableOpacity
                  key={`${row.folio}-${index}`}
                  style={[
                    styles.tableRow,
                    !getRowBgColor(row.estatus) && index % 2 === 1 && styles.tableRowAlt,
                    getRowBgColor(row.estatus) ? { backgroundColor: getRowBgColor(row.estatus) } : null,
                    selectedRowIndex === index && styles.tableRowSelected,
                  ]}
                  activeOpacity={0.85}
                  onPress={() => setSelectedRowIndex(index)}
                >
                  <Text style={[styles.td, styles.colEstatus]}>{row.estatus || '-'}</Text>
                  <Text style={[styles.td, styles.colFolio]}>{row.folio || '-'}</Text>
                  <Text style={[styles.td, styles.colLinea]}>{row.linea || '-'}</Text>
                  <Text style={[styles.td, styles.colEnsamble]}>{row.ensamble || '-'}</Text>
                  <Text style={[styles.td, styles.colParte]}>{row.numeroPartePrograma || row.numeroParte || '-'}</Text>
                  <Text style={[styles.td, styles.colSecuencia]}>{row.secuencia || '-'}</Text>
                  <Text style={[styles.td, styles.colMaterialInt]}>{row.materialint || '-'}</Text>
                  <Text style={[styles.td, styles.colCalibreInt]}>{row.calibreint || '-'}</Text>
                  <Text style={[styles.td, styles.colMaterialExt]}>{row.materialext || '-'}</Text>
                  <Text style={[styles.td, styles.colCalibreExt]}>{row.calibreext || '-'}</Text>
                  <Text style={[styles.td, styles.colDefecto]}>{row.defecto || '-'}</Text>
                  <Text style={[styles.td, styles.colCausa]}>{row.causa || '-'}</Text>
                  <Text style={[styles.td, styles.colMaquina]}>{row.maquina || '-'}</Text>
                  <Text style={[styles.td, styles.colCantidad]}>{row.cantidad || '-'}</Text>
                  <Text style={[styles.td, styles.colComentarios]}>{row.comentarios || '-'}</Text>
                  <Text style={[styles.td, styles.colFechaHora]}>{row.fecha || '-'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      )}

      {selectedRow ? (
        <TouchableOpacity
          style={[styles.detallesButton, { marginBottom: 30 }]}
          onPress={() => setShowDetailModal(true)}
          activeOpacity={0.85}
        >
          <Text style={styles.printButtonText}>Ver Detalles</Text>
        </TouchableOpacity>
      ) : null}

      {/* Modal detalle de reorden */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <SafeAreaView style={styles.detailModalSafe}>
          <View style={styles.detailModalHeader}>
            <Text style={styles.detailModalTitle}>Detalle de reorden</Text>
            <TouchableOpacity
              style={styles.detailModalCloseBtn}
              onPress={() => setShowDetailModal(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.detailModalCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.detailModalBody}>
            {/* Folio / Fecha / Planta */}
            <View style={styles.detailTopRow}>
              <View style={styles.detailTopField}>
                <Text style={styles.detailFieldLabel}>FOLIO</Text>
                <Text style={styles.detailFieldValue}>{selectedRow?.folio || '—'}</Text>
              </View>
              <View style={[styles.detailTopField, { flex: 2 }]}>
                <Text style={styles.detailFieldLabel}>FECHA Y HORA</Text>
                <Text style={styles.detailFieldValue}>{selectedRow?.fecha || '—'}</Text>
              </View>
              <View style={styles.detailTopField}>
                <Text style={styles.detailFieldLabel}>PLANTA</Text>
                <Text style={styles.detailFieldValue}>{selectedRow?.planta || '—'}</Text>
              </View>
            </View>

            {/* PARTE */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>PARTE</Text>
              <View style={styles.detailFieldRow}>
                <View style={styles.detailField}>
                  <Text style={styles.detailFieldLabel}>LINEA</Text>
                  <Text style={styles.detailFieldValue}>{selectedRow?.linea || '—'}</Text>
                </View>
                <View style={[styles.detailField, { flex: 2 }]}>
                  <Text style={styles.detailFieldLabel}>ENSAMBLE</Text>
                  <Text style={styles.detailFieldValue}>{selectedRow?.ensamble || '—'}</Text>
                </View>
                <View style={[styles.detailField, { flex: 2 }]}>
                  <Text style={styles.detailFieldLabel}>NUMERO DE PARTE/PROGRAMA</Text>
                  <Text style={styles.detailFieldValue}>{selectedRow?.numeroPartePrograma || selectedRow?.numeroParte || '—'}</Text>
                </View>
              </View>
              <View style={styles.detailFieldRow}>
                <View style={[styles.detailField, { flex: 2 }]}>
                  <Text style={styles.detailFieldLabel}>SECUENCIA</Text>
                  <Text style={styles.detailFieldValue}>{selectedRow?.secuencia || '—'}</Text>
                </View>
                <View style={[styles.detailField, { flex: 2 }]}>
                  <Text style={styles.detailFieldLabel}>PROGRAMA</Text>
                  <Text style={styles.detailFieldValue}>{selectedRow?.programa || '—'}</Text>
                </View>
                <View style={[styles.detailField, { flex: 2 }]}>
                  <Text style={styles.detailFieldLabel}>BALLOON NUMBER</Text>
                  <Text style={styles.detailFieldValue}>{selectedRow?.balloon || '—'}</Text>
                </View>
              </View>
            </View>

            {/* MATERIAL */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>MATERIAL</Text>
              <View style={styles.detailFieldRow}>
                <View style={styles.detailField}>
                  <Text style={styles.detailFieldLabel}>MATERIAL INTERNO</Text>
                  <Text style={styles.detailFieldValue}>{selectedRow?.materialint || '—'}</Text>
                </View>
                <View style={styles.detailField}>
                  <Text style={styles.detailFieldLabel}>CALIBRE INTERNO</Text>
                  <Text style={styles.detailFieldValue}>{selectedRow?.calibreint || '—'}</Text>
                </View>
                <View style={styles.detailField}>
                  <Text style={styles.detailFieldLabel}>MATERIAL EXTERNO</Text>
                  <Text style={styles.detailFieldValue}>{selectedRow?.materialext || '—'}</Text>
                </View>
                <View style={styles.detailField}>
                  <Text style={styles.detailFieldLabel}>CALIBRE EXTERNO</Text>
                  <Text style={styles.detailFieldValue}>{selectedRow?.calibreext || '—'}</Text>
                </View>
              </View>
            </View>

            {/* DETALLE */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>DETALLE</Text>
              <View style={styles.detailFieldRow}>
                <View style={styles.detailField}>
                  <Text style={styles.detailFieldLabel}>AREA</Text>
                  <Text style={styles.detailFieldValue}>{selectedRow?.area || '—'}</Text>
                </View>
                <View style={styles.detailField}>
                  <Text style={styles.detailFieldLabel}>SUB AREA</Text>
                  <Text style={styles.detailFieldValue}>{selectedRow?.subArea || '—'}</Text>
                </View>
                <View style={[styles.detailField, { flex: 2 }]}>
                  <Text style={styles.detailFieldLabel}>MAQUINA</Text>
                  <Text style={styles.detailFieldValue}>{selectedRow?.maquina || '—'}</Text>
                </View>
              </View>
              <View style={styles.detailFieldRow}>
                <View style={styles.detailField}>
                  <Text style={styles.detailFieldLabel}>DEFECTO</Text>
                  <Text style={styles.detailFieldValue}>{selectedRow?.defecto || '—'}</Text>
                </View>
                <View style={[styles.detailField, { flex: 2 }]}>
                  <Text style={styles.detailFieldLabel}>CAUSA</Text>
                  <Text style={styles.detailFieldValue}>{selectedRow?.causa || '—'}</Text>
                </View>
                <View style={styles.detailField}>
                  <Text style={styles.detailFieldLabel}>CANTIDAD</Text>
                  <Text style={styles.detailFieldValue}>{selectedRow?.cantidad || '—'}</Text>
                </View>
              </View>
              <View style={styles.detailFieldRow}>
                <View style={[styles.detailField, { flex: 2 }]}>
                  <Text style={styles.detailFieldLabel}>TIPO REORDEN</Text>
                  <Text style={styles.detailFieldValue}>{selectedRow?.tipoReorden || '—'}</Text>
                </View>
                <View style={[styles.detailField, { flex: 2 }]}>
                  <Text style={styles.detailFieldLabel}>COMPONENTE</Text>
                  <Text style={styles.detailFieldValue}>{selectedRow?.componente || '—'}</Text>
                </View>
              </View>
            </View>

            {/* COMENTARIOS */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>COMENTARIOS</Text>
              <View style={styles.detailFieldRow}>
                <View style={styles.detailField}>
                  <Text style={styles.detailFieldLabel}>TURNO</Text>
                  <Text style={styles.detailFieldValue}>{selectedRow?.turno || '—'}</Text>
                </View>
                <View style={[styles.detailField, { flex: 3 }]}>
                  <Text style={styles.detailFieldLabel}>EMPLEADO</Text>
                  <Text style={styles.detailFieldValue}>{selectedRow?.empleado || '—'}</Text>
                </View>
              </View>
              <Text style={styles.detailFieldLabel}>COMENTARIOS</Text>
              <View style={styles.detailCommentBox}>
                <Text style={styles.detailCommentText}>{selectedRow?.comentarios || '—'}</Text>
              </View>
            </View>

            {/* ESTATUS */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>ESTATUS</Text>
              <View style={styles.detailCommentBox}>
                <Text style={styles.detailCommentText}>{selectedRow?.estatus || '—'}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.printButton, { marginTop: 16, marginBottom: 15 }, isSendingToDymo && { opacity: 0.7 }]}
              onPress={handlePrintSelected}
              activeOpacity={0.85}
              disabled={isSendingToDymo}
            >
              <Text style={styles.printButtonText}>Imprimir Reorden</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showPrintPreview}
        animationType="slide"
        onRequestClose={() => setShowPrintPreview(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalToolbar}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowPrintPreview(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCloseButtonText}>Cerrar</Text>
            </TouchableOpacity>

            <Text style={styles.modalTitle} numberOfLines={1} ellipsizeMode="tail">Vista previa</Text>

            <TouchableOpacity
              style={[styles.modalDymoButton, isSendingToDymo && { opacity: 0.7 }]}
              onPress={() => setShowBridgeSelector(true)}
              activeOpacity={0.85}
              disabled={isSendingToDymo}
            >
              <Text style={styles.modalDymoButtonText} numberOfLines={1} ellipsizeMode="tail">
                {isSendingToDymo
                  ? 'Enviando...'
                  : selectedBridgeName
                    ? `Imprimir`
                    : 'Imprimir'}
              </Text>
            </TouchableOpacity>
          </View>

          <WebView
            style={styles.webView}
            source={{ html: previewHtml }}
            originWhitelist={['*']}
            scalesPageToFit
          />
        </SafeAreaView>
      </Modal>

      <BridgeSelectorModal
        visible={showBridgeSelector}
        onCancel={() => setShowBridgeSelector(false)}
        isLoading={isSendingToDymo}
        onSelectBridge={bridge => {
          setShowBridgeSelector(false);
          void handleSendToDymo(bridge);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    marginTop: 30,
    flex: 1,
    backgroundColor: '#F0F4FA',
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  backButton: {
    minWidth: 90,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
  },
  refreshButton: {
    minWidth: 90,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1A49D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#1F2937',
  },
  filterBtn: {
    height: 42,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  filterBtnActive: {
    backgroundColor: '#1A49D8',
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  centeredText: {
    color: '#4B5563',
    fontSize: 14,
  },
  tableWrap: {
    paddingBottom: 5,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
    paddingVertical: 10,
  },
  th: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
    paddingHorizontal: 8,
  },
  rowsScroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#E5E7EB',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 10,
  },
  tableRowAlt: {
    backgroundColor: '#F9FAFB',
  },
  tableRowSelected: {
    backgroundColor: '#DBEAFE',
  },
  td: {
    fontSize: 12,
    color: '#000000',
    paddingHorizontal: 8,
  },
  colEstatus: { width: 95 },
  colFolio: { width: 75 },
  colLinea: { width: 80 },
  colEnsamble: { width: 80 },
  colParte: { width: 115 },
  colSecuencia: { width: 105 },
  colMaterialInt: { width: 85 },
  colCalibreInt: { width: 80 },
  colMaterialExt: { width: 85 },
  colCalibreExt: { width: 80 },
  colDefecto: { width: 100 },
  colCausa: { width: 170 },
  colMaquina: { width: 130 },
  colCantidad: { width: 75 },
  colComentarios: { width: 260 },
  colFechaHora: { width: 150 },
  printButton: {
    marginTop: 10,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#f7832b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  printButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
   detallesButton: {
    marginTop: 10,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#1d52ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
    backgroundColor: '#F3F4F6',
    gap: 8,
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  modalCloseButton: {
    minWidth: 92,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#6B7280',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalDymoButton: {
    minWidth: 124,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#B45309',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    maxWidth: 220,
  },
  modalDymoButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
    flexShrink: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: '#E5E7EB',
  },
  detailModalSafe: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  detailModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  detailModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A49D8',
  },
  detailModalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  detailModalCloseBtnText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '700',
  },
  detailModalBody: {
    padding: 14,
    gap: 12,
  },
  detailTopRow: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailTopField: {
    flex: 1,
    gap: 4,
  },
  detailSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  detailSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1A49D8',
    marginBottom: 2,
  },
  detailFieldRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  detailField: {
    flex: 1,
    minWidth: 80,
    gap: 3,
  },
  detailFieldLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  detailFieldValue: {
    fontSize: 13,
    color: '#1F2937',
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  detailCommentBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    padding: 10,
    minHeight: 44,
  },
  detailCommentText: {
    fontSize: 13,
    color: '#1F2937',
  },
});

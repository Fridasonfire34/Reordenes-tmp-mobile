import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { API_ENDPOINTS, DYMO_ENDPOINTS } from '../config/api';

type ConsultarReordenesScreenProps = {
  onBack: () => void;
};

type ReordenRow = {
  folio: string;
  linea: string;
  ensamble: string;
  numeroParte: string;
  secuencia: string;
  material: string;
  calibre: string;
  defecto: string;
  causa: string;
  maquina: string;
  cantidad: string;
  comentarios: string;
  estatus: string;
  fecha: string;
};

type PrintLabelData = {
  folio: string;
  fecha: string;
  ensamble: string;
  parte: string;
  secuencia: string;
  defecto: string;
  cantidad: string;
};

const TARGET_STATUS = 'Pendiente por Programacion';

const GET_REORDENES_URL = API_ENDPOINTS.reorders;
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
  const [printLabelData, setPrintLabelData] = useState<PrintLabelData | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');

  const fetchReordenes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(GET_REORDENES_URL, {
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
          return {
            folio: pickText(r, ['folio', 'Folio', 'id', 'ID']),
            linea: pickText(r, ['linea', 'Linea', 'Línea']),
            ensamble: pickText(r, ['ensamble', 'Ensamble']),
            numeroParte: pickText(r, ['numeroParte', 'NumeroParte', 'numero_parte', 'Parte', 'Numero de Parte']),
            secuencia: pickText(r, ['secuencia', 'Secuencia', 'sequence', 'Sequence']),
            material: pickText(r, ['material', 'Material']),
            calibre: pickText(r, ['calibre', 'Calibre']),
            defecto: pickText(r, ['defecto', 'Defecto']),
            causa: pickText(r, ['causa', 'Causa']),
            maquina: pickText(r, ['maquina', 'Maquina', 'Máquina']),
            cantidad: pickText(r, ['cantidad', 'Cantidad']),
            comentarios: pickText(r, ['comentarios', 'Comentarios', 'comentario', 'Comentario']),
            estatus: pickText(r, ['estatus', 'Estatus', 'status', 'Status']),
            fecha: pickText(r, ['fecha', 'Fecha', 'captureDateTime', 'createdAt']),
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

  const filteredRows = useMemo(() => {
    const target = toNormalized(TARGET_STATUS);
    return rows.filter(row => toNormalized(row.estatus) === target);
  }, [rows]);

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
      secuencia: escapeHtml(d.secuencia),
      defecto: escapeHtml(d.defecto),
      cantidad: escapeHtml(d.cantidad),
    };

    const hasEnsamble = !!d.ensamble;
    const hasSecuencia = !!d.secuencia && d.secuencia !== '--' && d.secuencia !== 'N/A';

    let bodyRows = '';
    if (!hasSecuencia && hasEnsamble) {
      bodyRows = `
        <p><span>Folio Reorden:</span> <b>${safe.folio}</b></p>
        <p><span>Fecha y Hora:</span> <b>${safe.fecha}</b></p>
        <p><span>Ensamble:</span> <b>${safe.ensamble}</b></p>
        <p><span>Parte:</span> <b>${safe.parte}</b></p>
        <p class="split"><span>Secuencia: <b>--</b></span><span>Defecto: <b>${safe.defecto}</b></span></p>
        <p><span>Cantidad:</span> <b>${safe.cantidad}</b></p>
      `;
    } else if (hasSecuencia && !hasEnsamble) {
      bodyRows = `
        <p><span>Folio Reorden:</span> <b>${safe.folio}</b></p>
        <p><span>Fecha y Hora:</span> <b>${safe.fecha}</b></p>
        <p><span>Parte:</span> <b>${safe.parte}</b></p>
        <p><span>Secuencia:</span> <b>${safe.secuencia}</b></p>
        <p><span>Defecto:</span> <b>${safe.defecto}</b></p>
        <p><span>Cantidad:</span> <b>${safe.cantidad}</b></p>
      `;
    } else {
      bodyRows = `
        <p><span>Folio Reorden:</span> <b>${safe.folio}</b></p>
        <p><span>Fecha y Hora:</span> <b>${safe.fecha}</b></p>
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
              color: #1f2937;
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

    const normalizedPart = selectedRow.numeroParte.trim().toUpperCase();
    if (!normalizedPart) {
      Alert.alert('Sin datos', 'La fila seleccionada no tiene Numero de Parte valido.');
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
      parte: normalizedPart,
      secuencia: selectedRow.secuencia || '--',
      defecto: selectedRow.defecto || '--',
      cantidad: selectedRow.cantidad || '',
    };

    setPrintLabelData(labelData);
    setPreviewHtml(buildPreviewHtml(labelData));
    setShowPrintPreview(true);
  };

  const handleSendToDymo = async () => {
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
      const response = await fetch(DYMO_PRINT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labels,
          labelPreset: DYMO_LABEL_PRESET,
        }),
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(responseText || `Error ${response.status} al enviar a DYMO.`);
      }

      Alert.alert('Listo', 'Se enviaron las etiquetas a la impresora DYMO.', [
        {
          text: 'OK',
          onPress: () => {
            setShowPrintPreview(false);
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

      <View style={styles.statusPill}>
        <Text style={styles.statusPillText}>Mostrando solo: {TARGET_STATUS}</Text>
      </View>

      {loading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color="#1A49D8" />
          <Text style={styles.centeredText}>Cargando reordenes...</Text>
        </View>
      ) : filteredRows.length === 0 ? (
        <View style={styles.centeredState}>
          <Text style={styles.centeredText}>No hay reordenes con estatus {TARGET_STATUS}.</Text>
        </View>
      ) : (
        <ScrollView horizontal contentContainerStyle={styles.tableWrap}>
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.colFolio]}>Folio</Text>
              <Text style={[styles.th, styles.colLinea]}>Linea</Text>
              <Text style={[styles.th, styles.colEnsamble]}>Ensamble</Text>
              <Text style={[styles.th, styles.colParte]}>Numero de Parte</Text>
              <Text style={[styles.th, styles.colSecuencia]}>Secuencia</Text>
              <Text style={[styles.th, styles.colMaterial]}>Material</Text>
              <Text style={[styles.th, styles.colCalibre]}>Calibre</Text>
              <Text style={[styles.th, styles.colDefecto]}>Defecto</Text>
              <Text style={[styles.th, styles.colCausa]}>Causa</Text>
              <Text style={[styles.th, styles.colMaquina]}>Maquina</Text>
              <Text style={[styles.th, styles.colCantidad]}>Cantidad</Text>
              <Text style={[styles.th, styles.colComentarios]}>Comentarios</Text>
            </View>
            <ScrollView style={styles.rowsScroll}>
              {filteredRows.map((row, index) => (
                <TouchableOpacity
                  key={`${row.folio}-${index}`}
                  style={[
                    styles.tableRow,
                    index % 2 === 1 && styles.tableRowAlt,
                    selectedRowIndex === index && styles.tableRowSelected,
                  ]}
                  activeOpacity={0.85}
                  onPress={() => setSelectedRowIndex(index)}
                >
                  <Text style={[styles.td, styles.colFolio]}>{row.folio || '-'}</Text>
                  <Text style={[styles.td, styles.colLinea]}>{row.linea || '-'}</Text>
                  <Text style={[styles.td, styles.colEnsamble]}>{row.ensamble || '-'}</Text>
                  <Text style={[styles.td, styles.colParte]}>{row.numeroParte || '-'}</Text>
                  <Text style={[styles.td, styles.colSecuencia]}>{row.secuencia || '-'}</Text>
                  <Text style={[styles.td, styles.colMaterial]}>{row.material || '-'}</Text>
                  <Text style={[styles.td, styles.colCalibre]}>{row.calibre || '-'}</Text>
                  <Text style={[styles.td, styles.colDefecto]}>{row.defecto || '-'}</Text>
                  <Text style={[styles.td, styles.colCausa]}>{row.causa || '-'}</Text>
                  <Text style={[styles.td, styles.colMaquina]}>{row.maquina || '-'}</Text>
                  <Text style={[styles.td, styles.colCantidad]}>{row.cantidad || '-'}</Text>
                  <Text style={[styles.td, styles.colComentarios]}>{row.comentarios || '-'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      )}

      {selectedRow ? (
        <TouchableOpacity
          style={[styles.printButton, { marginBottom: 35 }, isSendingToDymo && { opacity: 0.7 }]}
          onPress={handlePrintSelected}
          activeOpacity={0.85}
          disabled={isSendingToDymo}
        >
          <Text style={styles.printButtonText}>Imprimir reorden</Text>
        </TouchableOpacity>
      ) : null}

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

            <Text style={styles.modalTitle}>Vista previa</Text>

            <TouchableOpacity
              style={[styles.modalDymoButton, isSendingToDymo && { opacity: 0.7 }]}
              onPress={() => void handleSendToDymo()}
              activeOpacity={0.85}
              disabled={isSendingToDymo}
            >
              <Text style={styles.modalDymoButtonText}>
                {isSendingToDymo ? 'Enviando...' : 'Enviar a DYMO'}
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
  statusPill: {
    alignSelf: 'flex-start',
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
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
    paddingBottom: 12,
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
    color: '#1F2937',
    paddingHorizontal: 8,
  },
  rowsScroll: {
    maxHeight: 560,
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
    color: '#374151',
    paddingHorizontal: 8,
  },
  colFolio: { width: 110 },
  colLinea: { width: 110 },
  colEnsamble: { width: 110 },
  colParte: { width: 105 },
  colSecuencia: { width: 110 },
  colMaterial: { width: 130 },
  colCalibre: { width: 100 },
  colDefecto: { width: 100 },
  colCausa: { width: 170 },
  colMaquina: { width: 130 },
  colCantidad: { width: 90 },
  colComentarios: { width: 260 },
  printButton: {
    marginTop: 40,
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
  },
  modalDymoButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  webView: {
    flex: 1,
    backgroundColor: '#E5E7EB',
  },
});

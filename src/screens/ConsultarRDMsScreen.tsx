import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_ENDPOINTS } from '../config/api';
import EditarRDMModal from './EditarRDMModal';

type ConsultarRDMsScreenProps = {
  onBack: () => void;
  loggedUser: string;
  loggedNomina: string;
};

type RdmRecord = Record<string, unknown>;

type ColumnConfig = {
  key: string;
  label: string;
  width: number;
};

const columns: ColumnConfig[] = [
  { key: '__sel__', label: '', width: 36 },
  { key: 'id', label: 'ID', width: 85 },
  { key: 'auditor', label: 'Auditor', width: 60 },
  { key: 'fecha', label: 'Fecha', width: 160 },
  { key: 'codigoMaterial', label: 'Codigo', width: 85 },
  { key: 'descripcion', label: 'Descripcion', width: 150 },
  { key: 'numeroTag', label: 'No. Tag', width: 120 },
  { key: 'proveedor', label: 'Proveedor', width: 200 },
  { key: 'cantidad', label: 'Cant.', width: 75 },
  { key: 'disposicion', label: 'Disposicion', width: 110 },
  { key: 'status', label: 'Status', width: 120 },
];

const normalizeKey = (value: string): string => value.toLowerCase().replace(/[\s_\-.\/]/g, '');

const findValueByCandidates = (row: RdmRecord, candidates: string[]): string => {
  const wanted = new Set(candidates.map(candidate => normalizeKey(candidate)));
  for (const [rawKey, rawValue] of Object.entries(row)) {
    if (!wanted.has(normalizeKey(rawKey))) continue;
    if (rawValue == null) return '';
    return String(rawValue);
  }
  return '';
};

const formatDateTime12h = (input: string): string => {
  const text = input.trim();
  if (!text) return '';
  const alreadyFormatted = text.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})\s*(AM|PM)$/i);
  if (alreadyFormatted) {
    const [, dd, mm, yyyy, hh, min, ampm] = alreadyFormatted;
    return `${dd}/${mm}/${yyyy} ${hh}:${min} ${ampm.toUpperCase()}`;
  }
  const local24h = text.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (local24h) {
    const [, dd, mm, yyyy, hourText, minuteText] = local24h;
    const hour24 = Number(hourText);
    if (Number.isFinite(hour24) && hour24 >= 0 && hour24 <= 23) {
      const ampm = hour24 >= 12 ? 'PM' : 'AM';
      const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
      const hh = `${hour12}`.padStart(2, '0');
      return `${dd}/${mm}/${yyyy} ${hh}:${minuteText} ${ampm}`;
    }
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  const dd = `${parsed.getDate()}`.padStart(2, '0');
  const mm = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const yyyy = `${parsed.getFullYear()}`;
  const hour24 = parsed.getHours();
  const minute = `${parsed.getMinutes()}`.padStart(2, '0');
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const hh = `${hour12}`.padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${minute} ${ampm}`;
};

const getCellValue = (row: RdmRecord, key: string): string => {
  switch (key) {
    case 'id': return findValueByCandidates(row, ['ID', 'Id', 'Folio']);
    case 'auditor': return findValueByCandidates(row, ['Auditor']);
    case 'fecha': return formatDateTime12h(findValueByCandidates(row, ['Fecha']));
    case 'codigoMaterial': return findValueByCandidates(row, ['Codigo de Material', 'CodigoMaterial', 'Codigo']);
    case 'descripcion': return findValueByCandidates(row, ['Descripcion']);
    case 'numeroTag': return findValueByCandidates(row, ['No. Tag', 'No Tag', 'NumeroTag']);
    case 'proveedor': return findValueByCandidates(row, ['Proveedor']);
    case 'cantidad': return findValueByCandidates(row, ['Cantidad']);
    case 'disposicion': return findValueByCandidates(row, ['Disposicion']);
    case 'status': return findValueByCandidates(row, ['Status']);
    default: return '';
  }
};

export default function ConsultarRDMsScreen({ onBack, loggedUser, loggedNomina }: ConsultarRDMsScreenProps) {
  const [records, setRecords] = useState<RdmRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editRdmRow, setEditRdmRow] = useState<RdmRecord | null>(null);
  const [isPreparingReport, setIsPreparingReport] = useState(false);

  const handleViewReport = useCallback(async (row: RdmRecord) => {
    const rawFolio = (getCellValue(row, 'id') || '').trim();

    setIsPreparingReport(true);
    try {
      if (!rawFolio) {
        throw new Error('El RDM no tiene folio para abrir el PDF.');
      }

      const generateResponse = await fetch(API_ENDPOINTS.generateRdmReport, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folio: rawFolio,
          reportData: {
            fecha: getCellValue(row, 'fecha'),
            auditor: getCellValue(row, 'auditor'),
            codigoMaterial: getCellValue(row, 'codigoMaterial'),
            descripcion: getCellValue(row, 'descripcion'),
            numeroTag: getCellValue(row, 'numeroTag'),
            proveedor: getCellValue(row, 'proveedor'),
            cantidad: getCellValue(row, 'cantidad'),
            unidad: findValueByCandidates(row, ['Unidad']),
            rechazo: findValueByCandidates(row, ['Rechazo']),
            disposicion: getCellValue(row, 'disposicion'),
            status: getCellValue(row, 'status'),
            salidaFecha: findValueByCandidates(row, ['Salida Fecha', 'SalidaFecha']),
          },
        }),
      });

      const generatePayload = await generateResponse.json().catch(() => null) as { message?: string } | null;

      if (!generateResponse.ok && generateResponse.status !== 409) {
        throw new Error(generatePayload?.message || `No fue posible generar el reporte (HTTP ${generateResponse.status}).`);
      }

      const pdfUrl = `${API_ENDPOINTS.rdmFile}/${encodeURIComponent(rawFolio)}`;

      const canOpen = await Linking.canOpenURL(pdfUrl);
      if (!canOpen) {
        throw new Error('No se puede abrir la URL del PDF en este dispositivo.');
      }

      await Linking.openURL(pdfUrl);
    } catch (error) {
      Alert.alert(
        'No se pudo abrir el reporte',
        error instanceof Error
          ? error.message
          : 'No fue posible abrir el PDF de este folio.',
      );
    } finally {
      setIsPreparingReport(false);
    }
  }, []);

  const fetchRdms = useCallback(async (isManualRefresh: boolean) => {
    if (isManualRefresh) { setIsRefreshing(true); } else { setIsLoading(true); }
    try {
      setErrorMessage('');
      const response = await fetch(`${API_ENDPOINTS.rdms}?limit=200`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
            ? payload.message
            : 'No fue posible consultar la tabla RDM.';
        throw new Error(message);
      }
      const rdms =
        payload && typeof payload === 'object' && 'rdms' in payload && Array.isArray(payload.rdms)
          ? payload.rdms
          : [];
      setRecords(rdms.filter((item: unknown) => item && typeof item === 'object') as RdmRecord[]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible consultar la tabla RDM.');
      setRecords([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchRdms(false); }, [fetchRdms]);

  const totalCountText = useMemo(() => `${records.length} registro(s)`, [records.length]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Ver RDMs</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.refreshButton, isRefreshing ? styles.refreshButtonDisabled : null]}
              onPress={() => { void fetchRdms(true); }}
              activeOpacity={0.85}
              disabled={isRefreshing}
            >
              <Text style={styles.refreshButtonText}>{isRefreshing ? 'Actualizando...' : 'Actualizar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
              <Text style={styles.backButtonText}>← Volver</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Tabla: RDM</Text>
          <Text style={styles.metaText}>{totalCountText}</Text>
        </View>

        {isLoading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="small" color="#1A49D8" />
            <Text style={styles.stateText}>Cargando registros de RDM...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.stateCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : records.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>No hay registros en la tabla RDM.</Text>
          </View>
        ) : (
          <View style={styles.tableCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View style={styles.tableHeaderRow}>
                  {columns.map(column => (
                    <Text key={column.key} style={[styles.tableHeaderText, { width: column.width }]}>
                      {column.label}
                    </Text>
                  ))}
                </View>
                <ScrollView style={styles.tableBody} nestedScrollEnabled>
                  {records.map((row, index) => (
                    <TouchableOpacity
                      key={`rdm-row-${index}`}
                      activeOpacity={0.75}
                      onPress={() => setSelectedIndex(prev => prev === index ? null : index)}
                      style={[
                        styles.tableBodyRow,
                        index % 2 === 1 ? styles.tableBodyRowAlt : null,
                        selectedIndex === index ? styles.tableBodyRowSelected : null,
                      ]}
                    >
                      {columns.map(column => {
                        if (column.key === '__sel__') {
                          return (
                            <View key={`sel-${index}`} style={[styles.radioCell, { width: column.width }]}>
                              <View style={[styles.radioOuter, selectedIndex === index ? styles.radioOuterSelected : null]}>
                                {selectedIndex === index && <View style={styles.radioInner} />}
                              </View>
                            </View>
                          );
                        }
                        return (
                          <Text key={`${column.key}-${index}`} style={[styles.tableBodyText, { width: column.width }]} numberOfLines={2}>
                            {getCellValue(row, column.key) || '-'}
                          </Text>
                        );
                      })}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </ScrollView>
          </View>
        )}

        {selectedIndex !== null && (
          <View style={styles.editarBar}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editarButton]}
              activeOpacity={0.85}
              onPress={() => {
                setEditRdmRow(records[selectedIndex]);
                setEditModalVisible(true);
              }}
            >
              <Text style={styles.actionButtonText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.verReporteButton]}
              activeOpacity={0.85}
              disabled={isPreparingReport}
              onPress={() => {
                void handleViewReport(records[selectedIndex]);
              }}
            >
              <Text style={styles.actionButtonText}>{isPreparingReport ? 'Preparando Reporte...' : 'Ver Reporte'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <EditarRDMModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        rdmRow={editRdmRow}
        loggedUser={loggedUser}
        loggedNomina={loggedNomina}
        onSaved={() => {
          setEditModalVisible(false);
          setSelectedIndex(null);
          void fetchRdms(true);
        }}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { marginTop: 15, flex: 1, backgroundColor: '#EEF1F5' },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 26, fontWeight: '800', color: '#1A49D8' },
  refreshButton: { backgroundColor: '#EDF2FF', borderWidth: 1, borderColor: '#BFD0FF', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  refreshButtonDisabled: { opacity: 0.7 },
  refreshButtonText: { color: '#1A49D8', fontSize: 13, fontWeight: '700' },
  backButton: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  backButtonText: { color: '#2D3748', fontSize: 15, fontWeight: '600' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  metaText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  stateCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: '#D8E0EB', alignItems: 'center', justifyContent: 'center', minHeight: 120 },
  stateText: { fontSize: 14, color: '#4A5568', marginTop: 10 },
  errorText: { fontSize: 14, color: '#B91C1C', lineHeight: 20, textAlign: 'center' },
  tableCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#D8E0EB', overflow: 'hidden' },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#EAF0FF', borderBottomWidth: 1, borderBottomColor: '#C7D4EE' },
  tableHeaderText: { paddingVertical: 10, paddingHorizontal: 10, fontSize: 12, fontWeight: '800', color: '#1E3A8A' },
  tableBody: { maxHeight: 620 },
  tableBodyRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  tableBodyRowAlt: { backgroundColor: '#FBFDFF' },
  tableBodyText: { paddingVertical: 10, paddingHorizontal: 10, fontSize: 12, color: '#1F2937' },
  tableBodyRowSelected: { backgroundColor: '#EAF0FF' },
  radioCell: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#94A3B8', alignItems: 'center', justifyContent: 'center' },
  radioOuterSelected: { borderColor: '#1A49D8' },
  radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#1A49D8' },
  editarBar: {
    paddingVertical: 12,
    paddingHorizontal: 0,
    backgroundColor: '#EEF1F5',
    marginBottom: 15,
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 30,
  },
  editarButton: { backgroundColor: '#1A49D8', marginBottom: 30 },
  verReporteButton: { backgroundColor: '#0F766E', marginBottom: 30 },
  actionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

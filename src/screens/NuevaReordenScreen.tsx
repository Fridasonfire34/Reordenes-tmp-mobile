import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { API_ENDPOINTS, DYMO_ENDPOINTS } from '../config/api';
import { formatLocalDateTimeForSql } from '../utils/dateTime';

type NuevaReordenScreenProps = {
  onBack: () => void;
  loggedNomina?: string;
};

type PrintLabelData = {
  folio: string;
  fecha: string;
  ensamble: string;
  parte: string;
  programa: string;
  secuencia: string;
  defecto: string;
  cantidad: string;
  porPrograma: boolean;
};

type OptionItem = {
  label: string;
  value: string;
  raw?: Record<string, unknown>;
};

type NumeroParteRow = {
  id: string;
  linea: string;
  ensamble: string;
  componente: string;
  cantidad: string;
  material: string;
  calibre: string;
  secuencia: string;
  balloon: string;
  cart: string;
  lado: string;
  raw: Record<string, unknown>;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');

const normalizePartValue = (value: string): string => value.trim().toUpperCase();

const NEW_FOLIO_URL = API_ENDPOINTS.newFolio;
const GET_LINEAS_URL = API_ENDPOINTS.lineas;
const GET_AREAS_URL = API_ENDPOINTS.areas;
const GET_SUB_AREAS_URL = API_ENDPOINTS.subAreas;
const GET_MAQUINAS_URL = API_ENDPOINTS.maquinas;
const GET_DEFECTOS_URL = API_ENDPOINTS.defectos;
const GET_CAUSAS_URL = API_ENDPOINTS.causas;
const GET_NUMERO_PARTE_URL = API_ENDPOINTS.numeroParte;
const GET_COMPONENTES_URL = API_ENDPOINTS.componentes;
const SAVE_REORDEN_URLS = [API_ENDPOINTS.saveReorder];
const DYMO_PRINT_API_URL = DYMO_ENDPOINTS.print;
const DYMO_LABEL_PRESET = '100x212';

function CheckOption({
  label,
  value,
  onToggle,
  flex,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
  flex?: number;
}) {
  return (
    <TouchableOpacity style={[styles.checkOption, flex !== undefined && { flex }]} onPress={onToggle} activeOpacity={0.8}>
      <View style={[styles.checkbox, value && styles.checkboxChecked]}>
        {value ? <Text style={styles.checkboxMark}>✓</Text> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function SelectPlaceholder({
  text,
  options,
  isOpen,
  onToggle,
  onSelect,
}: {
  text: string;
  options?: OptionItem[];
  isOpen?: boolean;
  onToggle?: () => void;
  onSelect?: (value: OptionItem) => void;
}) {
  return (
    <View style={styles.selectContainer}>
      <TouchableOpacity
        style={styles.selectBox}
        onPress={onToggle}
        activeOpacity={onToggle ? 0.8 : 1}
        disabled={!onToggle}
      >
        <Text style={styles.selectText}>{text}</Text>
        <Text style={styles.selectArrow}>{isOpen ? '▴' : '▾'}</Text>
      </TouchableOpacity>

      {isOpen && options && onSelect ? (
        <View style={styles.dropdownList}>
          <ScrollView
            style={styles.dropdownScroll}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {options.map(option => (
              <TouchableOpacity
                key={`${option.value}-${option.label}`}
                style={styles.dropdownItem}
                onPress={() => onSelect(option)}
                activeOpacity={0.8}
              >
                <Text style={styles.dropdownItemText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

export default function NuevaReordenScreen({ onBack, loggedNomina }: NuevaReordenScreenProps) {
  const plantOptions: OptionItem[] = [
    { label: 'Planta 1', value: 'Planta 1' },
    { label: 'Planta 2', value: 'Planta 2' },
    { label: 'Expansion', value: 'Expansion' },
  ];

  const [folio, setFolio] = useState('Generando folio...');
  const [planta, setPlanta] = useState('');
  const [linea, setLinea] = useState('');
  const [area, setArea] = useState('');
  const [subArea, setSubArea] = useState('');
  const [maquina, setMaquina] = useState('');
  const [turno, setTurno] = useState('');
  const [defecto, setDefecto] = useState('');
  const [causa, setCausa] = useState('');

  const turnoOptions: OptionItem[] = [
    { label: 'Turno 1', value: 'Turno 1' },
    { label: 'Turno 2', value: 'Turno 2' },
    { label: 'Turno 3', value: 'Turno 3' },
  ];
  const materialDropdownOptions: OptionItem[] = [
    'Acero al carbon',
    'Acero negro',
    'Agion',
    'Agion Azul',
    'Aluminio',
    'Antifinger',
    'Galvanizado',
    'Inoxidable',
    'Malla Electrosoldada',
    'Pintado',
    'Pintado-Epoxy',
    'Prepintado',
  ].map(item => ({ label: item, value: item }));
  const tipoReordenOptions: OptionItem[] = [
    'Componente',
    'Faltante paneles',
    'Faltante PM',
    'Panel Completo',
    'Partes Metalicas',
    'Skin',
  ].map(item => ({ label: item, value: item }));
  const [openDropdown, setOpenDropdown] = useState<
    'planta' | 'linea' | 'area' | 'subArea' | 'maquina' | 'turno' | 'defecto' | 'causa' | 'material' | 'tipoReorden' | 'componente' | null
  >(null);
  const [lineaOptions, setLineaOptions] = useState<OptionItem[]>([]);
  const [areaOptions, setAreaOptions] = useState<OptionItem[]>([]);
  const [subAreaOptions, setSubAreaOptions] = useState<OptionItem[]>([]);
  const [maquinaOptions, setMaquinaOptions] = useState<OptionItem[]>([]);
  const [defectoOptions, setDefectoOptions] = useState<OptionItem[]>([]);
  const [causaOptions, setCausaOptions] = useState<OptionItem[]>([]);
  const [componenteOptions, setComponenteOptions] = useState<OptionItem[]>([]);
  const [isSemanaChecked, setIsSemanaChecked] = useState(false);
  const [noReprocesar, setNoReprocesar] = useState(false);
  const [panelCompleto, setPanelCompleto] = useState(false);
  const [disparo, setDisparo] = useState(false);
  const [kanban, setKanban] = useState(false);
  const [revisionIngenieria, setRevisionIngenieria] = useState(false);
  const [noPpm, setNoPpm] = useState(false);
  const [usarProgramaComoNumeroParte, setUsarProgramaComoNumeroParte] = useState(false);
  const [manualLinea, setManualLinea] = useState(false);
  const [manualArea, setManualArea] = useState(false);
  const [manualSubArea, setManualSubArea] = useState(false);
  const [manualDefecto, setManualDefecto] = useState(false);
  const [manualCausa, setManualCausa] = useState(false);
  const [manualMaquina, setManualMaquina] = useState(false);

  const [semana, setSemana] = useState('');
  const [numeroParte, setNumeroParte] = useState('');
  const [idNumeroParte, setIdNumeroParte] = useState('');
  const [numeroParteRows, setNumeroParteRows] = useState<NumeroParteRow[]>([]);
  const [numeroParteNoMatch, setNumeroParteNoMatch] = useState(false);
  const [selectedNumeroParteRows, setSelectedNumeroParteRows] = useState<Set<number>>(new Set());
  const [showScanner, setShowScanner] = useState(false);
  const [selectedRowEnsamble, setSelectedRowEnsamble] = useState('');
  const [selectedRowComponente, setSelectedRowComponente] = useState('');
  const [selectedRowSource, setSelectedRowSource] = useState('');
  const [secuencia, setSecuencia] = useState('');
  const [balloon, setBalloon] = useState('');
  const [programa, setPrograma] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [calibreNP, setCalibreNP] = useState('');
  const [materialExterno, setMaterialExterno] = useState('');
  const [calibreExterno, setCalibreExterno] = useState('');
  const [panelTipo, setPanelTipo] = useState<string | null>(null);
  const [tipoReorden, setTipoReorden] = useState('');
  const [componente, setComponente] = useState('');
  const [empleado, setEmpleado] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingToDymo, setIsSendingToDymo] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [printLabelData, setPrintLabelData] = useState<PrintLabelData | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [showPlantaPicker, setShowPlantaPicker] = useState(false);
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  const [showLineaPicker, setShowLineaPicker] = useState(false);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const [showSubAreaPicker, setShowSubAreaPicker] = useState(false);
  const [showDefectoPicker, setShowDefectoPicker] = useState(false);
  const [showCausaPicker, setShowCausaPicker] = useState(false);
  const [showMaquinaPicker, setShowMaquinaPicker] = useState(false);
  const [showTipoReordenPicker, setShowTipoReordenPicker] = useState(false);
  const [showComponentePicker, setShowComponentePicker] = useState(false);
  const [showTurnoPicker, setShowTurnoPicker] = useState(false);

  const nowDateTime = useMemo(() => {
    const now = new Date();
    const dd = `${now.getDate()}`.padStart(2, '0');
    const mm = `${now.getMonth() + 1}`.padStart(2, '0');
    const yy = `${now.getFullYear()}`.slice(-2);
    const hh = `${now.getHours()}`.padStart(2, '0');
    const min = `${now.getMinutes()}`.padStart(2, '0');
    const ss = `${now.getSeconds()}`.padStart(2, '0');
    return {
      display: `${dd}/${mm}/${yy} ${hh}:${min}:${ss}`,
      sql: formatLocalDateTimeForSql(now),
    };
  }, []);

  const materialOptions = useMemo(() => {
    if (numeroParteRows.length === 0) {
      return materialDropdownOptions;
    }

    const uniqueMaterials = Array.from(
      new Set(numeroParteRows.map(row => row.material.trim()).filter(Boolean)),
    );

    return uniqueMaterials.map(item => ({ label: item, value: item }));
  }, [numeroParteRows, materialDropdownOptions]);

  const isNumeroParteTable = useMemo(() => {
    if (numeroParteRows.length === 0) {
      return false;
    }

    return numeroParteRows.every(row => {
      const source = row.raw?.Source ?? row.raw?.source;
      return typeof source === 'string' && source.toLowerCase() === 'numerosparte';
    });
  }, [numeroParteRows]);

  const normalizeOptions = (payload: unknown): OptionItem[] => {
    const getArray = (value: unknown): unknown[] => {
      if (Array.isArray(value)) {
        return value;
      }

      if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        for (const key of Object.keys(obj)) {
          if (Array.isArray(obj[key])) {
            return obj[key] as unknown[];
          }
        }
      }

      return [];
    };

    return getArray(payload)
      .map(item => {
        if (typeof item === 'string' || typeof item === 'number') {
          const text = String(item).trim();
          return text ? { label: text, value: text } : null;
        }

        if (!item || typeof item !== 'object') {
          return null;
        }

        const obj = item as Record<string, unknown>;
        const labelCandidate =
          obj.label ??
          obj.nombre ??
          obj.name ??
          obj.descripcion ??
          obj.description ??
          obj.linea ??
          obj.area ??
          obj.subArea ??
          obj.subarea ??
          obj.maquina ??
          obj.defecto ??
          obj.causa ??
          obj.value;

        if (labelCandidate == null) {
          return null;
        }

        const label = String(labelCandidate).trim();
        if (!label) {
          return null;
        }

        const valueCandidate = obj.id ?? obj._id ?? obj.value ?? label;
        const value = String(valueCandidate).trim() || label;

        return { label, value, raw: obj };
      })
      .filter((option): option is OptionItem => Boolean(option));
  };

  const fetchCatalogOptions = async (url: string, query?: Record<string, string>): Promise<OptionItem[]> => {
    const queryString = query
      ? `?${new URLSearchParams(
          Object.entries(query).reduce<Record<string, string>>((acc, [key, value]) => {
            if (value.trim()) {
              acc[key] = value;
            }
            return acc;
          }, {}),
        ).toString()}`
      : '';

    const responseWithQuery = await fetch(`${url}${queryString}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await responseWithQuery.json().catch(() => null);

    if (!responseWithQuery.ok) {
      throw new Error((data as { message?: string } | null)?.message || 'Error al cargar catalogo');
    }

    return normalizeOptions(data);
  };

  useEffect(() => {
    let mounted = true;

    const fetchNuevoFolio = async () => {
      try {
        const response = await fetch(NEW_FOLIO_URL, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.message || 'No se pudo generar un nuevo folio.');
        }

        const generatedFolio =
          data?.folio ||
          data?.nuevoFolio ||
          data?.newFolio ||
          data?.data?.folio ||
          data?.data?.nuevoFolio;

        if (!generatedFolio || typeof generatedFolio !== 'string') {
          throw new Error('La respuesta no contiene un folio valido.');
        }

        if (mounted) {
          setFolio(generatedFolio);
        }
      } catch (error) {
        if (mounted) {
          setFolio('Sin folio');
          Alert.alert(
            'Folio no disponible',
            error instanceof Error ? error.message : 'Error al generar el folio.',
          );
        }
      }
    };

    const fetchCatalogs = async () => {
      try {
        const [lineas, areas, subAreas, maquinas, defectos, causas] = await Promise.all([
          fetchCatalogOptions(GET_LINEAS_URL),
          fetchCatalogOptions(GET_AREAS_URL),
          fetchCatalogOptions(GET_SUB_AREAS_URL),
          fetchCatalogOptions(GET_MAQUINAS_URL),
          fetchCatalogOptions(GET_DEFECTOS_URL),
          fetchCatalogOptions(GET_CAUSAS_URL),
        ]);

        if (mounted) {
          setLineaOptions(lineas);
          setAreaOptions(areas);
          setSubAreaOptions(subAreas);
          setMaquinaOptions([
            ...maquinas.filter(o => o.label.trim().toUpperCase() === 'N/A'),
            ...maquinas.filter(o => o.label.trim().toUpperCase() !== 'N/A'),
          ]);
          setDefectoOptions(defectos);
          setCausaOptions(causas);
        }
      } catch (error) {
        if (mounted) {
          Alert.alert(
            'Catalogos no disponibles',
            error instanceof Error ? error.message : 'Error al cargar catalogos.',
          );
        }
      }
    };

    fetchNuevoFolio();
    fetchCatalogs();

    return () => {
      mounted = false;
    };
  }, []);

  const toggleDropdown = (
    key:
      | 'planta'
      | 'linea'
      | 'area'
      | 'subArea'
      | 'maquina'
      | 'turno'
      | 'defecto'
      | 'causa'
      | 'material'
      | 'tipoReorden'
      | 'componente',
  ) => {
    setOpenDropdown(current => (current === key ? null : key));
  };

  const handleSelectPlanta = (option: OptionItem) => {
    setPlanta(option.label);
    setOpenDropdown(null);
  };

  const handleAreaSelect = async (option: OptionItem) => {
    setArea(option.label);
    setSubArea('');
    setOpenDropdown(null);

    try {
      const subAreas = await fetchCatalogOptions(GET_SUB_AREAS_URL, {
        area: option.label,
        areaId: option.value,
        idArea: option.value,
      });
      setSubAreaOptions(subAreas);
    } catch {
      setSubAreaOptions([]);
    }
  };

  const handleDefectoSelect = async (option: OptionItem) => {
    setDefecto(option.label);
    setCausa('');
    setOpenDropdown(null);

    try {
      const causas = await fetchCatalogOptions(GET_CAUSAS_URL, {
        defecto: option.label,
        defectoId: option.value,
        idDefecto: option.value,
      });
      setCausaOptions(causas);
    } catch {
      setCausaOptions([]);
    }
  };

  const handleNumeroParteSubmit = async (valueOverride?: string) => {
    const numeroParteTrimmed = (valueOverride ?? numeroParte).trim();
    if (!numeroParteTrimmed) {
      return;
    }

    try {
      const response = await fetch(
        `${GET_NUMERO_PARTE_URL}?numeroParte=${encodeURIComponent(numeroParteTrimmed)}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error((data as { message?: string } | null)?.message || 'No se encontro el numero de parte.');
      }

      // Extraer idNumeroParte
      const rawId =
        (data as Record<string, unknown> | null)?.idNumeroParte ||
        (data as Record<string, unknown> | null)?.id ||
        ((data as Record<string, unknown> | null)?.data as Record<string, unknown> | undefined)
          ?.idNumeroParte ||
        ((data as Record<string, unknown> | null)?.data as Record<string, unknown> | undefined)?.id;

      if (rawId != null) {
        setIdNumeroParte(String(rawId));
      }

      const extractArray = (payload: unknown): unknown[] => {
        if (Array.isArray(payload)) return payload;
        if (payload && typeof payload === 'object') {
          const obj = payload as Record<string, unknown>;
          for (const key of ['numeros', 'data', 'rows', 'items', 'result', 'results', 'partes']) {
            if (Array.isArray(obj[key])) return obj[key] as unknown[];
          }
          for (const key of Object.keys(obj)) {
            if (Array.isArray(obj[key])) return obj[key] as unknown[];
          }
        }
        return [];
      };
      const rawArray: unknown[] = extractArray(data);

      const pickText = (record: Record<string, unknown>, candidates: string[]): string => {
        for (const key of candidates) {
          const value = record[key];
          if (value == null) {
            continue;
          }
          const text = String(value).trim();
          if (text) {
            return text;
          }
        }
        return '';
      };

      const seenIds = new Set<string>();
      const rows: NumeroParteRow[] = rawArray
        .filter(item => item && typeof item === 'object')
        .reduce<NumeroParteRow[]>((acc, item) => {
          const r = item as Record<string, unknown>;
          const id = pickText(r, ['ID', 'id', 'Id', 'idNumeroParte', 'id_numero_parte']);
          if (id && seenIds.has(id)) return acc;
          if (id) seenIds.add(id);
          acc.push({
            linea:      pickText(r, ['Linea', 'linea', 'Línea']),
            ensamble:   pickText(r, ['Ensamble', 'ensamble', 'numeroParte', 'Numero de Parte', 'Part Number']),
            componente: pickText(r, ['Componente', 'componente']),
            cantidad:   pickText(r, ['Cantidad', 'cantidad']),
            material:   pickText(r, ['Material', 'material']),
            calibre:    pickText(r, ['Calibre', 'calibre']),
            secuencia:  pickText(r, ['Secuencia', 'secuencia']),
            balloon:    pickText(r, ['Balloon', 'balloon', 'Balloon Number', 'balloonNumber', 'BalloonNumber']),
            cart:       pickText(r, ['Cart', 'cart']),
            lado:       pickText(r, ['Lado', 'lado']),
            id:         id,
            raw: r,
          });
          return acc;
        }, []);

      setNumeroParteRows(rows);
      setNumeroParteNoMatch(rows.length === 0);
      setSelectedNumeroParteRows(new Set());
      setSelectedRowEnsamble('');
      setSelectedRowComponente('');
      setSelectedRowSource('');
      setSelectedMaterial('');
      setCalibreNP('');
      setMaterialExterno('');
      setCalibreExterno('');
      setPanelTipo(null);
    } catch (error) {
      Alert.alert(
        'Numero de Parte no disponible',
        error instanceof Error ? error.message : 'Error al consultar el numero de parte.',
      );
    }
  };

  const handleSaveReorden = async () => {
    if (isSaving) return;

    if (usarProgramaComoNumeroParte && !programa.trim()) {
      Alert.alert('Dato incompleto', 'Escribe el programa completo en el input de Programa.');
      return;
    }

    setIsSaving(true);
    try {
      const firstSelectedIdx = selectedNumeroParteRows.size > 0 ? [...selectedNumeroParteRows][0] : null;
      const selectedRow = firstSelectedIdx != null ? numeroParteRows[firstSelectedIdx] : null;
      const programaToSave = programa.trim();
      const porPrograma = usarProgramaComoNumeroParte;
      const numeroParteToSave = porPrograma ? null : (numeroParte.trim() || null);
      const secuenciaToSave = usarProgramaComoNumeroParte ? 'Varias' : secuencia;

      const body = {
        folio,
        planta,
        linea,
        area,
        subArea,
        maquina,
        turno,
        defecto,
        causa,
        semana: isSemanaChecked ? semana : '',
        panelCompleto,
        disparo,
        kanban,
        revisionIngenieria,
        revisionConIngenieria: revisionIngenieria,
        numeroParte: numeroParteToSave,
        partNumber: numeroParteToSave,
        idNumeroParte: porPrograma ? null : idNumeroParte,
        partNumberId: porPrograma ? null : idNumeroParte,
        secuencia: secuenciaToSave,
        sequence: secuenciaToSave,
        balloon,
        balloonNumber: balloon,
        ensamble: porPrograma ? null : (selectedRowEnsamble || null),
        selectedEnsamble: porPrograma ? null : (selectedRowEnsamble || null),
        selectedComponente: porPrograma ? null : (selectedRowComponente || null),
        selectedRowSource: porPrograma ? null : (selectedRowSource || null),
        programa: programaToSave,
        porPrograma,
        material: selectedMaterial,
        materialInterno: selectedMaterial,
        calibre: calibreNP,
        calibreInterno: calibreNP,
        materialExterno: materialExterno || null,
        calibreExterno: calibreExterno || null,
        panel: panelTipo,
        tipoReorden,
        tipo: (() => {
          if (noPpm) return 'No PPM';
          if (panelCompleto) return 'Panel Completo';
          if (disparo) return 'Disparo';
          if (kanban) return 'Kanban';
          if (revisionIngenieria) return 'Revision con Ingenieria';
          return null;
        })(),
        componente,
        cantidad,
        empleado,
        comentarios,
        noReprocesar,
        captureDateTime: nowDateTime.sql,
        usuario: loggedNomina || empleado || null,
        numerosParteSelectedId: porPrograma ? null : (selectedRow?.id ?? null),
        noMatchFound: numeroParteNoMatch,
        noPpm,
      };

      let response: Response | null = null;
      let rawText = '';
      let data: Record<string, unknown> | null = null;
      let lastStatus = 0;

      for (const url of SAVE_REORDEN_URLS) {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        rawText = await response.text();
        try {
          data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
        } catch {
          data = null;
        }

        lastStatus = response.status;
        if (response.ok || response.status !== 404) {
          break;
        }
      }

      if (!response || !response.ok) {
        const serverMessage =
          (data?.message as string | undefined) ||
          (data?.error as string | undefined) ||
          rawText ||
          'Error al guardar la reorden.';
        throw new Error(`(${lastStatus || response?.status || 0}) ${serverMessage}`);
      }

      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const hh = now.getHours();
      const min = String(now.getMinutes()).padStart(2, '0');
      const ampm = hh >= 12 ? 'PM' : 'AM';
      const h12 = hh % 12 || 12;
      const isFromEnsambles = selectedRowSource.trim().toLowerCase() === 'ensambles';
      const nextLabelData: PrintLabelData = {
        folio: folio || '',
        fecha: `${dd}/${mm}/${yyyy} ${h12}:${min} ${ampm}`,
        ensamble: isFromEnsambles && !porPrograma ? (selectedRowEnsamble || '') : '',
        parte: porPrograma ? '' : (numeroParte || ''),
        programa: programaToSave,
        porPrograma,
        secuencia: porPrograma ? 'Varias' : (secuencia || '--'),
        defecto: defecto || '--',
        cantidad: cantidad || '',
      };
      setPrintLabelData(nextLabelData);
      setPreviewHtml(buildPreviewHtml(nextLabelData));
      setShowPrintPreview(true);
    } catch (error) {
      Alert.alert(
        'Error al guardar',
        error instanceof Error ? error.message : 'No se pudo guardar la reorden.',
      );
    } finally {
      setIsSaving(false);
    }
  };

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
      if (value.length <= 20) {
        return [value, ''];
      }

      return [value.slice(0, 20), value.slice(20)];
    };

    const [programLine1, programLine2] = splitProgram(safe.programa);

    if (d.porPrograma) {
      const continuationHtml = programLine2 ? `<p class="programContinuation">${programLine2}</p>` : '';
      const programCard = `
        <article class="sheet programSheet">
          <h4>Reorden</h4>
          <p><span>Fecha:</span> <b>${safe.fecha}</b></p>
          <p><span>Programa:</span> <b>${programLine1}</b></p>
          ${continuationHtml}
          <p><span>Secuencia:</span> <b>Varias</b></p>
          <p class="split"><span>Defecto: <b>${safe.defecto}</b></span><span>Cantidad: <b>${safe.cantidad}</b></span></p>
          <p class="programFooter"><b>*PROGRAMA COMPLETO*</b></p>
        </article>
      `;

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
                justify-content: space-between;
                gap: 8px;
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
                text-align: center;
                font-size: 11px;
              }
              @media (max-width: 700px) {
                .grid { grid-template-columns: 1fr; }
              }
            </style>
          </head>
          <body>
            <h3 class="title">Vista previa de impresion</h3>
            <section class="grid">${programCard}${programCard}</section>
          </body>
        </html>
      `;
    }

    const hasEnsamble = !!d.ensamble;
    const hasSecuencia = !!d.secuencia && d.secuencia !== '--' && d.secuencia !== 'N/A';

    let bodyRows: string;
    if (!hasSecuencia && hasEnsamble) {
      // Caso 1: sin secuencia, con ensamble
      bodyRows = `
        <p><span>Folio Reorden:</span> <b>${safe.folio}</b></p>
        <p><span>Fecha y Hora:</span> <b>${safe.fecha}</b></p>
        <p><span>Ensamble:</span> <b>${safe.ensamble}</b></p>
        <p><span>Parte:</span> <b>${safe.parte}</b></p>
        <p class="split"><span>Secuencia: <b>--</b></span><span>Defecto: <b>${safe.defecto}</b></span></p>
        <p><span>Cantidad:</span> <b>${safe.cantidad}</b></p>
      `;
    } else if (hasSecuencia && !hasEnsamble) {
      // Caso 2: con secuencia, sin ensamble
      bodyRows = `
        <p><span>Folio Reorden:</span> <b>${safe.folio}</b></p>
        <p><span>Fecha y Hora:</span> <b>${safe.fecha}</b></p>
        <p><span>Parte:</span> <b>${safe.parte}</b></p>
        <p><span>Secuencia:</span> <b>${safe.secuencia}</b></p>
        <p><span>Defecto:</span> <b>${safe.defecto}</b></p>
        <p><span>Cantidad:</span> <b>${safe.cantidad}</b></p>
      `;
    } else {
      // Caso 3: con secuencia y con ensamble (o fallback sin ambos)
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
              justify-content: space-between;
              gap: 8px;
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

  const handleSendToDymo = async () => {
    if (!printLabelData) {
      return;
    }

    const labelPart = printLabelData.porPrograma ? printLabelData.programa.trim() : printLabelData.parte.trim();
    const normalizedPart = printLabelData.porPrograma ? labelPart : normalizePartValue(labelPart);

    if (!normalizedPart) {
      Alert.alert('Sin datos', printLabelData.porPrograma ? 'No hay programa valido para enviar a DYMO.' : 'No hay numero de parte valido para enviar a DYMO.');
      return;
    }

    const labels = [
      {
        ...printLabelData,
        parte: normalizedPart,
        programa: printLabelData.porPrograma ? normalizedPart : printLabelData.programa,
      },
      {
        ...printLabelData,
        parte: normalizedPart,
        programa: printLabelData.porPrograma ? normalizedPart : printLabelData.programa,
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

      setShowPrintPreview(false);
      setShowSavedModal(true);
    } catch (error) {
      Alert.alert(
        'Error de impresion',
        error instanceof Error ? error.message : 'No fue posible enviar a DYMO.',
      );
    } finally {
      setIsSendingToDymo(false);
    }
  };

  const handleExclusiveProcessToggle = (
    option: 'panelCompleto' | 'disparo' | 'kanban',
  ) => {
    const isCurrentlyChecked =
      (option === 'panelCompleto' && panelCompleto) ||
      (option === 'disparo' && disparo) ||
      (option === 'kanban' && kanban);

    const nextChecked = !isCurrentlyChecked;

    setPanelCompleto(option === 'panelCompleto' ? nextChecked : false);
    setDisparo(option === 'disparo' ? nextChecked : false);
    setKanban(option === 'kanban' ? nextChecked : false);
  };

  const showAndroidToast = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }

    Alert.alert('Aviso', message);
  };

  const toggleManualField = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setOpenDropdown(null);
    setter(prev => !prev);
  };

  const handleToggleProgramaNumeroParte = () => {
    setOpenDropdown(null);

    if (!usarProgramaComoNumeroParte) {
      showAndroidToast('Escribe el programa completo en el input de Programa.');
      setNumeroParte('');
      setIdNumeroParte('');
    }

    setUsarProgramaComoNumeroParte(prev => !prev);
  };

  const renderCatalogField = ({
    label,
    required = false,
    manual,
    onToggleManual,
    value,
    onChangeText,
    placeholder = 'Seleccionar',
    onPress,
  }: {
    label: string;
    required?: boolean;
    manual: boolean;
    onToggleManual: () => void;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    onPress: () => void;
  }) => (
    <View style={styles.halfField}>
      <View style={styles.fieldHeaderRow}>
        <Text style={styles.fieldHeaderLabel}>
          {label}
          {required ? ' *' : ''}
        </Text>
        <CheckOption label="Manual" value={manual} onToggle={onToggleManual} flex={0} />
      </View>
      {manual ? (
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="words"
        />
      ) : (
        <TouchableOpacity style={styles.input} onPress={onPress} activeOpacity={0.8}>
          <View style={styles.selectRow}>
            <Text style={value ? styles.selectText : styles.selectPlaceholderText}>
              {value || placeholder}
            </Text>
            <Text style={styles.selectArrow}>▾</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderPickerModal = ({
    visible,
    onClose,
    title,
    options,
    onSelect,
  }: {
    visible: boolean;
    onClose: () => void;
    title: string;
    options: OptionItem[];
    onSelect: (option: OptionItem) => void | Promise<void>;
  }) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.pickerModalOverlay}>
        <View style={styles.pickerModalCard}>
          <Text style={styles.pickerModalTitle}>{title}</Text>
          <ScrollView style={styles.pickerModalList} keyboardShouldPersistTaps="handled">
            {options.map((option, index) => (
              <TouchableOpacity
                key={`${option.value}-${index}`}
                style={styles.pickerModalOption}
                activeOpacity={0.8}
                onPress={() => {
                  void Promise.resolve(onSelect(option)).finally(onClose);
                }}
              >
                <Text style={styles.pickerModalOptionText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.pickerModalCancelButton} activeOpacity={0.8} onPress={onClose}>
            <Text style={styles.pickerModalCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        scrollEnabled={openDropdown === null}
      >

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>Captura de</Text>
            <Text style={styles.title}>Nueva Reorden</Text>
          </View>
          <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.85}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.requiredFieldsNotice}>Los campos con * son obligatorios</Text>

        {/* ── Tarjeta: Información general ── */}
        <View style={[styles.card, { zIndex: 50 }]}>
          <Text style={styles.sectionTitle}>Información general</Text>
          <View style={styles.row2}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Folio</Text>
              <TextInput style={[styles.input, styles.disabledInput]} value={folio} editable={false} />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Fecha y Hora</Text>
              <TextInput style={[styles.input, styles.disabledInput]} value={nowDateTime.display} editable={false} />
            </View>
          </View>
          <View style={styles.plantaNoReprocessRow}>
            <View style={styles.firstRowRight}>
              <Text style={styles.label}>Planta *</Text>
              <View style={[styles.input, { borderColor: planta ? '#CBD5E0' : '#F6AD55', padding: 0 }]}>
                <TouchableOpacity style={styles.animatedPlantaInner} onPress={() => setShowPlantaPicker(true)} activeOpacity={0.8}>
                  <View style={styles.selectRow}>
                    <Text style={planta ? styles.selectText : styles.selectPlaceholderText}>
                      {planta || 'Selecciona una planta'}
                    </Text>
                    <Text style={styles.selectArrow}>▾</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.checkAligned}>
              <CheckOption
                label="No Reprocesar"
                value={noReprocesar}
                onToggle={() => setNoReprocesar(prev => !prev)}
              />
            </View>
          </View>
        </View>

        {/* ── Tarjeta: Número de Parte ── */}
        <View style={[styles.card, { zIndex: 40, opacity: planta ? 1 : 0.45 }]} pointerEvents={planta ? 'auto' : 'none'}>
          <Text style={styles.sectionTitle}>Número de Parte</Text>
          {idNumeroParte ? (
            <Text style={{ fontSize: 11, color: '#888', marginTop: 2, marginBottom: 4 }}>
              Id: {idNumeroParte}
            </Text>
          ) : null}
          <View style={{ marginBottom: 14 }}>
            <View style={styles.fieldHeaderRow}>
              <Text style={styles.fieldHeaderLabel}>Número de Parte {usarProgramaComoNumeroParte ? '(opcional)' : '*'}</Text>
              <CheckOption label="Programa" value={usarProgramaComoNumeroParte} onToggle={handleToggleProgramaNumeroParte} flex={0} />
            </View>
            <View style={styles.scanInputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }, usarProgramaComoNumeroParte && styles.disabledInput]}
                value={numeroParte}
                onChangeText={text => { setNumeroParte(text.toUpperCase()); setNumeroParteNoMatch(false); }}
                autoCapitalize="characters"
                placeholder="Ingresa y presiona Enter"
                returnKeyType="next"
                editable={!usarProgramaComoNumeroParte}
                onSubmitEditing={() => handleNumeroParteSubmit()}
              />
              <TouchableOpacity
                style={[styles.scanButton, usarProgramaComoNumeroParte && styles.disabledButton]}
                onPress={() => setShowScanner(true)}
                activeOpacity={0.8}
                disabled={usarProgramaComoNumeroParte}
              >
                <Text style={styles.scanButtonText}>📷 Escanear</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.row2}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Programa {usarProgramaComoNumeroParte ? '*' : '(inhabilitado)'}</Text>
              <TextInput
                style={[styles.input, !usarProgramaComoNumeroParte && styles.disabledInput]}
                value={programa}
                onChangeText={setPrograma}
                editable={usarProgramaComoNumeroParte}
                placeholder={usarProgramaComoNumeroParte ? 'Escribe el programa completo' : 'Activa Programa para editar'}
              />
            </View>
          </View>
          <View style={styles.row2}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Secuencia</Text>
              <TextInput
                style={[styles.input, usarProgramaComoNumeroParte && styles.disabledInput]}
                value={usarProgramaComoNumeroParte ? 'Varias' : secuencia}
                onChangeText={setSecuencia}
                editable={!usarProgramaComoNumeroParte}
                placeholder={usarProgramaComoNumeroParte ? 'Varias' : ''}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Balloon Number</Text>
              <TextInput style={styles.input} value={balloon} onChangeText={setBalloon} />
            </View>
          </View>
          <View style={styles.row2}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Material</Text>
              <TouchableOpacity
                style={[styles.input, numeroParteRows.length > 0 && styles.disabledInput]}
                onPress={() => {
                  if (numeroParteRows.length === 0) {
                    setShowMaterialPicker(true);
                  }
                }}
                activeOpacity={numeroParteRows.length === 0 ? 0.8 : 1}
                disabled={numeroParteRows.length > 0}
              >
                <View style={styles.selectRow}>
                  <Text style={selectedMaterial ? styles.selectText : styles.selectPlaceholderText}>
                    {numeroParteRows.length > 0
                      ? selectedMaterial || 'Selecciona una fila en la tabla'
                      : selectedMaterial || 'Selecciona material'}
                  </Text>
                  <Text style={styles.selectArrow}>▾</Text>
                </View>
              </TouchableOpacity>
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Calibre</Text>
              <TextInput
                style={[styles.input, numeroParteRows.length > 0 && styles.disabledInput]}
                value={calibreNP}
                onChangeText={setCalibreNP}
                editable={numeroParteRows.length === 0}
              />
            </View>
          </View>
        </View>

        {/* ── Tabla de resultados Número de Parte ── */}
        {numeroParteRows.length > 0 && (
          <View style={[styles.card, { zIndex: 25 }]}>
            <Text style={styles.sectionTitle}>Resultados encontrados</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                {/* Encabezado */}
                <View style={styles.tableHeader}>
                  <View style={styles.tableColCheck} />
                  {['Línea', 'Número de Parte', 'Material', 'Calibre', 'Secuencia', 'Balloon', 'Cart', 'Lado'].map(h => (
                    <Text key={h} style={[styles.tableHeaderCell, styles.tableColText]}>{h}</Text>
                  ))}
                </View>
                {/* Filas */}
                {numeroParteRows.map((row, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.tableRow,
                      idx % 2 === 1 && styles.tableRowAlt,
                      selectedNumeroParteRows.has(idx) && styles.tableRowSelected,
                    ]}
                    onPress={() => {
                      const newSelected = new Set(selectedNumeroParteRows);
                      const wasSelected = newSelected.has(idx);
                      if (wasSelected) {
                        newSelected.delete(idx);
                      } else {
                        newSelected.add(idx);
                        // Actualizar campos del contexto con la última fila agregada
                        const rowSourceRaw = row.raw?.Source ?? row.raw?.source;
                        const rowSource = typeof rowSourceRaw === 'string' ? rowSourceRaw.trim() : '';
                        // Para filas _Ins/_Out limpiar ensamble para que backend use body.numeroParte
                        const rowEnsambleUpper = (row.ensamble || '').toUpperCase();
                        const isInsOutRow = rowEnsambleUpper.endsWith('_INS') || rowEnsambleUpper.endsWith('_OUT');
                        setSelectedRowEnsamble(isInsOutRow ? '' : (row.ensamble || ''));
                        setSelectedRowComponente(row.componente || '');
                        setSelectedRowSource(rowSource);
                        if (row.linea) setLinea(row.linea);
                        if (row.id)    setIdNumeroParte(row.id);
                        if (row.componente) {
                          setComponente('');
                          setTipoReorden('Componente');
                          setOpenDropdown(null);
                          void fetchCatalogOptions(GET_COMPONENTES_URL)
                            .then(opts => setComponenteOptions(opts))
                            .catch(() => setComponenteOptions([]));
                        }
                        if (row.cantidad)   setCantidad(row.cantidad);
                        setSelectedMaterial(row.material || '');
                        setCalibreNP(row.calibre || '');
                      }
                      setSelectedNumeroParteRows(newSelected);
                      // Secuencia y Balloon: concatenar valores de todas las filas seleccionadas
                      const allRows = [...newSelected].map(i => numeroParteRows[i]);

                      // Detectar caso Panel Completo (_Ins + _Out)
                      const insRow = allRows.find(r => r.ensamble.toUpperCase().endsWith('_INS'));
                      const outRow = allRows.find(r => r.ensamble.toUpperCase().endsWith('_OUT'));
                      if (allRows.length === 2 && insRow && outRow) {
                        const insBase = insRow.ensamble.slice(0, -4);
                        const outBase = outRow.ensamble.slice(0, -4);
                        if (insBase.toUpperCase() === outBase.toUpperCase()) {
                          // Limpiar selectedRowEnsamble para que el backend use body.numeroParte (lo que escribió el usuario)
                          setSelectedRowEnsamble('');
                          setPanelCompleto(true);
                          setPanelTipo('Completo');
                          setDisparo(false);
                          setKanban(false);
                          setSelectedMaterial(insRow.material || '');
                          setCalibreNP(insRow.calibre || '');
                          setMaterialExterno(outRow.material || '');
                          setCalibreExterno(outRow.calibre || '');
                          setSecuencia(insRow.secuencia || outRow.secuencia || '');
                          setBalloon(insRow.balloon || outRow.balloon || '');
                          return;
                        }
                      }

                      // Escenario 2: solo _Ins seleccionado
                      if (allRows.length === 1 && allRows[0].ensamble.toUpperCase().endsWith('_INS')) {
                        setPanelTipo('Inside');
                        setSelectedMaterial(allRows[0].material || '');
                        setCalibreNP(allRows[0].calibre || '');
                        setMaterialExterno('');
                        setCalibreExterno('');
                        setSecuencia(allRows[0].secuencia || '');
                        setBalloon(allRows[0].balloon || '');
                        return;
                      }

                      // Escenario 3: solo _Out seleccionado
                      if (allRows.length === 1 && allRows[0].ensamble.toUpperCase().endsWith('_OUT')) {
                        setPanelTipo('Outside');
                        setSelectedMaterial('');
                        setCalibreNP('');
                        setMaterialExterno(allRows[0].material || '');
                        setCalibreExterno(allRows[0].calibre || '');
                        setSecuencia(allRows[0].secuencia || '');
                        setBalloon(allRows[0].balloon || '');
                        return;
                      }

                      // Caso normal: resetear campos externo y panelTipo
                      setPanelTipo(null);
                      setMaterialExterno('');
                      setCalibreExterno('');
                      setSecuencia(allRows.map(r => r.secuencia || '').filter(Boolean).join(', '));
                      setBalloon(allRows.map(r => r.balloon || '').filter(Boolean).join(', '));
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={styles.tableColCheck}>
                      <View style={[styles.checkbox, selectedNumeroParteRows.has(idx) && styles.checkboxChecked]}>
                        {selectedNumeroParteRows.has(idx) ? <Text style={styles.checkboxMark}>✓</Text> : null}
                      </View>
                    </View>
                    {[row.linea, row.ensamble, row.material, row.calibre, row.secuencia, row.balloon, row.cart, row.lado
                    ].map((val, ci) => (
                      <Text key={ci} style={[styles.tableCellText, styles.tableColText]}>{val || 'N/A'}</Text>
                    ))}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ── Tarjeta: Proceso ── */}
        <View style={[styles.card, { zIndex: 30, opacity: planta ? 1 : 0.45 }]} pointerEvents={planta ? 'auto' : 'none'}>
          <Text style={styles.sectionTitle}>Proceso</Text>
          <View style={styles.checksRow}>
            <CheckOption
              label="Semana"
              value={isSemanaChecked}
              onToggle={() => setIsSemanaChecked(prev => !prev)}
              flex={0}
            />
            <TextInput
              style={[styles.input, styles.weekInput, !isSemanaChecked && styles.disabledInput]}
              value={semana}
              onChangeText={text => setSemana(text.replace(/\D/g, ''))}
              placeholder={isSemanaChecked ? '' : 'Ej: 42'}
              editable={isSemanaChecked}
              keyboardType="number-pad"
            />
            <CheckOption
              label="Disparo"
              value={disparo}
              onToggle={() => handleExclusiveProcessToggle('disparo')}
              flex={0}
            />
          </View>
          <View style={styles.checksRow}>
            <CheckOption
              label="Panel Completo"
              value={panelCompleto}
              onToggle={() => handleExclusiveProcessToggle('panelCompleto')}
              flex={0}
            />
            <CheckOption
              label="Kanban"
              value={kanban}
              onToggle={() => handleExclusiveProcessToggle('kanban')}
              flex={0}
            />
          </View>
          <View style={styles.checksRow}>
            <CheckOption
              label="No PPM"
              value={noPpm}
              onToggle={() => setNoPpm(prev => !prev)}
              flex={0}
            />
            <CheckOption
              label="Revision con ingenieria"
              value={revisionIngenieria}
              onToggle={() => setRevisionIngenieria(prev => !prev)}
              flex={0}
            />
          </View>
        </View>

        {/* ── Tarjeta: Detalles del defecto ── */}
        <View style={[styles.card, { zIndex: 20, opacity: planta ? 1 : 0.45 }]} pointerEvents={planta ? 'auto' : 'none'}>
          <Text style={styles.sectionTitle}>Detalles del defecto</Text>

          <View style={styles.row2}>
            {renderCatalogField({
              label: 'Línea',
              required: true,
              manual: manualLinea,
              onToggleManual: () => toggleManualField(setManualLinea),
              value: linea,
              onChangeText: setLinea,
              placeholder: 'Seleccionar',
              onPress: () => setShowLineaPicker(true),
            })}
            {renderCatalogField({
              label: 'Área',
              required: true,
              manual: manualArea,
              onToggleManual: () => toggleManualField(setManualArea),
              value: area,
              onChangeText: setArea,
              placeholder: 'Seleccionar',
              onPress: () => setShowAreaPicker(true),
            })}
          </View>

          <View style={styles.row2}>
            {renderCatalogField({
              label: 'Sub Área',
              manual: manualSubArea,
              onToggleManual: () => toggleManualField(setManualSubArea),
              value: subArea,
              onChangeText: setSubArea,
              placeholder: 'Seleccionar',
              onPress: () => setShowSubAreaPicker(true),
            })}
            {renderCatalogField({
              label: 'Defecto',
              required: true,
              manual: manualDefecto,
              onToggleManual: () => toggleManualField(setManualDefecto),
              value: defecto,
              onChangeText: setDefecto,
              placeholder: 'Seleccionar',
              onPress: () => setShowDefectoPicker(true),
            })}
          </View>

          <View style={styles.row2}>
            {renderCatalogField({
              label: 'Causa',
              required: true,
              manual: manualCausa,
              onToggleManual: () => toggleManualField(setManualCausa),
              value: causa,
              onChangeText: setCausa,
              placeholder: 'Seleccionar',
              onPress: () => setShowCausaPicker(true),
            })}
            {renderCatalogField({
              label: 'Máquina',
              required: true,
              manual: manualMaquina,
              onToggleManual: () => toggleManualField(setManualMaquina),
              value: maquina,
              onChangeText: setMaquina,
              placeholder: 'Seleccionar',
              onPress: () => setShowMaquinaPicker(true),
            })}
          </View>

          <View style={styles.row2}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Tipo Reorden *</Text>
              <TouchableOpacity style={styles.input} onPress={() => setShowTipoReordenPicker(true)} activeOpacity={0.8}>
                <View style={styles.selectRow}>
                  <Text style={tipoReorden ? styles.selectText : styles.selectPlaceholderText}>
                    {tipoReorden || 'Seleccionar tipo reorden'}
                  </Text>
                  <Text style={styles.selectArrow}>▾</Text>
                </View>
              </TouchableOpacity>
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Componente</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={async () => {
                  if (componenteOptions.length === 0) {
                    try {
                      const opts = await fetchCatalogOptions(GET_COMPONENTES_URL);
                      setComponenteOptions(opts);
                    } catch {
                      setComponenteOptions([]);
                    }
                  }
                  setShowComponentePicker(true);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.selectRow}>
                  <Text style={componente ? styles.selectText : styles.selectPlaceholderText}>
                    {componente || 'Seleccionar componente'}
                  </Text>
                  <Text style={styles.selectArrow}>▾</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.row2}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Cantidad *</Text>
              <TextInput
                style={styles.input}
                value={cantidad}
                onChangeText={setCantidad}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </View>

        {/* ── Tarjeta: Comentarios ── */}
        <View style={[styles.card, { zIndex: 10, opacity: planta ? 1 : 0.45 }]} pointerEvents={planta ? 'auto' : 'none'}>
          <Text style={styles.sectionTitle}>Comentarios</Text>

          <View style={styles.row2}>
            <View style={styles.halfField}>
              <Text style={styles.label}>Turno *</Text>
              <TouchableOpacity style={styles.input} onPress={() => setShowTurnoPicker(true)} activeOpacity={0.8}>
                <View style={styles.selectRow}>
                  <Text style={turno ? styles.selectText : styles.selectPlaceholderText}>
                    {turno || 'Seleccionar'}
                  </Text>
                  <Text style={styles.selectArrow}>▾</Text>
                </View>
              </TouchableOpacity>
            </View>
            <View style={styles.halfField}>
              <Text style={styles.label}>Empleado</Text>
              <TextInput style={styles.input} value={empleado} onChangeText={setEmpleado} />
            </View>
          </View>

          <TextInput
            style={styles.commentsInput}
            multiline
            value={comentarios}
            onChangeText={setComentarios}
            placeholder="Escribe comentarios adicionales aquí..."
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && { opacity: 0.6 }]}
          activeOpacity={0.85}
          onPress={handleSaveReorden}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>{isSaving ? 'Guardando...' : 'Guardar Reorden'}</Text>
        </TouchableOpacity>

      </ScrollView>

      {renderPickerModal({
        visible: showPlantaPicker,
        onClose: () => setShowPlantaPicker(false),
        title: 'Selecciona planta',
        options: plantOptions,
        onSelect: option => {
          handleSelectPlanta(option);
        },
      })}

      {renderPickerModal({
        visible: showMaterialPicker,
        onClose: () => setShowMaterialPicker(false),
        title: 'Selecciona material',
        options: materialOptions,
        onSelect: option => {
          setSelectedMaterial(option.value);
        },
      })}

      {renderPickerModal({
        visible: showLineaPicker,
        onClose: () => setShowLineaPicker(false),
        title: 'Selecciona línea',
        options: lineaOptions,
        onSelect: option => {
          setLinea(option.label);
        },
      })}

      {renderPickerModal({
        visible: showAreaPicker,
        onClose: () => setShowAreaPicker(false),
        title: 'Selecciona área',
        options: areaOptions,
        onSelect: option => {
          handleAreaSelect(option);
        },
      })}

      {renderPickerModal({
        visible: showSubAreaPicker,
        onClose: () => setShowSubAreaPicker(false),
        title: 'Selecciona sub área',
        options: subAreaOptions,
        onSelect: option => {
          setSubArea(option.label);
        },
      })}

      {renderPickerModal({
        visible: showDefectoPicker,
        onClose: () => setShowDefectoPicker(false),
        title: 'Selecciona defecto',
        options: defectoOptions,
        onSelect: option => {
          handleDefectoSelect(option);
        },
      })}

      {renderPickerModal({
        visible: showCausaPicker,
        onClose: () => setShowCausaPicker(false),
        title: 'Selecciona causa',
        options: causaOptions,
        onSelect: option => {
          setCausa(option.label);
        },
      })}

      {renderPickerModal({
        visible: showMaquinaPicker,
        onClose: () => setShowMaquinaPicker(false),
        title: 'Selecciona máquina',
        options: maquinaOptions,
        onSelect: option => {
          setMaquina(option.label);
        },
      })}

      {renderPickerModal({
        visible: showTipoReordenPicker,
        onClose: () => setShowTipoReordenPicker(false),
        title: 'Selecciona tipo reorden',
        options: tipoReordenOptions,
        onSelect: async option => {
          setTipoReorden(option.value);
          if (option.value === 'Componente') {
            try {
              const opts = await fetchCatalogOptions(GET_COMPONENTES_URL);
              setComponenteOptions(opts);
            } catch {
              setComponenteOptions([]);
            }
          }
        },
      })}

      {renderPickerModal({
        visible: showComponentePicker,
        onClose: () => setShowComponentePicker(false),
        title: 'Selecciona componente',
        options: componenteOptions,
        onSelect: option => {
          setComponente(option.label);
        },
      })}

      {renderPickerModal({
        visible: showTurnoPicker,
        onClose: () => setShowTurnoPicker(false),
        title: 'Selecciona turno',
        options: turnoOptions,
        onSelect: option => {
          setTurno(option.label);
        },
      })}

      {/* ── Modal vista previa de impresión ── */}
      <Modal
        visible={showPrintPreview}
        animationType="slide"
        onRequestClose={() => { setShowPrintPreview(false); setShowSavedModal(true); }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalToolbar}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => { setShowPrintPreview(false); setShowSavedModal(true); }}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCloseButtonText}>Cerrar</Text>
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Vista previa</Text>

            <TouchableOpacity
              style={[styles.modalDymoButton, isSendingToDymo && { opacity: 0.7 }]}
              onPress={handleSendToDymo}
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

      <Modal
        visible={showSavedModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowSavedModal(false); onBack(); }}
      >
        <View style={styles.savedModalOverlay}>
          <View style={styles.savedModalBox}>
            <Text style={styles.savedModalIcon}>✓</Text>
            <Text style={styles.savedModalTitle}>Reorden guardada</Text>
            <Text style={styles.savedModalBody}>La reorden se guardó correctamente.</Text>
            <TouchableOpacity
              style={styles.savedModalButton}
              onPress={() => { setShowSavedModal(false); onBack(); }}
              activeOpacity={0.85}
            >
              <Text style={styles.savedModalButtonText}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {showScanner && (
        <BarcodeScannerModal
          visible={showScanner}
          onScan={value => {
            setShowScanner(false);
            setNumeroParte(value);
            setNumeroParteNoMatch(false);
            void handleNumeroParteSubmit(value);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* ── Contenedor principal ── */
  safeArea: {
    marginTop: 20,
    flex: 1,
    backgroundColor: '#F0F4FA',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 36,
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#718096',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A49D8',
  },
  requiredFieldsNotice: {
    fontSize: 11,
    color: '#C53030',
    fontWeight: '600',
    marginTop: -8,
    marginBottom: 12,
  },
  backButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  backButtonText: {
    color: '#2D3748',
    fontSize: 15,
    fontWeight: '600',
  },

  /* ── Tarjeta ── */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#1A2A3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1A49D8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EBF0F8',
  },

  /* ── Filas de campos ── */
  row2: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  row3: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  plantaNoReprocessRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  firstRowRight: {
    flex: 1,
    maxWidth: 280,
    position: 'relative',
    zIndex: 30,
  },
  checkAligned: {
    paddingBottom: 10,
    justifyContent: 'flex-end',
  },

  /* ── Etiqueta e input ── */
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 6,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  fieldHeaderLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A5568',
    flexShrink: 1,
  },
  animatedPlantaInner: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 10,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#CBD5E0',
    backgroundColor: '#F7FAFC',
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 12,
    color: '#1A2230',
    fontSize: 15,
  },
  disabledInput: {
    backgroundColor: '#EDF2F7',
    color: '#718096',
    borderColor: '#E2E8F0',
  },

  /* ── Select / Dropdown ── */
  selectContainer: {
    position: 'relative',
  },
  selectBox: {
    borderWidth: 1.5,
    borderColor: '#CBD5E0',
    backgroundColor: '#F7FAFC',
    borderRadius: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    color: '#1A2230',
    fontSize: 15,
    flex: 1,
  },
  selectPlaceholderText: {
    color: '#A0AEC0',
    fontSize: 15,
    flex: 1,
  },
  selectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectArrow: {
    color: '#718096',
    fontSize: 14,
    marginLeft: 8,
  },
  dropdownList: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: '#CBD5E0',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
    zIndex: 40,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4FA',
  },
  dropdownItemText: {
    color: '#2D3748',
    fontSize: 15,
  },

  /* ── Checkboxes ── */
  checksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  semanaRow: {
    justifyContent: 'flex-start',
  },
  checkOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: '#A0AEC0',
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },
  checkboxChecked: {
    backgroundColor: '#1A49D8',
    borderColor: '#1A49D8',
  },
  checkboxMark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  checkLabel: {
    color: '#2D3748',
    fontSize: 14,
    fontWeight: '600',
  },
  weekInput: {
    width: 90,
    height: 48,
  },

  /* ── Campos de formulario ── */
  formField: {
    width: '100%',
  },
  halfField: {
    flex: 1,
  },
  thirdField: {
    flex: 1,
    minWidth: '30%',
  },
  commentsInput: {
    borderWidth: 1.5,
    borderColor: '#CBD5E0',
    backgroundColor: '#F7FAFC',
    borderRadius: 10,
    minHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#1A2230',
    fontSize: 15,
  },

  /* ── Tabla Número de Parte ── */
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#EBF0F8',
    borderBottomWidth: 1.5,
    borderBottomColor: '#CBD5E0',
    paddingVertical: 10,
  },
  tableHeaderCell: {
    fontWeight: '700',
    fontSize: 13,
    color: '#2D3748',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4FA',
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#F7FAFC',
  },
  tableRowSelected: {
    backgroundColor: '#EBF2FF',
  },
  tableColCheck: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableColText: {
    width: 130,
    paddingHorizontal: 10,
  },
  tableCellText: {
    fontSize: 14,
    color: '#4A5568',
  },

  /* ── Escanear código de barras ── */
  scanInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanButton: {
    backgroundColor: '#2B6CB0',
    paddingHorizontal: 18,
    paddingVertical: 0,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  disabledButton: {
    opacity: 0.55,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  /* ── Botón Guardar ── */
  saveButton: {
    height: 58,
    borderRadius: 14,
    backgroundColor: '#1A49D8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#1A49D8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 30,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  /* ── Modal de impresión ── */
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  savedModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  savedModalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  savedModalIcon: {
    fontSize: 48,
    color: '#1b7d31',
    marginBottom: 12,
  },
  savedModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1b7d31',
    marginBottom: 8,
  },
  savedModalBody: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 24,
  },
  savedModalButton: {
    backgroundColor: '#1A49D8',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 40,
  },
  savedModalButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
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
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(16, 32, 51, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  pickerModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    maxHeight: '70%',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  pickerModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A49D8',
    marginBottom: 12,
  },
  pickerModalList: {
    maxHeight: 280,
  },
  pickerModalOption: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D8E0EB',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  pickerModalOptionText: {
    color: '#102033',
    fontSize: 14,
    fontWeight: '500',
  },
  pickerModalCancelButton: {
    marginTop: 8,
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  pickerModalCancelText: {
    color: '#2D3748',
    fontSize: 14,
    fontWeight: '600',
  },
  webView: {
    flex: 1,
    backgroundColor: '#E5E7EB',
  },
});
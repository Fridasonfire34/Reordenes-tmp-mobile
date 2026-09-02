import React, { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { API_ENDPOINTS } from '../config/api';
import { toSqlDateTimeFromDisplay } from '../utils/dateTime';

type RDMsScreenProps = {
  onBack: () => void;
  loggedUser: string;
  loggedNomina: string;
  onGoToFotosRDM: (folio: string, payload: RdmSavePayload) => void;
  initialDraft: RdmDraft | null;
  onDraftChange: (draft: RdmDraft) => void;
};

type FormState = {
  folio: string;
  auditor: string;
  fecha: string;
  codigoMaterial: string;
  material: string;
  numeroTag: string;
  proveedor: string;
  cantidad: string;
  unidad: string;
  rechazo: string;
  disposicion: string;
  status: string;
  aplicacionDesviacion: string;
};

type FormKey = keyof FormState;

type MaterialCatalogItem = {
  codigo: string;
  descripcion: string;
};

type MaterialItem = {
  key: string;
  codigo: string;
  descripcion: string;
  cantidad: string;
  tag: string;
};

export type RdmDraft = {
  form: FormState;
};

export type RdmSavePayload = {
  folio: string;
  auditor: string;
  fecha: string;
  codigoMaterial: string;
  descripcion: string;
  material: string;
  numeroTag: string;
  proveedor: string;
  cantidad: string;
  unidad: string;
  rechazo: string;
  disposicion: string;
  status: string;
  aplicacionDesviacion: string;
  captureDateTime: string;
};

const formatCurrentDateTime = (): string => {
  const now = new Date();
  const day = `${now.getDate()}`.padStart(2, '0');
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const year = `${now.getFullYear()}`;

  const rawHours = now.getHours();
  const minutes = `${now.getMinutes()}`.padStart(2, '0');
  const amPm = rawHours >= 12 ? 'PM' : 'AM';
  const hours12 = rawHours % 12 === 0 ? 12 : rawHours % 12;
  const hours = `${hours12}`.padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes} ${amPm}`;
};

const RDM_ROLLOS_MATL_URL = API_ENDPOINTS.rdmRollosMatl;
const OTHER_OPTION = 'Otro';

const splitValues = (value: string): string[] => {
  if (!value) {
    return [];
  }

  return value.split(',').map(v => v.trim());
};

const joinValues = (items: string[]): string => items.filter(v => v.length > 0).join(', ');

let materialItemKeyCounter = 0;
const createMaterialItemKey = (): string => {
  materialItemKeyCounter += 1;
  return `item-${Date.now()}-${materialItemKeyCounter}`;
};

const createEmptyMaterialItem = (): MaterialItem => ({
  key: createMaterialItemKey(),
  codigo: '',
  descripcion: '',
  cantidad: '',
  tag: '',
});

const buildInitialMaterialItems = (form?: FormState | null): MaterialItem[] => {
  if (!form) {
    return [createEmptyMaterialItem()];
  }

  const codigos = splitValues(form.codigoMaterial);
  const descripciones = splitValues(form.material);
  const cantidades = splitValues(form.cantidad);
  const tags = splitValues(form.numeroTag);
  const length = Math.max(codigos.length, descripciones.length, cantidades.length, tags.length);

  if (length === 0) {
    return [createEmptyMaterialItem()];
  }

  const items: MaterialItem[] = [];
  for (let index = 0; index < length; index += 1) {
    items.push({
      key: createMaterialItemKey(),
      codigo: codigos[index] ?? '',
      descripcion: descripciones[index] ?? '',
      cantidad: cantidades[index] ?? '',
      tag: tags[index] ?? '',
    });
  }

  return items;
};

const getStringFromKeys = (source: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
};

const normalizeMaterialCatalog = (payload: unknown): MaterialCatalogItem[] => {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown[] }).data)
      ? (payload as { data: unknown[] }).data
      : payload && typeof payload === 'object' && Array.isArray((payload as { results?: unknown[] }).results)
        ? (payload as { results: unknown[] }).results
        : payload && typeof payload === 'object' && Array.isArray((payload as { items?: unknown[] }).items)
          ? (payload as { items: unknown[] }).items
          : [];

  const uniqueByPair = new Set<string>();
  const normalized: MaterialCatalogItem[] = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      continue;
    }

    const source = row as Record<string, unknown>;
    const codigo = getStringFromKeys(source, ['Codigo', 'codigo', 'CODIGO']);
    const descripcion = getStringFromKeys(source, ['Descripcion', 'descripcion', 'DESCRIPCION']);

    if (!codigo || !descripcion) {
      continue;
    }

    const pairKey = `${codigo}__${descripcion}`;
    if (uniqueByPair.has(pairKey)) {
      continue;
    }

    uniqueByPair.add(pairKey);
    normalized.push({ codigo, descripcion });
  }

  return normalized;
};

export default function RDMsScreen({
  onBack,
  loggedUser,
  loggedNomina,
  onGoToFotosRDM,
  initialDraft,
  onDraftChange,
}: RDMsScreenProps) {
  const disposicionOptions = ['Desviacion', 'Devolucion', 'SCRAP', 'Retrabajo'];

  const [isLoadingFolio, setIsLoadingFolio] = useState(false);
  const [isLoadingMaterialCatalog, setIsLoadingMaterialCatalog] = useState(false);
  const [isLoadingProveedores, setIsLoadingProveedores] = useState(false);
  const [materialCatalog, setMaterialCatalog] = useState<MaterialCatalogItem[]>([]);
  const [proveedorOptions, setProveedorOptions] = useState<string[]>([]);
  const [showCodigoMaterialPicker, setShowCodigoMaterialPicker] = useState(false);
  const [showProveedorPicker, setShowProveedorPicker] = useState(false);
  const [showDisposicionPicker, setShowDisposicionPicker] = useState(false);
  const [isProveedorManual, setIsProveedorManual] = useState(false);
  const [keyboardPadding, setKeyboardPadding] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualCodigoInput, setManualCodigoInput] = useState('');
  const [activeMaterialItemKey, setActiveMaterialItemKey] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(() => {
    if (initialDraft?.form) {
      return initialDraft.form;
    }

    return {
      folio: '',
      auditor: loggedNomina || loggedUser || 'Usuario',
      fecha: formatCurrentDateTime(),
      codigoMaterial: '',
      material: '',
      numeroTag: '',
      proveedor: '',
      cantidad: '',
      unidad: '',
      rechazo: '',
      disposicion: '',
      status: '',
      aplicacionDesviacion: formatCurrentDateTime(),
    };
  });

  const [materialItems, setMaterialItems] = useState<MaterialItem[]>(() =>
    buildInitialMaterialItems(initialDraft?.form ?? null),
  );

  const updateField = (key: FormKey, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const codigoMaterialOptions = Array.from(new Set(materialCatalog.map(item => item.codigo)));

  const updateMaterialItem = (key: string, field: 'codigo' | 'descripcion' | 'cantidad' | 'tag', value: string) => {
    const normalizedValue = field === 'cantidad' ? value.replace(/\D/g, '') : value;
    setMaterialItems(prev => prev.map(item => (item.key === key ? { ...item, [field]: normalizedValue } : item)));
  };

  const addMaterialItem = () => {
    setMaterialItems(prev => [...prev, createEmptyMaterialItem()]);
  };

  const removeMaterialItem = (key: string) => {
    setMaterialItems(prev => {
      if (prev.length <= 1) {
        return prev.map(item => (item.key === key ? { ...item, codigo: '', descripcion: '', cantidad: '', tag: '' } : item));
      }
      return prev.filter(item => item.key !== key);
    });
  };

  const openCodigoPickerForItem = (key: string) => {
    setActiveMaterialItemKey(key);
    setShowCodigoMaterialPicker(true);
  };

  const closeCodigoPicker = () => {
    setShowCodigoMaterialPicker(false);
    setActiveMaterialItemKey(null);
    setSearchQuery('');
    setManualCodigoInput('');
  };

  const handleSelectCodigoForActiveItem = (codigo: string) => {
    if (!activeMaterialItemKey) {
      return;
    }

    const match = materialCatalog.find(item => item.codigo === codigo);
    setMaterialItems(prev => prev.map(item => (
      item.key === activeMaterialItemKey
        ? { ...item, codigo, descripcion: match ? match.descripcion : item.descripcion }
        : item
    )));
    closeCodigoPicker();
  };

  const handleManualCodigoSubmit = () => {
    const value = manualCodigoInput.trim();
    if (!value || !activeMaterialItemKey) {
      return;
    }

    setMaterialItems(prev => prev.map(item => (
      item.key === activeMaterialItemKey ? { ...item, codigo: value } : item
    )));
    closeCodigoPicker();
  };

  const handleSelectProveedor = (proveedor: string) => {
    if (proveedor === OTHER_OPTION) {
      setIsProveedorManual(true);
      updateField('proveedor', '');
      setShowProveedorPicker(false);
      return;
    }

    setIsProveedorManual(false);
    updateField('proveedor', proveedor);
    setShowProveedorPicker(false);
  };

  const hasIncompleteMaterialRow = materialItems.some(
    item => !item.codigo.trim() || !item.descripcion.trim() || !item.cantidad.trim() || !item.tag.trim(),
  );

  const missingRequiredFields = [
    { label: 'Renglones de material (Codigo, Descripcion, Cantidad y No. Tag)', value: hasIncompleteMaterialRow ? '' : '1' },
    { label: 'Proveedor', value: form.proveedor },
  ]
    .filter(field => !field.value.trim())
    .map(field => field.label);

  const isMainActionDisabled =
    isLoadingFolio || !form.folio.trim() || missingRequiredFields.length > 0;

  useEffect(() => {
    setForm(prev => ({ ...prev, auditor: loggedNomina || loggedUser || 'Usuario' }));
  }, [loggedNomina, loggedUser]);

  useEffect(() => {
    const codigoJoined = joinValues(materialItems.map(item => item.codigo));
    const descripcionJoined = joinValues(materialItems.map(item => item.descripcion));
    const cantidadJoined = joinValues(materialItems.map(item => item.cantidad));
    const tagJoined = joinValues(materialItems.map(item => item.tag));

    setForm(prev => {
      if (
        prev.codigoMaterial === codigoJoined
        && prev.material === descripcionJoined
        && prev.cantidad === cantidadJoined
        && prev.numeroTag === tagJoined
      ) {
        return prev;
      }

      return {
        ...prev,
        codigoMaterial: codigoJoined,
        material: descripcionJoined,
        cantidad: cantidadJoined,
        numeroTag: tagJoined,
      };
    });
  }, [materialItems]);

  useEffect(() => {
    onDraftChange({
      form,
    });
  }, [form, onDraftChange]);

  useEffect(() => {
    const fetchRdmFolio = async () => {
      if (form.folio) {
        return;
      }

      setIsLoadingFolio(true);
      try {
        const response = await fetch(API_ENDPOINTS.newRdmFolio, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
              ? data.message
              : 'No fue posible generar el folio RDM.';
          throw new Error(message);
        }

        const folio =
          data && typeof data === 'object' && 'folio' in data && typeof data.folio === 'string'
            ? data.folio
            : '';

        if (!folio) {
          throw new Error('El backend no devolvio un folio valido.');
        }

        setForm(prev => ({ ...prev, folio }));
      } catch (error) {
        Alert.alert(
          'Folio no disponible',
          error instanceof Error ? error.message : 'No fue posible generar el folio RDM.',
        );
      } finally {
        setIsLoadingFolio(false);
      }
    };

    void fetchRdmFolio();
  }, [form.folio]);

  useEffect(() => {
    const fetchMaterialCatalog = async () => {
      setIsLoadingMaterialCatalog(true);
      try {
        const response = await fetch(RDM_ROLLOS_MATL_URL, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
              ? payload.message
              : 'No fue posible cargar codigos y descripciones.';
          throw new Error(message);
        }

        const catalog = normalizeMaterialCatalog(payload);

        if (catalog.length === 0) {
          throw new Error('El backend no devolvio catalogo de materiales valido.');
        }

        setMaterialCatalog(catalog);
      } catch (error) {
        Alert.alert(
          'Catalogo no disponible',
          error instanceof Error ? error.message : 'No fue posible cargar codigos y descripciones.',
        );
      } finally {
        setIsLoadingMaterialCatalog(false);
      }
    };

    void fetchMaterialCatalog();
  }, []);

  useEffect(() => {
    const fetchProveedores = async () => {
      setIsLoadingProveedores(true);
      try {
        const response = await fetch(API_ENDPOINTS.rdmProveedores, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
              ? payload.message
              : 'No fue posible cargar proveedores.';
          throw new Error(message);
        }

        const proveedores = Array.isArray(payload)
          ? payload
              .map((item: unknown) => {
                if (typeof item === 'object' && item !== null && 'Proveedor' in item) {
                  const prov = (item as Record<string, unknown>).Proveedor;
                  return typeof prov === 'string' ? prov : null;
                }
                return null;
              })
              .filter((p: string | null) => p !== null)
          : [];

        if (proveedores.length === 0) {
          throw new Error('El backend no devolvio lista de proveedores valida.');
        }

        setProveedorOptions(proveedores);
      } catch (error) {
        Alert.alert(
          'Proveedores no disponibles',
          error instanceof Error ? error.message : 'No fue posible cargar proveedores.',
        );
      } finally {
        setIsLoadingProveedores(false);
      }
    };

    void fetchProveedores();
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => {
      setKeyboardPadding(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardPadding(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const handleAgregarFotosAction = () => {
    if (missingRequiredFields.length > 0) {
      Alert.alert(
        'Campos requeridos',
        `Completa los siguientes campos: ${missingRequiredFields.join(', ')}.`,
      );
      return;
    }

    const sqlFecha = toSqlDateTimeFromDisplay(form.fecha);
    if (!sqlFecha) {
      Alert.alert('Fecha invalida', 'No se pudo convertir la fecha del RDM.');
      return;
    }

    const codigoMaterial = joinValues(materialItems.map(item => item.codigo));
    const descripcion = joinValues(materialItems.map(item => item.descripcion));
    const cantidad = joinValues(materialItems.map(item => item.cantidad));
    const numeroTag = joinValues(materialItems.map(item => item.tag));

    const payload: RdmSavePayload = {
      folio: form.folio,
      auditor: form.auditor,
      fecha: sqlFecha,
      codigoMaterial,
      descripcion,
      material: descripcion,
      numeroTag,
      proveedor: form.proveedor,
      cantidad,
      unidad: form.unidad,
      rechazo: form.rechazo,
      disposicion: form.disposicion,
      status: form.status,
      aplicacionDesviacion: toSqlDateTimeFromDisplay(form.aplicacionDesviacion) ?? '',
      captureDateTime: sqlFecha,
    };

    onGoToFotosRDM(form.folio, payload);
  };

  const activeMaterialItem = materialItems.find(item => item.key === activeMaterialItemKey) ?? null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>Nuevo reporte de</Text>
            <Text style={styles.title}>RDM</Text>
          </View>
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 28 + keyboardPadding }]} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>
            <View style={styles.row2}>
              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>Folio</Text>
                <TextInput
                  style={styles.input}
                  value={form.folio}
                  editable={false}
                  placeholder={isLoadingFolio ? 'Generando folio...' : ''}
                  placeholderTextColor="#9AA6B2"
                />
              </View>

              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>Auditor</Text>
                <TextInput style={styles.input} value={form.auditor} editable={false} placeholderTextColor="#9AA6B2" />
              </View>
            </View>

            <View style={styles.row2}>
              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>Fecha</Text>
                <TextInput style={styles.input} value={form.fecha} editable={false} placeholderTextColor="#9AA6B2" />
              </View>

              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>Proveedor <Text style={styles.requiredMark}>*</Text></Text>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => setShowProveedorPicker(true)}
                  activeOpacity={0.8}
                  disabled={isLoadingFolio || isLoadingProveedores}
                >
                  <View style={styles.selectRow}>
                    <Text style={(form.proveedor || isProveedorManual) ? styles.selectText : styles.selectPlaceholderText}>
                      {isProveedorManual ? OTHER_OPTION : (form.proveedor || 'Selecciona proveedor')}
                    </Text>
                    <Text style={styles.selectArrow}>▾</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {isProveedorManual ? (
              <View style={styles.fieldBlock}>
                <TextInput
                  style={[styles.input, styles.manualInput]}
                  value={form.proveedor}
                  onChangeText={text => updateField('proveedor', text)}
                  editable={!isLoadingFolio}
                  placeholder="Escribe el proveedor manual"
                  placeholderTextColor="#9AA6B2"
                />
              </View>
            ) : null}

            <View style={styles.materialItemsSection}>
              <Text style={styles.fieldLabel}>Materiales <Text style={styles.requiredMark}>*</Text></Text>
              <Text style={styles.sectionHint}>Codigo, descripcion, cantidad y tag van juntos por cada material.</Text>

              {materialItems.map((item, index) => (
                <View key={item.key} style={styles.materialItemCard}>
                  <View style={styles.materialItemHeaderRow}>
                    <Text style={styles.materialItemIndex}>Material {index + 1}</Text>
                    {materialItems.length > 1 ? (
                      <TouchableOpacity
                        onPress={() => removeMaterialItem(item.key)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={styles.materialItemRemove}>Quitar</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <Text style={styles.materialItemFieldLabel}>Codigo de material</Text>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => openCodigoPickerForItem(item.key)}
                    activeOpacity={0.8}
                    disabled={isLoadingFolio || isLoadingMaterialCatalog}
                  >
                    <View style={styles.selectRow}>
                      <Text style={item.codigo ? styles.selectText : styles.selectPlaceholderText}>
                        {item.codigo || (isLoadingMaterialCatalog ? 'Cargando codigos...' : 'Selecciona codigo')}
                      </Text>
                      <Text style={styles.selectArrow}>▾</Text>
                    </View>
                  </TouchableOpacity>

                  <Text style={styles.materialItemFieldLabel}>Descripcion</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    value={item.descripcion}
                    onChangeText={text => updateMaterialItem(item.key, 'descripcion', text)}
                    editable={!isLoadingFolio}
                    multiline
                    numberOfLines={2}
                    textAlignVertical="top"
                    placeholder="Descripcion del material"
                    placeholderTextColor="#9AA6B2"
                  />

                  <View style={styles.row2}>
                    <View style={styles.halfField}>
                      <Text style={styles.materialItemFieldLabel}>Cantidad</Text>
                      <TextInput
                        style={styles.input}
                        value={item.cantidad}
                        onChangeText={text => updateMaterialItem(item.key, 'cantidad', text)}
                        editable={!isLoadingFolio}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#9AA6B2"
                      />
                    </View>

                    <View style={styles.halfField}>
                      <Text style={styles.materialItemFieldLabel}>No. Tag</Text>
                      <TextInput
                        style={styles.input}
                        value={item.tag}
                        onChangeText={text => updateMaterialItem(item.key, 'tag', text)}
                        editable={!isLoadingFolio}
                        placeholder="Tag"
                        placeholderTextColor="#9AA6B2"
                      />
                    </View>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addMaterialButton}
                activeOpacity={0.85}
                onPress={addMaterialItem}
                disabled={isLoadingFolio}
              >
                <Text style={styles.addMaterialButtonText}>+ Agregar material</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Unidad</Text>
              <TextInput
                style={styles.input}
                value={form.unidad}
                onChangeText={text => updateField('unidad', text)}
                editable={!isLoadingFolio}
                placeholderTextColor="#9AA6B2"
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Rechazo</Text>
              <TextInput
                style={[styles.input, styles.inputMultilineLarge]}
                value={form.rechazo}
                onChangeText={text => updateField('rechazo', text)}
                editable={!isLoadingFolio}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholderTextColor="#9AA6B2"
              />
            </View>

            <View style={styles.row2}>
              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>Disposicion</Text>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => setShowDisposicionPicker(true)}
                  activeOpacity={0.8}
                  disabled={isLoadingFolio}
                >
                  <View style={styles.selectRow}>
                    <Text style={form.disposicion ? styles.selectText : styles.selectPlaceholderText}>
                      {form.disposicion || 'Selecciona disposicion'}
                    </Text>
                    <Text style={styles.selectArrow}>▾</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>Status</Text>
                <TextInput
                  style={styles.input}
                  value={form.status}
                  onChangeText={text => updateField('status', text)}
                  editable={!isLoadingFolio}
                  placeholderTextColor="#9AA6B2"
                />
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Aplicacion/Desviacion</Text>
              <TextInput
                style={[styles.input]}
                value={form.aplicacionDesviacion}
                onChangeText={text => updateField('aplicacionDesviacion', text)}
                editable={!isLoadingFolio}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholderTextColor="#9AA6B2"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.addPhotosButton, isMainActionDisabled ? styles.addPhotosButtonDisabled : null]}
            activeOpacity={0.85}
            onPress={handleAgregarFotosAction}
            disabled={isMainActionDisabled}
          >
            <Text style={styles.addPhotosButtonText}>Agregar Fotografias</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <Modal
        visible={showCodigoMaterialPicker}
        transparent
        animationType="fade"
        onRequestClose={closeCodigoPicker}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecciona codigo de material</Text>

            <TextInput
              style={styles.modalSearchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar codigo..."
              placeholderTextColor="#9AA6B2"
              autoFocus
            />

            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {codigoMaterialOptions
                .filter(o => o.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(option => {
                  const selected = activeMaterialItem?.codigo === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.modalOption, selected ? styles.modalOptionSelected : null]}
                      activeOpacity={0.8}
                      onPress={() => handleSelectCodigoForActiveItem(option)}
                    >
                      <Text style={styles.modalOptionText}>{selected ? '✓ ' : ''}{option}</Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>

            <View style={styles.addRow}>
              <TextInput
                style={[styles.input, styles.addRowInput]}
                value={manualCodigoInput}
                onChangeText={setManualCodigoInput}
                onSubmitEditing={handleManualCodigoSubmit}
                placeholder="Codigo manual"
                placeholderTextColor="#9AA6B2"
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.addRowButton, !manualCodigoInput.trim() ? styles.addRowButtonDisabled : null]}
                activeOpacity={0.8}
                disabled={!manualCodigoInput.trim()}
                onPress={handleManualCodigoSubmit}
              >
                <Text style={styles.addRowButtonText}>+</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalCancelButton}
              activeOpacity={0.8}
              onPress={closeCodigoPicker}
            >
              <Text style={styles.modalCancelText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showProveedorPicker}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowProveedorPicker(false); setSearchQuery(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecciona proveedor</Text>

            <TextInput
              style={styles.modalSearchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar proveedor..."
              placeholderTextColor="#9AA6B2"
              autoFocus
            />

            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {[
                ...proveedorOptions.filter((o: string) =>
                  o.toLowerCase().includes(searchQuery.toLowerCase())
                ),
                OTHER_OPTION,
              ].map(option => (
                <TouchableOpacity
                  key={option}
                  style={styles.modalOption}
                  activeOpacity={0.8}
                  onPress={() => { handleSelectProveedor(option); setSearchQuery(''); }}
                >
                  <Text style={styles.modalOptionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCancelButton}
              activeOpacity={0.8}
              onPress={() => { setShowProveedorPicker(false); setSearchQuery(''); }}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDisposicionPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDisposicionPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecciona disposicion</Text>

            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {disposicionOptions.map(option => (
                <TouchableOpacity
                  key={option}
                  style={styles.modalOption}
                  activeOpacity={0.8}
                  onPress={() => {
                    updateField('disposicion', option);
                    setShowDisposicionPicker(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCancelButton}
              activeOpacity={0.8}
              onPress={() => setShowDisposicionPicker(false)}
            >
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    marginTop: 20,
    flex: 1,
    backgroundColor: '#EEF1F5',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 14,
  },
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
  scrollContent: {
    paddingBottom: 0,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A49D8',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8E0EB',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A49D8',
    marginBottom: 12,
  },
  optionalHint: {
    marginTop: -4,
    marginBottom: 10,
    fontSize: 12,
    color: '#64748B',
  },
  fieldBlock: {
    marginBottom: 12,
  },
  row2: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34495E',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D8E0EB',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    color: '#102033',
    fontSize: 14,
  },
  manualInput: {
    marginTop: 8,
  },
  dateText: {
    color: '#102033',
    fontSize: 14,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    color: '#102033',
    fontSize: 14,
    flex: 1,
  },
  selectPlaceholderText: {
    color: '#9AA6B2',
    fontSize: 14,
    flex: 1,
  },
  selectArrow: {
    color: '#34495E',
    fontSize: 14,
    marginLeft: 8,
  },
  inputMultiline: {
    minHeight: 66,
    paddingTop: 10,
    height: 'auto',
    marginBottom: 12,
  },
  inputMultilineLarge: {
    minHeight: 110,
    paddingTop: 10,
    height: 'auto',
  },
  backButtonText: {
    color: '#2D3748',
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(16, 32, 51, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8E0EB',
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A49D8',
    marginBottom: 12,
  },
  modalList: {
    maxHeight: 280,
  },
  modalOption: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D8E0EB',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  modalOptionText: {
    color: '#102033',
    fontSize: 14,
    fontWeight: '500',
  },
  modalCancelButton: {
    marginTop: 8,
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  modalCancelText: {
    color: '#2D3748',
    fontSize: 14,
    fontWeight: '600',
  },
  addPhotosButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#1A49D8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#1A49D8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  addPhotosButtonDisabled: {
    backgroundColor: '#9AA6B2',
    shadowOpacity: 0,
    elevation: 0,
  },
  addPhotosButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  actionModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8E0EB',
    padding: 16,
  },
  actionModalText: {
    color: '#34495E',
    fontSize: 14,
    marginBottom: 14,
  },
  actionPrimaryButton: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#1A49D8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  actionSecondaryButton: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EDF2FF',
    borderWidth: 1,
    borderColor: '#BFD0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSecondaryButtonText: {
    color: '#1A49D8',
    fontSize: 14,
    fontWeight: '700',
  },
  requiredMark: {
    color: '#E53E3E',
    fontWeight: '700',
  },
  modalSearchInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D8E0EB',
    borderRadius: 10,
    height: 40,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#102033',
    marginBottom: 10,
  },
  modalHint: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
    marginTop: -6,
  },
  modalOptionSelected: {
    backgroundColor: '#EDF2FF',
    borderColor: '#1A49D8',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  addRowInput: {
    flex: 1,
  },
  addRowButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#1A49D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRowButtonDisabled: {
    backgroundColor: '#9AA6B2',
  },
  addRowButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  materialItemsSection: {
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
  },
  materialItemCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D8E0EB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  materialItemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  materialItemIndex: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A49D8',
  },
  materialItemRemove: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E53E3E',
  },
  materialItemFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  addMaterialButton: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1A49D8',
    backgroundColor: '#EDF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  addMaterialButtonText: {
    color: '#1A49D8',
    fontSize: 14,
    fontWeight: '700',
  },
});

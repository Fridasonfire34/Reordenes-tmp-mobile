import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Asset, launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { API_ENDPOINTS } from '../config/api';

export type RdmRecord = Record<string, unknown>;

type MaterialCatalogItem = {
  codigo: string;
  descripcion: string;
};

type ExistingPhoto = {
  id: number;
  mimeType: string;
  fileSize: number;
  uri: string;
  markedForDelete: boolean;
};

type NewPhoto = {
  id: string;
  uri: string;
  mimeType: string;
  fileDataBase64: string;
  fileSize: number;
};

type EditForm = {
  auditor: string;
  codigoMaterial: string;
  descripcion: string;
  numeroTag: string;
  proveedor: string;
  cantidad: string;
  unidad: string;
  rechazo: string;
  disposicion: string;
  status: string;
  aplicacionDesviacion: string;
  wafloRma: string;
  nc: string;
};

export type EditarRDMModalProps = {
  visible: boolean;
  onClose: () => void;
  rdmRow: RdmRecord | null;
  loggedUser: string;
  loggedNomina: string;
  onSaved: () => void;
};

const EMPTY_FORM: EditForm = {
  auditor: '',
  codigoMaterial: '',
  descripcion: '',
  numeroTag: '',
  proveedor: '',
  cantidad: '',
  unidad: '',
  rechazo: '',
  disposicion: '',
  status: '',
  aplicacionDesviacion: '',
  wafloRma: '',
  nc: '',
};

const PROVEEDOR_OPTIONS = [
  'ACERO Y PRENSAS S.A DE C.V.',
  'PLESA STEEL',
  'KLOECKNER METALS DE MEXICO',
  'TERNIUM MEXICO S.A. de C.V.',
];

const DISPOSICION_OPTIONS = ['Desviacion', 'Devolucion', 'SCRAP', 'Retrabajo'];

const toStr = (v: unknown): string => (v == null ? '' : String(v));

const getFolioFromRow = (row: RdmRecord): string =>
  toStr(row['ID'] ?? row['Folio'] ?? row['Id']);

const hasFieldChanges = (original: EditForm, current: EditForm): boolean =>
  (Object.keys(original) as Array<keyof EditForm>).some(key => original[key] !== current[key]);

export default function EditarRDMModal({ visible, onClose, rdmRow, loggedUser, loggedNomina, onSaved }: EditarRDMModalProps) {
  const [tab, setTab] = useState<'datos' | 'fotos'>('datos');
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [originalForm, setOriginalForm] = useState<EditForm>(EMPTY_FORM);
  const [folio, setFolio] = useState('');
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);
  const [isLoadingFotos, setIsLoadingFotos] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [commentsText, setCommentsText] = useState('');
  const [materialCatalog, setMaterialCatalog] = useState<MaterialCatalogItem[]>([]);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  // Generic picker
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTitle, setPickerTitle] = useState('');
  const [pickerOptions, setPickerOptions] = useState<string[]>([]);
  const [pickerOnSelect, setPickerOnSelect] = useState<(v: string) => void>(() => () => {});

  const openPicker = (title: string, options: string[], onSelect: (v: string) => void) => {
    setPickerTitle(title);
    setPickerOptions(options);
    setPickerOnSelect(() => (v: string) => {
      onSelect(v);
      setPickerVisible(false);
    });
    setPickerVisible(true);
  };

  const codigoOptions = Array.from(new Set(materialCatalog.map(i => i.codigo)));
  const descripcionOptions = Array.from(new Set(materialCatalog.map(i => i.descripcion)));

  const setField = (key: keyof EditForm, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const loadCatalog = useCallback(async () => {
    try {
      const res = await fetch(API_ENDPOINTS.rdmRollosMatl);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) return;
      const rawItems: unknown[] = Array.isArray(data.items) ? data.items : [];
      setMaterialCatalog(
        rawItems
          .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
          .map(i => ({
            codigo: toStr(i['Codigo'] ?? i['codigo']),
            descripcion: toStr(i['Descripcion'] ?? i['descripcion']),
          }))
          .filter(i => i.codigo && i.descripcion),
      );
    } catch {
      // silent fail
    }
  }, []);

  const loadFotos = useCallback(async (folioValue: string) => {
    if (!folioValue) return;
    setIsLoadingFotos(true);
    try {
      const res = await fetch(`${API_ENDPOINTS.getRdmFotos}/${encodeURIComponent(folioValue)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setExistingPhotos([]);
        return;
      }
      type RawPhoto = { id: number; mimeType: string; fileSize: number; fileData: string };
      const photos: ExistingPhoto[] = (Array.isArray(data.photos) ? data.photos : []).map(
        (p: RawPhoto) => ({
          id: p.id,
          mimeType: p.mimeType ?? 'image/jpeg',
          fileSize: p.fileSize ?? 0,
          uri: `data:${p.mimeType ?? 'image/jpeg'};base64,${p.fileData}`,
          markedForDelete: false,
        }),
      );
      setExistingPhotos(photos);
    } catch {
      setExistingPhotos([]);
    } finally {
      setIsLoadingFotos(false);
    }
  }, []);

  useEffect(() => {
    if (!visible || !rdmRow) return;

    const f = getFolioFromRow(rdmRow);
    const initialForm: EditForm = {
      auditor: toStr(rdmRow['Auditor']),
      codigoMaterial: toStr(rdmRow['Codigo de Material']),
      descripcion: toStr(rdmRow['Descripcion']),
      numeroTag: toStr(rdmRow['No. Tag']),
      proveedor: toStr(rdmRow['Proveedor']),
      cantidad: toStr(rdmRow['Cantidad']),
      unidad: toStr(rdmRow['Unidad']),
      rechazo: toStr(rdmRow['Rechazo']),
      disposicion: toStr(rdmRow['Disposicion']),
      status: toStr(rdmRow['Status']),
      aplicacionDesviacion: toStr(rdmRow['Aplicacion/Desviacion']),
      wafloRma: toStr(rdmRow['No. Waflo/RMA']),
      nc: toStr(rdmRow['NC']),
    };

    setFolio(f);
    setForm(initialForm);
    setOriginalForm(initialForm);
    setNewPhotos([]);
    setExistingPhotos([]);
    setCommentsText('');
    setCommentsModalVisible(false);
    setTab('datos');
    void loadCatalog();
    void loadFotos(f);
  }, [visible, rdmRow, loadCatalog, loadFotos]);

  // Photo helpers
  const appendAssets = (assets?: Asset[]) => {
    if (!assets?.length) return;
    const next = assets
      .filter(a => !!a.uri && !!a.base64)
      .map(a => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        uri: a.uri as string,
        mimeType: a.type?.trim() || 'application/octet-stream',
        fileDataBase64: a.base64 as string,
        fileSize: typeof a.fileSize === 'number' ? Math.max(0, Math.round(a.fileSize)) : 0,
      }));
    setNewPhotos(prev => [...prev, ...next]);
  };

  const handleGallery = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.8,
      includeBase64: true,
    });
    if (!result.didCancel && !result.errorCode) appendAssets(result.assets);
  };

  const handleCamera = async () => {
    const result = await launchCamera({
      mediaType: 'photo',
      saveToPhotos: true,
      quality: 0.8,
      includeBase64: true,
    });
    if (!result.didCancel && !result.errorCode) appendAssets(result.assets);
  };

  const toggleDeleteExisting = (id: number) => {
    setExistingPhotos(prev =>
      prev.map(p => (p.id === id ? { ...p, markedForDelete: !p.markedForDelete } : p)),
    );
  };

  const removeNewPhoto = (id: string) => {
    setNewPhotos(prev => prev.filter(p => p.id !== id));
  };

  const handleSave = async (comentarios: string) => {
    if (!folio) {
      Alert.alert('Error', 'No se encontro el folio del RDM.');
      return;
    }

    const didFieldChange = hasFieldChanges(originalForm, form);
    const hasPhotoChanges = existingPhotos.some(p => p.markedForDelete) || newPhotos.length > 0;

    if (!didFieldChange && !hasPhotoChanges) {
      Alert.alert('Sin cambios', 'No hay cambios para guardar.');
      return;
    }

    setIsSaving(true);

    try {
      // 1. Update RDM fields only when field values changed.
      if (didFieldChange) {
        const rdmRes = await fetch(API_ENDPOINTS.updateRDM, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folio, ...form }),
        });

        if (!rdmRes.ok) {
          const d = await rdmRes.json().catch(() => null);
          throw new Error((d as { message?: string })?.message ?? 'Error al actualizar el RDM.');
        }
      }

      // 2. Delete marked photos
      const toDelete = existingPhotos.filter(p => p.markedForDelete);
      for (const photo of toDelete) {
        const delRes = await fetch(`${API_ENDPOINTS.deleteRdmFoto}/${photo.id}`, {
          method: 'DELETE',
        });
        if (!delRes.ok) {
          const d = await delRes.json().catch(() => null);
          throw new Error((d as { message?: string })?.message ?? `Error al eliminar foto ${photo.id}.`);
        }
      }

      // 3. Save new photos
      if (newPhotos.length > 0) {
        const fotosRes = await fetch(API_ENDPOINTS.saveRdmFotos, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folio,
            photos: newPhotos.map(p => ({
              mimeType: p.mimeType,
              fileData: p.fileDataBase64,
              fileSize: p.fileSize,
            })),
          }),
        });
        if (!fotosRes.ok) {
          const d = await fotosRes.json().catch(() => null);
          throw new Error((d as { message?: string })?.message ?? 'Error al guardar nuevas fotos.');
        }
      }

      // 4. Register movement only when RDM fields were modified.
      if (didFieldChange) {
        const parsedNomina = Number(loggedNomina);
        const usuarioMovimiento = Number.isFinite(parsedNomina) ? parsedNomina : 0;
        const movRes = await fetch(API_ENDPOINTS.saveMovimientoRdm, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folio,
            usuario: usuarioMovimiento,
            usuarioNombre: loggedUser,
            comentarios,
          }),
        });

        if (!movRes.ok) {
          const d = await movRes.json().catch(() => null);
          throw new Error((d as { message?: string })?.message ?? 'Error al registrar movimiento del RDM.');
        }
      }

      Alert.alert('Guardado', 'RDM actualizado correctamente.', [
        {
          text: 'OK',
          onPress: () => {
            onSaved();
            onClose();
          },
        },
      ]);
    } catch (error) {
      Alert.alert(
        'Error al guardar',
        error instanceof Error ? error.message : 'No fue posible guardar los cambios.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePressSave = () => {
    const didFieldChange = hasFieldChanges(originalForm, form);
    const hasPhotoChanges = existingPhotos.some(p => p.markedForDelete) || newPhotos.length > 0;

    if (!didFieldChange && !hasPhotoChanges) {
      Alert.alert('Sin cambios', 'No hay cambios para guardar.');
      return;
    }

    setCommentsText('');
    setCommentsModalVisible(true);
  };

  const handleConfirmSaveWithComments = () => {
    const finalComments = commentsText.trim() || 'Se modifico el RDM';
    setCommentsModalVisible(false);
    void handleSave(finalComments);
  };

  const totalFotos =
    existingPhotos.filter(p => !p.markedForDelete).length + newPhotos.length;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Editar RDM</Text>
            <Text style={styles.headerFolio}>Folio: {folio || '...'}</Text>
          </View>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, tab === 'datos' ? styles.tabActive : null]}
            onPress={() => setTab('datos')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, tab === 'datos' ? styles.tabTextActive : null]}>
              Datos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'fotos' ? styles.tabActive : null]}
            onPress={() => setTab('fotos')}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, tab === 'fotos' ? styles.tabTextActive : null]}>
              {isLoadingFotos ? 'Fotos...' : `Fotos (${totalFotos})`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {tab === 'datos' ? (
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollInner}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Auditor</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.auditor}
                onChangeText={v => setField('auditor', v)}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Código de Material</Text>
              <Text style={styles.fieldHint}>Puedes escribir varios códigos separados por coma.</Text>
              <View style={styles.fieldWithButtonRow}>
                <TextInput
                  style={[styles.fieldInput, styles.fieldInputFlex]}
                  value={form.codigoMaterial}
                  onChangeText={v => setField('codigoMaterial', v)}
                  placeholder="Codigo(s) de material"
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity
                  style={styles.fieldPickerButton}
                  activeOpacity={0.85}
                  onPress={() =>
                    openPicker('Código de Material', codigoOptions, v => {
                      const match = materialCatalog.find(i => i.codigo === v);
                      setForm(prev => {
                        const existing = prev.codigoMaterial.split(',').map(s => s.trim()).filter(Boolean);
                        const nextCodigos = existing.includes(v) ? existing : [...existing, v];
                        return {
                          ...prev,
                          codigoMaterial: nextCodigos.join(', '),
                          descripcion: prev.descripcion || (match ? match.descripcion : prev.descripcion),
                        };
                      });
                    })
                  }
                >
                  <Text style={styles.dropdownArrow}>▾</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Descripción</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() =>
                  openPicker('Descripción', descripcionOptions, v => {
                    const match = materialCatalog.find(i => i.descripcion === v);
                    setForm(prev => ({
                      ...prev,
                      descripcion: v,
                      codigoMaterial: match ? match.codigo : prev.codigoMaterial,
                    }));
                  })
                }
                activeOpacity={0.85}
              >
                <Text
                  style={form.descripcion ? styles.dropdownValue : styles.dropdownPlaceholder}
                  numberOfLines={2}
                >
                  {form.descripcion || 'Seleccionar descripción'}
                </Text>
                <Text style={styles.dropdownArrow}>▾</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>No. Tag</Text>
              <Text style={styles.fieldHint}>Puedes escribir varios tags separados por coma.</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.numeroTag}
                onChangeText={v => setField('numeroTag', v)}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Proveedor</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() =>
                  openPicker('Proveedor', PROVEEDOR_OPTIONS, v => setField('proveedor', v))
                }
                activeOpacity={0.85}
              >
                <Text
                  style={form.proveedor ? styles.dropdownValue : styles.dropdownPlaceholder}
                  numberOfLines={1}
                >
                  {form.proveedor || 'Seleccionar proveedor'}
                </Text>
                <Text style={styles.dropdownArrow}>▾</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Cantidad</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.cantidad}
                onChangeText={v => setField('cantidad', v.replace(/\D/g, ''))}
                keyboardType="numeric"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Unidad</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.unidad}
                onChangeText={v => setField('unidad', v)}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Rechazo</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMultiline]}
                value={form.rechazo}
                onChangeText={v => setField('rechazo', v)}
                multiline
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Disposición</Text>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() =>
                  openPicker('Disposición', DISPOSICION_OPTIONS, v => setField('disposicion', v))
                }
                activeOpacity={0.85}
              >
                <Text
                  style={form.disposicion ? styles.dropdownValue : styles.dropdownPlaceholder}
                  numberOfLines={1}
                >
                  {form.disposicion || 'Seleccionar disposición'}
                </Text>
                <Text style={styles.dropdownArrow}>▾</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Status</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.status}
                onChangeText={v => setField('status', v)}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Aplicación/Desviación</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.aplicacionDesviacion}
                onChangeText={v => setField('aplicacionDesviacion', v)}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>No. Waflo/RMA</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.wafloRma}
                onChangeText={v => setField('wafloRma', v)}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>NC</Text>
              <TextInput
                style={styles.fieldInput}
                value={form.nc}
                onChangeText={v => setField('nc', v)}
                placeholderTextColor="#94A3B8"
              />
            </View>
          </ScrollView>
        ) : (
          <View style={styles.fotosContainer}>
            {isLoadingFotos ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#1A49D8" size="small" />
                <Text style={styles.loadingText}>Cargando fotografias...</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.photoGrid}>
                {existingPhotos.length === 0 && newPhotos.length === 0 && (
                  <Text style={styles.emptyFotosText}>Este RDM no tiene fotografias aun.</Text>
                )}
                {existingPhotos.map((photo, i) => (
                  <View
                    key={`ex-${photo.id}`}
                    style={[styles.photoCell, photo.markedForDelete ? styles.photoCellDeleted : null]}
                  >
                    <TouchableOpacity onPress={() => setPreviewUri(photo.uri)} activeOpacity={0.85}>
                      <Image source={{ uri: photo.uri }} style={styles.photoImage} resizeMode="cover" />
                    </TouchableOpacity>
                    {photo.markedForDelete && <View style={styles.photoDeleteOverlay} />}
                    <View style={styles.photoFooter}>
                      <Text style={styles.photoLabel}>Foto {i + 1}</Text>
                      <TouchableOpacity
                        onPress={() => toggleDeleteExisting(photo.id)}
                        style={[
                          styles.photoActionTag,
                          photo.markedForDelete ? styles.photoActionTagRestore : styles.photoActionTagDelete,
                        ]}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.photoActionTagText}>
                          {photo.markedForDelete ? 'Restaurar' : 'Eliminar'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                {newPhotos.map((photo, i) => (
                  <View key={photo.id} style={styles.photoCell}>
                    <TouchableOpacity onPress={() => setPreviewUri(photo.uri)} activeOpacity={0.85}>
                      <Image source={{ uri: photo.uri }} style={styles.photoImage} resizeMode="cover" />
                    </TouchableOpacity>
                    <View style={styles.photoFooter}>
                      <Text style={[styles.photoLabel, styles.photoLabelNew]}>Nueva {i + 1}</Text>
                      <TouchableOpacity
                        onPress={() => removeNewPhoto(photo.id)}
                        style={[styles.photoActionTag, styles.photoActionTagDelete]}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.photoActionTagText}>Quitar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
            <View style={styles.photoButtonsRow}>
              <TouchableOpacity
                style={styles.photoAddButton}
                onPress={() => void handleGallery()}
                activeOpacity={0.85}
              >
                <Text style={styles.photoAddButtonText}>+ Galería</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoAddButton}
                onPress={() => void handleCamera()}
                activeOpacity={0.85}
              >
                <Text style={styles.photoAddButtonText}>📷 Cámara</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Footer save button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, isSaving ? styles.saveButtonDisabled : null]}
            onPress={handlePressSave}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Generic picker modal */}
        <Modal
          visible={pickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPickerVisible(false)}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setPickerVisible(false)}
          >
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>{pickerTitle}</Text>
              <FlatList
                data={pickerOptions}
                keyExtractor={(item, i) => `${item}-${i}`}
                style={{ maxHeight: 340 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.pickerOption}
                    onPress={() => pickerOnSelect(item)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.pickerOptionText}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Comments modal before save */}
        <Modal
          visible={commentsModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCommentsModalVisible(false)}
        >
          <View style={styles.commentsOverlay}>
            <View style={styles.commentsCard}>
              <Text style={styles.commentsTitle}>Comentarios este movimiento</Text>
              <TextInput
                style={styles.commentsInput}
                multiline
                placeholder="Escribe un comentario (opcional)"
                placeholderTextColor="#94A3B8"
                value={commentsText}
                onChangeText={setCommentsText}
              />
              <View style={styles.commentsActions}>
                <TouchableOpacity
                  style={styles.commentsCancelButton}
                  onPress={() => setCommentsModalVisible(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.commentsCancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.commentsSaveButton}
                  onPress={handleConfirmSaveWithComments}
                  activeOpacity={0.85}
                >
                  <Text style={styles.commentsSaveButtonText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Photo preview modal */}
        <Modal
          visible={previewUri !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewUri(null)}
        >
          <View style={styles.previewOverlay}>
            <TouchableOpacity
              style={styles.previewCloseButton}
              onPress={() => setPreviewUri(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.previewCloseText}>Cerrar</Text>
            </TouchableOpacity>
            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EEF1F5',
    marginTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A49D8',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerFolio: {
    fontSize: 13,
    color: '#BFD0FF',
    marginTop: 2,
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#1A49D8',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#1A49D8',
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 18,
    gap: 12,
  },
  fieldRow: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#1F2937',
  },
  fieldInputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  fieldHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 6,
  },
  fieldWithButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldInputFlex: {
    flex: 1,
  },
  fieldPickerButton: {
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E0',
    borderRadius: 10,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  dropdownValue: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    marginRight: 6,
  },
  dropdownPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: '#94A3B8',
    marginRight: 6,
  },
  dropdownArrow: {
    fontSize: 14,
    color: '#94A3B8',
  },
  fotosContainer: {
    flex: 1,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#475569',
    marginTop: 8,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 10,
  },
  emptyFotosText: {
    width: '100%',
    textAlign: 'center',
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 24,
    marginBottom: 12,
  },
  photoCell: {
    width: 150,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8E0EB',
  },
  photoCellDeleted: {
    opacity: 0.5,
    borderColor: '#F87171',
  },
  photoImage: {
    width: '100%',
    height: 120,
  },
  photoDeleteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(239,68,68,0.25)',
  },
  photoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  photoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  photoLabelNew: {
    color: '#16803C',
  },
  photoActionTag: {
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  photoActionTagDelete: {
    backgroundColor: '#FEE2E2',
  },
  photoActionTagRestore: {
    backgroundColor: '#DCFCE7',
  },
  photoActionTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F2937',
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  photoAddButton: {
    flex: 1,
    backgroundColor: '#EDF2FF',
    borderWidth: 1,
    borderColor: '#BFD0FF',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  photoAddButtonText: {
    color: '#1A49D8',
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    padding: 14,
    backgroundColor: '#EEF1F5',
  },
  saveButton: {
    backgroundColor: '#1A49D8',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingTop: 18,
    paddingBottom: 10,
    paddingHorizontal: 4,
    maxHeight: 420,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A49D8',
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  pickerOption: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#1F2937',
  },
  commentsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  commentsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D8E0EB',
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
  },
  commentsInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: '#CBD5E0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1F2937',
    textAlignVertical: 'top',
  },
  commentsActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  commentsCancelButton: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  commentsCancelButtonText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 14,
  },
  commentsSaveButton: {
    backgroundColor: '#1A49D8',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  commentsSaveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  previewCloseText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  previewImage: {
    width: '100%',
    height: '80%',
  },
});

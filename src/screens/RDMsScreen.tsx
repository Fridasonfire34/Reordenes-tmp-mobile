import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { API_ENDPOINTS } from '../config/api';

type RDMsScreenProps = {
  onBack: () => void;
  loggedUser: string;
  loggedNomina: string;
  onGoToFotosRDM: (folio: string) => void;
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
  numeroWafloRma: string;
  nc: string;
};

type FormKey = keyof FormState;

export type RdmDraft = {
  form: FormState;
  salidaDateIso: string;
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

const formatDateOnly = (date: Date): string => {
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const year = `${date.getFullYear()}`;
  return `${day}/${month}/${year}`;
};

const SAVE_RDM_URL = API_ENDPOINTS.saveRDM;

export default function RDMsScreen({
  onBack,
  loggedUser,
  loggedNomina,
  onGoToFotosRDM,
  initialDraft,
  onDraftChange,
}: RDMsScreenProps) {
  const proveedorOptions = [
    'ACERO Y PRENSAS S.A DE C.V.',
    'PLESA STEEL',
    'KLOECKNER METALS DE MEXICO',
    'TERNIUM MEXICO S.A. de C.V.',
  ];
  const disposicionOptions = ['Desviacion', 'Devolucion', 'SCRAP', 'Retrabajo'];

  const [isLoadingFolio, setIsLoadingFolio] = useState(false);
  const [showSalidaDatePicker, setShowSalidaDatePicker] = useState(false);
  const [showProveedorPicker, setShowProveedorPicker] = useState(false);
  const [showDisposicionPicker, setShowDisposicionPicker] = useState(false);
  const [showPhotoOrSaveModal, setShowPhotoOrSaveModal] = useState(false);
  const [isSavingRdm, setIsSavingRdm] = useState(false);
  const [salidaDate, setSalidaDate] = useState<Date>(() => {
    if (initialDraft?.salidaDateIso) {
      const parsed = new Date(initialDraft.salidaDateIso);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return new Date();
  });

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
      numeroWafloRma: '',
      nc: '',
    };
  });

  const updateField = (key: FormKey, value: string) => {
    const normalizedValue = key === 'cantidad' ? value.replace(/\D/g, '') : value;
    setForm(prev => ({ ...prev, [key]: normalizedValue }));
  };

  const missingRequiredFields = [
    { label: 'Codigo de Material', value: form.codigoMaterial },
    { label: 'Descripcion', value: form.material },
    { label: 'No. Tag', value: form.numeroTag },
    { label: 'Proveedor', value: form.proveedor },
  ]
    .filter(field => !field.value.trim())
    .map(field => field.label);

  const isMainActionDisabled =
    isLoadingFolio || isSavingRdm || !form.folio.trim() || missingRequiredFields.length > 0;

  const handleSalidaDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowSalidaDatePicker(false);
    }

    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    setSalidaDate(selectedDate);
  };

  useEffect(() => {
    setForm(prev => ({ ...prev, auditor: loggedNomina || loggedUser || 'Usuario' }));
  }, [loggedNomina, loggedUser]);

  useEffect(() => {
    onDraftChange({
      form,
      salidaDateIso: salidaDate.toISOString(),
    });
  }, [form, salidaDate, onDraftChange]);

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

  const saveRdm = async (showSuccessAlert: boolean): Promise<boolean> => {
    if (isSavingRdm) {
      return false;
    }

    const payload = {
      folio: form.folio,
      auditor: form.auditor,
      fecha: form.fecha,
      codigoMaterial: form.codigoMaterial,
      descripcion: form.material,
      material: form.material,
      numeroTag: form.numeroTag,
      proveedor: form.proveedor,
      cantidad: form.cantidad,
      unidad: form.unidad,
      rechazo: form.rechazo,
      disposicion: form.disposicion,
      status: form.status,
      aplicacionDesviacion: form.aplicacionDesviacion,
      salidaFecha: formatDateOnly(salidaDate),
      wfloRm: form.numeroWafloRma,
      nc: form.nc,
      captureDateTime: form.fecha,
    };

    try {
      setIsSavingRdm(true);

      const response = await fetch(SAVE_RDM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const rawText = await response.text();
      let data: Record<string, unknown> | null = null;

      try {
        data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
      } catch {
        data = null;
      }

      if (!response.ok) {
        const serverMessage =
          (data?.message as string | undefined) ||
          rawText ||
          `Error ${response.status} al guardar RDM.`;
        throw new Error(serverMessage);
      }

      if (showSuccessAlert) {
        Alert.alert('Guardado', 'El RDM se envio correctamente al backend.');
      }

      return true;
    } catch (error) {
      Alert.alert(
        'Error al guardar',
        error instanceof Error ? error.message : 'No fue posible guardar el RDM.',
      );
      return false;
    } finally {
      setIsSavingRdm(false);
    }
  };

  const handleGuardarAction = async () => {
    setShowPhotoOrSaveModal(false);
    await saveRdm(true);
  };

  const handleAnexarFotosAction = async () => {
    setShowPhotoOrSaveModal(false);

    if (missingRequiredFields.length > 0) {
      Alert.alert(
        'Campos requeridos',
        `Para anexar fotografias completa: ${missingRequiredFields.join(', ')}.`,
      );
      return;
    }

    const saved = await saveRdm(false);
    if (!saved) {
      return;
    }

    onGoToFotosRDM(form.folio);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Nuevo Reporte de RDM</Text>
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
                <Text style={styles.fieldLabel}>Codigo de material</Text>
                <TextInput
                  style={styles.input}
                  value={form.codigoMaterial}
                  onChangeText={text => updateField('codigoMaterial', text)}
                  editable={!isLoadingFolio}
                  placeholderTextColor="#9AA6B2"
                />
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Descripcion</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={form.material}
                onChangeText={text => updateField('material', text)}
                editable={!isLoadingFolio}
                placeholderTextColor="#9AA6B2"
              />
            </View>

            <View style={styles.row2}>
              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>No. Tag</Text>
                <TextInput
                  style={styles.input}
                  value={form.numeroTag}
                  onChangeText={text => updateField('numeroTag', text)}
                  editable={!isLoadingFolio}
                  placeholderTextColor="#9AA6B2"
                />
              </View>

              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>Proveedor</Text>
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => setShowProveedorPicker(true)}
                  activeOpacity={0.8}
                  disabled={isLoadingFolio}
                >
                  <View style={styles.selectRow}>
                    <Text style={form.proveedor ? styles.selectText : styles.selectPlaceholderText}>
                      {form.proveedor || 'Selecciona proveedor'}
                    </Text>
                    <Text style={styles.selectArrow}>▾</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.row2}>
              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>Cantidad</Text>
                <TextInput
                  style={styles.input}
                  value={form.cantidad}
                  onChangeText={text => updateField('cantidad', text)}
                  editable={!isLoadingFolio}
                  keyboardType="numeric"
                  placeholderTextColor="#9AA6B2"
                />
              </View>

              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>Unidad</Text>
                <TextInput
                  style={styles.input}
                  value={form.unidad}
                  onChangeText={text => updateField('unidad', text)}
                  editable={!isLoadingFolio}
                  placeholderTextColor="#9AA6B2"
                />
              </View>
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

          <View style={styles.formCard}>
            <Text style={styles.cardTitle}>Salida de Material</Text>
            <Text style={styles.optionalHint}>Estos campos no son obligatorios.</Text>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Fecha</Text>
              <TouchableOpacity style={styles.input} onPress={() => setShowSalidaDatePicker(true)} activeOpacity={0.8}>
                <Text style={styles.dateText}>{formatDateOnly(salidaDate)}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.row2}>
              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>Wflo / RM</Text>
                <TextInput
                  style={styles.input}
                  value={form.numeroWafloRma}
                  onChangeText={text => updateField('numeroWafloRma', text)}
                  editable={!isLoadingFolio}
                  placeholderTextColor="#9AA6B2"
                />
              </View>

              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>NC</Text>
                <TextInput
                  style={styles.input}
                  value={form.nc}
                  onChangeText={text => updateField('nc', text)}
                  editable={!isLoadingFolio}
                  placeholderTextColor="#9AA6B2"
                />
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.addPhotosButton, isMainActionDisabled ? styles.addPhotosButtonDisabled : null]}
            activeOpacity={0.85}
            onPress={() => setShowPhotoOrSaveModal(true)}
            disabled={isMainActionDisabled}
          >
            <Text style={styles.addPhotosButtonText}>Agregar fotografias o Guardar.</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {showSalidaDatePicker ? (
        <DateTimePicker
          value={salidaDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleSalidaDateChange}
        />
      ) : null}

      <Modal
        visible={showProveedorPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProveedorPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Selecciona proveedor</Text>

            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {proveedorOptions.map(option => (
                <TouchableOpacity
                  key={option}
                  style={styles.modalOption}
                  activeOpacity={0.8}
                  onPress={() => {
                    updateField('proveedor', option);
                    setShowProveedorPicker(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCancelButton}
              activeOpacity={0.8}
              onPress={() => setShowProveedorPicker(false)}
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

      <Modal
        visible={showPhotoOrSaveModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoOrSaveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.actionModalCard}>
            <Text style={styles.modalTitle}>Confirmar acción</Text>
            <Text style={styles.actionModalText}>¿Deseas guardar o anexar fotografías?</Text>

            <TouchableOpacity style={styles.actionPrimaryButton} activeOpacity={0.85} onPress={handleGuardarAction}>
              <Text style={styles.actionPrimaryButtonText}>{isSavingRdm ? 'Guardando...' : 'Guardar'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSecondaryButton}
              activeOpacity={0.85}
              onPress={handleAnexarFotosAction}
            >
              <Text style={styles.actionSecondaryButtonText}>Anexar fotografias</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelButton}
              activeOpacity={0.8}
              onPress={() => setShowPhotoOrSaveModal(false)}
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
    marginBottom: 10,
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
    paddingBottom: 28,
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
    minHeight: 82,
    paddingTop: 10,
    height: 'auto',
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
    marginBottom: 8,
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
});

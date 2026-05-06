import React, { useEffect, useState } from 'react';
import {
  Alert,
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

export default function RDMsScreen({ onBack, loggedUser }: RDMsScreenProps) {
  const [isLoadingFolio, setIsLoadingFolio] = useState(false);
  const [showSalidaDatePicker, setShowSalidaDatePicker] = useState(false);
  const [salidaDate, setSalidaDate] = useState<Date>(new Date());

  const [form, setForm] = useState<FormState>({
    folio: '',
    auditor: loggedUser || 'Usuario',
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
  });

  const updateField = (key: FormKey, value: string) => {
    const normalizedValue = key === 'cantidad' ? value.replace(/\D/g, '') : value;
    setForm(prev => ({ ...prev, [key]: normalizedValue }));
  };

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
    setForm(prev => ({ ...prev, auditor: loggedUser || 'Usuario' }));
  }, [loggedUser]);

  useEffect(() => {
    const fetchRdmFolio = async () => {
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
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Control de RDMs</Text>
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

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Fecha</Text>
              <TextInput style={styles.input} value={form.fecha} editable={false} placeholderTextColor="#9AA6B2" />
            </View>

            <View style={styles.row2}>
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

              <View style={styles.halfField}>
                <Text style={styles.fieldLabel}>Material</Text>
                <TextInput
                  style={styles.input}
                  value={form.material}
                  onChangeText={text => updateField('material', text)}
                  editable={!isLoadingFolio}
                  placeholderTextColor="#9AA6B2"
                />
              </View>
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
                <TextInput
                  style={styles.input}
                  value={form.proveedor}
                  onChangeText={text => updateField('proveedor', text)}
                  editable={!isLoadingFolio}
                  placeholderTextColor="#9AA6B2"
                />
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
                <TextInput
                  style={styles.input}
                  value={form.disposicion}
                  onChangeText={text => updateField('disposicion', text)}
                  editable={!isLoadingFolio}
                  placeholderTextColor="#9AA6B2"
                />
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
                style={[styles.input, styles.inputMultiline]}
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
});

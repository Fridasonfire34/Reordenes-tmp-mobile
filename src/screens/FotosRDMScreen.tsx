import React, { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Asset, launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { API_ENDPOINTS } from '../config/api';
import { type RdmSavePayload } from './RDMsScreen';

type FotosRDMScreenProps = {
  onBack: () => void;
  onSaved: () => void;
  folio: string;
  rdmPayload: RdmSavePayload | null;
};

type RdmPhoto = {
  id: string;
  uri: string;
  mimeType: string;
  fileDataBase64: string;
  fileSize: number;
};

export default function FotosRDMScreen({ onBack, onSaved, folio, rdmPayload }: FotosRDMScreenProps) {
  const [photos, setPhotos] = useState<RdmPhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<RdmPhoto | null>(null);
  const [isSavingPhotos, setIsSavingPhotos] = useState(false);

  const appendAssets = (assets?: Asset[]) => {
    if (!assets?.length) {
      return;
    }

    const nextPhotos = assets
      .filter(asset => !!asset.uri && !!asset.base64)
      .map(asset => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        uri: asset.uri as string,
        mimeType: asset.type?.trim() || 'application/octet-stream',
        fileDataBase64: asset.base64 as string,
        fileSize: typeof asset.fileSize === 'number' && Number.isFinite(asset.fileSize)
          ? Math.max(0, Math.round(asset.fileSize))
          : 0,
      }));

    if (!nextPhotos.length) {
      return;
    }

    setPhotos(prev => [...prev, ...nextPhotos]);
  };

  const handleSelectFromGallery = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        quality: 0.8,
        includeBase64: true,
      });

      if (result.didCancel) {
        return;
      }

      if (result.errorCode) {
        Alert.alert('Error', result.errorMessage || 'No fue posible abrir la galeria.');
        return;
      }

      appendAssets(result.assets);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'No fue posible abrir la galeria.',
      );
    }
  };

  const handleTakePhoto = async () => {
    try {
      const result = await launchCamera({
        mediaType: 'photo',
        saveToPhotos: true,
        quality: 0.8,
        cameraType: 'back',
        includeBase64: true,
      });

      if (result.didCancel) {
        return;
      }

      if (result.errorCode) {
        Alert.alert('Error', result.errorMessage || 'No fue posible abrir la camara.');
        return;
      }

      appendAssets(result.assets);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'No fue posible abrir la camara.',
      );
    }
  };

  const handleSavePhotos = async () => {
    if (!photos.length) {
      Alert.alert('Sin fotos', 'Agrega al menos una fotografia antes de guardar.');
      return;
    }

    if (!folio.trim()) {
      Alert.alert('Folio no disponible', 'No se puede guardar sin folio de RDM.');
      return;
    }

    if (!rdmPayload) {
      Alert.alert('Error', 'No se encontraron los datos del RDM. Vuelve al formulario.');
      return;
    }

    if (photos.some(p => !p.fileDataBase64)) {
      Alert.alert('Foto incompleta', 'Una o mas fotografias no tienen datos. Vuelve a capturarlas.');
      return;
    }

    try {
      setIsSavingPhotos(true);

      // 1. Guardar RDM en BD
      const rdmResponse = await fetch(API_ENDPOINTS.saveRDM, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rdmPayload),
      });

      const rdmText = await rdmResponse.text();
      let rdmData: Record<string, unknown> | null = null;
      try { rdmData = rdmText ? (JSON.parse(rdmText) as Record<string, unknown>) : null; } catch { rdmData = null; }

      if (!rdmResponse.ok) {
        throw new Error(
          (rdmData?.message as string | undefined) || rdmText || `Error ${rdmResponse.status} al guardar RDM.`,
        );
      }

      // 2. Guardar fotografias
      const fotosResponse = await fetch(API_ENDPOINTS.saveRdmFotos, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folio: folio.trim(),
          photos: photos.map(p => ({
            mimeType: p.mimeType,
            fileData: p.fileDataBase64,
            fileSize: p.fileSize,
          })),
        }),
      });

      const fotosData = await fotosResponse.json().catch(() => null);
      if (!fotosResponse.ok) {
        const msg = fotosData && typeof fotosData === 'object' && typeof fotosData.message === 'string'
          ? fotosData.message
          : `Error ${fotosResponse.status} al guardar fotografias.`;
        throw new Error(msg);
      }

      // 3. Generar reporte PDF (fotos ya guardadas en BD para que aparezcan en el reporte)
      try {
        const pdfResponse = await fetch(API_ENDPOINTS.generateRdmReport, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folio: rdmPayload.folio,
          }),
        });

        if (!pdfResponse.ok && pdfResponse.status !== 409) {
          const pdfData = await pdfResponse.json().catch(() => null) as { message?: string } | null;
          const msg = pdfData?.message ?? '';
          if (!/existe|existente|duplicado|duplicate/i.test(msg)) {
            Alert.alert('Advertencia', `RDM guardado, pero no se genero el PDF: ${msg || `Error ${pdfResponse.status}`}`);
          }
        }
      } catch {
        Alert.alert('Advertencia', 'RDM guardado, pero no fue posible generar el PDF.');
      }

      Alert.alert(
        'Guardado',
        `RDM ${folio} guardado.`,
        [{ text: 'OK', onPress: onSaved }],
      );
    } catch (error) {
      Alert.alert(
        'Error al guardar',
        error instanceof Error ? error.message : 'No fue posible guardar el RDM.',
      );
    } finally {
      setIsSavingPhotos(false);
    }
  };

  const handleDeleteSelectedPhoto = () => {
    if (!selectedPhoto) {
      return;
    }

    const photoToDelete = selectedPhoto;

    Alert.alert('Eliminar fotografia', '¿Deseas eliminar esta fotografia?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          setPhotos(prev => prev.filter(photo => photo.id !== photoToDelete.id));
          setSelectedPhoto(null);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>REPORTE RDM</Text>
            <Text style={styles.title}>Anexar Fotografias</Text>
            <Text style={styles.headerFolio}>Folio: {folio || 'Sin folio'}</Text>
          </View>
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.galleryCard}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {photos.length === 0 ? (
              <View style={styles.emptyStateBox}>
                <Text style={styles.emptyStateTitle}>No hay fotografias cargadas</Text>
                <Text style={styles.emptyText}>
                  Usa Galeria o Camara para agregar evidencias del reporte.
                </Text>
              </View>
            ) : null}

            <View style={styles.grid}>
              {photos.map((photo, index) => (
                <TouchableOpacity
                  key={photo.id}
                  style={styles.photoCell}
                  activeOpacity={0.9}
                  onPress={() => setSelectedPhoto(photo)}
                >
                  <Image source={{ uri: photo.uri }} style={styles.photoImage} resizeMode="cover" />
                  <View style={styles.photoFooter}>
                    <Text style={styles.photoLabel}>Foto {index + 1}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.bottomActions}>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity style={styles.actionButton} activeOpacity={0.85} onPress={handleSelectFromGallery}>
              <Text style={styles.actionIcon}>+</Text>
              <Text style={styles.actionText}>Galeria</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} activeOpacity={0.85} onPress={handleTakePhoto}>
              <Text style={styles.actionIcon}>📷</Text>
              <Text style={styles.actionText}>Camara</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, photos.length === 0 || isSavingPhotos ? styles.saveButtonDisabled : null]}
            activeOpacity={0.85}
            onPress={() => {
              void handleSavePhotos();
            }}
            disabled={photos.length === 0 || isSavingPhotos}
          >
            <Text style={styles.saveButtonText}>
              {isSavingPhotos ? 'Guardando...' : `Guardar RDM (${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'})`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={selectedPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.previewOverlay}>
          <View style={styles.previewTopActions}>
            <TouchableOpacity
              style={styles.previewDeleteButton}
              activeOpacity={0.85}
              onPress={handleDeleteSelectedPhoto}
            >
              <Text style={styles.previewDeleteText}>Eliminar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.previewCloseButton}
              activeOpacity={0.85}
              onPress={() => setSelectedPhoto(null)}
            >
              <Text style={styles.previewCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>

          {selectedPhoto ? (
            <Image source={{ uri: selectedPhoto.uri }} style={styles.previewImage} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    marginBottom: 35,
    marginTop: 20,
    flex: 1,
    backgroundColor: '#E7ECF6',
  },
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B64A5',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#12306F',
  },
  headerFolio: {
    marginTop: 5,
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  backButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#C9D5EA',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  backButtonText: {
    color: '#2D3748',
    fontSize: 14,
    fontWeight: '600',
  },
  galleryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E2F0',
    padding: 12,
    marginBottom: 10,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  emptyStateBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#C4D1E7',
    backgroundColor: '#F8FAFC',
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  photoCell: {
    width: '48.7%',
    borderRadius: 12,
    backgroundColor: '#F8FBFF',
    borderWidth: 1,
    borderColor: '#D8E0EB',
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#E2E8F0',
  },
  photoFooter: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  photoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  bottomActions: {
    gap: 8,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: '#F8FBFF',
    borderWidth: 1,
    borderColor: '#D4DEEF',
    borderRadius: 16,
    padding: 10,
  },
  actionButton: {
    flex: 1,
    height: 62,
    borderRadius: 12,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  actionIcon: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  actionText: {
    color: '#DBEAFE',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  saveButton: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    backgroundColor: '#0F9D58',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    shadowColor: '#0F9D58',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  saveButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 18,
  },
  previewTopActions: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  previewDeleteButton: {
    backgroundColor: 'rgba(220, 38, 38, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(254, 202, 202, 0.8)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  previewDeleteText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  previewCloseButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  previewCloseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  previewImage: {
    width: '100%',
    flex: 1,
  },
});

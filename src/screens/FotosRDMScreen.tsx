import React, { useState } from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Asset, launchCamera, launchImageLibrary } from 'react-native-image-picker';

type FotosRDMScreenProps = {
  onBack: () => void;
  folio: string;
};

export default function FotosRDMScreen({ onBack, folio }: FotosRDMScreenProps) {
  const [photos, setPhotos] = useState<Array<{ id: string; uri: string }>>([]);

  const appendAssets = (assets?: Asset[]) => {
    if (!assets?.length) {
      return;
    }

    const nextPhotos = assets
      .filter(asset => !!asset.uri)
      .map(asset => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        uri: asset.uri as string,
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

  const handleSavePhotos = () => {
    if (!photos.length) {
      Alert.alert('Sin fotos', 'Agrega al menos una fotografia antes de guardar.');
      return;
    }

    Alert.alert('Guardado', `Se guardaron ${photos.length} fotografias del folio ${folio || 'N/A'}.`);
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
                <View key={photo.id} style={styles.photoCell}>
                  <Image source={{ uri: photo.uri }} style={styles.photoImage} resizeMode="cover" />
                  <View style={styles.photoFooter}>
                    <Text style={styles.photoLabel}>Foto {index + 1}</Text>
                  </View>
                </View>
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
            style={[styles.saveButton, photos.length === 0 ? styles.saveButtonDisabled : null]}
            activeOpacity={0.85}
            onPress={handleSavePhotos}
            disabled={photos.length === 0}
          >
            <Text style={styles.saveButtonText}>Guardar Fotografias ({photos.length})</Text>
          </TouchableOpacity>
        </View>
      </View>
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
});

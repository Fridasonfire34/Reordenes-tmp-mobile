import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';
import type { OnReadCodeData } from 'react-native-camera-kit/src/CameraProps';

interface BarcodeScannerModalProps {
  visible: boolean;
  onScan: (value: string) => void;
  onClose: () => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onScan,
  onClose,
}) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible) {
      setScanned(false);
      void requestCameraPermission();
    }
  }, [visible]);

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      const status = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
      );
      setHasPermission(status === PermissionsAndroid.RESULTS.GRANTED);
    } else {
      setHasPermission(true);
    }
  };

  const handleReadCode = useCallback(
    (event: OnReadCodeData) => {
      if (scanned) return;
      const value = event.nativeEvent.codeStringValue;
      if (value) {
        setScanned(true);
        onScan(value);
      }
    },
    [scanned, onScan],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {hasPermission ? (
          <>
            <Camera
              style={StyleSheet.absoluteFill}
              cameraType={CameraType.Back}
              scanBarcode={!scanned}
              onReadCode={handleReadCode}
              showFrame={true}
              laserColor="#4A90E2"
              frameColor="white"
            />
            <View style={styles.hintContainer} pointerEvents="none">
              <Text style={styles.hintText}>
                {scanned
                  ? '✓ Código detectado'
                  : 'Apunta la cámara al código de barras'}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.centered}>
            <Text style={styles.errorIcon}>📷</Text>
            <Text style={styles.statusText}>Sin permiso para usar la cámara.</Text>
            <Text style={styles.subText}>
              Habilita el permiso en Ajustes del dispositivo.
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕  Cerrar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#111',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  subText: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 48,
  },

  /* ── Hint / instrucción ── */
  hintContainer: {
    position: 'absolute',
    bottom: 110,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: '#fff',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },

  /* ── Botón cerrar ── */
  closeButton: {
    position: 'absolute',
    top: 48,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

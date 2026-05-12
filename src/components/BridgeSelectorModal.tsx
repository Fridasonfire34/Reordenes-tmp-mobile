import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {
  Bridge,
  loadBridgesConfig,
  formatBridgeDisplay,
  checkBridgesAvailability,
} from '../utils/bridgeManager';

interface BridgeSelectorModalProps {
  visible: boolean;
  onSelectBridge: (bridge: Bridge) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const BridgeSelectorModal: React.FC<BridgeSelectorModalProps> = ({
  visible,
  onSelectBridge,
  onCancel,
  isLoading = false,
}) => {
  const [bridges, setBridges] = useState<Bridge[]>([]);
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (visible) {
      loadBridges();
    }
  }, [visible]);

  const loadBridges = async () => {
    setLoading(true);
    try {
      const allBridges = await loadBridgesConfig();
      setBridges(allBridges);
      
      // Verificar disponibilidad
      const avail = await checkBridgesAvailability(allBridges);
      setAvailability(avail);
    } catch (error) {
      console.error('Error cargando bridges:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBridge = (bridge: Bridge) => {
    if (availability.get(bridge.id)) {
      onSelectBridge(bridge);
    }
  };

  const isBridgeAvailable = (bridgeId: string): boolean => {
    return availability.get(bridgeId) ?? false;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.title}>Selecciona una Impresora DYMO</Text>

          {loading || isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0066cc" />
              <Text style={styles.loadingText}>Buscando impresoras...</Text>
            </View>
          ) : bridges.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No hay impresoras disponibles</Text>
            </View>
          ) : (
            <ScrollView style={styles.bridgeList}>
              {bridges.map((bridge) => {
                const available = isBridgeAvailable(bridge.id);
                return (
                  <TouchableOpacity
                    key={bridge.id}
                    style={[
                      styles.bridgeItem,
                      !available && styles.bridgeItemDisabled,
                    ]}
                    onPress={() => handleSelectBridge(bridge)}
                    disabled={!available}
                  >
                    <View style={styles.bridgeInfo}>
                      <Text
                        style={[
                          styles.bridgeName,
                          !available && styles.bridgeNameDisabled,
                        ]}
                      >
                        {formatBridgeDisplay(bridge)}
                      </Text>
                      {bridge.description && (
                        <Text
                          style={[
                            styles.bridgeDescription,
                            !available && styles.bridgeDescriptionDisabled,
                          ]}
                        >
                          {bridge.description}
                        </Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.statusIndicator,
                        available ? styles.statusOnline : styles.statusOffline,
                      ]}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    maxHeight: '80%',
    width: '90%',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
  bridgeList: {
    width: '100%',
    maxHeight: 400,
  },
  bridgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginVertical: 5,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#0066cc',
  },
  bridgeItemDisabled: {
    opacity: 0.5,
    backgroundColor: '#f0f0f0',
    borderLeftColor: '#ccc',
  },
  bridgeInfo: {
    flex: 1,
  },
  bridgeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  bridgeNameDisabled: {
    color: '#999',
  },
  bridgeDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  bridgeDescriptionDisabled: {
    color: '#999',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 10,
  },
  statusOnline: {
    backgroundColor: '#4CAF50',
  },
  statusOffline: {
    backgroundColor: '#f44336',
  },
  cancelButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    width: '100%',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

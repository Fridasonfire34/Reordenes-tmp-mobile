import React, { useState } from 'react';
import { View, TouchableOpacity, Text, Alert, ActivityIndicator } from 'react-native';
import { BridgeSelectorModal } from '../components/BridgeSelectorModal';
import { getBridgeUrl } from '../utils/bridgeManager';

interface Bridge {
  id: string;
  name: string;
  port: number;
  location: string;
  description?: string;
}

interface Label {
  folio: string;
  fecha: string;
  ensamble?: string;
  parte: string;
  secuencia?: string;
  defecto?: string;
  cantidad: string;
}
export const NuevaReordenScreenWithBridgeSelector = () => {
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [selectedBridge, setSelectedBridge] = useState<Bridge | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const handleEnviarADymo = async () => {
    setSelectorVisible(true);
  };

  const handleSelectBridge = async (bridge: Bridge) => {
    setSelectedBridge(bridge);
    setSelectorVisible(false);

    await printToSelectedBridge(bridge);
  };

  const printToSelectedBridge = async (bridge: Bridge) => {
    try {
      setIsPrinting(true);

      const labels: Label[] = [
        {
          folio: 'RDM-2024-001',
          fecha: new Date().toLocaleString('es-MX'),
          ensamble: 'ASSY-123',
          parte: 'PART-456',
          secuencia: '1',
          defecto: 'N/A',
          cantidad: '10',
        },
      ];

      const bridgeUrl = getBridgeUrl(bridge.location, bridge.port);
      const response = await fetch(`${bridgeUrl}/api/rdm/print`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          labels: labels,
          labelPreset: '100x212',
          printerName: 'DYMO LABELWRITER 550',
        }),
      });

      const result = await response.json();

      if (response.ok) {
        Alert.alert(
          'Éxito',
          `Se imprimieron ${result.printed} etiqueta(s) en ${bridge.name}`
        );
      } else {
        Alert.alert(
          'Error',
          `Impresión fallida: ${result.message}`
        );
      }
    } catch (error) {
      Alert.alert(
        'Error de Conexión',
        `No se pudo conectar con ${selectedBridge?.name}: ${String(error)}`
      );
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      {/* Botón que muestra el selector */}
      <TouchableOpacity
        style={{
          backgroundColor: '#0066cc',
          padding: 15,
          borderRadius: 8,
          marginVertical: 10,
        }}
        onPress={handleEnviarADymo}
        disabled={isPrinting}
      >
        {isPrinting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
            Enviar a DYMO
            {selectedBridge && ` (${selectedBridge.name})`}
          </Text>
        )}
      </TouchableOpacity>

      {/* Modal selector de impresoras */}
      <BridgeSelectorModal
        visible={selectorVisible}
        onSelectBridge={handleSelectBridge}
        onCancel={() => setSelectorVisible(false)}
        isLoading={isPrinting}
      />
    </View>
  );
};

/*
PASOS DE INTEGRACIÓN:

1. En tu screen NuevaReordenScreen.tsx, importa:
   - BridgeSelectorModal del componente
   - getBridgeUrl del bridgeManager

2. Agrega estado para tracking:
   - selectorVisible: boolean
   - selectedBridge: Bridge | null
   - isPrinting: boolean

3. En tu botón "Enviar a DYMO", llama a handleEnviarADymo()

4. Cuando el usuario selecciona una impresora, se ejecuta printToSelectedBridge()

5. La petición POST se envía a: http://{location}:{port}/api/rdm/print

VENTAJAS:
✅ Usuario elige impresora antes de enviar
✅ Muestra disponibilidad en tiempo real
✅ Cada bridge se ejecuta en su propio puerto
✅ Nombres descriptivos para cada ubicación
✅ Fallback a impresora por defecto en cada bridge
*/

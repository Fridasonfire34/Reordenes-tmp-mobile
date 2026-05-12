# Configuración de Múltiples Impresoras DYMO

## Arquitectura

```
┌─────────────────────────────────────────┐
│     APP MÓVIL (React Native)            │
│  - Lee bridges.config.json              │
│  - Muestra selector visual              │
│  - Envía petición a bridge elegido      │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┬─────────────┬──────────────┐
       │                │             │              │
       ▼                ▼             ▼              ▼
   BRIDGE 1        BRIDGE 2      BRIDGE 3      BRIDGE 4
   Puerto 3010     Puerto 3011   Puerto 3012   Puerto 3013
   DYMO Embarques  DYMO Calidad  DYMO Viper    DYMO Metálicas
   PC A            PC B          PC C          PC D
```

## Configuración Paso a Paso

### 1. Configurar cada Bridge

En **cada computadora** donde tengas una impresora DYMO:

```bash
cd bridge-rdm
cp .env.example .env
```

Edita `.env` con los datos de esa máquina:

**Máquina 1 - Embarques (.env):**
```
PORT=3010
BRIDGE_NAME=DYMO Embarques
BRIDGE_LOCATION=192.168.1.100
DYMO_PRINTER_NAME=DYMO LABELWRITER 550
DYMO_LABEL_PRESET=100x212
```

**Máquina 2 - Calidad (.env):**
```
PORT=3011
BRIDGE_NAME=DYMO Calidad
BRIDGE_LOCATION=192.168.1.101
DYMO_PRINTER_NAME=DYMO LABELWRITER 550
DYMO_LABEL_PRESET=100x212
```

Y así para cada máquina...

### 2. Configurar bridges.config.json

En la **raíz del proyecto** (lado app), actualiza `bridges.config.json`:

```json
{
  "bridges": [
    {
      "id": "embarques",
      "name": "DYMO Embarques",
      "port": 3010,
      "location": "192.168.1.100",
      "description": "Impresora para etiquetas de embarque"
    },
    {
      "id": "calidad",
      "name": "DYMO Calidad",
      "port": 3011,
      "location": "192.168.1.101",
      "description": "Impresora para QA y control de calidad"
    }
    // ... más bridges
  ]
}
```

### 3. Actualizar la App (React Native)

**En el componente donde tienes el botón "Enviar a Dymo":**

```tsx
import { BridgeSelectorModal } from '../components/BridgeSelectorModal';
import { getBridgeUrl } from '../utils/bridgeManager';

export const NuevaReordenScreen = () => {
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [selectedBridge, setSelectedBridge] = useState<Bridge | null>(null);

  const handleEnviarADymo = () => {
    setSelectorVisible(true); // Muestra selector
  };

  const handleSelectBridge = async (bridge: Bridge) => {
    setSelectedBridge(bridge);
    setSelectorVisible(false);

    // Enviar a imprimir
    const bridgeUrl = getBridgeUrl(bridge.location, bridge.port);
    await fetch(`${bridgeUrl}/api/rdm/print`, {
      method: 'POST',
      body: JSON.stringify({
        labels: [/* tus etiquetas */],
        labelPreset: '100x212',
        printerName: 'DYMO LABELWRITER 550',
      }),
    });
  };

  return (
    <View>
      <TouchableOpacity onPress={handleEnviarADymo}>
        <Text>Enviar a DYMO</Text>
      </TouchableOpacity>

      <BridgeSelectorModal
        visible={selectorVisible}
        onSelectBridge={handleSelectBridge}
        onCancel={() => setSelectorVisible(false)}
      />
    </View>
  );
};
```

### 4. Iniciar los Bridges

En **cada computadora**:

```bash
cd bridge-rdm
npm install
npm start
```

Deberías ver:
```
RDM bridge activo en http://localhost:3010
Bridge: DYMO Embarques
```

## Endpoints Disponibles

### Cada Bridge expone:

**Health Check:**
```
GET http://{IP}:{PORT}/api/rdm/health
→ { ok: true, service: "rdm-dymo-bridge" }
```

**Info del Bridge:**
```
GET http://{IP}:{PORT}/api/rdm/info
→ {
    name: "DYMO Embarques",
    port: 3010,
    location: "192.168.1.100",
    printer: "DYMO LABELWRITER 550",
    preset: "100x212"
  }
```

**Listar Impresoras Disponibles:**
```
GET http://{IP}:{PORT}/api/rdm/printers
→ { printers: [...] }
```

**Enviar a Imprimir:**
```
POST http://{IP}:{PORT}/api/rdm/print
Body: {
  labels: [
    {
      folio: "RDM-2024-001",
      fecha: "2024-05-11 10:30",
      ensamble: "ASSY-123",
      parte: "PART-456",
      secuencia: "1",
      defecto: "N/A",
      cantidad: "10"
    }
  ],
  labelPreset: "100x212",
  printerName: "DYMO LABELWRITER 550"
}
→ { ok: true, printed: 1, printerName: "DYMO LABELWRITER 550" }
```

## Carga del archivo bridges.config.json

Hay varias opciones:

### Opción A: Leer desde archivo local (recomendado para React Native)
```tsx
import bridgesConfig from '../bridges.config.json';
const bridges = bridgesConfig.bridges;
```

### Opción B: Leer desde el backend API
```tsx
const response = await fetch('http://192.168.17.9:4000/api/rdm/bridges');
const { bridges } = await response.json();
```

### Opción C: Leer desde endpoint en el bridge
```tsx
// Cada bridge expone su información
const response = await fetch('http://192.168.1.100:3010/api/rdm/info');
const bridgeInfo = await response.json();
```

## Ventajas de este Sistema

✅ **Descentralizado**: Cada impresora se gestiona independientemente  
✅ **Escalable**: Agregar nuevas impresoras es trivial  
✅ **Resiliente**: Si un bridge falla, otros siguen funcionando  
✅ **Fácil de usar**: Selector visual que muestra disponibilidad  
✅ **Flexible**: Puedes cambiar puertos sin modificar código  
✅ **Identificable**: Cada impresora tiene nombre descriptivo  

## Troubleshooting

### "No se encuentran bridges disponibles"
1. Verifica que cada bridge esté corriendo: `netstat -an | findstr :PORT`
2. Verifica las IPs en `bridges.config.json`
3. Verifica firewall permita comunicación en los puertos

### "Impresora DYMO no encontrada"
1. Verifica el nombre exacto: `Get-Printer | findstr DYMO` (PowerShell)
2. Actualiza `DYMO_PRINTER_NAME` en `.env`

### "Error de conexión al bridge"
1. Verifica que el bridge esté escuchando en el puerto correcto
2. Verifica conectividad: `ping 192.168.1.100`
3. Revisa logs del bridge en la consola

## Seguridad

Para producción considera:
- Agregar autenticación a los endpoints
- Usar HTTPS en lugar de HTTP
- Validar origen de peticiones (CORS configurado)
- Rate limiting para prevenir abuso

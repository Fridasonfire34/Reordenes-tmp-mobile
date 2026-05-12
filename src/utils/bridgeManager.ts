export interface Bridge {
  id: string;
  name: string;
  port: number;
  location: string;
  description?: string;
}

interface BridgeInfo {
  name: string;
  port: number;
  location: string;
  printer: string;
  preset: string;
}

let cachedBridges: Bridge[] = [];

/**
 * Obtiene la lista de bridges disponibles desde el archivo de configuración
 */
export const loadBridgesConfig = async (): Promise<Bridge[]> => {
  try {
    const config = require('../../bridges.config.json') as { bridges?: Bridge[] };
    cachedBridges = Array.isArray(config?.bridges) ? config.bridges : [];
    return cachedBridges;
  } catch (error) {
    console.warn('Error cargando bridges, usando cache:', error);
    return cachedBridges;
  }
};

/**
 * Obtiene información de un bridge específico
 */
export const getBridgeInfo = async (location: string, port: number): Promise<BridgeInfo | null> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(`http://${location}:${port}/api/rdm/info`, {
      signal: controller.signal,
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.warn(`Bridge no disponible: ${location}:${port}`, error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Verifica la disponibilidad de todos los bridges
 */
export const checkBridgesAvailability = async (bridges: Bridge[]): Promise<Map<string, boolean>> => {
  const availability = new Map<string, boolean>();
  
  await Promise.all(
    bridges.map(async (bridge) => {
      const info = await getBridgeInfo(bridge.location, bridge.port);
      availability.set(bridge.id, info !== null);
    })
  );
  
  return availability;
};

/**
 * Construye la URL del bridge
 */
export const getBridgeUrl = (location: string, port: number): string => {
  return `http://${location}:${port}`;
};

/**
 * Obtiene los puentes disponibles (solo los que responden)
 */
export const getAvailableBridges = async (): Promise<Bridge[]> => {
  const bridges = await loadBridgesConfig();
  const availability = await checkBridgesAvailability(bridges);
  
  return bridges.filter((b) => availability.get(b.id) === true);
};

/**
 * Formatea el nombre del bridge para mostrar en la UI
 * Ej: "DYMO Embarques - 3010"
 */
export const formatBridgeDisplay = (bridge: Bridge): string => {
  return `${bridge.name} - ${bridge.port}`;
};

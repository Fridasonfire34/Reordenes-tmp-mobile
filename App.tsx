import React, { useEffect, useState } from 'react';
import { Alert, Linking, PermissionsAndroid, Platform, StatusBar } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import MenuScreen from './src/screens/MenuScreen';
import NuevaReordenScreen from './src/screens/NuevaReordenScreen';
import ConsultarReordenesScreen from './src/screens/ConsultarReordenesScreen';

async function requestCameraPermissionOnLaunch() {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Permiso de camara',
        message:
          'RDM necesita acceso a la camara para tomar fotos y escanear codigos de barras.',
        buttonPositive: 'Permitir',
        buttonNegative: 'No permitir',
        buttonNeutral: 'Mas tarde',
      },
    );

    if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      Alert.alert(
        'Permiso bloqueado',
        'Activa el permiso de camara en Ajustes para usar fotos y escaneo de codigos.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir ajustes', onPress: () => Linking.openSettings() },
        ],
      );
    }
  } catch {
    // Si falla la solicitud, la app sigue funcionando y podras reintentar luego.
  }
}

function App() {
  const [currentScreen, setCurrentScreen] = useState<
    'login' | 'menu' | 'new-order' | 'consultar-reordenes'
  >('login');
  const [loggedUser, setLoggedUser] = useState('Usuario');

  useEffect(() => {
    requestCameraPermissionOnLaunch();
  }, []);

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#EEF1F5" />
      {currentScreen === 'login' ? (
        <LoginScreen
          onLoginSuccess={user => {
            setLoggedUser(user || 'Usuario');
            setCurrentScreen('menu');
          }}
        />
      ) : currentScreen === 'menu' ? (
        <MenuScreen
          userName={loggedUser}
          onNuevaReorden={() => setCurrentScreen('new-order')}
          onConsultarReordenes={() => setCurrentScreen('consultar-reordenes')}
        />
      ) : currentScreen === 'new-order' ? (
        <NuevaReordenScreen onBack={() => setCurrentScreen('menu')} />
      ) : (
        <ConsultarReordenesScreen onBack={() => setCurrentScreen('menu')} />
      )}
    </>
  );
}

export default App;

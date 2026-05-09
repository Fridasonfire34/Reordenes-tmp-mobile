import React, { useEffect, useState } from 'react';
import { Alert, Linking, PermissionsAndroid, Platform, StatusBar } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import MenuScreen from './src/screens/MenuScreen';
import NuevaReordenScreen from './src/screens/NuevaReordenScreen';
import ConsultarReordenesScreen from './src/screens/ConsultarReordenesScreen';
import RDMsScreen, { type RdmDraft } from './src/screens/RDMsScreen';
import RDMsMenuScreen from './src/screens/RDMsMenuScreen';
import ConsultarRDMsScreen from './src/screens/ConsultarRDMsScreen';
import FotosRDMScreen from './src/screens/FotosRDMScreen';

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
    | 'login'
    | 'menu'
    | 'new-order'
    | 'consultar-reordenes'
    | 'rdms-menu'
    | 'rdms-new'
    | 'rdms-view'
    | 'rdms-fotos'
  >('login');
  const [loggedUser, setLoggedUser] = useState('Usuario');
  const [loggedNomina, setLoggedNomina] = useState('');
  const [rdmFolioForPhotos, setRdmFolioForPhotos] = useState('');
  const [rdmDraft, setRdmDraft] = useState<RdmDraft | null>(null);

  useEffect(() => {
    requestCameraPermissionOnLaunch();
  }, []);

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#EEF1F5" />
      {currentScreen === 'login' ? (
        <LoginScreen
          onLoginSuccess={({ name, nomina }) => {
            setLoggedUser(name || 'Usuario');
            setLoggedNomina(nomina || '');
            setCurrentScreen('menu');
          }}
        />
      ) : currentScreen === 'menu' ? (
        <MenuScreen
          userName={loggedUser}
          onNuevaReorden={() => setCurrentScreen('new-order')}
          onConsultarReordenes={() => setCurrentScreen('consultar-reordenes')}
          onRDMs={() => setCurrentScreen('rdms-menu')}
        />
      ) : currentScreen === 'new-order' ? (
        <NuevaReordenScreen onBack={() => setCurrentScreen('menu')} />
      ) : currentScreen === 'rdms-menu' ? (
        <RDMsMenuScreen
          onBack={() => setCurrentScreen('menu')}
          onVerRDMs={() => setCurrentScreen('rdms-view')}
          onNuevoRDM={() => {
            setRdmDraft(null);
            setRdmFolioForPhotos('');
            setCurrentScreen('rdms-new');
          }}
        />
      ) : currentScreen === 'rdms-new' ? (
        <RDMsScreen
          onBack={() => setCurrentScreen('rdms-menu')}
          loggedUser={loggedUser}
          loggedNomina={loggedNomina}
          initialDraft={rdmDraft}
          onDraftChange={setRdmDraft}
          onGoToFotosRDM={folio => {
            setRdmFolioForPhotos(folio || '');
            setCurrentScreen('rdms-fotos');
          }}
        />
      ) : currentScreen === 'rdms-view' ? (
        <ConsultarRDMsScreen
          onBack={() => setCurrentScreen('rdms-menu')}
          loggedUser={loggedUser}
          loggedNomina={loggedNomina}
        />
      ) : currentScreen === 'rdms-fotos' ? (
        <FotosRDMScreen
          folio={rdmFolioForPhotos}
          onBack={() => setCurrentScreen('rdms-new')}
          onSaved={() => {
            setRdmDraft(null);
            setRdmFolioForPhotos('');
            setCurrentScreen('rdms-menu');
          }}
        />
      ) : (
        <ConsultarReordenesScreen onBack={() => setCurrentScreen('menu')} />
      )}
    </>
  );
}

export default App;

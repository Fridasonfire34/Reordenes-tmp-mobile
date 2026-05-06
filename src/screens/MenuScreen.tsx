import React from 'react';
import {
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const BRAND_BLUE = '#1400FF';

type MenuScreenProps = {
  userName: string;
  onNuevaReorden: () => void;
  onConsultarReordenes: () => void;
  onRDMs: () => void;
};

export default function MenuScreen({
  userName,
  onNuevaReorden,
  onConsultarReordenes,
  onRDMs,
}: MenuScreenProps) {

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Botones centrados en toda la pantalla */}
        <View style={styles.buttonsWrapper}>
          <TouchableOpacity
            style={[styles.menuButton, styles.buttonPrimary]}
            onPress={onNuevaReorden}
          >
            <Text style={styles.menuEmoji}>📝</Text>
            <View style={styles.menuButtonContent}>
              <Text style={styles.menuButtonText}>Nueva Reorden</Text>
              <Text style={styles.menuButtonSubText}>Crear una nueva solicitud</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuButton, styles.buttonSecondary]}
            onPress={onConsultarReordenes}
          >
            <Text style={styles.menuEmoji}>📋</Text>
            <View style={styles.menuButtonContent}>
              <Text style={styles.menuButtonText}>Consultar reordenes</Text>
              <Text style={styles.menuButtonSubText}>Buscar y revisar estatus</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuButton, styles.buttonTertiary]}
            onPress={onRDMs}
          >
            <Text style={styles.menuEmoji}>📦</Text>
            <View style={styles.menuButtonContent}>
              <Text style={styles.menuButtonText}>RDMs</Text>
              <Text style={styles.menuButtonSubText}>Gestión de movimientos RDM</Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Header encima de los botones */}
        <View style={styles.headerCard}>
          <Text style={styles.welcomeLabel}>Bienvenido:</Text>
          <Text style={styles.userName} numberOfLines={1}>
            {userName}
          </Text>
          <Text style={styles.subtitle}>Selecciona una opción del menú principal</Text>
        </View>

        {/* Footer encima de los botones */}
        <View style={styles.footer}>
          <Image
            source={require('../../assets/images/TMP.png')}
            style={styles.footerLogo}
            resizeMode="contain"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EEF1F5',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
  },
  buttonsWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginTop: 20,
    marginBottom: 20,
    borderLeftWidth: 5,
    borderLeftColor: BRAND_BLUE,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  welcomeLabel: {
    fontSize: 14,
    color: '#5C6B7A',
    marginBottom: 2,
  },
  userName: {
    fontSize: 24,
    color: '#111111',
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#5C6B7A',
  },
  menuButton: {
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#D8E0EB',
  },
  buttonPrimary: {
    backgroundColor: '#EAF0FF',
  },
  buttonSecondary: {
    backgroundColor: '#EEF6FF',
  },
  buttonTertiary: {
    backgroundColor: '#F1F8FF',
  },
  menuEmoji: {
    fontSize: 26,
    marginRight: 12,
  },
  menuButtonContent: {
    flex: 1,
  },
  menuButtonText: {
    color: '#102033',
    fontSize: 18,
    fontWeight: '700',
  },
  menuButtonSubText: {
    color: '#5C6B7A',
    fontSize: 14,
    marginTop: 3,
  },
  menuArrow: {
    fontSize: 28,
    color: BRAND_BLUE,
    marginLeft: 8,
    marginTop: -2,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.65,
  },
  footerLogo: {
    width: 120,
    height:50,
  },
});
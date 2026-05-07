import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type ConsultarRDMsScreenProps = {
  onBack: () => void;
};

export default function ConsultarRDMsScreen({ onBack }: ConsultarRDMsScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Ver RDMs</Text>
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.messageTitle}>Modulo de consulta en preparacion</Text>
          <Text style={styles.messageBody}>
            Ya puedes entrar desde el menu de RDMs. Si quieres, en el siguiente paso conectamos esta pantalla al endpoint de consulta para listar movimientos.
          </Text>
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
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A49D8',
  },
  backButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  backButtonText: {
    color: '#2D3748',
    fontSize: 15,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#D8E0EB',
  },
  messageTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#102033',
    marginBottom: 8,
  },
  messageBody: {
    fontSize: 14,
    color: '#4A5568',
    lineHeight: 20,
  },
});

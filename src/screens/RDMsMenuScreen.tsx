import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type RDMsMenuScreenProps = {
  onBack: () => void;
  onVerRDMs: () => void;
  onNuevoRDM: () => void;
};

export default function RDMsMenuScreen({ onBack, onVerRDMs, onNuevoRDM }: RDMsMenuScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobBottom} />

        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>RDMs</Text>
          </View>
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>RDMs</Text>
          <Text style={styles.heroTitle}>Gestion de movimientos RDM</Text>
          <Text style={styles.heroDescription}>Administra y consulta movimientos desde un solo lugar.</Text>
        </View>

        <TouchableOpacity style={[styles.optionCard, styles.optionPrimary]} onPress={onVerRDMs} activeOpacity={0.9}>
          <View style={[styles.optionStripe, styles.optionStripePrimary]} />
          <View style={styles.optionIconWrap}>
            <Text style={styles.optionIconText}>R</Text>
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Ver RDMs</Text>
            <Text style={styles.optionSubtitle}>Consultar movimientos registrados</Text>
            <Text style={styles.optionMeta}>Historial y seguimiento</Text>
          </View>
          <Text style={styles.optionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.optionCard, styles.optionSecondary]} onPress={onNuevoRDM} activeOpacity={0.9}>
          <View style={[styles.optionStripe, styles.optionStripeSecondary]} />
          <View style={styles.optionIconWrap}>
            <Text style={styles.optionIconText}>N</Text>
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Capturar nuevo RDM</Text>
            <Text style={styles.optionSubtitle}>Registrar un nuevo movimiento</Text>
            <Text style={styles.optionMeta}>Alta rapida de captura</Text>
          </View>
          <Text style={styles.optionArrow}>›</Text>
        </TouchableOpacity>

        <Text style={styles.footerNote}>Tip: Puedes volver al menu principal con el boton de arriba.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    marginTop: 20,
    flex: 1,
    backgroundColor: '#E9EFF8',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  backgroundBlobTop: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#DCE8FF',
    top: -70,
    right: -90,
  },
  backgroundBlobBottom: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#D7F1EE',
    bottom: -50,
    left: -70,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F5D75',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: '#173C9A',
    maxWidth: 260,
  },
  headerHint: {
    marginTop: 6,
    fontSize: 13,
    color: '#5E6E86',
    maxWidth: 250,
  },
  backButton: {
    backgroundColor: '#FDFEFF',
    borderWidth: 1,
    borderColor: '#C4D2EA',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  backButtonText: {
    color: '#324562',
    fontSize: 14,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: '#173C9A',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 14,
    shadowColor: '#173C9A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 6,
  },
  heroLabel: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: '#C5D5FF',
    fontWeight: '700',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  heroDescription: {
    fontSize: 13,
    color: '#D7E4FF',
  },
  optionCard: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D2DFF2',
    marginBottom: 14,
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0E213D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  optionPrimary: {
    backgroundColor: '#F6F9FF',
  },
  optionSecondary: {
    backgroundColor: '#F5FCFB',
  },
  optionStripe: {
    width: 5,
    alignSelf: 'stretch',
    borderRadius: 4,
    marginRight: 12,
  },
  optionStripePrimary: {
    backgroundColor: '#2B62E8',
  },
  optionStripeSecondary: {
    backgroundColor: '#12937A',
  },
  optionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E8F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionIconText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1C4CCC',
  },
  optionContent: {
    flex: 1,
    marginTop: 10,
  },
  optionTitle: {
    color: '#102033',
    fontSize: 17,
    fontWeight: '800',
  },
  optionSubtitle: {
    color: '#5C6B7A',
    fontSize: 13,
    marginTop: 3,
  },
  optionMeta: {
    color: '#8193AA',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },
  optionArrow: {
    fontSize: 30,
    color: '#1B4FD7',
    marginLeft: 8,
    marginTop: -3,
  },
  footerNote: {
    marginTop: 4,
    fontSize: 12,
    color: '#657892',
    textAlign: 'center',
  },
});

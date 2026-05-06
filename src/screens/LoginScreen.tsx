import React, { useRef, useState } from 'react';
import {
  Alert,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { API_ENDPOINTS } from '../config/api';

const BRAND_BLUE = '#1400FF';
const LOGIN_URL = API_ENDPOINTS.login;
const RECOVERY_URL = API_ENDPOINTS.recoveryBase;

type LoginScreenProps = {
  onLoginSuccess?: (loggedUser: string) => void;
};

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordInputRef = useRef<TextInput>(null);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [screenMode, setScreenMode] = useState<
    'login' | 'forgot-password' | 'verify-code' | 'new-password'
  >('login');

  const handleSendRecoveryCode = async () => {
    if (!recoveryEmail.trim()) {
      Alert.alert('Dato incompleto', 'Ingresa tu correo para recuperar la contraseña.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`${RECOVERY_URL}/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: recoveryEmail.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Error', data?.message || 'No se pudo enviar el código.');
        return;
      }

      console.log('Recovery code requested for:', recoveryEmail.trim());
      setRecoveryCode('');
      setScreenMode('verify-code');
    } catch (error) {
      Alert.alert('Error de red', 'No se pudo conectar con el servidor.');
      console.error('Recovery send code error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!recoveryCode.trim()) {
      Alert.alert('Dato incompleto', 'Ingresa el código que recibiste.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`${RECOVERY_URL}/validate-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: recoveryEmail.trim(), codigo: recoveryCode.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Error', data?.message || 'Código incorrecto.');
        return;
      }

      setScreenMode('new-password');
    } catch (error) {
      Alert.alert('Error de red', 'No se pudo conectar con el servidor.');
      console.error('Recovery verify code error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Contraseña inválida', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (!confirmPassword) {
      Alert.alert('Dato incompleto', 'Confirma tu nueva contraseña.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('No coincide', 'La confirmación no coincide con la nueva contraseña.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`${RECOVERY_URL}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correo: recoveryEmail.trim(),
          codigo: recoveryCode.trim(),
          nuevaContrasena: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Error', data?.message || 'No se pudo cambiar la contraseña.');
        return;
      }

      Alert.alert('Listo', 'Contraseña actualizada correctamente.');
      setRecoveryEmail('');
      setRecoveryCode('');
      setNewPassword('');
      setConfirmPassword('');
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setScreenMode('login');
    } catch (error) {
      Alert.alert('Error de red', 'No se pudo conectar con el servidor.');
      console.error('Recovery reset password error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      console.error('Login validation error: correo o contraseña vacios');
      Alert.alert('Datos incompletos', 'Ingresa correo y contraseña.');
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          correo: email.trim(),
          contrasena: password,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

      if (!response.ok) {
        const errorMessage =
          typeof data === 'string' ? data : data?.message || 'No fue posible iniciar sesión.';
        console.error('Login HTTP error:', {
          url: LOGIN_URL,
          status: response.status,
          statusText: response.statusText,
          body: data,
        });
        Alert.alert('Error de login', errorMessage);
        return;
      }

      console.log('Respuesta login:', data);
      const loggedUser =
        typeof data === 'object' && data
          ? data?.user?.name ||
            data?.usuario?.nombre ||
            data?.nombre ||
            data?.user?.nombre ||
            data?.user?.username ||
            data?.username ||
            'Usuario'
          : 'Usuario';
      onLoginSuccess?.(loggedUser);
    } catch (error) {
      Alert.alert('Error de red', 'No se pudo conectar con el servidor.');
      console.error('Login network error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    setRecoveryEmail(email.trim());
    setScreenMode('forgot-password');
  };

  const handleBackToLogin = () => {
    setScreenMode('login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerText}>
            {screenMode === 'login' ? 'Login' : 'Login'}
          </Text>
          <Text style={styles.headerSeparator}> | </Text>
          <Text style={styles.headerTextBold}>Reordenes</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {screenMode === 'login' ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Iniciar sesión</Text>

              <Text style={styles.label}>Correo</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#B0B0B0"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => passwordInputRef.current?.focus()}
              />

              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  ref={passwordInputRef}
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#B0B0B0"
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(v => !v)}
                  style={styles.eyeButton}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleForgotPassword}
                style={styles.forgotContainer}
              >
                <Text style={styles.forgotText}>Olvidé mi contraseña</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loginButton, isSubmitting && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={isSubmitting}
              >
                <Text style={styles.loginButtonText}>
                  {isSubmitting ? 'Enviando...' : 'Entrar'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : screenMode === 'forgot-password' ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Recuperar contraseña</Text>
              <Text style={styles.recoveryDescription}>
                Escribe tu correo para enviarte el código de recuperación.
              </Text>

              <View style={styles.divider} />

              <Text style={styles.label}>Correo</Text>
              <TextInput
                style={styles.input}
                value={recoveryEmail}
                onChangeText={setRecoveryEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#B0B0B0"
                returnKeyType="send"
                onSubmitEditing={handleSendRecoveryCode}
              />

              <TouchableOpacity style={styles.loginButton} onPress={handleSendRecoveryCode}>
                <Text style={styles.loginButtonText}>
                  {isSubmitting ? 'Enviando...' : 'Enviar código'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleBackToLogin}
                style={styles.backToLoginContainer}
              >
                <Text style={styles.backToLoginText}>Volver al inicio de sesión</Text>
              </TouchableOpacity>
            </View>
          ) : screenMode === 'verify-code' ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Recuperar contraseña</Text>
              <Text style={styles.recoveryHighlightText}>
                Te enviamos un código a tu correo. Introdúcelo a continuación.
              </Text>

              <View style={styles.recoveryNoticeRow}>
                <Text style={styles.recoveryNoticeIcon}>⏰</Text>
                <Text style={styles.recoveryNoticeText}>El código expira en 15 minutos</Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.codeLabel}>Ingresa el código (6 dígitos)</Text>
              <TextInput
                style={styles.codeInput}
                value={recoveryCode}
                onChangeText={value => setRecoveryCode(value.replace(/[^0-9]/g, '').slice(0, 6))}
                keyboardType="number-pad"
                placeholder="_  _  _  _  _  _"
                placeholderTextColor="#7C7C7C"
                maxLength={6}
                textAlign="center"
                returnKeyType="done"
                onSubmitEditing={handleVerifyCode}
              />

              <TouchableOpacity style={styles.loginButton} onPress={handleVerifyCode}>
                <Text style={styles.loginButtonText}>
                  {isSubmitting ? 'Validando...' : 'Validar'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleBackToLogin}
                style={styles.backToLoginContainer}
              >
                <Text style={styles.backToLoginText}>Volver al inicio de sesión</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Recuperar contraseña</Text>
              <Text style={styles.recoveryDescription}>
                Ingresa tu nueva contraseña.
              </Text>

              <View style={styles.divider} />

              <Text style={styles.label}>Nueva contraseña</Text>
              <View style={styles.passwordWrapperAlt}>
                <TextInput
                  style={styles.passwordInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#B0B0B0"
                  returnKeyType="next"
                />
                <TouchableOpacity
                  onPress={() => setShowNewPassword(prev => !prev)}
                  style={styles.eyeButton}
                >
                  <Text style={styles.eyeIcon}>{showNewPassword ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Confirmar contraseña</Text>
              <View style={styles.passwordWrapperAlt}>
                <TextInput
                  style={styles.passwordInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#B0B0B0"
                  returnKeyType="done"
                  onSubmitEditing={handleResetPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(prev => !prev)}
                  style={styles.eyeButton}
                >
                  <Text style={styles.eyeIcon}>{showConfirmPassword ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.loginButton} onPress={handleResetPassword}>
                <Text style={styles.loginButtonText}>
                  {isSubmitting ? 'Guardando...' : 'Cambiar contraseña'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleBackToLogin}
                style={styles.backToLoginContainer}
              >
                <Text style={styles.backToLoginText}>Volver al inicio de sesión</Text>
              </TouchableOpacity>

              <Text style={styles.recoverySuccessText}>
                Codigo correcto. Ahora ingresa tu nueva contraseña.
              </Text>
            </View>
          )}

          {/* Footer — logo */}
          <View style={styles.footer}>
            <Image
              source={require('../../assets/images/TMP.png')}
              style={styles.footerLogo}
              resizeMode="contain"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EEF1F5',
  },
  flex: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
    paddingBottom: 10,
    backgroundColor: '#EEF1F5',
  },
  headerText: {
    fontSize: 18,
    fontWeight: '400',
    color: '#333333',
  },
  headerSeparator: {
    fontSize: 18,
    color: '#AAAAAA',
  },
  headerTextBold: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND_BLUE,
    letterSpacing: 1,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tarjeta blanca
  formCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 24,
  },
  recoveryDescription: {
    fontSize: 15,
    lineHeight: 21,
    color: '#5C6B7A',
    marginBottom: 20,
  },
  recoveryHighlightText: {
    fontSize: 15,
    lineHeight: 21,
    color: BRAND_BLUE,
    marginBottom: 24,
  },
  recoveryNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 26,
  },
  recoveryNoticeIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  recoveryNoticeText: {
    fontSize: 14,
    color: '#666666',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#D8DEE6',
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  codeLabel: {
    fontSize: 14,
    color: '#5C6B7A',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: '#555555',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DEDEDE',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111111',
    backgroundColor: '#FAFAFA',
    marginBottom: 16,
  },
  codeInput: {
    borderWidth: 1,
    borderColor: '#C9D6E4',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 26,
    fontSize: 28,
    color: '#111111',
    backgroundColor: '#FFFFFF',
    marginBottom: 24,
    letterSpacing: 14,
    fontWeight: '600',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DEDEDE',
    borderRadius: 10,
    backgroundColor: '#FAFAFA',
    marginBottom: 8,
  },
  passwordWrapperAlt: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#B9C9D8',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    marginBottom: 14,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111111',
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  eyeIcon: {
    fontSize: 16,
  },
  forgotContainer: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginTop: 6,
  },
  forgotText: {
    color: BRAND_BLUE,
    fontSize: 13,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: BRAND_BLUE,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.65,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  backToLoginContainer: {
    alignSelf: 'center',
    marginTop: 20,
  },
  backToLoginText: {
    color: BRAND_BLUE,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  recoverySuccessText: {
    marginTop: 18,
    fontSize: 14,
    lineHeight: 20,
    color: '#0C8A84',
  },

  // Footer
  footer: {
    marginTop: 56,
    marginBottom: 24,
    alignItems: 'center',
    opacity: 0.6,
  },
  footerLogo: {
    width: 100,
    height: 36,
  },
});

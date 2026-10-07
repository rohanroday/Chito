import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, errorMessage } from '@/api/client';
import type { Me, Tokens } from '@/api/types';
import { Button } from '@/components/Button';
import { MonasteryScene } from '@/components/MonasteryScene';
import { DentilBorder } from '@/components/ornaments';
import { Txt } from '@/components/Txt';
import { hoursLabel } from '@/lib/store-config';
import { useAuth } from '@/state/auth';
import { useStoreInfo } from '@/state/catalog';
import { colors, fonts, radius } from '@/theme';

export default function Login() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const store = useStoreInfo();
  const setTokens = useAuth((s) => s.setTokens);
  const finishLogin = useAuth((s) => s.finishLogin);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'name'>('phone');
  const [devMode, setDevMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sceneW = Math.min(width, 420);
  const validPhone = /^[6-9]\d{9}$/.test(phone);
  const validName = name.trim().length >= 2;
  const fullPhone = `+91${phone}`;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const sendOtp = () =>
    run(async () => {
      const r = await api<{ sent: boolean; devMode?: boolean }>('/auth/otp/send', { method: 'POST', body: { phone: fullPhone }, auth: false });
      setDevMode(!!r.devMode);
      setOtp('');
      setStep('otp');
    });

  const verify = () =>
    run(async () => {
      const r = await api<Tokens & { user: Me; needsName: boolean }>('/auth/otp/verify', {
        method: 'POST',
        body: { phone: fullPhone, code: otp },
        auth: false,
      });
      setTokens({ accessToken: r.accessToken, refreshToken: r.refreshToken });
      // Returning customers go straight in; new ones tell us their name first
      if (r.needsName) setStep('name');
      else finishLogin(r.user.phone, r.user.name);
    });

  const finish = () =>
    validName &&
    run(async () => {
      const me = await api<Me>('/me', { method: 'PATCH', body: { name: name.trim() } });
      finishLogin(me.phone, me.name);
    });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.maroon }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingTop: insets.top + 12, alignItems: 'center' }}>
          <Txt variant="strong" color={colors.white} style={{ opacity: 0.9 }}>
            Tashi Delek 🙏
          </Txt>
          <Txt variant="display" color={colors.gold}>
            Chito
          </Txt>
          <MonasteryScene width={sceneW * 0.8} height={sceneW * 0.8 * (260 / 300)} />
        </View>
        <DentilBorder />
        <View style={{ flex: 1, backgroundColor: colors.card, padding: 20, paddingBottom: insets.bottom + 24, gap: 14 }}>
          {step === 'phone' ? (
            <>
              <Txt variant="h1">Sikkim&apos;s own quick bazaar</Txt>
              <Txt color={colors.muted}>Enter your mobile number to get started.</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white, height: 54 }}>
                <Txt variant="h3" style={{ paddingHorizontal: 14, borderRightWidth: 1, borderRightColor: colors.line }}>
                  +91
                </Txt>
                <TextInput
                  value={phone}
                  onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                  placeholder="98XXXXXXXX"
                  placeholderTextColor={colors.subtle}
                  keyboardType="phone-pad"
                  // No autoFocus: this screen mounts under the splash, and the keyboard
                  // would cover it. The keyboard opens when the user taps the field.
                  accessibilityLabel="Mobile number"
                  style={{ flex: 1, paddingHorizontal: 14, fontFamily: fonts.semibold, fontSize: 18, color: colors.ink }}
                />
              </View>
              {!!error && <Txt variant="caption" color={colors.vermilion}>{error}</Txt>}
              <Button title="Get OTP" onPress={sendOtp} disabled={!validPhone} loading={busy} />
            </>
          ) : step === 'name' ? (
            <>
              <Txt variant="h1">Tashi Delek! What&apos;s your name?</Txt>
              <Txt color={colors.muted}>So our rider knows who to ask for at your door.</Txt>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.subtle}
                autoFocus
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                returnKeyType="done"
                onSubmitEditing={() => finish()}
                maxLength={40}
                accessibilityLabel="Your name"
                style={{ height: 54, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white, paddingHorizontal: 14, fontFamily: fonts.semibold, fontSize: 18, color: colors.ink }}
              />
              {!!error && <Txt variant="caption" color={colors.vermilion}>{error}</Txt>}
              <Button title="Start shopping" onPress={finish} disabled={!validName} loading={busy} />
            </>
          ) : (
            <>
              <Txt variant="h1">Enter OTP</Txt>
              <Txt color={colors.muted}>Sent to +91 {phone}</Txt>
              <TextInput
                value={otp}
                onChangeText={(t) => {
                  setOtp(t.replace(/\D/g, '').slice(0, 4));
                  setError('');
                }}
                placeholder="• • • •"
                placeholderTextColor={colors.subtle}
                keyboardType="number-pad"
                autoFocus
                accessibilityLabel="One time password"
                style={{
                  height: 58,
                  borderWidth: 1.5,
                  borderColor: error ? colors.vermilion : colors.line,
                  borderRadius: radius.md,
                  backgroundColor: colors.white,
                  textAlign: 'center',
                  letterSpacing: 14,
                  fontFamily: fonts.bold,
                  fontSize: 24,
                  color: colors.ink,
                }}
              />
              {!!error && <Txt variant="caption" color={colors.vermilion}>{error}</Txt>}
              {devMode && (
                <View style={{ backgroundColor: colors.gold50, borderRadius: radius.md, padding: 10 }}>
                  <Txt variant="caption" color={colors.wood}>
                    Test mode: no SMS is sent. Use OTP 1234.
                  </Txt>
                </View>
              )}
              <Button title="Verify & continue" onPress={verify} disabled={otp.length !== 4} loading={busy} />
              <Button title="Change number" variant="ghost" onPress={() => { setStep('phone'); setOtp(''); setError(''); }} />
            </>
          )}
          <Txt variant="caption" color={colors.subtle} style={{ textAlign: 'center', marginTop: 'auto' }}>
            We deliver within {store.serviceRadiusKm} km of our store · {hoursLabel(store)}
          </Txt>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

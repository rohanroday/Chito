import { Bike, KeyRound, PackageCheck, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, errorMessage } from '@/api/client';
import { Button } from '@/components/Button';
import { DentilBorder, PrayerFlags } from '@/components/ornaments';
import { Txt } from '@/components/Txt';
import { type RiderProfile, type Tokens, useAuth } from '@/state/auth';
import { colors, fonts, radius } from '@/theme';

const input = {
  height: 54,
  borderWidth: 1.5,
  borderColor: colors.line,
  borderRadius: radius.md,
  backgroundColor: colors.white,
  paddingHorizontal: 14,
  fontFamily: fonts.semibold,
  fontSize: 20,
  color: colors.ink,
} as const;

const STEPS = [
  { Icon: UserPlus, text: 'The store adds your phone number on the Riders page.' },
  { Icon: KeyRound, text: 'Log in here with that number and the OTP.' },
  { Icon: PackageCheck, text: 'Orders appear when the store hands them to you. Ask the customer for their 4-digit code at the door.' },
];

export default function Login() {
  const insets = useSafeAreaInsets();
  const [digits, setDigits] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [devMode, setDevMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const phone = `+91${digits}`;

  const sendCode = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api<{ sent: boolean; devMode?: boolean }>('/auth/otp/send', { method: 'POST', body: { phone }, auth: false });
      setDevMode(!!r.devMode);
      setStep('code');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const phoneOk = /^[6-9]\d{9}$/.test(digits);

  const verify = async (otp = code) => {
    if (otp.length !== 4 || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await api<Tokens & { rider: RiderProfile }>('/rider/auth/otp/verify', { method: 'POST', body: { phone, code: otp }, auth: false });
      useAuth.getState().login(r.rider, { accessToken: r.accessToken, refreshToken: r.refreshToken });
    } catch (e) {
      setError(errorMessage(e));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.parchment }}>
      <View style={{ backgroundColor: colors.maroon, paddingTop: insets.top + 24, paddingBottom: 28, alignItems: 'center', gap: 6 }}>
        <View style={{ width: 76, height: 84, borderTopLeftRadius: 38, borderTopRightRadius: 38, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
          <Bike size={40} color={colors.maroon} />
        </View>
        <Txt variant="display" color={colors.gold}>
          Chito Rider
        </Txt>
        <Txt color={colors.white} style={{ opacity: 0.9 }}>
          Deliveries for Chito, Singtam
        </Txt>
      </View>
      <DentilBorder />
      <PrayerFlags height={28} />

      {/* Scrolls the field being typed in above the keyboard */}
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        {step === 'phone' ? (
          <>
            <Txt variant="h2">Your phone number</Txt>
            <Txt color={colors.muted}>Use the number the store saved for you.</Txt>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={[input, { justifyContent: 'center', backgroundColor: colors.sand }]}>
                <Txt variant="h3">+91</Txt>
              </View>
              <TextInput
                value={digits}
                onChangeText={(t) => setDigits(t.replace(/\D/g, '').slice(0, 10))}
                keyboardType="phone-pad"
                placeholder="98XXXXXXXX"
                placeholderTextColor={colors.subtle}
                accessibilityLabel="Mobile number"
                autoComplete="tel"
                returnKeyType="next"
                onSubmitEditing={() => phoneOk && !busy && sendCode()}
                style={[input, { flex: 1 }]}
              />
            </View>
            <Button title="Get OTP" onPress={sendCode} disabled={!phoneOk} loading={busy} />
          </>
        ) : (
          <>
            <Txt variant="h2">Enter the OTP</Txt>
            <Txt color={colors.muted}>Sent by SMS to {phone}</Txt>
            {devMode && (
              <Txt variant="strong" color={colors.saffron}>
                Test mode: no SMS is sent. Use OTP 1234.
              </Txt>
            )}
            <TextInput
              value={code}
              onChangeText={(t) => {
                const next = t.replace(/\D/g, '').slice(0, 4);
                setCode(next);
                if (next.length === 4) verify(next); // log in as soon as the 4th digit is typed
              }}
              autoFocus
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              keyboardType="number-pad"
              placeholder="• • • •"
              placeholderTextColor={colors.subtle}
              accessibilityLabel="One time password"
              style={[input, { letterSpacing: 12, textAlign: 'center' }]}
            />
            <Button title="Start delivering" onPress={() => verify()} disabled={code.length !== 4} loading={busy} />
            <Button
              title="Change number"
              variant="ghost"
              onPress={() => {
                setStep('phone');
                setCode('');
                setError('');
              }}
            />
          </>
        )}
        {!!error && (
          <Txt variant="strong" color={colors.vermilion} style={{ textAlign: 'center' }}>
            {error}
          </Txt>
        )}

        {step === 'phone' && (
          <View style={{ marginTop: 10, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 12 }}>
            <Txt variant="h3">How it works</Txt>
            {STEPS.map(({ Icon, text }, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.turquoise50, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={18} color={colors.turquoise} />
                </View>
                <Txt color={colors.wood} style={{ flex: 1, paddingTop: 6 }}>
                  {text}
                </Txt>
              </View>
            ))}
          </View>
        )}
        <Txt variant="caption" color={colors.subtle} style={{ textAlign: 'center', marginTop: 4 }}>
          Only for Chito’s own delivery riders.
        </Txt>
      </KeyboardAwareScrollView>
    </View>
  );
}

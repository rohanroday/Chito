import { router } from 'expo-router';
import { Bell, Check, ChevronRight, LogOut, MapPin, MessageCircle, Phone } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DentilBorder, Mountains } from '@/components/ornaments';
import { Txt } from '@/components/Txt';
import { callSupport, whatsappSupport } from '@/lib/support';
import { api, errorMessage } from '@/api/client';
import { endServerSession } from '@/api/session';
import { closeSocket } from '@/api/socket';
import type { Me as MeUser } from '@/api/types';
import { useBottomGap } from '@/lib/layout';
import { addressLine, hasTypedAddress, useAuth, useProfile, useSelectedAddress } from '@/state/auth';
import { colors, fonts, radius } from '@/theme';

function Row({
  Icon,
  title,
  sub,
  onPress,
  right,
  danger,
}: {
  Icon: typeof Bell;
  title: string;
  sub?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
}) {
  const content = (
    <>
      <Icon size={22} color={danger ? colors.vermilion : colors.maroon} />
      <View style={{ flex: 1 }}>
        <Txt variant="strong" color={danger ? colors.vermilion : colors.ink}>
          {title}
        </Txt>
        {sub && (
          <Txt variant="caption" color={colors.muted} numberOfLines={2}>
            {sub}
          </Txt>
        )}
      </View>
      {right ?? (onPress && <ChevronRight size={18} color={colors.subtle} />)}
    </>
  );
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line };
  // Rows with a Switch are plain Views (Switch is its own control — no nested buttons)
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [style, { opacity: pressed ? 0.6 : 1 }]}>
      {content}
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}

export default function Me() {
  const insets = useSafeAreaInsets();
  const { phone, name, setName, logout: clearSession } = useAuth();
  const { addresses, notifications, setNotifications } = useProfile();
  const address = useSelectedAddress();
  const [nameError, setNameError] = useState('');
  const bottomGap = useBottomGap();
  const [draft, setDraft] = useState(name);
  const dirty = draft.trim() !== name && draft.trim().length >= 2;

  const saveName = async () => {
    if (!dirty) return;
    try {
      const me = await api<MeUser>('/me', { method: 'PATCH', body: { name: draft.trim() } });
      setName(me.name);
      setNameError('');
    } catch (e) {
      setNameError(errorMessage(e));
    }
  };

  const logout = () => {
    endServerSession(); // reads the token, so it runs before clearSession()
    closeSocket();
    clearSession();
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <View style={{ backgroundColor: colors.maroon, paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 18, alignItems: 'center' }}>
        <View style={{ width: 72, height: 80, borderTopLeftRadius: 36, borderTopRightRadius: 36, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
          <Txt variant="display" color={colors.maroon}>
            {(name || 'C')[0].toUpperCase()}
          </Txt>
        </View>
        {/* Full width + centred text: inside a centred column, Android measures Yatra One a few px
            too narrow and cuts off the end of the name ("Jay Is ga…") */}
        <Txt variant="h2" color={colors.gold} numberOfLines={2} style={{ marginTop: 8, alignSelf: 'stretch', textAlign: 'center' }}>
          {name || 'Tashi Delek!'}
        </Txt>
        <Txt variant="caption" color={colors.white} style={{ alignSelf: 'stretch', textAlign: 'center' }}>
          {phone}
        </Txt>
      </View>
      <DentilBorder />

      <View style={{ padding: 16 }}>
        <Txt variant="caption" color={colors.muted}>
          Your name
        </Txt>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={saveName}
            onBlur={saveName}
            returnKeyType="done"
            autoCapitalize="words"
            maxLength={40}
            placeholder="What should we call you?"
            placeholderTextColor={colors.subtle}
            accessibilityLabel="Your name"
            style={{ flex: 1, height: 48, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white, paddingHorizontal: 12, fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}
          />
          <Pressable
            onPress={saveName}
            disabled={!dirty}
            accessibilityRole="button"
            accessibilityLabel="Save name"
            style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: dirty ? colors.maroon : colors.sand, alignItems: 'center', justifyContent: 'center' }}>
            <Check size={20} color={dirty ? colors.gold : colors.subtle} />
          </Pressable>
        </View>

        {!!nameError && (
          <Txt variant="caption" color={colors.vermilion} style={{ marginTop: 4 }}>
            {nameError}
          </Txt>
        )}
        <View style={{ marginTop: 8 }}>
          <Row
            Icon={MapPin}
            title={addresses.length > 1 ? `Saved addresses (${addresses.length})` : 'Delivery address'}
            sub={
              hasTypedAddress(address)
                ? `Delivering to ${address.label} · ${addressLine(address)}${address.location ? '' : ' · location pin missing, tap to add'}`
                : 'Not set yet. Tap to add yours or your family’s'
            }
            onPress={() => router.push(addresses.length ? '/addresses' : '/address')}
          />
          <Row
            Icon={Bell}
            title="Order notifications"
            sub={notifications ? 'On · we’ll tell you when your order moves' : 'Off'}
            right={
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: colors.line, true: colors.maroon }}
                thumbColor={notifications ? colors.gold : colors.white}
                accessibilityLabel="Order notifications"
              />
            }
          />
          <Row Icon={Phone} title="Call Chito" sub="Help with an order" onPress={callSupport} />
          <Row Icon={MessageCircle} title="WhatsApp Chito" sub="Chat with the store" onPress={() => whatsappSupport()} />
          <Row Icon={LogOut} title="Log out" onPress={logout} danger />
        </View>
      </View>
      {/* Footer sits at the bottom; mountains run down into the ground band */}
      <View style={{ marginTop: 'auto' }}>
        <Txt variant="caption" color={colors.subtle} style={{ textAlign: 'center', marginBottom: 4 }}>
          Chito v1.0 · Made in Sikkim
        </Txt>
        <Mountains height={70} />
        <View style={{ height: bottomGap, backgroundColor: colors.sand }} />
      </View>
    </ScrollView>
  );
}

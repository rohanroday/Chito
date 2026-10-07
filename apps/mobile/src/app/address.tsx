import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, CircleAlert, CircleCheck, ClipboardPaste, Link2, LocateFixed, Map as MapIcon, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/client';
import { Button } from '@/components/Button';
import { DentilBorder } from '@/components/ornaments';
import { Txt } from '@/components/Txt';
import { getCurrentPlace } from '@/lib/location';
import { openMapPicker } from '@/lib/map-pick';
import { type CheckedPin, checkPin, resolveSharedLocation } from '@/lib/pin';
import { type Pin, useProfile } from '@/state/auth';
import { useStoreInfo } from '@/state/catalog';
import { colors, fonts, radius } from '@/theme';

const LABEL_IDEAS = ['Home', 'Work', "Mom's house", "Parents' home"];

const inputStyle = {
  minHeight: 48,
  borderWidth: 1.5,
  borderColor: colors.line,
  borderRadius: radius.md,
  backgroundColor: colors.white,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontFamily: fonts.medium,
  fontSize: 16,
  color: colors.ink,
} as const;

function Field({
  label,
  required,
  hint,
  ...input
}: { label: string; required?: boolean; hint?: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ gap: 4 }}>
      <Txt variant="strong">
        {label}
        {required && <Txt color={colors.vermilion}> *</Txt>}
      </Txt>
      <TextInput
        placeholderTextColor={colors.subtle}
        accessibilityLabel={label}
        {...input}
        style={[inputStyle, input.multiline && { minHeight: 76, textAlignVertical: 'top' }]}
      />
      {!!hint && (
        <Txt variant="caption" color={colors.muted}>
          {hint}
        </Txt>
      )}
    </View>
  );
}

function Chip({ title, on, onPress }: { title: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      style={{ paddingHorizontal: 14, height: 38, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1.5, borderColor: on ? colors.maroon : colors.line, backgroundColor: on ? colors.maroon50 : colors.card }}>
      <Txt variant="strong" color={on ? colors.maroon : colors.ink}>
        {title}
      </Txt>
    </Pressable>
  );
}

function WayToLocate({ Icon, title, sub, busy, onPress }: { Icon: typeof MapPin; title: string; sub: string; busy?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: pressed ? colors.turquoise50 : colors.card, borderWidth: 1, borderColor: colors.line })}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.turquoise, alignItems: 'center', justifyContent: 'center' }}>
        {busy ? <ActivityIndicator color={colors.white} /> : <Icon size={20} color={colors.white} />}
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="h3" color={colors.turquoise}>
          {title}
        </Txt>
        <Txt variant="caption" color={colors.muted}>
          {sub}
        </Txt>
      </View>
    </Pressable>
  );
}

type LocState =
  | { kind: 'idle' }
  | { kind: 'loading'; how: 'gps' | 'link' | 'map' }
  | ({ kind: 'found'; how: 'gps' | 'link' | 'map' | 'saved' } & CheckedPin)
  | { kind: 'problem'; message: string; openSettings?: boolean };

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/addresses'));
const digits = (s: string) => s.replace(/\D/g, '').slice(-10);

export default function AddressScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const saved = useProfile((s) => (id ? s.addresses.find((a) => a.id === id) : undefined));
  const isFirst = useProfile((s) => s.addresses.length === 0);
  const saveAddress = useProfile((s) => s.saveAddress);
  const store = useStoreInfo();

  const [forOther, setForOther] = useState(!!saved?.recipientName);
  const [recipientName, setRecipientName] = useState(saved?.recipientName ?? '');
  const [recipientPhone, setRecipientPhone] = useState(digits(saved?.recipientPhone ?? ''));
  const [label, setLabel] = useState(saved?.label ?? (isFirst ? 'Home' : ''));
  const [house, setHouse] = useState(saved?.house ?? '');
  const [landmark, setLandmark] = useState(saved?.landmark ?? '');
  const [area, setArea] = useState(saved?.area ?? '');
  const [directions, setDirections] = useState(saved?.directions ?? '');
  const [link, setLink] = useState('');
  const [loc, setLoc] = useState<LocState>(
    saved?.location
      ? {
          kind: 'found',
          how: 'saved',
          location: saved.location,
          distanceKm: saved.distanceKm,
          serviceable: saved.serviceable === true,
          testBypass: saved.serviceable === true && saved.distanceKm > store.serviceRadiusKm,
        }
      : { kind: 'idle' },
  );

  const phoneOk = /^[6-9]\d{9}$/.test(recipientPhone);
  const recipientOk = !forOther || (recipientName.trim().length >= 2 && phoneOk);
  const valid = landmark.trim().length >= 3 && area.trim().length >= 2 && label.trim().length > 0 && recipientOk;

  const applyPin = (how: 'gps' | 'link' | 'map', p: CheckedPin) => setLoc({ kind: 'found', how, ...p });

  const locateMe = async () => {
    setLoc({ kind: 'loading', how: 'gps' });
    const place = await getCurrentPlace();
    switch (place.status) {
      case 'ok':
        try {
          applyPin('gps', await checkPin(place.coords));
        } catch (e) {
          setLoc({ kind: 'problem', message: errorMessage(e) });
          break;
        }
        // Fill blanks from the phone's geocoder; never overwrite what the user typed
        if (place.area && !area.trim()) setArea(place.area);
        if (place.street && !house.trim()) setHouse(place.street);
        break;
      case 'denied':
        setLoc({
          kind: 'problem',
          message: place.canAskAgain
            ? 'Location permission is needed to find you. Tap the button again and choose "Allow".'
            : 'Location is blocked for Chito. Turn it on in your phone settings.',
          openSettings: !place.canAskAgain,
        });
        break;
      case 'off':
        setLoc({ kind: 'problem', message: 'Your phone’s location (GPS) is off. Turn it on and try again.' });
        break;
      default:
        setLoc({ kind: 'problem', message: place.message });
    }
  };

  const findSharedLink = async (text = link) => {
    if (text.trim().length < 3) return;
    setLoc({ kind: 'loading', how: 'link' });
    try {
      applyPin('link', await resolveSharedLocation(text.trim()));
      setLink('');
    } catch (e) {
      setLoc({ kind: 'problem', message: errorMessage(e) });
    }
  };

  const pasteAndFind = async () => {
    const text = await Clipboard.getStringAsync().catch(() => '');
    if (!text.trim()) {
      setLoc({ kind: 'problem', message: 'Nothing copied yet. In WhatsApp, long-press the location message and tap Copy, then come back.' });
      return;
    }
    setLink(text);
    await findSharedLink(text);
  };

  const pickedOnMap = async (p: Pin) => {
    setLoc({ kind: 'loading', how: 'map' });
    try {
      applyPin('map', await checkPin(p));
    } catch (e) {
      setLoc({ kind: 'problem', message: errorMessage(e) });
    }
  };

  const save = () => {
    saveAddress(
      {
        label: label.trim(),
        recipientName: forOther ? recipientName.trim() : '',
        recipientPhone: forOther ? `+91${recipientPhone}` : '',
        house: house.trim(),
        landmark: landmark.trim(),
        area: area.trim(),
        directions: directions.trim(),
      },
      loc.kind === 'found' ? { location: loc.location, distanceKm: loc.distanceKm, serviceable: loc.serviceable } : null,
      saved?.id,
    );
    goBack();
  };

  const busy = loc.kind === 'loading';
  const ways = [
    <WayToLocate
      key="map"
      Icon={MapIcon}
      title="Pick on the map"
      sub="Find the house and drop the pin on its door"
      busy={busy && loc.how === 'map'}
      onPress={() => openMapPicker(loc.kind === 'found' ? loc.location : undefined, pickedOnMap)}
    />,
    <WayToLocate
      key="gps"
      Icon={LocateFixed}
      title={loc.kind === 'found' && loc.how === 'gps' ? 'Update my current location' : 'Use my current location'}
      sub={forOther ? 'Only if you are standing at their door right now' : 'Stand at your door when you tap this'}
      busy={busy && loc.how === 'gps'}
      onPress={locateMe}
    />,
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ backgroundColor: colors.maroon, paddingTop: insets.top + 6, paddingHorizontal: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {/* Leaving with a complete address keeps it — people often tap back instead of Save */}
        <Pressable onPress={valid && !busy ? save : goBack} hitSlop={12} accessibilityLabel="Back" style={{ padding: 4 }}>
          <ChevronLeft size={26} color={colors.gold} />
        </Pressable>
        <Txt variant="h1" color={colors.gold}>
          {saved ? 'Edit address' : 'New address'}
        </Txt>
      </View>
      <DentilBorder />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        {/* Who receives it */}
        <View style={{ gap: 6 }}>
          <Txt variant="h2">Who will receive the order?</Txt>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip title="Me" on={!forOther} onPress={() => setForOther(false)} />
            <Chip title="Someone else" on={forOther} onPress={() => setForOther(true)} />
          </View>
        </View>
        {forOther && (
          <View style={{ gap: 12, backgroundColor: colors.gold50, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.goldDeep, padding: 12 }}>
            <Txt variant="caption" color={colors.wood}>
              Ordering for family from far away? Our rider will call this person, not you. You can pay online so they don&apos;t have to pay at the door.
            </Txt>
            <Field label="Their name" required value={recipientName} onChangeText={setRecipientName} placeholder="e.g. Mom, Pem Lhamu" autoCapitalize="words" />
            <View style={{ gap: 4 }}>
              <Txt variant="strong">
                Their phone number<Txt color={colors.vermilion}> *</Txt>
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[inputStyle, { justifyContent: 'center', backgroundColor: colors.sand }]}>
                  <Txt variant="strong">+91</Txt>
                </View>
                <TextInput
                  value={recipientPhone}
                  onChangeText={(t) => setRecipientPhone(t.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile"
                  placeholderTextColor={colors.subtle}
                  keyboardType="phone-pad"
                  accessibilityLabel="Their phone number"
                  style={[inputStyle, { flex: 1 }]}
                />
              </View>
              {recipientPhone.length > 0 && !phoneOk && (
                <Txt variant="caption" color={colors.vermilion}>
                  Enter a 10-digit Indian mobile number
                </Txt>
              )}
            </View>
          </View>
        )}

        {/* Where */}
        <Txt variant="h2">Where should we deliver?</Txt>
        {forOther ? (
          <>
            {/* Shared location: the easiest way when you're far away */}
            <View style={{ gap: 8, padding: 12, borderRadius: radius.lg, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1.5, borderColor: colors.turquoise, backgroundColor: colors.card }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Link2 size={20} color={colors.turquoise} />
                <Txt variant="h3" color={colors.turquoise} style={{ flex: 1 }}>
                  Paste the location they sent you
                </Txt>
              </View>
              <Txt variant="caption" color={colors.muted}>
                Ask them to send their location on WhatsApp (📎 → Location → Send your current location), or a Google Maps link. Copy it and paste it here.
              </Txt>
              <TextInput
                value={link}
                onChangeText={setLink}
                placeholder="maps.app.goo.gl/… or 27.2361, 88.5012"
                placeholderTextColor={colors.subtle}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Shared location link"
                onSubmitEditing={() => findSharedLink()}
                style={inputStyle}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="Paste & find" variant="secondary" icon={<ClipboardPaste size={18} color={colors.maroon} />} onPress={pasteAndFind} disabled={busy} style={{ flex: 1 }} />
                <Button title="Find" onPress={() => findSharedLink()} disabled={busy || link.trim().length < 3} loading={busy && loc.how === 'link'} style={{ flex: 1 }} />
              </View>
            </View>
            {ways}
          </>
        ) : (
          [...ways].reverse()
        )}

        {loc.kind === 'found' &&
          (loc.testBypass ? (
            // Never pretend an out-of-range address is fine: say it's only allowed in test mode
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#FDF0DD', borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.saffron }}>
              <CircleAlert size={20} color={colors.saffron} />
              <Txt variant="strong" color={colors.wood} style={{ flex: 1 }}>
                This pin is {loc.distanceKm} km away, outside our {store.serviceRadiusKm} km area. Orders are allowed only because the store is in TEST MODE.
              </Txt>
            </View>
          ) : loc.serviceable ? (
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.leaf50, borderRadius: radius.md, padding: 12 }}>
              <CircleCheck size={20} color={colors.leaf} />
              <Txt variant="strong" color={colors.leaf} style={{ flex: 1 }}>
                Pin set · {loc.distanceKm} km from our store · We deliver here!
              </Txt>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.vermilion50, borderRadius: radius.md, padding: 12 }}>
              <CircleAlert size={20} color={colors.vermilion} />
              <Txt variant="strong" color={colors.vermilion} style={{ flex: 1 }}>
                This pin is {loc.distanceKm} km from our store. Chito delivers only within {store.serviceRadiusKm} km for now.
              </Txt>
            </View>
          ))}

        {loc.kind === 'problem' && (
          <View style={{ gap: 6, backgroundColor: colors.vermilion50, borderRadius: radius.md, padding: 12 }}>
            <Txt variant="strong" color={colors.vermilion}>
              {loc.message}
            </Txt>
            {loc.openSettings && (
              <Pressable onPress={() => Linking.openSettings()} accessibilityRole="link">
                <Txt variant="strong" color={colors.turquoise}>
                  Open settings ›
                </Txt>
              </Pressable>
            )}
          </View>
        )}

        {loc.kind === 'idle' && (
          <View style={{ flexDirection: 'row', gap: 10, backgroundColor: colors.turquoise50, borderRadius: radius.md, padding: 12 }}>
            <MapPin size={20} color={colors.turquoise} />
            <Txt variant="caption" color={colors.turquoise} style={{ flex: 1 }}>
              The pin tells us the distance from our store. A landmark below helps our rider find the door fast.
            </Txt>
          </View>
        )}

        <View style={{ gap: 6 }}>
          <Txt variant="strong">
            Save as<Txt color={colors.vermilion}> *</Txt>
          </Txt>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {LABEL_IDEAS.map((l) => (
              <Chip key={l} title={l} on={l === label} onPress={() => setLabel(l)} />
            ))}
          </View>
          <TextInput
            value={label}
            onChangeText={(t) => setLabel(t.slice(0, 30))}
            placeholder="Or type a name, e.g. Didi's flat"
            placeholderTextColor={colors.subtle}
            accessibilityLabel="Address name"
            style={inputStyle}
          />
        </View>

        <Field label="House / building name" value={house} onChangeText={setHouse} placeholder="e.g. Tamang Niwas, 2nd floor" />
        <Field label="Landmark" required value={landmark} onChangeText={setLandmark} placeholder="e.g. Near Singtam Hospital, above SBI" />
        <Field label="Area / locality" required value={area} onChangeText={setArea} placeholder="e.g. Singtam Bazaar, Golitar" />
        <Field
          label="Directions for the rider"
          value={directions}
          onChangeText={setDirections}
          placeholder="e.g. Blue gate after the temple, call before coming"
          multiline
        />

        {loc.kind !== 'found' && valid && (
          <Txt variant="caption" color={colors.saffron} style={{ textAlign: 'center' }}>
            The address will be saved. To place orders we also need its location pin (map, shared location or current location above).
          </Txt>
        )}
        <Button title="Save address" onPress={save} disabled={!valid || busy} />
        {!valid && (
          <Txt variant="caption" color={colors.muted} style={{ textAlign: 'center' }}>
            {!recipientOk ? 'Add their name and a 10-digit phone number to save.' : 'Fill in a name for this address, a landmark and the area to save.'}
          </Txt>
        )}
      </ScrollView>

    </KeyboardAvoidingView>
  );
}

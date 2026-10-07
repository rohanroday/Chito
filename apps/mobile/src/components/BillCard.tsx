import { View } from 'react-native';

import { rupees } from '@/lib/format';
import type { Bill } from '@/lib/store-config';
import { colors, radius } from '@/theme';

import { DentilBorder } from './ornaments';
import { Txt } from './Txt';

function Row({ label, value, color = colors.ink, strike }: { label: string; value: string; color?: string; strike?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Txt color={colors.muted}>{label}</Txt>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {strike && (
          <Txt color={colors.subtle} style={{ textDecorationLine: 'line-through' }}>
            {strike}
          </Txt>
        )}
        <Txt variant="strong" color={color}>
          {value}
        </Txt>
      </View>
    </View>
  );
}

/** "Receipt scroll" bill — dentil borders top and bottom like a paper scroll. */
export function BillCard({ bill }: { bill: Bill }) {
  return (
    <View style={{ borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card }}>
      <DentilBorder bg={colors.maroon} />
      {bill.savings > 0 && (
        <View style={{ backgroundColor: colors.leaf50, paddingVertical: 8, alignItems: 'center' }}>
          <Txt variant="strong" color={colors.leaf}>
            You saved {rupees(bill.savings)} on this order 🎉
          </Txt>
        </View>
      )}
      <View style={{ padding: 16 }}>
        <Txt variant="h2" style={{ marginBottom: 6 }}>
          Bill details
        </Txt>
        <Row label="Item total" value={rupees(bill.itemTotal)} strike={bill.mrpTotal > bill.itemTotal ? rupees(bill.mrpTotal) : undefined} />
        <Row
          label="Delivery fee"
          value={bill.deliveryFee === 0 ? 'FREE' : rupees(bill.deliveryFee)}
          color={bill.deliveryFee === 0 ? colors.leaf : colors.ink}
          strike={bill.deliveryFee === 0 ? rupees(bill.standardDeliveryFee) : undefined}
        />
        <Row label="Handling fee" value={rupees(bill.handlingFee)} />
        <View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.line, marginVertical: 8 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt variant="h3">To pay</Txt>
          <Txt variant="h1" color={colors.maroon}>
            {rupees(bill.grandTotal)}
          </Txt>
        </View>
      </View>
      <DentilBorder bg={colors.maroon} />
    </View>
  );
}

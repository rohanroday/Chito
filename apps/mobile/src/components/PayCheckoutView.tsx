import { useMemo } from 'react';
import { Linking } from 'react-native';
import { WebView } from 'react-native-webview';

import { checkoutConfig, type CheckoutOptions } from '@/lib/payment';
import { colors } from '@/theme';

export type PayOutcome = 'paid' | 'failed' | 'dismissed' | 'error';

/** UPI and bank apps are opened by links the WebView can't load itself (upi://, intent://…): hand them to Android. */
function openExternally(url: string) {
  if (url.startsWith('intent://')) {
    // intent://pay?pa=…#Intent;scheme=upi;package=…;S.browser_fallback_url=…;end
    const [body, extras = ''] = url.slice('intent://'.length).split('#Intent;');
    const scheme = /(?:^|;)scheme=([^;]+)/.exec(extras)?.[1];
    const fallback = /(?:^|;)S\.browser_fallback_url=([^;]+)/.exec(extras)?.[1];
    const target = scheme ? `${scheme}://${body}` : null;
    (target ? Linking.openURL(target) : Promise.reject(new Error('no scheme'))).catch(() => fallback && Linking.openURL(decodeURIComponent(fallback)).catch(() => undefined));
    return;
  }
  Linking.openURL(url).catch(() => undefined);
}

/**
 * Phone: Razorpay's standard Checkout inside a WebView, in redirect mode. When payment ends Razorpay posts the signed
 * result to our server (callbackUrl), whose page tells us here how it went. The server alone decides "paid".
 */
export function PayCheckoutView({ opts, onOutcome }: { opts: CheckoutOptions; onOutcome: (o: PayOutcome, message?: string) => void }) {
  const html = useMemo(() => {
    const config = { ...checkoutConfig(opts), redirect: true, callback_url: opts.callbackUrl };
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:${colors.parchment}}</style></head><body>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
function post(m){ if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
try {
  if (!window.Razorpay) throw new Error('Razorpay did not load');
  var o = ${JSON.stringify(config)};
  o.modal = { ondismiss: function () { post({ chitoPayment: 'dismissed' }); } };
  new Razorpay(o).open();
} catch (e) { post({ chitoPayment: 'error', message: String(e && e.message || e) }); }
</script></body></html>`;
  }, [opts]);

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html, baseUrl: 'https://chito.app/' }}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={(req) => {
        if (/^(https?|about|data|blob):/i.test(req.url)) return true;
        openExternally(req.url);
        return false;
      }}
      onMessage={(e) => {
        try {
          const m = JSON.parse(e.nativeEvent.data) as { chitoPayment?: PayOutcome; message?: string };
          if (m.chitoPayment) onOutcome(m.chitoPayment, m.message);
        } catch {
          // not ours
        }
      }}
      onError={(e) => onOutcome('error', e.nativeEvent.description)}
      style={{ flex: 1, backgroundColor: colors.parchment }}
    />
  );
}

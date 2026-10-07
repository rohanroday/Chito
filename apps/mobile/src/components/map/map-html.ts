// A tiny Leaflet page shown inside a WebView (phone) or an iframe (web). The pin stays in the middle;
// the user drags the map under it, and every stop posts the centre back to the app.
// Tiles: OpenStreetMap's public server. Fine for development and light use, but its usage policy forbids heavy
// app traffic, so swap for Google Maps (or a paid tile provider) before launch.
import { colors } from '@/theme';

import type { Pin } from '@/state/auth';

export type MapHtmlOptions = { center: Pin; store: Pin; radiusKm: number; zoom?: number };

/** What the map page tells the app. */
export type MapMessage = { type: 'move'; lat: number; lng: number } | { type: 'ready' } | { type: 'error'; message: string };

export function mapHtml({ center, store, radiusKm, zoom = 16 }: MapHtmlOptions) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<script>
function post(m){var s=JSON.stringify(m);if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(s)}else{parent.postMessage({chitoMap:s},'*')}}
window.onerror=function(msg){post({type:'error',message:String(msg)})};
</script>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" onerror="post({type:'error',message:'Map library could not load (no internet?)'})"></script>
<style>
html,body,#m{margin:0;height:100%;background:${colors.sand}}
#pin{position:absolute;left:50%;top:50%;z-index:1000;pointer-events:none;transform:translate(-50%,-100%)}
#dot{position:absolute;left:50%;top:50%;z-index:999;width:10px;height:4px;border-radius:50%;background:rgba(0,0,0,.35);transform:translate(-50%,-50%)}
</style></head><body><div id="m"></div><div id="dot"></div>
<svg id="pin" width="38" height="48" viewBox="0 0 38 48"><path d="M19 47C19 47 3 29 3 18a16 16 0 1 1 32 0c0 11-16 29-16 29z" fill="${colors.maroon}" stroke="${colors.gold}" stroke-width="2.5"/><circle cx="19" cy="18" r="6" fill="${colors.gold}"/></svg>
<script>
if(window.L){
var map=L.map('m',{zoomControl:true}).setView([${center.lat},${center.lng}],${zoom});
var tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
var loaded=0,failed=0;
tiles.on('tileload',function(){if(loaded++===0)post({type:'ready'})});
tiles.on('tileerror',function(){if(++failed===4&&loaded===0)post({type:'error',message:'Map pictures could not load. Check your internet and try again.'})});
L.circle([${store.lat},${store.lng}],{radius:${radiusKm * 1000},color:'${colors.turquoise}',weight:2,fillOpacity:0.06,interactive:false}).addTo(map);
L.circleMarker([${store.lat},${store.lng}],{radius:8,color:'${colors.maroon}',weight:3,fillColor:'${colors.gold}',fillOpacity:1}).addTo(map).bindTooltip('Chito store');
function send(){var c=map.getCenter();post({type:'move',lat:+c.lat.toFixed(6),lng:+c.lng.toFixed(6)})}
map.on('moveend',send);send();
// Re-measure once the screen has its real size, or tiles never load
function fit(){map.invalidateSize({pan:false})}
window.addEventListener('resize',fit);[150,400,900].forEach(function(t){setTimeout(fit,t)});
}
</script></body></html>`;
}

export function parseMapMessage(data: unknown): MapMessage | null {
  try {
    const m = JSON.parse(String(data)) as MapMessage;
    if (m.type === 'move') return Number.isFinite(m.lat) && Number.isFinite(m.lng) ? m : null;
    return m.type === 'ready' || m.type === 'error' ? m : null;
  } catch {
    return null;
  }
}

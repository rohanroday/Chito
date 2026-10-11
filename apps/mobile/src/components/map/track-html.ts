// Read-only tracking map: the delivery pin (home) + the rider's live position.
// The app moves the rider with window.moveRider(lat, lng) (WebView injectJavaScript / iframe postMessage).
import { colors } from '@/theme';

import type { Pin } from '@/state/auth';

export function trackHtml({ home, rider }: { home: Pin; rider: Pin | null }) {
  const start = rider ?? home;
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{margin:0;height:100%;background:${colors.sand}}
.rider{width:34px;height:34px;border-radius:17px;background:${colors.maroon};border:3px solid ${colors.gold};display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 6px rgba(0,0,0,.35)}</style>
</head><body><div id="m"></div><script>
if(window.L){
var map=L.map('m',{zoomControl:false,attributionControl:true}).setView([${start.lat},${start.lng}],15);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
var home=L.circleMarker([${home.lat},${home.lng}],{radius:9,color:'${colors.maroon}',weight:3,fillColor:'${colors.gold}',fillOpacity:1}).addTo(map).bindTooltip('Delivery here');
var icon=L.divIcon({className:'',html:'<div class="rider">🛵</div>',iconSize:[34,34],iconAnchor:[17,17]});
var rider=${rider ? `L.marker([${rider.lat},${rider.lng}],{icon:icon}).addTo(map)` : 'null'};
function fit(){var pts=[home.getLatLng()];if(rider)pts.push(rider.getLatLng());if(pts.length>1)map.fitBounds(L.latLngBounds(pts).pad(0.35),{maxZoom:16});else map.setView(pts[0],15)}
window.moveRider=function(lat,lng){if(rider){rider.setLatLng([lat,lng])}else{rider=L.marker([lat,lng],{icon:icon}).addTo(map)}fit()};
window.addEventListener('message',function(e){var d=e.data;if(d&&d.chitoRider){window.moveRider(d.chitoRider.lat,d.chitoRider.lng)}});
fit();[300,900].forEach(function(t){setTimeout(function(){map.invalidateSize({pan:false});fit()},t)});
}
</script></body></html>`;
}

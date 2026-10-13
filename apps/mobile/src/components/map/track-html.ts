// Read-only tracking map: the store, the delivery pin (home) and the rider's live position.
// The app moves the rider with window.moveRider(lat, lng) (WebView injectJavaScript / iframe postMessage).
import { colors } from '@/theme';

import type { Pin } from '@/state/auth';

/** `store` is null when it would sit on top of the home pin. */
export type TrackMapProps = { home: Pin; store: Pin | null; rider: Pin | null; homeLabel: string };

export function trackHtml({ home, store, rider, homeLabel }: TrackMapProps) {
  // Data goes in as JSON and labels are set with textContent, so a name can never become HTML
  const data = JSON.stringify({ home, store, rider, homeLabel });
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
html,body,#m{margin:0;height:100%;background:${colors.sand};font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
.pin{display:flex;flex-direction:column;align-items:center}
.tag{background:${colors.white};color:${colors.ink};font-size:12px;font-weight:700;line-height:1;padding:5px 8px;border-radius:999px;box-shadow:0 1px 4px rgba(0,0,0,.3);white-space:nowrap;margin-bottom:4px;max-width:140px;overflow:hidden;text-overflow:ellipsis}
.home .dot{width:26px;height:26px;border-radius:13px 13px 13px 0;transform:rotate(-45deg);background:${colors.maroon};border:3px solid ${colors.white};box-shadow:0 2px 6px rgba(0,0,0,.35)}
.home .dot:after{content:'';position:absolute;left:7px;top:7px;width:8px;height:8px;border-radius:4px;background:${colors.gold}}
.store .dot{width:20px;height:20px;border-radius:6px;background:${colors.turquoise};border:3px solid ${colors.white};box-shadow:0 2px 6px rgba(0,0,0,.35)}
.store .tag{background:${colors.turquoise};color:${colors.white}}
.rider{position:relative;width:40px;height:40px}
.rider .ring{position:absolute;inset:-8px;border-radius:50%;background:${colors.gold};opacity:.45;animation:p 1.8s ease-out infinite}
.rider .face{position:absolute;inset:0;border-radius:50%;background:${colors.maroon};border:3px solid ${colors.gold};display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 2px 8px rgba(0,0,0,.4)}
@keyframes p{0%{transform:scale(.6);opacity:.6}100%{transform:scale(1.4);opacity:0}}
.re{position:absolute;right:10px;top:10px;z-index:500;background:${colors.white};color:${colors.maroon};border:0;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.3);display:none}
.leaflet-control-attribution{font-size:9px}
</style>
</head><body><div id="m"></div><button class="re" id="re">Show all</button><script>
if(window.L){
var D=${data};
var map=L.map('m',{zoomControl:false,attributionControl:true});
L.control.zoom({position:'bottomright'}).addTo(map);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
function pinIcon(cls,label,w,h){
  var el=document.createElement('div');el.className='pin '+cls;
  var t=document.createElement('div');t.className='tag';t.textContent=label;el.appendChild(t);
  var d=document.createElement('div');d.className='dot';d.style.position='relative';el.appendChild(d);
  return L.divIcon({className:'',html:el.outerHTML,iconSize:[w,h],iconAnchor:[w/2,h]});
}
var storeM=D.store?L.marker([D.store.lat,D.store.lng],{icon:pinIcon('store','Chito store',90,48),interactive:false}).addTo(map):null;
var homeM=L.marker([D.home.lat,D.home.lng],{icon:pinIcon('home',D.homeLabel,140,58),interactive:false,zIndexOffset:500}).addTo(map);
var riderIcon=L.divIcon({className:'',html:'<div class="rider"><div class="ring"></div><div class="face">🛵</div></div>',iconSize:[40,40],iconAnchor:[20,20]});
var rider=null,line=null,moved=false,auto=false;
var re=document.getElementById('re');
function draw(lat,lng){
  if(rider){rider.setLatLng([lat,lng])}else{rider=L.marker([lat,lng],{icon:riderIcon,interactive:false,zIndexOffset:1000}).addTo(map)}
  var pts=[[lat,lng],[D.home.lat,D.home.lng]];
  if(line){line.setLatLngs(pts)}else{line=L.polyline(pts,{color:'${colors.maroon}',weight:3,opacity:.7,dashArray:'6 8'}).addTo(map)}
}
function fit(){
  var pts=[homeM.getLatLng()];if(storeM)pts.push(storeM.getLatLng());if(rider)pts.push(rider.getLatLng());
  var b=L.latLngBounds(pts);
  auto=true;
  // Home at the store's pin (or a rider standing on it): still show the neighbourhood, not one building
  if(b.getNorthEast().distanceTo(b.getSouthWest())<150)map.setView(b.getCenter(),16,{animate:false});
  else map.fitBounds(b,{paddingTopLeft:[40,70],paddingBottomRight:[40,30],maxZoom:17,animate:false});
  auto=false;moved=false;re.style.display='none';
}
// Once the customer pans or zooms, stop jumping back on every rider update; offer "Show all" instead
map.on('dragstart zoomstart',function(){if(!auto){moved=true;re.style.display='block'}});
re.onclick=fit;
window.moveRider=function(lat,lng){draw(lat,lng);if(!moved)fit()};
window.addEventListener('message',function(e){var d=e.data;if(d&&d.chitoRider){window.moveRider(d.chitoRider.lat,d.chitoRider.lng)}});
if(D.rider)draw(D.rider.lat,D.rider.lng);
fit();[300,900].forEach(function(t){setTimeout(function(){map.invalidateSize({pan:false});if(!moved)fit()},t)});
}
</script></body></html>`;
}

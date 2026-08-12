//Users/mac/crimemap/frontend/src/components/MapView.jsx
import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { Map, BarChart2, History, Plus, Clock, Thermometer, Circle, MousePointerClick, List, X, SlidersHorizontal, Route, TrendingUp, FileDown, MapPinned } from 'lucide-react';import ReportForm      from './ReportForm';
import ReportList      from './ReportList';
import ConfirmToast    from './ConfirmToast';
import SubmitSuccessToast from './SubmitSuccessToast';
import PredictPanel    from './PredictPanel';
import AnalyticaPanel  from './AnalyticaPanel';
import HistorialPanel  from './HistorialPanel';
import FilterPanel     from './FilterPanel';
import AddressSearch   from './AddressSearch';
import { useDeviceId } from '../hooks/useDeviceId';
import { getReports, getHeatmap, getNearby, getZonasVerificadas, getZonasFijas } from '../api/reports';
import PanicButton from './PanicButton';
import ProximityAlert from './ProximityAlert';
import LocateButton from './LocateButton';
import PoliceMarkers from './PoliceMarkers';
import SafeRoutePanel from './SafeRoutePanel';
import { Link } from 'react-router-dom';
import AnalyticsDashboard from '../pages/AnalyticsDashboard';
import ReportesExport from '../pages/ReportesExport';
import ZoneDetailModal from './ZoneDetailModal';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const TIPO_COLORS = {
  'Robo a persona':'#E24B4A',
  'Robo a domicilio':'#D85A30',
  'Robo a vehículo':'#F0997B',
  'Asalto a mano armada':'#BA7517',
  'Homicidio':'#791F1F',
  'Extorsión':'#993556',
  'Vandalismo':'#1D9E75',
  'Punto GDO':'#534AB7',
  'Otro':'#888',
};

const isMobile = () => window.innerWidth < 768;

export default function MapView() {
  const zonaLayers = useRef([]);
  const mapRef        = useRef(null);
  const mapInstance   = useRef(null);
  const heatLayer     = useRef(null);
  const clusterGroup  = useRef(null);
  const gridLayers    = useRef([]);
  const formMarker    = useRef(null);
  const deviceId      = useDeviceId();

  const [reports,      setReports]      = useState([]);
  const [formPos,      setFormPos]      = useState(null);
  const [nearbyList,   setNearbyList]   = useState([]);
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false);
  const [zonasVerificadas, setZonasVerificadas] = useState([]);
  const [zonasFijas, setZonasFijas] = useState([]);
  const [zonaSeleccionada, setZonaSeleccionada] = useState(null);
  const [showHeat,     setShowHeat]     = useState(true);
  const [showCluster,  setShowCluster]  = useState(true);
  const [activeTab,    setActiveTab]    = useState('mapa');
  const [loading,      setLoading]      = useState(false);
  const [mobile,       setMobile]       = useState(isMobile());
  const [mobilePanel,  setMobilePanel]  = useState(null); // 'menu' | 'lista' | null
  const [filtros, setFiltros] = useState({
    dias: 30,
    tipos: [],
    severidadMin: 1,
    estados: ['aprobado', 'pendiente'],
    soloConfiables: false, // ← agregar
  });

  const filtrosRef = useRef(filtros);
  useEffect(() => { filtrosRef.current = filtros; }, [filtros]);

  useEffect(() => {
    const handleResize = () => setMobile(isMobile());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (mapInstance.current) return;
    const map = L.map(mapRef.current, { center:[-2.1894,-79.8891], zoom:13 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:'© OpenStreetMap contributors',
    }).addTo(map);

    const mcg = L.markerClusterGroup({
      maxClusterRadius:80, spiderfyOnMaxZoom:true, showCoverageOnHover:false,
      iconCreateFunction:(cluster) => {
        const count = cluster.getChildCount();
        const size  = count>50?56:count>20?44:34;
        const bg    = count>50?'#A32D2D':count>20?'#BA7517':'#E24B4A';
        return L.divIcon({
          html:`<div style="width:${size}px;height:${size}px;border-radius:50%;
            background:${bg};color:#fff;font-weight:600;font-size:${size>44?14:12}px;
            display:flex;align-items:center;justify-content:center;
            border:3px solid rgba(255,255,255,.8);box-shadow:0 2px 8px rgba(0,0,0,.3)">${count}</div>`,
          className:'', iconSize:[size,size], iconAnchor:[size/2,size/2],
        });
      },
    });
    map.addLayer(mcg);
    clusterGroup.current = mcg;
    mapInstance.current  = map;

    map.on('dblclick', (e) => {
      e.originalEvent.preventDefault();
      placeFormMarker(map, e.latlng.lat, e.latlng.lng);
      setFormPos({ lat:e.latlng.lat, lng:e.latlng.lng });
      setMobilePanel(null);
    });
    map.on('moveend', () => loadReports(map));
    loadReports(map);
    loadHeatmap(map);
    loadZonasVerificadas(map);
  }, []);

  useEffect(() => {
    getZonasFijas().then(setZonasFijas).catch(e => console.error(e));
  }, []);

  // Verificar denuncias cercanas al cargar
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        const nearby = await getNearby(latitude, longitude);
        const misIds       = JSON.parse(localStorage.getItem('crimemap_historial') || '[]').map(r => r.id);
        const confirmadas  = JSON.parse(localStorage.getItem('crimemap_confirmed') || '[]');
        const filtered     = nearby.filter(r => !misIds.includes(r.id) && !confirmadas.includes(r.id));
        if (filtered.length > 0) setNearbyList(filtered);
      } catch {}
    }, () => {}, { enableHighAccuracy: true, timeout: 5000 });
  }, []);

  const placeFormMarker = (map, lat, lng) => {
    if (formMarker.current) formMarker.current.remove();
    const icon = L.divIcon({
      className:'',
      html:`<div style="width:16px;height:16px;border-radius:50%;
        background:#E24B4A;border:3px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
      iconSize:[16,16], iconAnchor:[8,8],
    });
    formMarker.current = L.marker([lat,lng],{icon}).addTo(map);
  };

  const loadZonasVerificadas = async (map) => {
    try {
      const zonas = await getZonasVerificadas();
      setZonasVerificadas(zonas);
      zonaLayers.current.forEach(l => l.remove());
      zonaLayers.current = [];

      zonas.forEach(z => {
        const circle = L.circle([z.lat, z.lng], {
          radius: z.radio_metros,
          color: '#534AB7',
          fillColor: '#534AB7',
          fillOpacity: 0.10,
          weight: 2,
          dashArray: '4,4',
        }).bindPopup(`
          <b>⚠️ Zona de concentración verificada</b><br>
          Tipo predominante: ${z.tipo_predominante}<br>
          <small>${z.total_reportes} denuncias en esta área</small>
        `).addTo(map);
        zonaLayers.current.push(circle);
      });
    } catch (e) { console.error(e); }
  };
  const reportsFiltrados = filtros.soloConfiables
  ? reports.filter(r => r.reputacion_puntos >= 130)
  : reports;

  const handleMoveMap = (lat, lng) => {
    if (!mapInstance.current) return;
    mapInstance.current.setView([lat,lng], 16);
    placeFormMarker(mapInstance.current, lat, lng);
    setFormPos({ lat, lng });
    setMobilePanel(null);
  };

  const handleZonaSelect = (nombre) => {
    const zona = zonasFijas.find(z => z.nombre === nombre);
    if (!zona) return;
    if (mapInstance.current) {
      try { mapInstance.current.setView([zona.lat, zona.lng], 16); } catch (e) { console.error(e); }
    }
    setZonaSeleccionada(zona);
    setMobilePanel(null);
  };

  const loadReports = useCallback(async (map) => {
    try {
      setLoading(true);
      const b = map.getBounds();
      const bounds = `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;
      const data   = await getReports(bounds, filtrosRef.current);
      setReports(data);
      updateMarkers(data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  // Recargar cuando cambian los filtros
useEffect(() => {
  if (mapInstance.current) loadReports(mapInstance.current);
}, [filtros, loadReports]);

  // Refresco automático: vuelve a pedir los reportes cada 15s sin que el usuario recargue
  useEffect(() => {
    const interval = setInterval(() => {
      if (mapInstance.current) loadReports(mapInstance.current);
    }, 15000);
    return () => clearInterval(interval);
  }, [loadReports]);

const updateMarkers = (data) => {
  if (!clusterGroup.current) return;
  clusterGroup.current.clearLayers();

  const dataFiltrada = filtrosRef.current.soloConfiables
    ? data.filter(r => r.reputacion_puntos >= 130)
    : data;

  dataFiltrada.forEach(r => {
    const color  = TIPO_COLORS[r.tipo] || '#888';
    const esConfiable = r.reputacion_puntos >= 130;
    // Validación colectiva: 5+ confirmaciones de otros ciudadanos es una
    // fuente de validación tan legítima como la aprobación de la Autoridad,
    // no un premio de consolación mientras se espera al moderador. Por eso
    // el punto deja de verse "pendiente" con cualquiera de las dos, no solo
    // con la de Autoridad — si no, el mapa contradice el propio discurso de
    // que la validación es colectiva.
    const verifCiudadania = r.confirmaciones >= 5;
    const verifAutoridad  = r.estado === 'aprobado';
    const esVerificado    = verifAutoridad || verifCiudadania;
    const esPend = !esVerificado;

    const icon   = L.divIcon({
      className:'',
      html:`<div style="position:relative;width:12px;height:12px;border-radius:50%;
        background:${color};border:2px solid white;opacity:${esPend ? 0.55 : 1};
        box-shadow:0 1px 3px rgba(0,0,0,.4)">
        ${esPend ? '<div style="position:absolute;top:-4px;right:-4px;font-size:9px;">⏳</div>' : ''}
        ${esConfiable ? '<div style="position:absolute;top:-5px;left:-5px;font-size:10px;">⭐</div>' : ''}
        ${verifCiudadania ? `<div style="position:absolute;bottom:-5px;right:-5px;font-size:10px;">${verifAutoridad ? '🛡️' : '👥'}</div>` : ''}
      </div>`,
      iconSize:[12,12], iconAnchor:[6,6],
    });

    let estadoTexto;
    if (verifAutoridad && verifCiudadania) {
      estadoTexto = '<span style="color:#1D9E75;font-size:11px;">🛡️ Verificado por Autoridad y ciudadanía</span>';
    } else if (verifAutoridad) {
      estadoTexto = '<span style="color:#1D9E75;font-size:11px;">✓ Verificado por Autoridad</span>';
    } else if (verifCiudadania) {
      estadoTexto = '<span style="color:#534AB7;font-size:11px;">👥 Verificado por ciudadanía</span>';
    } else {
      estadoTexto = '<span style="color:#BA7517;font-size:11px;">(pendiente de revisión)</span>';
    }

    const marker = L.marker([r.lat,r.lng],{icon}).bindPopup(`
      <b>${r.tipo}</b> ${estadoTexto}<br>
      ${esConfiable ? '<span style="color:#EF9F27;font-size:11px;">⭐ Reportante confiable</span><br>' : ''}
      ${r.descripcion||'<i>Sin descripción</i>'}<br>
      <small>${r.confirmaciones} confirmaciones</small>
    `);
    clusterGroup.current.addLayer(marker);
  });
};
  const loadHeatmap = async (map) => {
  try {
    const { points } = await getHeatmap();
    if (!points.length) return;
    await import('leaflet.heat');
    // El contenedor puede seguir sin tamaño real justo después de crearse el mapa
    // (sobre todo la primera carga); sin esto, leaflet.heat dibuja sobre un canvas
    // de ancho 0 y lanza un IndexSizeError.
    map.invalidateSize();
    if (map.getSize().x === 0 || map.getSize().y === 0) return;
    if (heatLayer.current) heatLayer.current.remove();
    heatLayer.current = L.heatLayer(points,{
      radius: 45,
      blur: 35,
      maxZoom: 17,
      max: 5, // techo real de peso: severidad(5), sin confirmaciones — ver heatmap.py
      minOpacity: 0.05, // antes 0.35 — forzaba a que hasta el borde sin señal real se viera pintado
      gradient: {
        // Sin verde: el verde se leía como "zona segura" cuando en realidad solo
        // era "casi sin acumulación de calor" (el borde difuso de cualquier punto).
        // Ahora las zonas sin señal real quedan transparentes, no coloreadas.
        0:    'rgba(239,159,39,0)', // transparente en la base
        0.35: '#F4C542', // amarillo — recién empieza a haber señal real
        0.6:  '#EF9F27', // naranja
        0.8:  '#BA7517', // naranja oscuro
        1.0:  '#E24B4A', // rojo
      },
    }).addTo(map);
  } catch(e) { console.error(e); }
};

  const toggleHeatmap = () => {
    if (!heatLayer.current||!mapInstance.current) return;
    if (showHeat) heatLayer.current.remove();
    else heatLayer.current.addTo(mapInstance.current);
    setShowHeat(!showHeat);
  };

  const toggleClusters = () => {
    if (!clusterGroup.current||!mapInstance.current) return;
    if (showCluster) mapInstance.current.removeLayer(clusterGroup.current);
    else mapInstance.current.addLayer(clusterGroup.current);
    setShowCluster(!showCluster);
  };

  const handleGridData = (zonas) => {
    gridLayers.current.forEach(l => l.remove());
    gridLayers.current = [];
    if (!zonas||!mapInstance.current) return;
    zonas.forEach(z => {
      const opacity = z.nivel_riesgo==='ALTO'?0.5:z.nivel_riesgo==='MEDIO'?0.3:0.1;
      if (opacity < 0.15) return;
      const rect = L.rectangle(
        [[z.lat-0.004,z.lng-0.004],[z.lat+0.004,z.lng+0.004]],
        { color:z.color, fillColor:z.color, fillOpacity:opacity, weight:0 }
      ).bindPopup(`<b>Predicción</b><br>Nivel: <b style="color:${z.color}">${z.nivel_riesgo}</b><br>Riesgo estimado: ${z.riesgo_estimado}`)
       .addTo(mapInstance.current);
      gridLayers.current.push(rect);
    });
  };

  const handleReportCreated = async () => {
    if (formMarker.current) { formMarker.current.remove(); formMarker.current = null; }
    setFormPos(null);
    setShowSubmitSuccess(true);
    if (mapInstance.current) loadReports(mapInstance.current);
    if (formPos) {
      const nearby = await getNearby(formPos.lat, formPos.lng);
      const misIds       = JSON.parse(localStorage.getItem('crimemap_historial') || '[]').map(r => r.id);
      const confirmadas  = JSON.parse(localStorage.getItem('crimemap_confirmed') || '[]');
      const filtered     = nearby.filter(r => !misIds.includes(r.id) && !confirmadas.includes(r.id));
      if (filtered.length > 0) setNearbyList(filtered);
    }
  };

  const handleClose = () => {
    if (formMarker.current) { formMarker.current.remove(); formMarker.current = null; }
    setFormPos(null);
  };

  const openNewReport = () => {
    const c = mapInstance.current?.getCenter();
    if (c) { placeFormMarker(mapInstance.current, c.lat, c.lng); setFormPos({ lat:c.lat, lng:c.lng }); }
    setMobilePanel(null);
    setActiveTab('mapa');
  };

  const renderLeftPanel = () => {
    if (activeTab==='analitica')  return <AnalyticaPanel reports={reports}/>;
    if (activeTab==='prediccion') return <PredictPanel map={mapInstance.current} onGridData={handleGridData}/>;
    if (activeTab==='historial')  return <HistorialPanel map={mapInstance.current}/>;
    if (activeTab==='ruta')       return <SafeRoutePanel map={mapInstance.current}/>;
    if (activeTab==='reportes-export') return <ReportesExport/>;
    if (activeTab==='zonas') return (
      <div style={{ padding: 14 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:10 }}>Zonas de Guayaquil</div>
        {zonasFijas.length === 0 ? (
          <div style={{ fontSize:12, color:'#aaa' }}>Cargando zonas...</div>
        ) : (
          <select
            style={{ width:'100%', padding:'9px 10px', borderRadius:8, border:'1px solid #eee', fontSize:13, background:'#fff' }}
            value={zonaSeleccionada?.nombre || ''}
            onChange={e => handleZonaSelect(e.target.value)}
          >
            <option value="" disabled>Selecciona una zona...</option>
            {zonasFijas.map(z => (
              <option key={z.nombre} value={z.nombre}>
                {z.nombre} · {z.nivel_riesgo}
              </option>
            ))}
          </select>
        )}

        <div style={{ marginTop:16, paddingTop:14, borderTop:'1px solid #f0f0f0' }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#888', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:10 }}>
            Nivel de riesgo
          </div>
          {[
            { nivel:'ALTO',  color:'#E24B4A', rango:'≥ 40 pts/semana',   desc:'Severidad alta y sostenida en los últimos 180 días.' },
            { nivel:'MEDIO', color:'#BA7517', rango:'10–39 pts/semana', desc:'Presencia moderada de reportes graves.' },
            { nivel:'BAJO',  color:'#1D9E75', rango:'< 10 pts/semana',  desc:'Baja concentración o sin reportes recientes.' },
          ].map(n => (
            <div key={n.nivel} style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:10 }}>
              <div style={{ width:12, height:12, borderRadius:4, background:n.color, flexShrink:0, marginTop:2 }}/>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:'#1a1a1a' }}>
                  {n.nivel} <span style={{ fontWeight:400, color:'#aaa' }}>({n.rango})</span>
                </div>
                <div style={{ fontSize:11, color:'#888', marginTop:1 }}>{n.desc}</div>
              </div>
            </div>
          ))}
          <div style={{ fontSize:10, color:'#bbb', marginTop:6, lineHeight:1.4 }}>
            Riesgo = severidad acumulada de reportes aprobados (180 días) ÷ semanas de historial.
          </div>
        </div>
      </div>
    );

    return null;
  };

  // ── MOBILE LAYOUT ──────────────────────────────────────────
  if (mobile) {
    return (
      <div style={{ width:'100vw', height:'100dvh', position:'relative', overflow:'hidden', fontFamily:'-apple-system,sans-serif' }}>

        {/* Mapa ocupa toda la pantalla */}
        <div ref={mapRef} style={{ width:'100%', height:'100%' }}/>
          <PoliceMarkers map={mapInstance.current} />

        {/* Header móvil */}
        <div style={mStyles.header}>
          <div style={mStyles.headerLogo}>
            <Map size={16} color="#E24B4A" strokeWidth={2.5}/>
            <span>CrimeMap GYE</span>
          </div>
          <div style={mStyles.headerCount}>
            <span style={mStyles.countBadge}>{reports.length}</span>
          </div>
        </div>

        {/* Panel de filtros móvil */}
        <div style={{ position:'absolute', top:64, right:12, zIndex:999 }}>
          <FilterPanel filtros={filtros} onChange={setFiltros} />
        </div>

        <AddressSearch map={mapInstance.current} mobile />

        {loading && <div style={mStyles.loading}>Actualizando...</div>}

        {/* Toast de confirmación */}
        {nearbyList.length > 0 && (
          <ConfirmToast reports={nearbyList} onDismiss={() => setNearbyList([])}/>
        )}
        {showSubmitSuccess && (
          <SubmitSuccessToast mobile onDismiss={() => setShowSubmitSuccess(false)} />
        )}
        <ProximityAlert />
        <LocateButton map={mapInstance.current} mobile={mobile} />
        <PanicButton mobile={mobile} />
        {zonaSeleccionada && (
          <ZoneDetailModal zona={zonaSeleccionada} onClose={() => setZonaSeleccionada(null)} />
        )}

        {/* Formulario de denuncia */}
        {formPos && (
          <div style={mStyles.formOverlay}>
            <ReportForm
              lat={formPos.lat} lng={formPos.lng}
              deviceId={deviceId}
              onCreated={handleReportCreated}
              onClose={handleClose}
              onMoveMap={handleMoveMap}
            />
          </div>
        )}

        {/* Panel deslizable desde abajo */}
        {mobilePanel && (
          <div style={mStyles.bottomSheet}>
            <div style={mStyles.bottomSheetHandle}/>
            <div style={mStyles.bottomSheetHeader}>
              <span style={mStyles.bottomSheetTitle}>
                {mobilePanel === 'lista' && 'Denuncias visibles'}
                {mobilePanel === 'menu'  && 'Menú'}
              </span>
              <button style={mStyles.bottomSheetClose} onClick={() => setMobilePanel(null)}>
                <X size={16} strokeWidth={2}/>
              </button>
            </div>
            <div style={mStyles.bottomSheetContent}>
              {mobilePanel === 'lista' && (
                <ReportList reports={reportsFiltrados} map={mapInstance.current}/>              )}
              {mobilePanel === 'menu' && (
                <div style={mStyles.menuGrid}>
                  {[
                    { id:'analitica',  label:'Analítica',  Icon:BarChart2  },
                    { id:'prediccion', label:'Predicción', Icon:Clock      },
                    { id:'historial',  label:'Historial',  Icon:History    },
                    { id:'ruta',       label:'Ruta segura',  Icon:Route     }, // ← agregar esta línea
                    { id:'zonas',      label:'Zonas',        Icon:MapPinned },
                    { id:'analitica-avanzada',label:'Analítica avanzada', Icon:TrendingUp },
                    { id:'reportes-export',label:'Reportes', Icon:FileDown },

                  ].map(({ id, label, Icon }) => (
                    <div key={id} style={mStyles.menuItem}
                      onClick={() => { setActiveTab(id); setMobilePanel('panel'); }}>
                      <Icon size={22} color="#E24B4A" strokeWidth={1.8}/>
                      <span>{label}</span>
                    </div>
                  ))}
                  <div style={mStyles.menuItem} onClick={toggleHeatmap}>
                    <Thermometer size={22} color={showHeat?'#E24B4A':'#aaa'} strokeWidth={1.8}/>
                    <span>Heatmap {showHeat?'ON':'OFF'}</span>
                  </div>
                  <div style={mStyles.menuItem} onClick={toggleClusters}>
                    <Circle size={22} color={showCluster?'#E24B4A':'#aaa'} strokeWidth={1.8}/>
                    <span>Clusters {showCluster?'ON':'OFF'}</span>
                  </div>
                </div>
              )}
              {mobilePanel === 'panel' && (
                <div style={{ flex:1, overflowY:'auto' }}>
                  {renderLeftPanel()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Leyenda */}
        <div style={mStyles.legend}>
          {showHeat && (
            <div style={{ marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid #eee' }}>
              <div style={{ height: 6, borderRadius: 3, background: 'linear-gradient(to right, rgba(239,159,39,0), #F4C542, #EF9F27, #BA7517, #E24B4A)' }}/>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#aaa', marginTop: 2 }}>
                <span>Menos reportes</span>
                <span>Más reportes</span>
              </div>
            </div>
          )}
          {Object.entries(TIPO_COLORS).map(([tipo, color]) => (
            <div key={tipo} style={mStyles.legendItem}>
              <div style={{width:8,height:8,borderRadius:'50%',background:color,flexShrink:0}}/>
              <span>{tipo}</span>
            </div>
          ))}
          <div style={mStyles.legendItem}>
            <div style={{width:8,height:8,borderRadius:'50%',border:'2px dashed #534AB7',flexShrink:0}}/>
            <span>Zona verificada</span>
          </div>
          <div style={mStyles.legendItem}> {/* o styles.legendItem en desktop */}
            <span style={{ fontSize: 9 }}>⭐</span>
            <span>Reportante confiable</span>
          </div>
          <div style={mStyles.legendItem}>
            <span style={{ fontSize: 9 }}>👥</span>
            <span>Verificado por ciudadanía (5+ confirmaron)</span>
          </div>
          <div style={mStyles.legendItem}>
            <span style={{ fontSize: 9 }}>🛡️</span>
            <span>Verificado por Autoridad y ciudadanía</span>
          </div>
        </div>

        {/* Tab bar inferior */}
        <div style={mStyles.tabBar}>
          <button style={mStyles.tabBtn} onClick={() => setMobilePanel(mobilePanel==='menu'?null:'menu')}>
            <SlidersHorizontal size={20} color={mobilePanel==='menu'?'#E24B4A':'#888'} strokeWidth={1.8}/>
            <span style={{...mStyles.tabLabel, color:mobilePanel==='menu'?'#E24B4A':'#888'}}>Menú</span>
          </button>
          <button style={mStyles.tabBtnCenter} onClick={openNewReport}>
            <Plus size={24} color="#fff" strokeWidth={2.5}/>
          </button>
          <button style={mStyles.tabBtn} onClick={() => setMobilePanel(mobilePanel==='lista'?null:'lista')}>
            <List size={20} color={mobilePanel==='lista'?'#E24B4A':'#888'} strokeWidth={1.8}/>
            <span style={{...mStyles.tabLabel, color:mobilePanel==='lista'?'#E24B4A':'#888'}}>Lista</span>
          </button>
        </div>
      </div>
    );
  }

  // ── DESKTOP LAYOUT ─────────────────────────────────────────
  return (
    <div style={{ display:'flex', height:'100dvh', overflow:'hidden', fontFamily:'-apple-system,sans-serif' }}>
      <aside style={styles.sidebarLeft}>
        <div style={styles.logo}>
          <Map size={18} color="#E24B4A" strokeWidth={2.5}/>
          <span>CrimeMap GYE</span>
        </div>
        <nav style={styles.nav}>
          <div style={styles.navSection}>Vistas</div>
          {[
            { id:'mapa',       label:'Mapa en vivo', Icon:Map       },
            { id:'analitica',  label:'Analítica',    Icon:BarChart2  },
            { id:'prediccion', label:'Predicción',   Icon:Clock     },
            { id:'historial',  label:'Historial',    Icon:History   },
            { id:'ruta',       label:'Ruta segura',  Icon:Route     },
            { id:'zonas',      label:'Zonas',        Icon:MapPinned },
            { id:'analitica-avanzada',label:'Analítica avanzada', Icon:TrendingUp },


          ].map(({ id, label, Icon }) => (
            <div key={id}
              style={{...styles.navItem,...(activeTab===id?styles.navItemActive:{})}}
              onClick={() => setActiveTab(id)}>
              <Icon size={15} strokeWidth={1.8}/>
              <span>{label}</span>
            </div>
          ))}

          <div style={styles.navSection}>Denuncias</div>
          <div style={styles.navItem} onClick={openNewReport}>
            <Plus size={15} strokeWidth={1.8}/>
            <span>Nueva denuncia</span>
          </div>
          <div style={styles.navSection}>Capas</div>
          {[
            { label:'Heatmap',  Icon:Thermometer, active:showHeat,    toggle:toggleHeatmap  },
            { label:'Clusters', Icon:Circle,      active:showCluster, toggle:toggleClusters },
          ].map(({ label, Icon, active, toggle }) => (
            <div key={label}
              style={{...styles.navItem,...(active?styles.navItemActive:{})}}
              onClick={toggle}>
              <Icon size={15} strokeWidth={1.8}/>
              <span>{label}</span>
              {active && <div style={styles.activeDot}/>}
            </div>
          ))}
        </nav>
        {activeTab !== 'mapa' && activeTab !== 'analitica-avanzada' && activeTab !== 'reportes-export' && (
          <div style={styles.panelWrapper}>{renderLeftPanel()}</div>
        )}
        <div style={styles.sidebarBottom}>
          <div
            style={{...styles.reportesBtn, ...(activeTab==='reportes-export' ? styles.reportesBtnActive : {})}}
            onClick={() => setActiveTab('reportes-export')}>
            <FileDown size={15} strokeWidth={1.8}/>
            <span>Reportes</span>
          </div>
          <div style={styles.mapInfo}>
            <div style={styles.mapInfoLabel}>Denuncias visibles</div>
            <div style={styles.mapInfoCount}>{reports.length}</div>
          </div>
        </div>
      </aside>
      <div style={{ flex:1, position:'relative' }}>

  {/* El mapa y sus overlays SIEMPRE están montados, solo se ocultan con CSS */}
  <div style={{ display: (activeTab === 'analitica-avanzada' || activeTab === 'reportes-export') ? 'none' : 'block', width:'100%', height:'100%', position:'relative' }}>
    <div ref={mapRef} style={{ width:'100%', height:'100%' }}/>
    <PoliceMarkers map={mapInstance.current} />

    {activeTab==='prediccion' && (
      <div style={styles.predictBanner}>
        Modo predicción — selecciona fecha, hora y modelo en el panel
      </div>
    )}
    {loading && <div style={styles.loading}>Actualizando...</div>}
    <FilterPanel filtros={filtros} onChange={setFiltros} />
    <AddressSearch map={mapInstance.current} />
    <div style={styles.hint}>
      <MousePointerClick size={13} strokeWidth={1.8}/>
      <span>Doble clic para denunciar</span>
    </div>
    {formPos && (
      <div style={styles.formOverlay}>
        <ReportForm
          lat={formPos.lat} lng={formPos.lng}
          deviceId={deviceId}
          onCreated={handleReportCreated}
          onClose={handleClose}
          onMoveMap={handleMoveMap}
        />
      </div>
    )}
    <LocateButton map={mapInstance.current} mobile={mobile} />
    {nearbyList.length > 0 && (
      <ConfirmToast reports={nearbyList} onDismiss={() => setNearbyList([])}/>
    )}
    {showSubmitSuccess && (
      <SubmitSuccessToast onDismiss={() => setShowSubmitSuccess(false)} />
    )}
    <div style={styles.legend}>
      {showHeat && (
        <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #eee' }}>
          <div style={{ height: 7, borderRadius: 4, background: 'linear-gradient(to right, rgba(239,159,39,0), #F4C542, #EF9F27, #BA7517, #E24B4A)' }}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#aaa', marginTop: 3 }}>
            <span>Menos reportes</span>
            <span>Más reportes</span>
          </div>
        </div>
      )}
      {Object.entries(TIPO_COLORS).map(([tipo, color]) => (
        <div key={tipo} style={styles.legendItem}>
          <div style={{...styles.legendDot, background:color}}/>
          <span>{tipo}</span>
        </div>
      ))}
      <div style={styles.legendItem}>
        <div style={{...styles.legendDot, border:'2px dashed #534AB7', background:'transparent'}}/>
        <span>Zona verificada</span>
      </div>
      <div style={styles.legendItem}>
        <span style={{ fontSize: 9 }}>⭐</span>
        <span>Reportante confiable</span>
      </div>
      <div style={styles.legendItem}>
        <span style={{ fontSize: 9 }}>👥</span>
        <span>Verificado por ciudadanía (5+ confirmaron)</span>
      </div>
      <div style={styles.legendItem}>
        <span style={{ fontSize: 9 }}>🛡️</span>
        <span>Verificado por Autoridad y ciudadanía</span>
      </div>
    </div>
  </div>

  {/* El dashboard solo se monta cuando se necesita, esto sí puede montar/desmontar */}
  {activeTab === 'analitica-avanzada' && (
    <div style={{ position:'absolute', inset:0, background:'#fff', overflowY:'auto' }}>
      <AnalyticsDashboard />
    </div>
  )}
  {activeTab === 'reportes-export' && (
    <div style={{ position:'absolute', inset:0, background:'#fff', overflowY:'auto' }}>
      <ReportesExport />
    </div>
  )}
</div>
      <ReportList reports={reportsFiltrados} map={mapInstance.current}/>
      <PanicButton />
      {zonaSeleccionada && (
        <ZoneDetailModal zona={zonaSeleccionada} onClose={() => setZonaSeleccionada(null)} />
      )}
    </div>
  );
}

// ── MOBILE STYLES ───────────────────────────────────────────
const mStyles = {
  header:            { position:'absolute', top:0, left:0, right:0, zIndex:1000, background:'rgba(255,255,255,0.95)', backdropFilter:'blur(8px)', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #eee' },
  headerLogo:        { display:'flex', alignItems:'center', gap:'8px', fontWeight:700, fontSize:'15px', color:'#1a1a1a' },
  headerCount:       { display:'flex', alignItems:'center' },
  countBadge:        { background:'#E24B4A', color:'#fff', fontSize:'12px', fontWeight:700, padding:'2px 8px', borderRadius:'10px' },
  loading:           { position:'absolute', top:'60px', left:'50%', transform:'translateX(-50%)', background:'#fff', padding:'6px 14px', borderRadius:'20px', fontSize:'12px', boxShadow:'0 2px 8px rgba(0,0,0,.15)', zIndex:1000 },
  formOverlay:       { position:'absolute', top:'60px', left:'50%', transform:'translateX(-50%)', zIndex:2000, width:'calc(100vw - 32px)', maxWidth:'320px' },
  legend:            { position:'absolute', bottom:'90px', left:'12px', zIndex:1000, background:'rgba(255,255,255,0.92)', backdropFilter:'blur(8px)', borderRadius:'8px', padding:'6px 8px', display:'flex', flexDirection:'column', gap:'3px' },
  legendItem:        { display:'flex', alignItems:'center', gap:'5px', fontSize:'10px', color:'#555' },
  bottomSheet:       { position:'absolute', bottom:'72px', left:0, right:0, zIndex:1500, background:'#fff', borderRadius:'16px 16px 0 0', boxShadow:'0 -4px 20px rgba(0,0,0,.15)', maxHeight:'60vh', display:'flex', flexDirection:'column' },
  bottomSheetHandle: { width:'36px', height:'4px', background:'#eee', borderRadius:'2px', margin:'10px auto 0' },
  bottomSheetHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px 8px' },
  bottomSheetTitle:  { fontWeight:600, fontSize:'14px' },
  bottomSheetClose:  { background:'none', border:'none', cursor:'pointer', color:'#aaa', display:'flex', alignItems:'center' },
  bottomSheetContent:{ flex:1, overflowY:'auto' },
  menuGrid:          { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', padding:'12px 16px 20px' },
  menuItem:          { display:'flex', flexDirection:'column', alignItems:'center', gap:'6px', padding:'14px 8px', background:'#fafafa', borderRadius:'12px', cursor:'pointer', fontSize:'12px', color:'#555', fontWeight:500 },
tabBar: { 
  position:'absolute', bottom:0, left:0, right:0, zIndex:1000, 
  background:'rgba(255,255,255,0.96)', backdropFilter:'blur(8px)', 
  borderTop:'1px solid #eee', display:'flex', alignItems:'center', 
  justifyContent:'space-around', 
  padding:'8px 16px env(safe-area-inset-bottom, 20px)',
  height:'auto',
  paddingBottom:'max(20px, env(safe-area-inset-bottom))',
},  tabBtn:            { display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', background:'none', border:'none', cursor:'pointer', padding:'4px 16px' },
  tabBtnCenter:      { width:'52px', height:'52px', borderRadius:'50%', background:'#E24B4A', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(226,75,74,.4)' },
  tabLabel:          { fontSize:'10px', fontWeight:500 },
};

// ── DESKTOP STYLES ──────────────────────────────────────────
const styles = {
  sidebarLeft:   { width:'220px', background:'#fff', borderRight:'1px solid #eee', display:'flex', flexDirection:'column', zIndex:1000, overflow:'hidden' },
  logo:          { padding:'16px', fontWeight:700, fontSize:'15px', borderBottom:'1px solid #eee', color:'#1a1a1a', display:'flex', alignItems:'center', gap:'8px', flexShrink:0 },
  nav:           { padding:'8px', flexShrink:0 },
  navSection:    { fontSize:'10px', fontWeight:600, color:'#ccc', textTransform:'uppercase', padding:'12px 8px 4px', letterSpacing:'.06em' },
  navItem:       { padding:'8px 10px', borderRadius:'8px', cursor:'pointer', fontSize:'13px', color:'#666', margin:'1px 0', display:'flex', alignItems:'center', gap:'8px' },
  navItemActive: { background:'#fff0f0', color:'#E24B4A', fontWeight:500 },
  activeDot:     { width:'6px', height:'6px', borderRadius:'50%', background:'#E24B4A', marginLeft:'auto' },
  panelWrapper:  { flex:1, overflowY:'auto', borderTop:'1px solid #eee' },
  sidebarBottom: { marginTop:'auto', flexShrink:0 },
  reportesBtn:   { display:'flex', alignItems:'center', gap:'8px', margin:'0 8px', padding:'9px 10px', borderRadius:'8px', cursor:'pointer', fontSize:'13px', color:'#666', borderTop:'1px solid #eee' },
  reportesBtnActive: { background:'#fff0f0', color:'#E24B4A', fontWeight:500 },
  mapInfo:       { padding:'12px 16px', borderTop:'1px solid #eee', flexShrink:0 },
  mapInfoLabel:  { fontSize:'11px', color:'#aaa' },
  mapInfoCount:  { fontSize:'28px', fontWeight:700, color:'#E24B4A' },
  predictBanner: { position:'absolute', top:'12px', left:'50%', transform:'translateX(-50%)', background:'#534AB7', color:'#fff', fontSize:'11px', fontWeight:500, padding:'7px 16px', borderRadius:'20px', zIndex:1000, whiteSpace:'nowrap' },
  loading:       { position:'absolute', top:'12px', left:'50%', transform:'translateX(-50%)', background:'#fff', padding:'6px 14px', borderRadius:'20px', fontSize:'12px', boxShadow:'0 2px 8px rgba(0,0,0,.15)', zIndex:1000 },
  hint:          { position:'absolute', bottom:'24px', right:'12px', zIndex:1000, background:'rgba(0,0,0,.5)', color:'#fff', fontSize:'11px', padding:'5px 10px', borderRadius:'20px', display:'flex', alignItems:'center', gap:'5px' },
  formOverlay:   { position:'absolute', top:'60px', left:'50%', transform:'translateX(-50%)', zIndex:2000 },
  legend:        { position:'absolute', bottom:'24px', left:'12px', zIndex:1000, background:'#fff', borderRadius:'8px', padding:'8px 10px', boxShadow:'0 2px 8px rgba(0,0,0,.12)', display:'flex', flexDirection:'column', gap:'4px' },
  legendItem:    { display:'flex', alignItems:'center', gap:'6px', fontSize:'11px', color:'#555' },
  legendDot:     { width:'10px', height:'10px', borderRadius:'50%' },
};
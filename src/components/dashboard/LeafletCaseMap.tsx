// src/components/dashboard/LeafletCaseMap.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import type { Map as LeafletMap, LatLngExpression } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2 } from 'lucide-react';
import type { MapMarkerData } from '@/types/case';

// Default Leaflet icon setup
const defaultIcon = L.icon({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

interface LeafletCaseMapProps {
  markers: MapMarkerData[];
  center?: LatLngExpression;
  zoom?: number;
}

const mapContainerStyle: React.CSSProperties = {
  height: '100%',
  width: '100%',
  borderRadius: 'var(--radius)',
};

const defaultInitialCenter: LatLngExpression = [-15.7801, -47.9292]; // Brasília, Brazil

const MapUpdater = ({ center, zoomLevel }: { center: LatLngExpression; zoomLevel: number }) => {
  const map = useMap();
  useEffect(() => {
    let isValidCenter = false;
    if (Array.isArray(center) && center.length === 2 && Number.isFinite(center[0]) && Number.isFinite(center[1])) {
      isValidCenter = true;
    } else if (typeof center === 'object' && center !== null && 'lat' in center && 'lng' in center && Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
      isValidCenter = true;
    }

    if (map && isValidCenter && Number.isFinite(zoomLevel)) {
      map.setView(center, zoomLevel);
    }
  }, [center, zoomLevel, map]);
  return null;
};

const LeafletCaseMap: React.FC<LeafletCaseMapProps> = ({
  markers,
  center: initialCenterProp,
  zoom: initialZoomProp = 4,
}) => {
  const [isClient, setIsClient] = useState(false);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  // Using a stable key to prevent unnecessary re-mounts of MapContainer itself.
  // MapUpdater will handle dynamic changes to center/zoom.
  const mapKey = useMemo(() => `leaflet-map-${Math.random().toString(36).substring(7)}`, []);


  useEffect(() => {
    setIsClient(true);
  }, []);

  const center = useMemo<LatLngExpression>(() => {
    if (initialCenterProp) {
      if (Array.isArray(initialCenterProp) && initialCenterProp.length === 2 && Number.isFinite(initialCenterProp[0]) && Number.isFinite(initialCenterProp[1])) {
        return initialCenterProp as [number, number];
      }
      if (typeof initialCenterProp === 'object' && 'lat' in initialCenterProp && 'lng' in initialCenterProp && Number.isFinite(initialCenterProp.lat) && Number.isFinite(initialCenterProp.lng)) {
        return [initialCenterProp.lat, initialCenterProp.lng];
      }
    }
    if (markers.length > 0 && markers[0]?.position &&
        Number.isFinite(markers[0].position.lat) &&
        Number.isFinite(markers[0].position.lng)) {
      return [markers[0].position.lat, markers[0].position.lng];
    }
    return defaultInitialCenter;
  }, [markers, initialCenterProp]);

  const zoom = useMemo(() => {
    if (markers.length === 1) return 10;
    if (markers.length > 0 && markers.length < 5) return 6;
    return initialZoomProp;
  }, [markers, initialZoomProp]);

  // Cleanup map instance on component unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        // console.log("LeafletCaseMap: Removing map instance on unmount for key:", mapKey);
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapKey]); // This dependency ensures cleanup happens if mapKey were to change, but mapKey is now stable.
                // The primary purpose here is cleanup when LeafletCaseMap itself unmounts.

  if (!isClient) {
    return (
      <div style={mapContainerStyle} className="rounded-lg shadow-md bg-muted flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
        <Loader2 className="h-10 w-10 mb-2 text-primary animate-spin" />
        <p className="font-semibold">Carregando mapa...</p>
      </div>
    );
  }

  return (
    <MapContainer
      key={mapKey} // Key to help React differentiate MapContainer instances if needed, though now stable.
      center={center}
      zoom={zoom}
      scrollWheelZoom={true}
      style={mapContainerStyle}
      className="rounded-lg shadow-md"
      whenCreated={(mapInstance) => {
        // console.log("LeafletCaseMap: Map instance created for key:", mapKey, mapInstance);
        if (mapInstanceRef.current && mapInstanceRef.current !== mapInstance) {
            // console.warn("LeafletCaseMap: Potentially overwriting an existing map instance ref. This might indicate a problem if not intended.");
            // mapInstanceRef.current.remove(); // Clean up old instance if it wasn't cleaned up properly
        }
        mapInstanceRef.current = mapInstance;
      }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((marker) => (
        marker?.position && Number.isFinite(marker.position.lat) && Number.isFinite(marker.position.lng) && (
          <Marker key={marker.id} position={[marker.position.lat, marker.position.lng]}>
            <Popup>
              <div className="p-1 max-w-xs" dangerouslySetInnerHTML={{ __html: marker.popupContent }} />
            </Popup>
          </Marker>
        )
      ))}
      <MapUpdater center={center} zoomLevel={zoom} />
    </MapContainer>
  );
};

export default LeafletCaseMap;

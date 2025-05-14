// src/components/dashboard/LeafletCaseMap.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import type { Map as LeafletMapType, LatLngExpression } from 'leaflet';
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
  borderRadius: 'var(--radius)', // Applied via className now, but kept for reference
};

const defaultInitialCenter: LatLngExpression = [-15.7801, -47.9292]; // Brasília, Brazil

// Component to update map view when center or zoom props change
const MapViewUpdater = ({ center, zoom }: { center: LatLngExpression; zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    if (map) {
      let validCenter = center;
      let validZoom = zoom;

      // Validate center
      if (Array.isArray(center) && (center.length !== 2 || !Number.isFinite(center[0]) || !Number.isFinite(center[1]))) {
        console.warn("LeafletCaseMap: Invalid center prop in MapViewUpdater, using default.", center);
        validCenter = defaultInitialCenter;
      } else if (typeof center === 'object' && center !== null && 
                 (!('lat' in center) || !('lng' in center) || !Number.isFinite(center.lat) || !Number.isFinite(center.lng))) {
        console.warn("LeafletCaseMap: Invalid center prop in MapViewUpdater, using default.", center);
        validCenter = defaultInitialCenter;
      }

      // Validate zoom
      if (!Number.isFinite(zoom)) {
        console.warn("LeafletCaseMap: Invalid zoom prop in MapViewUpdater, using default.", zoom);
        validZoom = 4; // A sensible default zoom
      }
      
      map.setView(validCenter, validZoom);
    }
  }, [center, zoom, map]);
  return null;
};


const LeafletCaseMap: React.FC<LeafletCaseMapProps> = ({
  markers,
  center: initialCenterProp,
  zoom: initialZoomProp = 4,
}) => {
  const [isClient, setIsClient] = useState(false);
  const mapInstanceRef = useRef<LeafletMapType | null>(null); 

  useEffect(() => {
    setIsClient(true);
  }, []);

  const mapKey = useMemo(() => {
    // Key changes if the number of markers or their fundamental IDs change.
    return `map-${markers.map(m => m.id).join('_')}`;
  }, [markers]);

  const center = useMemo<LatLngExpression>(() => {
    if (initialCenterProp) {
      if (Array.isArray(initialCenterProp) && initialCenterProp.length === 2 && Number.isFinite(initialCenterProp[0]) && Number.isFinite(initialCenterProp[1])) {
        return initialCenterProp as [number, number];
      }
      if (typeof initialCenterProp === 'object' && 'lat' in initialCenterProp && 'lng' in initialCenterProp && Number.isFinite(initialCenterProp.lat) && Number.isFinite(initialCenterProp.lng)) {
        return [initialCenterProp.lat, initialCenterProp.lng];
      }
      console.warn("LeafletCaseMap: Invalid initialCenterProp, falling back.", initialCenterProp);
    }
    if (markers.length > 0 && markers[0]?.position &&
        Number.isFinite(markers[0].position.lat) &&
        Number.isFinite(markers[0].position.lng)) {
      return [markers[0].position.lat, markers[0].position.lng];
    }
    return defaultInitialCenter;
  }, [markers, initialCenterProp]);

  const zoom = useMemo(() => {
    if (!Number.isFinite(initialZoomProp)) {
      console.warn("LeafletCaseMap: Invalid initialZoomProp, using default 4.", initialZoomProp);
      return 4;
    }
    if (markers.length === 1) return 10;
    if (markers.length > 0 && markers.length < 5) return 6;
    return initialZoomProp;
  }, [markers, initialZoomProp]);

  useEffect(() => {
    // Cleanup function to run when the component unmounts.
    // React's `key` prop on MapContainer should trigger unmount/remount,
    // and this cleanup will then be called for the old instance.
    return () => {
      if (mapInstanceRef.current) {
        console.log("LeafletCaseMap: Cleanup - Removing map instance from ref on unmount.");
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null; 
      }
    };
  }, []); // Empty dependency array: runs only on mount and unmount of this LeafletCaseMap component instance.

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
      key={mapKey} 
      center={center}
      zoom={zoom}
      scrollWheelZoom={true}
      style={mapContainerStyle}
      className="rounded-lg shadow-md" // Ensure Tailwind radius is applied
      whenCreated={(map) => {
        // Simply assign the created map instance to the ref.
        // The useEffect cleanup will handle removing the previous instance when the component unmounts (due to key change or otherwise).
        console.log("LeafletCaseMap: MapContainer created/recreated via key. New map instance assigned.");
        mapInstanceRef.current = map;
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
      <MapViewUpdater center={center} zoom={zoom} />
    </MapContainer>
  );
};

export default LeafletCaseMap;
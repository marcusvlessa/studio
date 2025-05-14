// src/components/dashboard/CaseMap.tsx
"use client";

import { useEffect, useState, useMemo, useRef } from 'react';
import type { LatLngExpression, Map as LeafletMap } from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Loader2, MapPin } from 'lucide-react';

// Fix for default Leaflet icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface MapMarkerData {
  position: LatLngExpression;
  popupContent: string;
  id: string;
}

interface CaseMapProps {
  markers: MapMarkerData[];
  center?: LatLngExpression;
  zoom?: number;
}

// Component to adjust map view when markers change
const ChangeView = ({ markers, center, zoom }: { markers: MapMarkerData[], center: LatLngExpression, zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(marker => marker.position));
      if (bounds.isValid()) {
        if (!map.getBounds().equals(bounds, 0.01)) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      } else if (markers.length === 1) {
         // Ensure marker position is valid LatLng before comparing or setting view
         const markerPosition = L.latLng(markers[0].position);
         if (map.getZoom() !== zoom || !map.getCenter().equals(markerPosition)) {
           map.setView(markerPosition, zoom);
         }
      }
    } else {
      const currentCenter = L.latLng(center);
      if (map.getZoom() !== zoom || !map.getCenter().equals(currentCenter)) {
         map.setView(currentCenter, zoom);
      }
    }
  }, [markers, center, zoom, map]);
  return null;
};


const CaseMap: React.FC<CaseMapProps> = ({
  markers,
  center = [-15.7801, -47.9292], 
  zoom = 4, 
}) => {
  const [isClient, setIsClient] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    setIsClient(true);
    // This effect is for the CaseMap component itself
    return () => {
      // This cleanup runs when CaseMap unmounts
      if (mapRef.current) {
        // console.log("CaseMap unmounting, attempting to remove map instance:", mapRef.current);
        try {
          mapRef.current.remove();
        } catch (e) {
          // console.error("Error removing map instance in CaseMap cleanup:", e);
        }
        mapRef.current = null; 
      }
    };
  }, []);

  // Stable key to force re-render MapContainer only when essential props change.
  // This helps prevent the "Map container is already initialized" error during HMR.
  const mapKey = useMemo(() => {
    const centerStr = Array.isArray(center) && center.length === 2 ? `${center[0].toString()},${center[1].toString()}` : String(center);
    const markersKeyPart = markers.map(m => m.id).join('-');
    return `map-instance-${centerStr}-${zoom}-${markersKeyPart}`;
  }, [center, zoom, markers]);

  if (!isClient) {
    return (
      <div style={{ height: '100%', width: '100%' }} className="rounded-lg shadow-md bg-muted flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
        Carregando Mapa...
      </div>
    );
  }

  if (markers.length === 0 && isClient) { 
     return (
      <div style={{ height: '100%', width: '100%' }} className="rounded-lg shadow-md bg-muted flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
        <MapPin className="h-10 w-10 mb-2 text-primary" />
        <p className="text-sm">Nenhum marcador para exibir no mapa.</p>
      </div>
    );
  }
  
  return (
    <MapContainer
      key={mapKey} 
      center={center}
      zoom={zoom}
      scrollWheelZoom={true}
      style={{ height: '100%', width: '100%' }}
      className="rounded-lg shadow-md"
      whenCreated={(mapInstance) => { 
        mapRef.current = mapInstance;
        // console.log("Leaflet map instance created/recreated for key:", mapKey);
      }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((marker) => (
        <Marker key={marker.id} position={marker.position}>
          <Popup>{marker.popupContent}</Popup>
        </Marker>
      ))}
      <ChangeView markers={markers} center={center} zoom={zoom} />
    </MapContainer>
  );
};

export default CaseMap;

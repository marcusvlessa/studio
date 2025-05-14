// src/components/dashboard/CaseMap.tsx
"use client";

import { useEffect, useState, useMemo } from 'react';
import type { LatLngExpression } from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
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

const CaseMap: React.FC<CaseMapProps> = ({
  markers,
  center = [-15.7801, -47.9292], // Default center (Brasília)
  zoom = 4, // Default zoom
}) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Generate a key that changes if crucial map props change.
  // This helps ensure React replaces the MapContainer instance if necessary.
  const mapKey = useMemo(() => {
    // Create a stable string representation of markers for the key
    const markersKeyPart = markers.map(m => `${m.id}_${m.position.toString()}`).join(';');
    return `map-${JSON.stringify(center)}-${zoom}-${markers.length}-${markersKeyPart}`;
  }, [center, zoom, markers]);

  if (!isClient) {
    return (
      <div style={{ height: '100%', width: '100%' }} className="rounded-lg shadow-md bg-muted flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Carregando Mapa...
      </div>
    );
  }

  if (markers.length === 0) {
     return (
      <div style={{ height: '100%', width: '100%' }} className="rounded-lg shadow-md bg-muted flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
        <MapPin className="h-10 w-10 mb-2" />
        <p className="text-sm">Nenhum marcador para exibir no mapa.</p>
      </div>
    );
  }
  
  return (
    // Using the generated mapKey.
    // The MapContainer's key prop ensures that if critical data for the map (center, zoom, markers) changes,
    // React will unmount the old component and mount a new one, allowing Leaflet to initialize cleanly.
    <MapContainer key={mapKey} center={center} zoom={zoom} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }} className="rounded-lg shadow-md">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((marker) => (
        <Marker key={marker.id} position={marker.position}>
          <Popup>{marker.popupContent}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default CaseMap;

// src/components/dashboard/LeafletCaseMap.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, MapPin } from 'lucide-react';
import type { MapMarkerData } from '@/types/case';

// Default Leaflet icon setup (แก้ปัญหาไอคอนหาย)
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
  center?: { lat: number; lng: number };
  zoom?: number;
}

const mapContainerStyle = {
  height: '100%',
  width: '100%',
};

const defaultCenter: L.LatLngExpression = [-15.7801, -47.9292]; // Brasília

const RecenterAutomatically = ({ center }: { center: L.LatLngExpression }) => {
  const map = useMap();
  useEffect(() => {
    if (center && map) {
      map.setView(center);
    }
  }, [center, map]);
  return null;
};

const LeafletCaseMap: React.FC<LeafletCaseMapProps> = ({
  markers,
  center: initialCenter,
  zoom = 4,
}) => {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true); // Set to true once component is mounted on client
  }, []);

  const currentMapCenter = useMemo(() => {
    if (markers.length > 0 && markers[0]?.position &&
        Number.isFinite(markers[0].position.lat) &&
        Number.isFinite(markers[0].position.lng)) {
      return [markers[0].position.lat, markers[0].position.lng] as L.LatLngExpression;
    }
    if (initialCenter && Number.isFinite(initialCenter.lat) && Number.isFinite(initialCenter.lng)) {
      return [initialCenter.lat, initialCenter.lng] as L.LatLngExpression;
    }
    return defaultCenter;
  }, [markers, initialCenter]);

  const currentZoom = useMemo(() => {
    if (markers.length > 0 && markers.length < 5) {
      return 6; // Zoom in a bit if few markers
    }
    return zoom;
  }, [markers, zoom]);

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
      center={currentMapCenter}
      zoom={currentZoom}
      scrollWheelZoom={true}
      style={mapContainerStyle}
      className="rounded-lg shadow-md"
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
      <RecenterAutomatically center={currentMapCenter} />
    </MapContainer>
  );
};

export default LeafletCaseMap;

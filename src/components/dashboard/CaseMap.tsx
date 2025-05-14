// src/components/dashboard/CaseMap.tsx
"use client";

import type { LatLngExpression } from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet'; // Import L for custom icons if needed

// Fix for default Leaflet icon issue with Webpack/Next.js
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
  if (typeof window === 'undefined') {
    // Don't render on the server
    return null;
  }

  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }} className="rounded-lg shadow-md">
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

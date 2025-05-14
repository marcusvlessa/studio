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
         // Check if map is already zoomed to bounds to prevent potential loops
        if (!map.getBounds().equals(bounds, 0.01)) { // 0.01 is a tolerance
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      } else if (markers.length === 1) {
         if (map.getZoom() !== zoom || !map.getCenter().equals(L.latLng(markers[0].position))) {
           map.setView(markers[0].position, zoom);
         }
      }
    } else {
      // If no markers, set to default center and zoom if not already there
      if (map.getZoom() !== zoom || !map.getCenter().equals(L.latLng(center))) {
         map.setView(center, zoom);
      }
    }
  // Omitting `map` from dependencies as `useMap` provides a stable instance from the parent MapContainer.
  // Effect should re-run primarily based on external prop changes like markers, center, zoom.
  }, [markers, center, zoom]);
  return null;
};


const CaseMap: React.FC<CaseMapProps> = ({
  markers,
  center = [-15.7801, -47.9292], // Default center (Brasília)
  zoom = 4, // Default zoom
}) => {
  const [isClient, setIsClient] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    setIsClient(true);
    // Cleanup function to explicitly remove the map instance when the component unmounts.
    // This can help prevent the "Map container is already initialized" error,
    // especially during development with Fast Refresh / HMR.
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        // console.log("Leaflet map instance explicitly removed.");
      }
    };
  }, []);

  // The mapKey forces React to unmount and remount MapContainer when these props change,
  // which should help Leaflet re-initialize cleanly. Adding a timestamp ensures it's always unique
  // if other dependencies might not change but a re-render is still problematic.
  const mapKey = useMemo(() => {
    const centerStr = Array.isArray(center) ? center.join(',') : String(center);
    return `map-instance-${centerStr}-${zoom}-${markers.length}-${Date.now()}`;
  }, [center, zoom, markers]);


  if (!isClient) {
    return (
      <div style={{ height: '100%', width: '100%' }} className="rounded-lg shadow-md bg-muted flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Carregando Mapa...
      </div>
    );
  }

  if (markers.length === 0 && isClient) { 
     return (
      <div style={{ height: '100%', width: '100%' }} className="rounded-lg shadow-md bg-muted flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
        <MapPin className="h-10 w-10 mb-2" />
        <p className="text-sm">Nenhum marcador para exibir no mapa.</p>
      </div>
    );
  }
  
  return (
    <MapContainer
      key={mapKey} // Force re-render by changing key
      center={center}
      zoom={zoom}
      scrollWheelZoom={true}
      style={{ height: '100%', width: '100%' }}
      className="rounded-lg shadow-md"
      whenCreated={(mapInstance) => { // Callback to get the map instance
        mapRef.current = mapInstance;
        // console.log("Leaflet map instance created.");
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

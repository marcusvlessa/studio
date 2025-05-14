// src/components/dashboard/GoogleCaseMap.tsx
"use client";

import { useState, useCallback, useMemo }_from_ 'react';
import { GoogleMap, LoadScriptNext, MarkerF, InfoWindowF }_from_ '@react-google-maps/api';
import { Loader2, MapPin }_from_ 'lucide-react';
import type { GoogleMapMarkerData }_from_ '@/app/page'; // Adjust path if MapMarkerData is moved

interface GoogleCaseMapProps {
  markers: GoogleMapMarkerData[];
  center?: { lat: number; lng: number };
  zoom?: number;
  apiKey: string | undefined;
}

const mapContainerStyle = {
  height: '100%',
  width: '100%',
};

const defaultCenter = {
  lat: -15.7801, // Default center (Brasilia)
  lng: -47.9292,
};

const GoogleCaseMap: React.FC<GoogleCaseMapProps> = ({
  markers,
  center = defaultCenter,
  zoom = 4,
  apiKey,
}) => {
  const [selectedMarker, setSelectedMarker] = useState<GoogleMapMarkerData | null>(null);

  const onMarkerClick = useCallback((marker: GoogleMapMarkerData) => {
    setSelectedMarker(marker);
  }, []);

  const onInfoWindowClose = useCallback(() => {
    setSelectedMarker(null);
  }, []);

  const mapOptions = useMemo(() => ({
    disableDefaultUI: true,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  }), []);


  if (!apiKey) {
    return (
      <div style={mapContainerStyle} className="rounded-lg shadow-md bg-muted flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
        <MapPin className="h-10 w-10 mb-2 text-destructive" />
        <p className="font-semibold">Chave da API do Google Maps não configurada.</p>
        <p className="text-xs">Configure a chave `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` no seu ambiente.</p>
      </div>
    );
  }
  
  return (
    <LoadScriptNext googleMapsApiKey={apiKey} loadingElement={<div className="flex items-center justify-center h-full bg-muted rounded-lg"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Carregando mapa...</p></div>}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={markers.length > 0 ? markers[0].position : center}
        zoom={markers.length > 0 && markers.length < 5 ? 6 : zoom} // Zoom in a bit if few markers
        options={mapOptions}
      >
        {markers.map((marker) => (
          <MarkerF
            key={marker.id}
            position={marker.position}
            onClick={() => onMarkerClick(marker)}
          />
        ))}

        {selectedMarker && (
          <InfoWindowF
            position={selectedMarker.position}
            onCloseClick={onInfoWindowClose}
          >
            <div className="p-1 max-w-xs">
              <div dangerouslySetInnerHTML={{ __html: selectedMarker.popupContent }} />
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>
    </LoadScriptNext>
  );
};

export default GoogleCaseMap;

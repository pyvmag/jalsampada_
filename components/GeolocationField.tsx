"use client";

import React, { useEffect, useState, useRef } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { MapContainer, TileLayer, Marker, useMapEvents, LayersControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { FormField } from "./DynamicFormComponent";
import { cn } from "@/lib/utils";
import { FieldHelp, FieldError } from "./DynamicFormComponent";

// Fix for default marker icons in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface GeolocationFieldProps {
  field: FormField;
  disabled?: boolean;
}

const LocationMarker = ({ position, setPosition, disabled }: any) => {
  useMapEvents({
    click(e) {
      if (!disabled) {
        setPosition(e.latlng);
      }
    },
  });

  return position === null ? null : <Marker position={position}></Marker>;
};

export const GeolocationField = ({ field, disabled }: GeolocationFieldProps) => {
  const { control, setValue, watch, formState: { errors } } = useFormContext();
  
  // Watch for changes in the primary field
  const fieldValue = watch(field.name);

  // Determine initial coordinates based on the field value string or try to get current location
  const [position, setPosition] = useState<L.LatLng | null>(null);

  useEffect(() => {
    if (fieldValue && typeof fieldValue === "string") {
      try {
        const parsed = JSON.parse(fieldValue);
        if (parsed.features && parsed.features[0] && parsed.features[0].geometry) {
           const coords = parsed.features[0].geometry.coordinates; // [lng, lat]
           setPosition(new L.LatLng(coords[1], coords[0]));
        }
      } catch (e) {
         console.warn("Could not parse geolocation data:", e);
      }
    } else if (navigator.geolocation && !position) {
       navigator.geolocation.getCurrentPosition((pos) => {
          if (!fieldValue) {
             setPosition(new L.LatLng(pos.coords.latitude, pos.coords.longitude));
          }
       }, () => {
         // Default to Pune roughly if geolocation fails or is denied
         if (!fieldValue) {
            setPosition(new L.LatLng(18.5204, 73.8567));
         }
       });
    } else if (!position) {
       // Default fallback
       setPosition(new L.LatLng(18.5204, 73.8567));
    }
  }, [fieldValue]);

  const handlePositionChange = (newPosition: L.LatLng) => {
    setPosition(newPosition);
    
    // Create GeoJSON object conforming to standard representation
    const geoJson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
             point_type: "circle",
             radius: 0
          },
          geometry: {
            type: "Point",
            coordinates: [newPosition.lng, newPosition.lat]
          }
        }
      ]
    };

    setValue(field.name, JSON.stringify(geoJson), { shouldDirty: true, shouldValidate: true });

    // Also try to sync latitude and longitude fields if they exist in the model
    // This is optional but helpful if the doctype has separate lat/lng fields
    setValue("latitude", newPosition.lat, { shouldDirty: true });
    setValue("longitude", newPosition.lng, { shouldDirty: true });
  };

  const hasError = !!errors[field.name];

  return (
    <div className="form-group">
      <label htmlFor={field.name} className="form-label">
        {field.label}
        {field.required ? " *" : ""}
      </label>
      
      <div 
        className={cn(
          "map-container-wrapper relative border rounded-md overflow-hidden z-0",
          hasError ? "border-red-500" : "border-input",
          disabled ? "opacity-70 pointer-events-none" : ""
        )}
        style={{ height: "400px", width: "100%" }}
      >
        {position ? (
          <MapContainer 
            center={position} 
            zoom={13} 
            scrollWheelZoom={true} 
            style={{ height: "100%", width: "100%", zIndex: 0 }}
          >
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Map">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Satellite">
                <TileLayer
                  attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              </LayersControl.BaseLayer>
            </LayersControl>
            <LocationMarker position={position} setPosition={handlePositionChange} disabled={disabled} />
          </MapContainer>
        ) : (
          <div className="flex items-center justify-center h-full bg-muted/20 text-muted-foreground">
            Loading map...
          </div>
        )}
      </div>

      <FieldError error={(errors as any)[field.name]} />
      <FieldHelp text={field.description || "Click on the map to set the location."} />
    </div>
  );
};

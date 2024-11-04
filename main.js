import "./style.css";
import { Map, View } from "ol";
import { OSM, TileWMS, Vector as VectorSource } from "ol/source";
import { Tile as TileLayer, Vector as VectorLayer, Group as LayerGroup } from "ol/layer";
import GeoJSON from "ol/format/GeoJSON";
import { fromLonLat, transformExtent } from "ol/proj";
import { ScaleLine, FullScreen, ZoomToExtent, Control, MousePosition, defaults as defaultControls } from "ol/control";
import LayerSwitcher from "ol-layerswitcher";
import Overlay from "ol/Overlay";
import { Style, Stroke, Fill } from "ol/style";
import "ol-layerswitcher/dist/ol-layerswitcher.css";
import { format } from "ol/coordinate";

// Configuración de la vista inicial (centrada en España)
const spainCenter = fromLonLat([-3.7038, 40.4168]); // Coordenadas aproximadas de Madrid
const spainExtent = transformExtent([-10, 35, 5, 44], "EPSG:4326", "EPSG:3857"); // Aproximación del área de España

// Configuración de las capas base (OSM, PNOA y MTN50)
const osmLayer = new TileLayer({
  title: "OpenStreetMap",
  source: new OSM(),
  type: "base",
  visible: true, // Visible por defecto
});

const pnoaLayer = new TileLayer({
  title: "PNOA",
  source: new TileWMS({
    url: "https://www.ign.es/wms-inspire/pnoa-ma?",
    params: { LAYERS: "OI.OrthoimageCoverage", TILED: true },
    attributions: '© <a href="https://www.ign.es/web/ign/portal">Instituto Geográfico Nacional</a>',
  }),
  type: "base",
  visible: false,
});

const mtn50Layer = new TileLayer({
  title: "MTN50",
  source: new TileWMS({
    url: "https://www.ign.es/wms/primera-edicion-mtn",
    params: { LAYERS: "MTN50", TILED: true },
    attributions: '© <a href="https://www.ign.es/web/ign/portal">Instituto Geográfico Nacional</a>',
  }),
  type: "base",
  visible: false,
});

// 03.6 Control personalizado
class InfoControl extends Control {
  constructor(opt_options) {
    const options = opt_options || {};

    const button = document.createElement("button");
    button.innerHTML = "I";

    const element = document.createElement("div");
    element.className = "info-control ol-unselectable ol-control";
    element.appendChild(button);

    super({
      element: element,
      target: options.target,
    });

    button.addEventListener("click", this.handleInfo.bind(this), false);
  }

  handleInfo() {
    let map = this.getMap();
    let currentExtent = map.getView().calculateExtent(map.getSize());
    let projectionCode = map.getView().getProjection().code_;
    let extent4326 = transformExtent(
      currentExtent,
      projectionCode,
      "EPSG:4326"
    );

    alert(`Extensión de la vista actual (4326): ${extent4326.toString()}`);
  }
}

const infoControl = new InfoControl();

// 03.3 Mouse position control. Modificación de CSS. Añadir subclase format
const mousePositionControl = new MousePosition({
  coordinateFormat: (coordinate) => {
    return format(coordinate, "Lat: {y}, Long: {x}", 4);
  },
  projection: "EPSG:4326",
  className: "coordinate_display",
});

// Botón de zoom a la extensión de La Coruña
const zoomToCorunaControl = new ZoomToExtent({
  extent: transformExtent([-8.4125, 43.3623, -8.3558, 43.385], "EPSG:4326", "EPSG:3857"),
});

// Barra de Escala
const scaleControl = new ScaleLine({
  units: "metric",
  bar: true, // Representa la escala gráfica con intervalos
  steps: 4, // Divisiones
  //text: true, // Valor de escala
  minWidth: 140, // Ancho mínimo
});

// Grupo de capas base
const baseMaps = new LayerGroup({
  title: "Mapas base",
  layers: [osmLayer, pnoaLayer, mtn50Layer],
});

// Función de estilo basada en el campo 'agrupacion'
const caminosAgrupacionStyle = (feature) => {
  const agrupacion = feature.get("agrupacion"); // Obtener el valor del campo 'agrupacion'
  
  // Definir colores según el valor de 'agrupacion'
  let color;
  switch (agrupacion) {
    case "grupo1":
      color = "#FF5733"; // Color para el grupo 1
      break;
    case "grupo2":
      color = "#33FF57"; // Color para el grupo 2
      break;
    case "grupo3":
      color = "#3357FF"; // Color para el grupo 3
      break;
    default:
      color = "#FF33A1"; // Color por defecto si no hay coincidencia
      break;
  }

  // Retornar el estilo según el color definido
  return new Style({
    stroke: new Stroke({
      color: color,
      width: 3,
    }),
    fill: new Fill({
      color: color,
    }),
  });
};

// Capa de Caminos de Santiago con estilo basado en 'agrupacion'
const caminosLayer = new VectorLayer({
  title: "Caminos de Santiago",
  source: new VectorSource({
    url: "./data/caminos_santiago.geojson", // Ruta del archivo GeoJSON
    format: new GeoJSON(),
  }),
  style: caminosAgrupacionStyle, // Aplicamos la función de estilo
  visible: true,
});

// Grupo de capas superpuestas
const overlays = new LayerGroup({
  title: "Capas",
  layers: [caminosLayer], // Puedes añadir más capas aquí si es necesario
});

// Configuración del pop-up
const popupContainer = document.getElementById("popup");
const popupContent = document.getElementById("popup-content");
const popupCloser = document.getElementById("popup-closer");

// Cerrar el pop-up
popupCloser.onclick = function () {
  overlay.setPosition(undefined);
  popupCloser.blur();
  return false;
};

// Crear overlay para el pop-up
const overlay = new Overlay({
  element: popupContainer,
  autoPan: true,
  autoPanAnimation: {
    duration: 250,
  },
});

// Añadir el overlay al mapa
const map = new Map({
  target: "map",
  layers: [baseMaps, overlays], // Incluye ambos grupos de capas
  view: new View({
    center: spainCenter,
    zoom: 6,
    maxZoom: 16,
    minZoom: 4,
    extent: spainExtent,
  }),
  controls: defaultControls().extend([new FullScreen(), mousePositionControl, zoomToCorunaControl, scaleControl, infoControl]),
  overlays: [overlay],
});

// Evento para abrir el pop-up al hacer clic en la capa de Caminos de Santiago
map.on("singleclick", function (evt) {
  let featureFound = false;

  // Buscar las características en el píxel donde se hizo clic
  map.forEachFeatureAtPixel(evt.pixel, function (feature) {
    if (feature.get("nombre")) { // Aquí se asume que hay un atributo "nombre"
      const nombre = feature.get("nombre"); // Obtener el nombre del camino
      const longitud = feature.get("longitud"); // Obtener longitud (ajusta según los atributos reales)
      
      // Mostrar la información en el pop-up
      popupContent.innerHTML = `<h3>Camino de Santiago</h3>
                                <p><b>Nombre:</b> ${nombre}</p>
                                <p><b>Longitud:</b> ${longitud} km</p>`;
      overlay.setPosition(evt.coordinate);
      featureFound = true;
    }
  });

  if (!featureFound) {
    overlay.setPosition(undefined); // Cerrar el pop-up si no se encontró ninguna característica
  }
});

// Control de cambio de capas
const layerSwitcher = new LayerSwitcher({
  tipLabel: "Leyenda", // Texto de tooltip para el control
});
map.addControl(layerSwitcher);

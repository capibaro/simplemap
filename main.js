import './style.css';
import Feature from 'ol/Feature';
import Map from 'ol/Map';
import Point from 'ol/geom/Point';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import View from 'ol/View';
import {Circle as CircleStyle, Fill, Icon, Stroke, Style} from 'ol/style';
import {Tile as TileLayer, Vector as VectorLayer} from 'ol/layer';
import {getVectorContext} from 'ol/render';
import Overlay from 'ol/Overlay';
import {toLonLat, transform, transformExtent} from 'ol/proj';
import {Control, FullScreen, defaults as defaultControls, ScaleLine} from 'ol/control';
import {toStringHDMS} from 'ol/coordinate';
import LineString from 'ol/geom/LineString';

const key = '5b3ce3597851110001cf6248327831cfba664fa09cc5f53a231a7882';
const direction_url = 'https://api.openrouteservice.org/v2/directions/driving-car?api_key=' + key;
// const duration_url = 'https://www.capibaro.ink/predict'
const duration_url = 'http://127.0.0.1:5000/predict'

class ResetMapControl extends Control {
  constructor(opt_options) {
    const options = opt_options || {};

    const button = document.createElement('button');
    button.innerHTML = '↻';

    const element = document.createElement('div');
    element.className = 'reset-map ol-unselectable ol-control';
    element.appendChild(button);

    super({
      element: element,
      target: options.target,
    });

    button.addEventListener('click', this.handleResetMap.bind(this), false);
  }

  handleResetMap() {
    this.getMap().getView().setCenter(transform([104.06385, 30.660467], 'EPSG:4326', 'EPSG:3857'))
    this.getMap().getView().setZoom(14)
  }
}

const last_click = new Feature({
  geometry: null
})
last_click.setStyle(
  new Style({
    image: new Icon({
      crossOrigin: 'anonymous',
      // For Internet Explorer 11
      imgSize: [20, 20],
      src: 'data/dot.svg',
    }),
  })
);

const start = new Feature({
  geometry: null
})
start.setStyle(
  new Style({
    image: new Icon({
      color: '#BADA55',
      crossOrigin: 'anonymous',
      // For Internet Explorer 11
      imgSize: [20, 20],
      src: 'data/dot.svg',
    }),
  })
);

const end = new Feature({
  geometry: null
})
end.setStyle(
  new Style({
    image: new Icon({
      color: 'rgba(255, 0, 0, .5)',
      crossOrigin: 'anonymous',
      // For Internet Explorer 11
      imgSize: [20, 20],
      src: 'data/dot.svg',
    }),
  })
);

const lineStyle = new Style({
  stroke: new Stroke({
    width: 6,
    color: 'rgba(255, 0, 0, .5)',
  }),
});

const markerStyle = new Style({
  image: new CircleStyle({
    radius: 7,
    fill: new Fill({color: 'black'}),
    stroke: new Stroke({
      color: 'white',
      width: 2,
    }),
  }),
})

const marker = new Feature({
  geometry: null
})
marker.setStyle(markerStyle);

const vectorLayer1 = new VectorLayer({
  source: new VectorSource({
    features: [last_click, start, end, marker],
  }),
});

const vectorLayer2 = new VectorLayer({
  source: new VectorSource({
    features: [],
  }),
});

const container = document.getElementById('popup');
const content = document.getElementById('popup-content');
const closer = document.getElementById('popup-closer');

const overlay = new Overlay({
  element: container,
  autoPan: {
    animation: {
      duration: 250,
    },
  },
});

closer.onclick = function () {
  overlay.setPosition(undefined);
  closer.blur();
  return false;
};

const map = new Map({
  controls: defaultControls().extend([
    new FullScreen(),
    new ResetMapControl(),
    new ScaleLine({
      units: 'metric',
    })
  ]),
  layers: [
    new TileLayer({
      source: new OSM(),
    }),
    vectorLayer2,
    vectorLayer1,
  ],
  overlays: [overlay],
  target: 'map',
  view: new View({
    center: transform([104.06385, 30.660467], 'EPSG:4326', 'EPSG:3857'),
    extent: transformExtent([102.9, 30.09, 104.9, 31.44], 'EPSG:4326', 'EPSG:3857'),
    zoom: 14,
    minZoom: 10,
    maxZoom: 18
  }),
});

map.on('singleclick', function (evt) {
  const coordinate = evt.coordinate;
  const hdms = toStringHDMS(toLonLat(coordinate));

  content.innerHTML = '<p>You clicked here:</p><code>' + hdms + '</code>';
  overlay.setPosition(coordinate);

  last_click.setGeometry(new Point(coordinate))
});

const setStart = document.getElementById('set-start');
setStart.addEventListener('click', function () {
  if (last_click.getGeometry() == null) {
    alert('No place has been chosen! Please click somewhere first.')
  }
  start.setGeometry(last_click.getGeometry())
});

const setEnd = document.getElementById('set-end');
setEnd.addEventListener('click', function () {
  if (last_click.getGeometry() == null) {
    alert('No place has been chosen! Please click somewhere first.')
  }
  end.setGeometry(last_click.getGeometry())
});

const directionButton = document.getElementById('get-direction');
directionButton.addEventListener('click', function() {
  if (directing == false) {
    getDirection();
    directing = true;
  } else {
    clearDirction();
    directing = false;
  }
})

let directing = false;

let coords, lineGeometry, position, dist;

function getDirection() {
  if (start.getGeometry() == null) {
    alert('Start not set! Please click somewhere then set it as start.')
    return
  }
  let startCoord = transform(start.getGeometry().getCoordinates(), 'EPSG:3857','EPSG:4326')
  if (end.getGeometry() == null) {
    alert('End not set! Please click somewhere then set it as end.')
    return
  }
  let endCoord = transform(end.getGeometry().getCoordinates(), 'EPSG:3857','EPSG:4326')
  let request = direction_url + '&start=' + startCoord[0] + ',' + startCoord[1] + '&end=' + endCoord[0] +  ',' + endCoord[1];
  fetch(request).then(function (response) {
    response.json().then(function (result) {
      dist = result.features[0].properties.summary.distance
      coords = result.features[0].geometry.coordinates;
      lineGeometry = new LineString(coords).transform('EPSG:4326', 'EPSG:3857');
      let lineFeature = new Feature({
        geometry: lineGeometry,
      });
      lineFeature.setStyle(lineStyle);
      vectorLayer2.getSource().addFeature(lineFeature);
      marker.setGeometry(new Point(coords[0]))
      position = marker.getGeometry().clone();
      directionButton.textContent = 'Clear Direction';
      overlay.setPosition(undefined);
      distance = 0;
    })
  }).catch(error => {
    console.error('error while fetching dirction:', error)
  })
}

function clearDirction() {
  last_click.setGeometry(null);
  start.setGeometry(null);
  end.setGeometry(null);
  marker.setGeometry(null);
  vectorLayer2.getSource().clear();
  directionButton.textContent = 'Get Direction';
  distanceSpan.style.visibility = 'hidden';
  durationSpan.style.visibility = 'hidden';
  // speedLabel.style.visibility = 'hidden';
}

const durationButtion = document.getElementById('get-duration');
durationButtion.addEventListener('click', function() {
  getDuration();
})

const distanceSpan = document.getElementById('distance');
const durationSpan = document.getElementById('duration');
// const speedLabel = document.getElementById('speed');

let pred_time;

function formatTime(seconds) {
  let minute = Math.floor(seconds / 60);
  let second = seconds - minute * 60;
  return minute + ' min ' + second + ' s';
}

function getDuration() {
  if (directing) {
    let data = {
      'coords': coords,
      'distance': dist / 1000,
    };
    console.log(JSON.stringify(data))
    fetch(duration_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }).then(response => response.json())
      .then(data => {
        console.log(data)
        distanceSpan.innerHTML = '<button>Distance: <code>' + (dist / 1000).toFixed(1) + ' km' + '</code></button>'
        distanceSpan.style.visibility = 'visible';
        pred_time = parseInt(data.time);
        durationSpan.innerHTML = '<button>Duration: <code>' + formatTime(pred_time) + '</code></button>'
        durationSpan.style.visibility = 'visible';
        // speedLabel.style.visibility = 'visible';
        lastDistance = 0;
      }).catch(error => {
        console.error('There has been a problem with duration fetch:', error)
      })
  }
  else {
    alert('Do not hava any direction yet! Please get a direction first.')
  }
}

// const speedInput = document.getElementById('input-speed');
const startButton = document.getElementById('start-animation');
let animating, distance, lastTime, lastDistance;

function moveFeature(event) {
  // const speed = Number(speedInput.value);
  const speed = 60;
  const time = event.frameState.time;
  const elapsedTime = time - lastTime;
  distance = (distance + (speed * elapsedTime) / 1e6) % 2;
  lastTime = time;
  if (distance >= 1) {
    distanceSpan.innerHTML = '<button>Distance: <code>0.0 km</code></button>'
    durationSpan.innerHTML = '<button>Duration: <code>0 min 0 s</code></button>'
    stopAnimation()
    return
  }
  if (distance-lastDistance > 100 / dist) {
    let currentDistance = (dist / 1000 * (1 - distance)).toFixed(1)
    if (currentDistance < 0) {currentDistance = 0.0}
    distanceSpan.innerHTML = '<button>Distance: <code>' + currentDistance + ' km' + '</code></button>'
    let currentDuration = Math.round(pred_time * (1 - distance))
    if (currentDuration < 0) {currentDuration = 0}
    durationSpan.innerHTML = '<button>Duration: <code>' + formatTime(currentDuration) + '</code></button>'
    lastDistance = distance
  }
  const currentCoordinate = lineGeometry.getCoordinateAt(distance);
  position.setCoordinates(currentCoordinate);
  const vectorContext = getVectorContext(event);
  vectorContext.setStyle(markerStyle);
  vectorContext.drawGeometry(position);
  // tell OpenLayers to continue the postrender animation
  map.render();
}

function startAnimation() {
  animating = true;
  lastTime = Date.now();
  startButton.textContent = 'Stop Animation';
  vectorLayer2.on('postrender', moveFeature);
  // hide geoMarker and trigger map render through change event
  marker.setGeometry(null);
}

function stopAnimation() {
  animating = false;
  startButton.textContent = 'Start Animation';

  // Keep marker at current animation position
  marker.setGeometry(position);
  vectorLayer2.un('postrender', moveFeature);
}

startButton.addEventListener('click', function () {
  if (directing) {
    if (animating) {
      stopAnimation();
    } else {
      startAnimation();
    }
  }
  else {
    alert('Do not hava any direction yet! Please get a direction first.')
  }
});
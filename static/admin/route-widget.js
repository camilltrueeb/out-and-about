(function () {
  var h = window.h;
  var createClass = window.createClass;

  function loadScript(src) {
    return new Promise(function (resolve) {
      if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }

  function loadCSS(href) {
    if (!document.querySelector('link[href="' + href + '"]')) {
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      document.head.appendChild(l);
    }
  }

  function loadLeaflet() {
    loadCSS('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
    loadCSS('https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css');
    return loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js').then(function () {
      return loadScript('https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js');
    });
  }

  var RouteDrawerControl = createClass({
    getInitialState: function () {
      return { open: false };
    },

    // Instance refs (not React state — no re-render needed)
    mapContainer: null,
    leafletMap: null,
    drawnItems: null,

    setMapContainer: function (el) {
      this.mapContainer = el;
      if (el && this.state.open && !this.leafletMap) {
        this.initMap();
      }
    },

    toggleOpen: function () {
      var self = this;
      this.setState(function (s) { return { open: !s.open }; }, function () {
        if (!self.state.open && self.leafletMap) {
          self.leafletMap.remove();
          self.leafletMap = null;
          self.drawnItems = null;
        }
      });
    },

    clearRoute: function () {
      this.props.onChange('');
      if (this.drawnItems) this.drawnItems.clearLayers();
    },

    initMap: function () {
      var self = this;
      loadLeaflet().then(function () {
        if (!self.state.open || !self.mapContainer || self.leafletMap) return;
        var L = window.L;
        var map = L.map(self.mapContainer).setView([46.8, 8.2], 8);
        self.leafletMap = map;

        var attrib = '&copy; <a href="https://www.swisstopo.admin.ch" target="_blank">swisstopo</a>';
        function wmts(id) {
          return L.tileLayer(
            'https://wmts.geo.admin.ch/1.0.0/' + id + '/default/current/3857/{z}/{x}/{y}.jpeg',
            { attribution: attrib, maxZoom: 18 }
          );
        }
        var baseLayers = {
          'Landeskarte': wmts('ch.swisstopo.pixelkarte-farbe'),
          'Luftbild':    wmts('ch.swisstopo.swissimage'),
          'Karte grau':  wmts('ch.swisstopo.pixelkarte-grau'),
        };
        baseLayers['Landeskarte'].addTo(map);
        function ovlay(id) {
          return L.tileLayer(
            'https://wmts.geo.admin.ch/1.0.0/' + id + '/default/current/3857/{z}/{x}/{y}.png',
            { attribution: attrib, maxZoom: 18, opacity: 0.9 }
          );
        }
        var overlays = {
          'Wanderwege': ovlay('ch.astra.wanderland'),
          'Veloland':   ovlay('ch.astra.veloland'),
        };
        L.control.layers(baseLayers, overlays, { position: 'topright' }).addTo(map);
        map.getPanes().overlayPane.style.filter = 'drop-shadow(0 0 2px rgba(0,0,0,0.85))';

        var drawnItems = new L.FeatureGroup();
        self.drawnItems = drawnItems;
        map.addLayer(drawnItems);

        var value = self.props.value;
        if (value && value.trim()) {
          try {
            L.geoJSON(JSON.parse(value), { style: { color: '#a855f7', weight: 5 } })
              .eachLayer(function (l) { drawnItems.addLayer(l); });
            if (drawnItems.getLayers().length > 0) {
              map.fitBounds(drawnItems.getBounds(), { padding: [20, 20] });
            }
          } catch (e) { /* ignore invalid json */ }
        }

        var drawControl = new L.Control.Draw({
          draw: {
            polyline: { shapeOptions: { color: '#a855f7', weight: 5 }, metric: true },
            polygon: false,
            rectangle: false,
            circle: false,
            circlemarker: false,
            marker: false
          },
          edit: { featureGroup: drawnItems }
        });
        map.addControl(drawControl);

        map.on(L.Draw.Event.CREATED, function (e) {
          drawnItems.clearLayers();
          drawnItems.addLayer(e.layer);
          self.props.onChange(JSON.stringify(drawnItems.toGeoJSON()));
        });
        map.on(L.Draw.Event.EDITED, function () {
          self.props.onChange(JSON.stringify(drawnItems.toGeoJSON()));
        });
        map.on(L.Draw.Event.DELETED, function () {
          self.props.onChange('');
        });
      });
    },

    componentWillUnmount: function () {
      if (this.leafletMap) { this.leafletMap.remove(); this.leafletMap = null; }
    },

    render: function () {
      var self = this;
      var value = this.props.value;
      var open = this.state.open;
      var hasRoute = !!(value && value.trim());

      return h('div', null,
        h('div', {
          style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }
        },
          h('span', { style: { fontSize: '0.9rem', color: hasRoute ? '#2d6a4f' : '#888' } },
            hasRoute ? '✓ Route gespeichert' : 'Keine Route'
          ),
          h('button', {
            type: 'button',
            onClick: self.toggleOpen,
            style: {
              padding: '5px 14px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              cursor: 'pointer',
              background: open ? '#f0f0f0' : 'white',
              fontSize: '0.85rem'
            }
          }, open ? 'Karte schliessen' : (hasRoute ? 'Route bearbeiten' : 'Route zeichnen')),
          hasRoute ? h('button', {
            type: 'button',
            onClick: self.clearRoute,
            style: {
              padding: '5px 12px',
              borderRadius: '6px',
              border: '1px solid #fcc',
              cursor: 'pointer',
              color: '#c0392b',
              fontSize: '0.85rem',
              background: 'white'
            }
          }, 'Route löschen') : null
        ),
        open ? h('div', {
          ref: self.setMapContainer,
          style: {
            height: '420px',
            width: '100%',
            borderRadius: '6px',
            border: '1px solid #ddd',
            overflow: 'hidden'
          }
        }) : null
      );
    }
  });

  function RouteDrawerPreview(props) {
    var value = props.value;
    if (!value) return h('p', { style: { color: '#888' } }, 'Keine Route');
    try {
      var gj = JSON.parse(value);
      var features = gj.features || (gj.type === 'Feature' ? [gj] : []);
      var pts = features.reduce(function (acc, f) {
        return acc + ((f.geometry && Array.isArray(f.geometry.coordinates)) ? f.geometry.coordinates.length : 0);
      }, 0);
      return h('p', null, 'Route: ' + pts + ' Punkte');
    } catch (e) {
      return h('p', null, 'Route vorhanden');
    }
  }

  window.CMS.registerWidget('route-drawer', RouteDrawerControl, RouteDrawerPreview);
}());

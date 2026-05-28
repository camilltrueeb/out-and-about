(function () {
  var h = window.h;
  var createClass = window.createClass;
  var ORS_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjA1NDQ4NDY3MmM2NTRmZjFiZWZiMDY0NzM1NjFjNDg1IiwiaCI6Im11cm11cjY0In0=';

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
    return loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
  }

  var RouteDrawerControl = createClass({
    getInitialState: function () {
      this.mapContainer = null;
      this.leafletMap = null;
      this.waypoints = [];
      this.segments = [];
      this.segmentLayers = [];
      this.markerLayers = [];
      this.existingLayer = null;
      return { open: false, loading: false, error: null, hasDrawing: false };
    },

    setMapContainer: function (el) {
      this.mapContainer = el;
      if (el && this.state.open && !this.leafletMap) this.initMap();
    },

    toggleOpen: function () {
      var self = this;
      this.setState(function (s) { return { open: !s.open }; }, function () {
        if (!self.state.open && self.leafletMap) {
          self.leafletMap.remove();
          self.leafletMap = null;
          self.waypoints = [];
          self.segments = [];
          self.segmentLayers = [];
          self.markerLayers = [];
          self.existingLayer = null;
        }
      });
    },

    clearRoute: function () {
      this.props.onChange('');
      this.waypoints = [];
      this.segments = [];
      if (this.leafletMap) {
        this.segmentLayers.forEach(function (l) { l.remove(); });
        this.markerLayers.forEach(function (l) { l.remove(); });
        if (this.existingLayer) { this.existingLayer.remove(); this.existingLayer = null; }
      }
      this.segmentLayers = [];
      this.markerLayers = [];
      this.setState({ error: null, hasDrawing: false });
    },

    undoSegment: function () {
      if (this.waypoints.length === 0) return;

      if (this.segments.length === 0) {
        var m = this.markerLayers.pop();
        if (m) m.remove();
        this.waypoints.pop();
        this.setState({ hasDrawing: this.waypoints.length > 0 });
        return;
      }

      var line = this.segmentLayers.pop();
      if (line) line.remove();
      this.segments.pop();
      var marker = this.markerLayers.pop();
      if (marker) marker.remove();
      this.waypoints.pop();

      this.saveRoute();
      this.setState({ hasDrawing: this.waypoints.length > 0 });
    },

    addWaypointMarker: function (latlng) {
      this.waypoints.push(latlng);
      var L = window.L;
      var m = L.circleMarker(latlng, {
        radius: 5, color: '#a855f7', fillColor: 'white', fillOpacity: 1, weight: 2
      }).addTo(this.leafletMap);
      this.markerLayers.push(m);
    },

    routeSegment: function (from, to) {
      var self = this;
      var start = from.lng.toFixed(6) + ',' + from.lat.toFixed(6);
      var end   = to.lng.toFixed(6)   + ',' + to.lat.toFixed(6);

      self.setState({ loading: true, error: null });

      fetch('https://api.openrouteservice.org/v2/directions/foot-hiking?api_key=' + ORS_KEY + '&start=' + start + '&end=' + end)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var coords = data.features && data.features[0] &&
                       data.features[0].geometry && data.features[0].geometry.coordinates;
          if (!coords || coords.length === 0) throw new Error('empty');

          var L = window.L;
          var latlngs = coords.map(function (c) { return [c[1], c[0]]; });
          var line = L.polyline(latlngs, { color: '#a855f7', weight: 4, opacity: 0.9 }).addTo(self.leafletMap);
          self.segmentLayers.push(line);
          self.segments.push(coords);
          self.addWaypointMarker(to);
          self.saveRoute();
          self.setState({ loading: false, hasDrawing: true });
        })
        .catch(function () {
          self.setState({ loading: false, error: 'Keine Route gefunden — anderen Punkt wählen.' });
        });
    },

    saveRoute: function () {
      if (this.segments.length === 0) { this.props.onChange(''); return; }
      var allCoords = [];
      this.segments.forEach(function (seg, i) {
        allCoords = allCoords.concat(i === 0 ? seg : seg.slice(1));
      });
      this.props.onChange(JSON.stringify({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: allCoords } }]
      }));
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
        map.getContainer().style.cursor = 'crosshair';

        // Show existing route (display only — cleared on first click)
        var value = self.props.value;
        if (value && value.trim()) {
          try {
            self.existingLayer = L.geoJSON(JSON.parse(value), { style: { color: '#a855f7', weight: 4 } }).addTo(map);
            var bounds = self.existingLayer.getBounds();
            if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
          } catch (e) {}
        }

        map.on('click', function (e) {
          if (self.state.loading) return;

          // Clear existing displayed route on first click
          if (self.existingLayer) {
            self.existingLayer.remove();
            self.existingLayer = null;
          }

          if (self.waypoints.length === 0) {
            self.addWaypointMarker(e.latlng);
            self.setState({ hasDrawing: true });
          } else {
            self.routeSegment(self.waypoints[self.waypoints.length - 1], e.latlng);
          }
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
      var loading = this.state.loading;
      var error = this.state.error;
      var hasRoute = !!(value && value.trim());
      var hasDrawing = this.state.hasDrawing;

      return h('div', null,
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' } },
          h('span', { style: { fontSize: '0.9rem', color: hasRoute ? '#2d6a4f' : '#888' } },
            hasRoute ? '✓ Route gespeichert' : 'Keine Route'
          ),
          h('button', {
            type: 'button',
            onClick: self.toggleOpen,
            style: { padding: '5px 14px', borderRadius: '6px', border: '1px solid #ccc', cursor: 'pointer', background: open ? '#f0f0f0' : 'white', fontSize: '0.85rem' }
          }, open ? 'Karte schliessen' : (hasRoute ? 'Route bearbeiten' : 'Route zeichnen')),
          hasRoute || hasDrawing ? h('button', {
            type: 'button',
            onClick: self.clearRoute,
            style: { padding: '5px 12px', borderRadius: '6px', border: '1px solid #fcc', cursor: 'pointer', color: '#c0392b', fontSize: '0.85rem', background: 'white' }
          }, 'Route löschen') : null,
          hasDrawing ? h('button', {
            type: 'button',
            onClick: self.undoSegment,
            disabled: loading,
            style: { padding: '5px 12px', borderRadius: '6px', border: '1px solid #ccc', cursor: loading ? 'default' : 'pointer', fontSize: '0.85rem', background: 'white' }
          }, '↩ Rückgängig') : null,
          loading ? h('span', { style: { fontSize: '0.85rem', color: '#666' } }, 'Route berechnen…') : null,
          error   ? h('span', { style: { fontSize: '0.85rem', color: '#c0392b' } }, error) : null
        ),
        open ? h('p', { style: { fontSize: '0.8rem', color: '#888', margin: '0 0 6px' } },
          'Auf die Karte klicken um Wegpunkte zu setzen — die Route folgt automatisch den Wanderwegen.'
        ) : null,
        open ? h('div', {
          ref: self.setMapContainer,
          style: { height: '420px', width: '100%', borderRadius: '6px', border: '1px solid #ddd', overflow: 'hidden' }
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

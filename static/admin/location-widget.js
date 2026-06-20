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
    loadCSS('https://unpkg.com/leaflet-control-geocoder@2.4.0/dist/Control.Geocoder.css');
    if (!document.getElementById('geocoder-color-fix')) {
      var s = document.createElement('style');
      s.id = 'geocoder-color-fix';
      s.textContent = '.leaflet-control-geocoder-form input { color: #000 !important; }';
      document.head.appendChild(s);
    }
    return loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js').then(function () {
      return loadScript('https://unpkg.com/leaflet-control-geocoder@2.4.0/dist/Control.Geocoder.js');
    });
  }

  var LocationPickerControl = createClass({
    getInitialState: function () {
      this.mapContainer = null;
      this.leafletMap = null;
      this.marker = null;
      try {
        var val = this.props.value;
        if (val && val.trim()) window.__cms_location_value = val.trim();
      } catch (e) {}
      return { open: false };
    },

    setMapContainer: function (el) {
      this.mapContainer = el;
      if (el && !this.leafletMap) this.initMap();
    },

    toggleOpen: function () {
      var self = this;
      this.setState(function (s) { return { open: !s.open }; }, function () {
        if (!self.state.open && self.leafletMap) {
          self.leafletMap.remove();
          self.leafletMap = null;
          self.marker = null;
        }
      });
    },

    clearLocation: function () {
      this.props.onChange('');
      if (this.marker && this.leafletMap) {
        this.marker.remove();
        this.marker = null;
      }
      try { window.__cms_location_value = ''; } catch (e) {}
    },

    initMap: function () {
      var self = this;
      loadLeaflet().then(function () {
        if (!self.mapContainer || self.leafletMap) return;
        var L = window.L;

        var attrib = '&copy; <a href="https://www.swisstopo.admin.ch" target="_blank">swisstopo</a>';
        var wmts = function (id) {
          return L.tileLayer(
            'https://wmts.geo.admin.ch/1.0.0/' + id + '/default/current/3857/{z}/{x}/{y}.jpeg',
            { attribution: attrib, maxZoom: 18 }
          );
        };
        var baseLayers = {
          'Landeskarte':    wmts('ch.swisstopo.pixelkarte-farbe'),
          'Weltkarte':      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                              maxZoom: 19,
                            }),
          'Weltkarte Topo': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://opentopomap.org/">OpenTopoMap</a>',
                              subdomains: 'abc', maxZoom: 17,
                            }),
          'Luftbild':       L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                              attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a>',
                              maxZoom: 19,
                            }),
        };

        var map = L.map(self.mapContainer, { layers: [baseLayers['Landeskarte']] })
          .setView([46.8, 8.2], 8);
        L.control.layers(baseLayers, {}, { position: 'topright' }).addTo(map);
        L.Control.geocoder({ defaultMarkGeocode: false, position: 'topleft' })
          .on('markgeocode', function (e) { map.setView(e.geocode.center, 13); })
          .addTo(map);
        setTimeout(function () { map.invalidateSize(); }, 50);
        self.leafletMap = map;

        var val = self.props.value;
        if (val && val.trim()) {
          var parts = val.split(',');
          var lat = parseFloat(parts[0]);
          var lon = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lon)) {
            self.marker = L.marker([lat, lon]).addTo(map);
            map.setView([lat, lon], 13);
            try { window.__cms_location_value = lat + ',' + lon; } catch (e) {}
          }
        }

        map.on('click', function (e) {
          var lat = e.latlng.lat.toFixed(6);
          var lon = e.latlng.lng.toFixed(6);
          if (self.marker) {
            self.marker.setLatLng(e.latlng);
          } else {
            self.marker = L.marker(e.latlng).addTo(map);
          }
          self.props.onChange(lat + ',' + lon);
          try { window.__cms_location_value = lat + ',' + lon; } catch (e) {}
        });
      });
    },

    componentWillUnmount: function () {
      if (this.leafletMap) { this.leafletMap.remove(); this.leafletMap = null; }
    },

    render: function () {
      var val = this.props.value;
      var hasVal = val && val.trim();
      var displayVal = '';
      if (hasVal) {
        var parts = val.split(',');
        var lat = parseFloat(parts[0]), lon = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lon)) displayVal = lat.toFixed(4) + ', ' + lon.toFixed(4);
      }

      return h('div', { style: { fontFamily: 'sans-serif' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' } },
          h('button', {
            type: 'button',
            onClick: this.toggleOpen,
            style: { padding: '6px 12px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', background: '#fff' }
          }, this.state.open ? 'Karte schliessen' : (hasVal ? 'Standort bearbeiten' : 'Standort setzen')),
          hasVal && h('span', { style: { fontSize: '13px', color: '#333' } }, '📍 ' + displayVal),
          hasVal && h('button', {
            type: 'button',
            onClick: this.clearLocation,
            style: { padding: '4px 8px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ddd', color: '#c00', fontSize: '12px', background: '#fff' }
          }, 'Löschen')
        ),
        this.state.open && h('div', {
          ref: this.setMapContainer.bind(this),
          style: { height: '350px', border: '1px solid #ccc', borderRadius: '4px' }
        }),
        this.state.open && h('p', { style: { fontSize: '12px', color: '#888', marginTop: '4px' } },
          'Auf die Karte klicken um den Standort zu setzen.'
        )
      );
    }
  });

  var LocationPickerPreview = createClass({
    render: function () {
      var val = this.props.value;
      if (!val || !val.trim()) return h('span', {}, 'Kein Standort');
      var parts = val.split(',');
      var lat = parseFloat(parts[0]), lon = parseFloat(parts[1]);
      if (isNaN(lat) || isNaN(lon)) return h('span', {}, 'Ungültiger Standort');
      return h('span', {}, '📍 ' + lat.toFixed(4) + ', ' + lon.toFixed(4));
    }
  });

  CMS.registerWidget('location-picker', LocationPickerControl, LocationPickerPreview);
})();

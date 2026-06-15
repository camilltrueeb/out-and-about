(function () {
  var h = window.h;
  var createClass = window.createClass;

  var CLOUD_NAME = 'dx2yckdac';
  var ASSETS_URL = '/.netlify/functions/cloudinary-assets';

  // ── Cloudinary thumbnail URL (200×200, avoids loading full-size in picker) ──

  function thumb(url) {
    return url.replace('/upload/', '/upload/w_200,h_200,c_fill/');
  }

  // ── Upload Widget ─────────────────────────────────────────────────────────

  function openUploadWidget(callback) {
    function doOpen() {
      var newUrls = [];
      window.cloudinary.openUploadWidget(
        {
          cloudName    : CLOUD_NAME,
          uploadPreset : 'outandabout_admin',
          multiple     : true,
          maxFiles     : 20,
          resourceType : 'image',
          sources      : ['local', 'url', 'camera'],
        },
        function (error, result) {
          if (error || !result) return;
          if (result.event === 'success') newUrls.push(result.info.secure_url);
          if (result.event === 'queues-end' && newUrls.length > 0) callback(newUrls);
        }
      );
    }
    if (window.cloudinary && window.cloudinary.openUploadWidget) {
      doOpen();
    } else {
      var s = document.createElement('script');
      s.src = 'https://upload-widget.cloudinary.com/global/all.js';
      s.onload = doOpen;
      document.head.appendChild(s);
    }
  }

  // ── Library Picker overlay ────────────────────────────────────────────────

  function openLibraryPicker(callback) {
    // overlay
    var overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
      background: 'rgba(0,0,0,0.55)', zIndex: '99999',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    // panel
    var panel = document.createElement('div');
    Object.assign(panel.style, {
      background: 'white', borderRadius: '10px',
      width: '90vw', maxWidth: '860px', maxHeight: '82vh',
      display: 'flex', flexDirection: 'column',
      padding: '16px', gap: '12px', boxSizing: 'border-box',
      fontFamily: 'sans-serif',
    });

    // header
    var header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    });
    var title = document.createElement('strong');
    title.textContent = 'Bilder aus Bibliothek';
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button'; closeBtn.textContent = '✕';
    Object.assign(closeBtn.style, {
      background: 'none', border: 'none', cursor: 'pointer',
      fontSize: '18px', lineHeight: '1',
    });
    closeBtn.addEventListener('click', function () { overlay.remove(); });
    header.appendChild(title); header.appendChild(closeBtn);

    // content (grid area)
    var content = document.createElement('div');
    Object.assign(content.style, { overflowY: 'auto', flex: '1', minHeight: '100px' });
    content.textContent = 'Wird geladen…';

    // footer
    var footer = document.createElement('div');
    Object.assign(footer.style, { display: 'flex', justifyContent: 'flex-end', gap: '8px' });
    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button'; cancelBtn.textContent = 'Abbrechen';
    Object.assign(cancelBtn.style, {
      padding: '6px 16px', borderRadius: '6px',
      border: '1px solid #ccc', cursor: 'pointer', background: 'white',
    });
    cancelBtn.addEventListener('click', function () { overlay.remove(); });
    var addBtn = document.createElement('button');
    addBtn.type = 'button'; addBtn.textContent = 'Hinzufügen';
    addBtn.disabled = true;
    Object.assign(addBtn.style, {
      padding: '6px 16px', borderRadius: '6px',
      border: 'none', cursor: 'pointer',
      background: '#a855f7', color: 'white', opacity: '0.4',
    });
    footer.appendChild(cancelBtn); footer.appendChild(addBtn);

    panel.appendChild(header); panel.appendChild(content); panel.appendChild(footer);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // fetch & render
    var selected = new Set();

    function updateAddBtn() {
      var n = selected.size;
      addBtn.disabled = n === 0;
      addBtn.style.opacity = n === 0 ? '0.4' : '1';
      addBtn.textContent = n > 0 ? 'Hinzufügen (' + n + ')' : 'Hinzufügen';
    }

    fetch(ASSETS_URL)
      .then(function (r) {
        if (!r.ok) throw new Error(r.status === 404 ? 'not-configured' : 'api-error');
        return r.json();
      })
      .then(function (urls) {
        content.textContent = '';
        if (urls.length === 0) {
          content.textContent = 'Keine Bilder vorhanden.';
          return;
        }
        var grid = document.createElement('div');
        Object.assign(grid.style, {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
          gap: '6px',
        });

        urls.forEach(function (url) {
          var wrap = document.createElement('div');
          Object.assign(wrap.style, { position: 'relative', cursor: 'pointer' });

          var img = document.createElement('img');
          img.src = thumb(url);
          img.loading = 'lazy';
          Object.assign(img.style, {
            width: '100%', aspectRatio: '1', objectFit: 'cover',
            borderRadius: '4px', display: 'block', boxSizing: 'border-box',
            border: '3px solid transparent',
          });

          var check = document.createElement('div');
          Object.assign(check.style, {
            position: 'absolute', top: '4px', right: '4px',
            width: '22px', height: '22px', borderRadius: '50%',
            background: '#a855f7', color: 'white',
            display: 'none', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 'bold', pointerEvents: 'none',
          });
          check.textContent = '✓';

          wrap.addEventListener('click', function () {
            if (selected.has(url)) {
              selected.delete(url);
              img.style.border = '3px solid transparent';
              check.style.display = 'none';
            } else {
              selected.add(url);
              img.style.border = '3px solid #a855f7';
              check.style.display = 'flex';
            }
            updateAddBtn();
          });

          wrap.appendChild(img); wrap.appendChild(check);
          grid.appendChild(wrap);
        });
        content.appendChild(grid);
      })
      .catch(function (err) {
        content.textContent = err.message === 'not-configured'
          ? 'Bibliothek nicht verfügbar. CLOUDINARY_API_SECRET als Netlify-Umgebungsvariable setzen.'
          : 'Fehler beim Laden der Bilder.';
      });

    addBtn.addEventListener('click', function () {
      if (selected.size > 0) { callback(Array.from(selected)); overlay.remove(); }
    });
  }

  // ── Widget component ──────────────────────────────────────────────────────

  var GalleryPickerControl = createClass({
    parseValue: function () {
      var v = this.props.value;
      if (!v) return { urls: [], thumb: 0 };
      if (Array.isArray(v)) return { urls: v, thumb: 0 };
      try {
        var parsed = JSON.parse(v);
        if (Array.isArray(parsed)) return { urls: parsed, thumb: 0 };
        return { urls: parsed.urls || [], thumb: parsed.thumb || 0 };
      } catch (e) { return { urls: [], thumb: 0 }; }
    },

    save: function (urls, thumb) {
      this.props.onChange(JSON.stringify({ urls: urls, thumb: thumb }));
    },

    addImages: function (newUrls) {
      var current = this.parseValue();
      var merged  = current.urls.slice();
      newUrls.forEach(function (u) { if (merged.indexOf(u) === -1) merged.push(u); });
      this.save(merged, current.thumb);
    },

    removeImage: function (idx) {
      var current = this.parseValue();
      var urls    = current.urls.filter(function (_, i) { return i !== idx; });
      var t       = current.thumb;
      if (idx < t) t--;
      else if (idx === t) t = 0;
      if (urls.length === 0) this.props.onChange('');
      else this.save(urls, Math.min(t, urls.length - 1));
    },

    setThumb: function (idx) {
      var current = this.parseValue();
      this.save(current.urls, idx);
    },

    render: function () {
      var self = this;
      var data = this.parseValue();
      var imgs = data.urls;
      var t    = data.thumb;

      var btnStyle = {
        padding: '6px 14px', borderRadius: '6px',
        border: '1px solid #ccc', cursor: 'pointer',
        background: 'white', fontSize: '0.85rem',
      };

      return h('div', null,
        imgs.length > 0 ? h('div', {
          style: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }
        },
          imgs.map(function (src, i) {
            var isThumb = i === t;
            return h('div', { key: i, style: { position: 'relative' } },
              h('img', {
                src: src, alt: '',
                style: {
                  width: '80px', height: '80px', objectFit: 'cover',
                  borderRadius: '4px', display: 'block',
                  outline: isThumb ? '2px solid #a855f7' : 'none', outlineOffset: '1px',
                }
              }),
              h('button', {
                type: 'button', title: 'Bild entfernen',
                onClick: function () { self.removeImage(i); },
                style: {
                  position: 'absolute', top: '2px', right: '2px',
                  background: 'rgba(0,0,0,0.65)', border: 'none', color: 'white',
                  borderRadius: '50%', width: '18px', height: '18px',
                  cursor: 'pointer', fontSize: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0',
                }
              }, '✕'),
              h('button', {
                type: 'button', title: isThumb ? 'Thumbnail' : 'Als Thumbnail setzen',
                onClick: function () { if (!isThumb) self.setThumb(i); },
                style: {
                  position: 'absolute', bottom: '2px', left: '2px',
                  background: isThumb ? '#a855f7' : 'rgba(0,0,0,0.5)',
                  border: 'none', color: 'white',
                  borderRadius: '50%', width: '18px', height: '18px',
                  cursor: isThumb ? 'default' : 'pointer', fontSize: '11px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0',
                }
              }, '★')
            );
          })
        ) : null,
        h('div', { style: { display: 'flex', gap: '8px' } },
          h('button', {
            type: 'button', style: btnStyle,
            onClick: function () { openUploadWidget(function (urls) { self.addImages(urls); }); },
          }, 'Hochladen'),
          h('button', {
            type: 'button', style: btnStyle,
            onClick: function () { openLibraryPicker(function (urls) { self.addImages(urls); }); },
          }, 'Aus Bibliothek')
        )
      );
    }
  });

  function GalleryPickerPreview(props) {
    var v = props.value;
    if (!v) return h('p', { style: { color: '#888' } }, 'Keine Bilder');
    try {
      var parsed = Array.isArray(v) ? { urls: v } : JSON.parse(v);
      var count  = (parsed.urls || parsed).length || 0;
      return h('p', null, count + ' Bild' + (count !== 1 ? 'er' : ''));
    } catch (e) { return h('p', null, 'Bilder vorhanden'); }
  }

  window.CMS.registerWidget('gallery-picker', GalleryPickerControl, GalleryPickerPreview);
}());

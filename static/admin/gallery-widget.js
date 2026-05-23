(function () {
  var h = window.h;
  var createClass = window.createClass;

  function openCloudinaryPicker(callback) {
    function doOpen() {
      var newUrls = [];
      window.cloudinary.openUploadWidget(
        {
          cloudName: 'dx2yckdac',
          uploadPreset: 'outandabout_admin',
          multiple: true,
          maxFiles: 20,
          resourceType: 'image',
          sources: ['local', 'url', 'camera'],
        },
        function (error, result) {
          if (error) return;
          if (result.event === 'success') {
            newUrls.push(result.info.secure_url);
          }
          if (result.event === 'queues-end' && newUrls.length > 0) {
            callback(newUrls);
          }
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

    addImages: function () {
      var self = this;
      var current = self.parseValue();
      openCloudinaryPicker(function (newUrls) {
        var merged = current.urls.slice();
        newUrls.forEach(function (u) {
          if (merged.indexOf(u) === -1) merged.push(u);
        });
        self.save(merged, current.thumb);
      });
    },

    removeImage: function (idx) {
      var current = this.parseValue();
      var urls = current.urls.filter(function (_, i) { return i !== idx; });
      var thumb = current.thumb;
      if (idx < thumb) thumb--;
      else if (idx === thumb) thumb = 0;
      if (urls.length === 0) {
        this.props.onChange('');
      } else {
        this.save(urls, Math.min(thumb, urls.length - 1));
      }
    },

    setThumb: function (idx) {
      var current = this.parseValue();
      this.save(current.urls, idx);
    },

    render: function () {
      var self = this;
      var data = this.parseValue();
      var imgs = data.urls;
      var thumb = data.thumb;

      return h('div', null,
        imgs.length > 0 ? h('div', {
          style: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }
        },
          imgs.map(function (src, i) {
            var isThumb = i === thumb;
            return h('div', { key: i, style: { position: 'relative' } },
              h('img', {
                src: src,
                alt: '',
                style: {
                  width: '80px', height: '80px',
                  objectFit: 'cover', borderRadius: '4px', display: 'block',
                  outline: isThumb ? '2px solid #a855f7' : 'none',
                  outlineOffset: '1px',
                }
              }),
              h('button', {
                type: 'button',
                title: 'Bild entfernen',
                onClick: function () { self.removeImage(i); },
                style: {
                  position: 'absolute', top: '2px', right: '2px',
                  background: 'rgba(0,0,0,0.65)', border: 'none', color: 'white',
                  borderRadius: '50%', width: '18px', height: '18px',
                  cursor: 'pointer', fontSize: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0'
                }
              }, '✕'),
              h('button', {
                type: 'button',
                title: isThumb ? 'Thumbnail' : 'Als Thumbnail setzen',
                onClick: function () { if (!isThumb) self.setThumb(i); },
                style: {
                  position: 'absolute', bottom: '2px', left: '2px',
                  background: isThumb ? '#a855f7' : 'rgba(0,0,0,0.5)',
                  border: 'none', color: 'white',
                  borderRadius: '50%', width: '18px', height: '18px',
                  cursor: isThumb ? 'default' : 'pointer', fontSize: '11px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0'
                }
              }, '★')
            );
          })
        ) : null,
        h('button', {
          type: 'button',
          onClick: function () { self.addImages(); },
          style: {
            padding: '6px 16px',
            borderRadius: '6px',
            border: '1px solid #ccc',
            cursor: 'pointer',
            background: 'white',
            fontSize: '0.85rem'
          }
        }, imgs.length > 0 ? 'Weitere Bilder hinzufügen' : 'Bilder auswählen')
      );
    }
  });

  function GalleryPickerPreview(props) {
    var v = props.value;
    if (!v) return h('p', { style: { color: '#888' } }, 'Keine Bilder');
    try {
      var parsed = Array.isArray(v) ? { urls: v } : JSON.parse(v);
      var count = (parsed.urls || parsed).length || 0;
      return h('p', null, count + ' Bild' + (count !== 1 ? 'er' : ''));
    } catch (e) {
      return h('p', null, 'Bilder vorhanden');
    }
  }

  window.CMS.registerWidget('gallery-picker', GalleryPickerControl, GalleryPickerPreview);
}());

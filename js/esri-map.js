/*global WildRydes _config*/

var WildRydes = window.WildRydes || {};
WildRydes.map = WildRydes.map || {};

(function esriMapScopeWrapper($) {
    require([
        'esri/Map',
        'esri/views/MapView',
        'esri/Graphic',
        'esri/geometry/Point',
        'esri/symbols/TextSymbol',
        'esri/symbols/PictureMarkerSymbol',
        'esri/geometry/support/webMercatorUtils',
        'dojo/domReady!'
    ], function (
        Map, MapView,
        Graphic, Point, TextSymbol,
        PictureMarkerSymbol, webMercatorUtils
    ) {
        var wrMap = WildRydes.map;
        wrMap.clearGraphics = clearGraphics;

        var map = new Map({ basemap: 'gray-vector' });

        var view = new MapView({
            center: [80.0043, 13.0096],
            container: 'map',
            map: map,
            zoom: 15
        });

        // Symbols
        var pickupSymbol = new TextSymbol({
            color: '#07373d',
            text: '\ue61d',
            font: { size: 24, family: 'CalciteWebCoreIcons' }
        });

        var dropoffSymbol = new TextSymbol({
            color: '#d32f2f',
            text: '\ue61d',
            font: { size: 24, family: 'CalciteWebCoreIcons' }
        });

        var unicornSymbol = new PictureMarkerSymbol({
            url: '/images/mini-van.png',
            width: '50px',
            height: '50px'
        });

        // Graphics references
        var pickupGraphic = null;
        var dropoffGraphic = null;
        var unicornGraphic = null;

        // Current mode
        wrMap.clickMode = 'pickup';  // default

        function clearGraphics(type = 'all') {
            if (type === 'all' || type === 'pickup') {
                if (pickupGraphic) {
                    view.graphics.remove(pickupGraphic);
                    pickupGraphic = null;
                }
            }
            if (type === 'all' || type === 'dropoff') {
                if (dropoffGraphic) {
                    view.graphics.remove(dropoffGraphic);
                    dropoffGraphic = null;
                }
            }
            if (type === 'all' || type === 'unicorn') {
                if (unicornGraphic) {
                    view.graphics.remove(unicornGraphic);
                    unicornGraphic = null;
                }
            }
        }

        function reverseGeocode(lon, lat, callback) {
            fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${lon},${lat}&f=pjson`)
                .then(r => r.json())
                .then(data => {
                    let name = "Unknown location";
                    if (data.address) {
                        name = data.address.Neighborhood ||
                               data.address.District ||
                               data.address.Subregion ||
                               data.address.City ||
                               name;
                    }
                    callback(name);
                })
                .catch(() => callback("Unknown location"));
        }

        // Map click handler
        view.on('click', function (event) {
            console.log("Map clicked → current mode:", wrMap.clickMode); // debug

            if (wrMap.clickMode !== 'pickup' && wrMap.clickMode !== 'dropoff') {
                console.log("Ignoring click — no valid mode set");
                return;
            }

            var point = event.mapPoint;
            var lat = point.latitude;
            var lon = point.longitude;

            if (wrMap.clickMode === 'pickup') {
                clearGraphics('pickup');
                reverseGeocode(lon, lat, (name) => {
                    wrMap.pickup = { latitude: lat, longitude: lon, name };
                    pickupGraphic = new Graphic({ geometry: point, symbol: pickupSymbol });
                    view.graphics.add(pickupGraphic);
                    $(wrMap).trigger('locationChange');
                    console.log("Pickup set:", wrMap.pickup);
                });
            } else if (wrMap.clickMode === 'dropoff') {
                clearGraphics('dropoff');
                reverseGeocode(lon, lat, (name) => {
                    wrMap.dropoff = { latitude: lat, longitude: lon, name };
                    dropoffGraphic = new Graphic({ geometry: point, symbol: dropoffSymbol });
                    view.graphics.add(dropoffGraphic);
                    $(wrMap).trigger('locationChange');
                    console.log("Dropoff set:", wrMap.dropoff);
                });
            }
        });

        // Mode setters
        wrMap.setPickupMode = function () {
            wrMap.clickMode = 'pickup';
            console.log("Mode → pickup"); // debug
            $(wrMap).trigger('modeChange');
        };

        wrMap.setDropoffMode = function () {
            wrMap.clickMode = 'dropoff';
            console.log("Mode → dropoff"); // debug
            $(wrMap).trigger('modeChange');
        };

        // Animation
        wrMap.animate = function (origin, dest, callback) {
            console.log("animate called", origin, dest);
            var startTime;
            var step = function (timestamp) {
                if (!startTime) startTime = timestamp;
                var progress = timestamp - startTime;
                var progressPct = Math.min(progress / 2000, 1);

                var point = new Point({
                    longitude: origin.longitude + (dest.longitude - origin.longitude) * progressPct,
                    latitude: origin.latitude + (dest.latitude - origin.latitude) * progressPct
                });

                view.graphics.remove(unicornGraphic);
                unicornGraphic = new Graphic({ geometry: point, symbol: unicornSymbol });
                view.graphics.add(unicornGraphic);

                if (progressPct < 1) {
                    requestAnimationFrame(step);
                } else {
                    callback();
                }
            };
            requestAnimationFrame(step);
        };

        wrMap.unsetLocation = function () {
            clearGraphics('all');
        };

        // View watchers
        function updateCenter(newValue) {
            wrMap.center = { latitude: newValue.latitude, longitude: newValue.longitude };
        }

        function updateExtent(newValue) {
            var min = webMercatorUtils.xyToLngLat(newValue.xmin, newValue.ymin);
            var max = webMercatorUtils.xyToLngLat(newValue.xmax, newValue.ymax);
            wrMap.extent = { minLng: min[0], minLat: min[1], maxLng: max[0], maxLat: max[1] };
        }

        view.watch('extent', updateExtent);
        view.watch('center', updateCenter);

        view.then(() => {
            console.log("Map view ready");
            updateExtent(view.extent);
            updateCenter(view.center);
        });
    });
}(jQuery));
/*global WildRydes _config*/

var WildRydes = window.WildRydes || {};
WildRydes.map = WildRydes.map || {};

(function rideScopeWrapper($) {
    var authToken;
    WildRydes.authToken.then(function setAuthToken(token) {
        if (token) {
            authToken = token;
        } else {
            window.location.href = '/signin.html';
        }
    }).catch(function handleTokenError(error) {
        alert(error);
        window.location.href = '/signin.html';
    });
    function requestUnicorn(pickupLocation) {
        $.ajax({
            method: 'POST',
            url: _config.api.invokeUrl + '/ride',
            headers: {
                Authorization: authToken
            },
            data: JSON.stringify({
                PickupLocation: {
                    Latitude: pickupLocation.latitude,
                    Longitude: pickupLocation.longitude
                }
            }),
            contentType: 'application/json',
            success: completeRequest,
            error: function ajaxError(jqXHR, textStatus, errorThrown) {
                console.error('Error requesting ride: ', textStatus, ', Details: ', errorThrown);
                console.error('Response: ', jqXHR.responseText);
                alert('An error occured when requesting your car:\n' + jqXHR.responseText);
            }
        });
    }

    function completeRequest(result) {
        var unicorn;
        var pronoun;
        console.log('Response received from API: ', result);
        unicorn = result.Unicorn;
        pronoun = unicorn.Gender === 'Male' ? 'his' : 'her';
        displayUpdate('Driver: ' + unicorn.Name + ', your car (' + unicorn.CarNumber + ') is on ' + pronoun + ' way.');
        animateArrival(function animateCallback() {
            displayUpdate(unicorn.Name + ' has arrived. Hop up!');
            WildRydes.map.unsetLocation();
            $('#request').prop('disabled', 'disabled');
            $('#request').text('Set Pickup');
        });
    }

    // Register click handler for #request button
    $(function onDocReady() {
        $('#request').click(handleRequestClick);
        $(WildRydes.map).on('pickupChange', handlePickupChanged);

        WildRydes.authToken.then(function updateAuthMessage(token) {
            if (token) {
                displayUpdate('You are authenticated. Click to see your <a href="#authTokenModal" data-toggle="modal">auth token</a>.');
                $('.authToken').text(token);
            }
        });

        if (!_config.api.invokeUrl) {
            $('#noApiMessage').show();
        }
    });

    function calculateDistance(lat1, lon1, lat2, lon2) {
        var R = 6371; // km
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;

        var a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    function estimateFare(distance) {
        var baseFare = 50;     // ₹
        var perKm = 12;        // ₹ per km

        return baseFare + (distance * perKm);
    }

    /*function handlePickupChanged() {
        var requestButton = $('#request');
        requestButton.text('Request Car');
        requestButton.prop('disabled', false);
    }*/
   function handlePickupChanged() {
        var pickup = WildRydes.map.selectedPoint;
        var baseLat = 13.0096;
        var baseLon = 80.0043;

        var distance = calculateDistance(
            baseLat,
            baseLon,
            pickup.latitude,
            pickup.longitude
        );

        var fare = estimateFare(distance);

        displayUpdate(
            "Distance: " + distance.toFixed(2) +
            " km | Estimated Fare: ₹" + Math.round(fare) + 
            " | Pickup location: " + WildRydes.map.locationName
        );

        var requestButton = $('#request');
        requestButton.text('Request Car');
        requestButton.prop('disabled', false);
    }

    function handleRequestClick(event) {
        var pickupLocation = WildRydes.map.selectedPoint;
        event.preventDefault();
        requestUnicorn(pickupLocation);
    }

    function animateArrival(callback) {
        var dest = WildRydes.map.selectedPoint;
        var origin = {};

        if (dest.latitude > WildRydes.map.center.latitude) {
            origin.latitude = WildRydes.map.extent.minLat;
        } else {
            origin.latitude = WildRydes.map.extent.maxLat;
        }

        if (dest.longitude > WildRydes.map.center.longitude) {
            origin.longitude = WildRydes.map.extent.minLng;
        } else {
            origin.longitude = WildRydes.map.extent.maxLng;
        }

        WildRydes.map.animate(origin, dest, callback);
    }

    function displayUpdate(text) {
        var updates = $('#updates');
        updates.append($('<li>' + text + '</li>'));
        if (updates.children().length > 10) {
            updates.children().first().remove();
        }
        var panelBody = updates.parent(); // this is .panel-body
        panelBody.scrollTop(panelBody[0].scrollHeight);
    }
}(jQuery));

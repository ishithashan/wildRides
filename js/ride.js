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

    function requestUnicorn(pickup, dropoff) {
        $.ajax({
            method: 'POST',
            url: _config.api.invokeUrl + '/ride',
            headers: { Authorization: authToken },
            data: JSON.stringify({
                PickupLocation: {
                    Latitude: pickup.latitude,
                    Longitude: pickup.longitude
                },
                DropoffLocation: {  // ← new!
                    Latitude: dropoff.latitude,
                    Longitude: dropoff.longitude
                }
            }),
            contentType: 'application/json',
            success: completeRequest,
            error: function ajaxError(jqXHR) {
                console.error('Error requesting ride: ', jqXHR);
                alert('Error requesting ride:\n' + jqXHR.responseText);
            }
        });
    }

    function completeRequest(result) {
        var unicorn = result.Unicorn;
        var pronoun = unicorn.Gender === 'Male' ? 'his' : 'her';
        displayUpdate(`Driver: ${unicorn.Name}, your car (${unicorn.CarNumber}) is on ${pronoun} way to pickup.`);
        animateArrival(function () {
            displayUpdate(`${unicorn.Name} has arrived at pickup. Heading to drop-off!`);
            //WildRydes.map.unsetLocation();
            $('#request').prop('disabled', true).text('Ride Requested');
        });
    }

    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function estimateFare(distance) {
        const baseFare = 50;
        const perKm = 12;
        return Math.round(baseFare + (distance * perKm));}

function updateUIWithLocationsAndMode() {
    const pickup = WildRydes.map.pickup;
    const dropoff = WildRydes.map.dropoff;
    const mode = WildRydes.map.clickMode;

    // Clear previous messages (optional - comment out if you want history)
    // $('#updates').empty();

    let message = "";

    if (!pickup && !dropoff) {
        message = "Welcome! Use the buttons to set your pickup and drop-off locations.";
    }

    if (pickup) {
        message += `<strong>Pickup Point:</strong> ${pickup.name} (${pickup.latitude.toFixed(4)}, ${pickup.longitude.toFixed(4)})<br>`;
    }

    if (pickup && dropoff) {
        const distance = calculateDistance(
            pickup.latitude, pickup.longitude,
            dropoff.latitude, dropoff.longitude
        );
        const fare = estimateFare(distance);
        message += `<strong>Drop Point:</strong> Distance: ${distance.toFixed(2)} km | Estimated Fare: ₹${fare} | Drop location: ${dropoff.name}<br>`;
        $('#request').prop('disabled', false).text('Request Ride');
    } else if (pickup) {
        message += "Now set your drop-off location on the map.<br>";
        $('#request').prop('disabled', true).text('Set Drop-off first');
    } else {
        message += "First set your pickup location.<br>";
        $('#request').prop('disabled', true).text('Set Pickup first');
    }

    // Only show current mode when relevant
    if (pickup && !dropoff) {
        message += `<small>Current mode: Setting Drop-off (click "Set Drop-off Location" if needed)</small>`;
    } else if (!pickup) {
        message += `<small>Current mode: Setting Pickup</small>`;
    }

    displayUpdate(message);
}

$(function onDocReady() {
    // Buttons to switch mode
    $('#setPickup').click(() => {
        WildRydes.map.setPickupMode();
        updateUIWithLocationsAndMode();  // ← call here
    });

    $('#setDropoff').click(() => {
        WildRydes.map.setDropoffMode();
        updateUIWithLocationsAndMode();  // ← call here
    });

    $('#request').click(handleRequestClick);

    // Listen for both events
    $(WildRydes.map).on('locationChange modeChange', updateUIWithLocationsAndMode);

    WildRydes.authToken.then(token => {
        if (token) {
            displayUpdate('Authenticated. Use buttons to set pickup/drop-off on map.');
        }
    });

    if (!_config.api.invokeUrl) {
        $('#noApiMessage').show();
    }

    // Initial UI state
    updateUIWithLocationsAndMode();

    $('#resetLocations').click(() => {
    WildRydes.map.pickup = null;
    WildRydes.map.dropoff = null;
    WildRydes.map.unsetLocation();
    updateUIWithLocationsAndMode();
    displayUpdate("Locations cleared. Start over by setting pickup.");
});
$('#newRide').click(() => {
    WildRydes.map.pickup = null;
    WildRydes.map.dropoff = null;
    WildRydes.map.clickMode = 'pickup';
    WildRydes.map.unsetLocation();           // clears pins + unicorn
    $('#request').prop('disabled', true).text('Set Pickup first');
    $('#newRide').hide();
    displayUpdate("Map cleared! Ready for a new ride.<br>Click 'Set Pickup Location' to begin.");
    updateUIWithLocationsAndMode();
});
$('#showHistory').click(async function () {
    displayUpdate('<em>Loading your ride history...</em>');

    try {
        const userPool = new AmazonCognitoIdentity.CognitoUserPool({
            UserPoolId: _config.cognito.userPoolId,
            ClientId: _config.cognito.userPoolClientId
        });

        const cognitoUser = userPool.getCurrentUser();

        if (!cognitoUser) {
            displayUpdate('You are not signed in. Please sign in first.');
            return;
        }

        const session = await new Promise((resolve, reject) => {
            cognitoUser.getSession((err, sess) => {
                if (err) reject(err);
                else resolve(sess);
            });
        });

        const currentUsername = cognitoUser.getUsername();
        console.log("Current username for history:", currentUsername);

        // Updated ajax call with dataType
        const allRides = await $.ajax({
            method: 'GET',
            url: _config.api.invokeUrl + '/ride',
            headers: {
                Authorization: authToken
            },
            dataType: 'json'   // ← key fix
        });

        // No need for JSON.parse — allRides is already an array
        const myRides = allRides.filter(ride => ride.User === currentUsername);

        if (myRides.length === 0) {
            displayUpdate('You haven’t taken any rides yet.<br>Request your first unicorn ride!');
            return;
        }

        myRides.sort((a, b) => new Date(b.RequestTime) - new Date(a.RequestTime));

        let html = '<strong style="font-size:1.1em">My Ride History</strong><ul class="ride-history">';

        myRides.forEach(ride => {
            const time = new Date(ride.RequestTime).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                dateStyle: 'medium',
                timeStyle: 'short'
            });

            html += `
                <li>
                    <div><strong>${time}</strong></div>
                    <div>Unicorn: ${ride.Unicorn.Name} (${ride.Unicorn.CarNumber})</div>
                    <div>Gender: ${ride.Unicorn.Gender}</div>
                </li>
            `;
        });

        html += '</ul>';

        displayUpdate(html);

    } catch (err) {
        console.error('History error:', err);
        displayUpdate('Sorry, could not load ride history right now.<br>Error: ' + (err.message || 'Unknown error'));
    }
});
});

    function handleRequestClick(event) {
        event.preventDefault();
        const pickup = WildRydes.map.pickup;
        const dropoff = WildRydes.map.dropoff;
        if (pickup && dropoff) {
            requestUnicorn(pickup, dropoff);
        } else {
            alert("Please select both pickup and drop-off locations.");
        }
    }

function animateArrival(callback) {
    // Use pickup location as destination (unicorn comes to pickup)
    var dest = WildRydes.map.pickup;

    if (!dest) {
        console.warn("No pickup location set for animation");
        callback(); // skip animation if no pickup
        return;
    }

    // Choose a starting point outside the current view (simple logic)
    var origin = {};
    if (dest.latitude > WildRydes.map.center.latitude) {
        origin.latitude = WildRydes.map.extent.minLat - 0.05; // slightly outside
    } else {
        origin.latitude = WildRydes.map.extent.maxLat + 0.05;
    }

    if (dest.longitude > WildRydes.map.center.longitude) {
        origin.longitude = WildRydes.map.extent.minLng - 0.05;
    } else {
        origin.longitude = WildRydes.map.extent.maxLng + 0.05;
    }

    //WildRydes.map.animate(origin, dest, callback);
    WildRydes.map.animate(origin, dest, function () {
        // animation finished
        callback();
    });
}

function completeRequest(result) {
    var unicorn = result.Unicorn;
    var pronoun = unicorn.Gender === 'Male' ? 'his' : 'her';

    displayUpdate(
        `Driver: ${unicorn.Name}, your car (${unicorn.CarNumber}) is on ${pronoun} way to pickup.`
    );

    console.log("Starting unicorn animation now...");  // ← ADD THIS LINE
    animateArrival(function () {
        console.log("Unicorn animation finished!");   // ← ADD THIS
        displayUpdate(`${unicorn.Name} has arrived at pickup! Hop in!`);
        if (WildRydes.map.clearGraphics) {
            WildRydes.map.clearGraphics('unicorn');
        } else {
            console.warn("clearGraphics not available");
        }
        $('#request').prop('disabled', true).text('Ride In Progress');
        $('#newRide').show();
    });
}

    function displayUpdate(text) {
        var updates = $('#updates');
        updates.append($('<li>' + text + '</li>'));
        if (updates.children().length > 10) {
            updates.children().first().remove();
        }
        var panelBody = updates.parent();
        panelBody.scrollTop(panelBody[0].scrollHeight);
    }
}(jQuery));
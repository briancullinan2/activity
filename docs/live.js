setInterval(() => {
    // TODO: refresh images
    let images = document.querySelectorAll('.livedev > img')
    for (let i = 0; i < images.length; i++) {
        if (images[i].src && !images[i].getAttribute('original-src')) {
            images[i].setAttribute('original-src', images[i].src)
        }
        let originalImage = images[i].getAttribute('original-src')
        let newImage = originalImage.replace(/\?.*/, '') + '?t=' + Date.now()
        // set background to previous image
        if (images[i].src) {
            images[i].style.backgroundImage = "url('" + encodeURI(images[i].src) + "')"
        }
        setTimeout(() => {
            images[i].src = newImage
        }, 100)
    }
}, 5000)


let historyIndex = 0
let currentValue = ''
function sendHandler(evt) {
    let chatBox = document.querySelector('#chat-program textarea')
    if (event.key === 'Enter') {
        evt.preventDefault()
        let session = localStorage.getItem('brian-chat-session')
        let messageHistory = document.querySelector('#messages')
        let otr = document.querySelector('#chat-program input')
        messageHistory.innerHTML += '<div class="user"><p>User: ' + chatBox.value + '</p></div>'
        let messagePost = {
            method: 'POST',
            body: JSON.stringify({ otr: otr.checked, session: session, content: chatBox.value }),
            headers: {
                "Content-Type": "application/json",
            }
        }
        if (chatBox.value.trim() == '') {
            chatBox.value = ''
            return
        }
        chatBox.value = ''
        historyIndex = 0
        setTimeout(async () => {
            messageHistory.scrollTop = messageHistory.scrollTop + 10000
            let result = await fetch('https://brian-chat.pryor.games/?session=' + session + '&t=' + Date.now(), messagePost)
            if (result.ok) {
                messageHistory.innerHTML += '<div class="ai">AI: ' + await result.text() + '</div>'
            }
            messageHistory.scrollTop = messageHistory.scrollTop + 10000
        }, 100)
        return false
    }
    if (event.key === 'ArrowUp' && chatBox.scrollTop < 10) {
        if (historyIndex === 0) {
            currentValue = chatBox.value
        }
        let messageHistory = document.querySelector('#messages')
        // TODO: adjust according to messages loaded, don't count too high
        let count = 0
        let i
        for (i = messageHistory.childNodes.length - 1; i >= 0 && count < (historyIndex + 1); i--) {
            if (!messageHistory.childNodes[i].innerText) {
                continue
            }
            if (messageHistory.childNodes[i].innerText.startsWith('User:')) {
                count++
            }
        }
        if (i > 0) {
            historyIndex++
            chatBox.value = messageHistory.childNodes[i + 1].innerText.substring(6)
        }
    }
    if (event.key === 'ArrowDown' && historyIndex > 0) {
        let messageHistory = document.querySelector('#messages')
        if (historyIndex === 1) {
            historyIndex--
            chatBox.value = currentValue
        } else {
            let count = 0
            let i
            for (i = messageHistory.childNodes.length - 1; i >= 0 && count < (historyIndex - 1); i--) {
                if (!messageHistory.childNodes[i].innerText) {
                    continue
                }
                if (messageHistory.childNodes[i].innerText.startsWith('User:')) {
                    count++
                }
            }
            if (i > 0) {
                historyIndex--
                chatBox.value = messageHistory.childNodes[i + 1].innerText.substring(6)
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', async (event) => {
    let session = localStorage.getItem('brian-chat-session')

    if (!session) {
        const array = new Uint8Array(16)
        window.crypto.getRandomValues(array)
        localStorage.setItem('brian-chat-session', (session = Array.from(array).map(byte => byte.toString(16).padStart(2, '0')).join('')));
    }


    let result = await fetch('https://brian-chat.pryor.games/embed?session=' + session + '&t=' + Date.now(), {
        method: 'GET'
    })
    document.querySelector('#chat-program').innerHTML = await result.text()

    setTimeout(() => {
        let messageHistory = document.querySelector('#messages')
        messageHistory.scrollTop = messageHistory.scrollTop + 10000
        document.querySelector('#chat-program textarea').addEventListener('keyup', sendHandler)
        document.querySelector('#chat-program button').addEventListener('click', sendHandler)
        // TODO:
        //document.querySelector('#chat-program #messages').addEventListener('scroll')
    }, 100)

    // in case it takes too long to respond and it errors out in 30 seconds
    setInterval(async () => {
        let messageHistory = document.querySelector('#messages')
        let messagesWithIds = document.querySelectorAll('#messages > *[id]')
        let messagesWithoutIds = document.querySelectorAll('#messages > *:not([id])')
        if (messageHistory.scrollTop + messageHistory.clientHeight == messageHistory.scrollHeight) {
            messageHistory.scrollTop = messageHistory.scrollTop + 10000
        }
        if (!messagesWithIds[messagesWithIds.length - 1]) {
            return
        }
        let from = parseInt(messagesWithIds[messagesWithIds.length - 1].id.replace('id-', ''))
        let result = await fetch('https://brian-chat.pryor.games/embed?session=' + session + '&from=' + (from + 1) + '&t=' + Date.now(), {
            method: 'GET'
        })
        let newMessages = (/<div id="messages">([\s\S]*?)<\/div>\n<\/div>/gi).exec(await result.text())
        for (let i = 0; i < messagesWithoutIds.length; i++) {
            messagesWithoutIds[i].remove()
        }
        if (newMessages) {
            messageHistory.innerHTML += newMessages[1]
        }
        setTimeout(() => {
            if (messageHistory.scrollTop + messageHistory.clientHeight == messageHistory.scrollHeight) {
                messageHistory.scrollTop = messageHistory.scrollTop + 10000
            }
        }, 100)
    }, 5000)

});
document.addEventListener('DOMContentLoaded', () => {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    const base64Attribute = mapElement.getAttribute('data-timeline');
    if (!base64Attribute) return;

    // Safely decode Base64 JSON payload
    const mapData = JSON.parse(atob(base64Attribute));
    const map = L.map('map', { zoomSnap: 0.5 }).setView([0, 0], 2);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        crossOrigin: 'anonymous'
    }).addTo(map);

    const bounds = [];

    // 1. Draw every raw GPS point as a discrete circle marker
    if (Array.isArray(mapData.pings)) {
        mapData.pings.forEach(ping => {
            L.circleMarker(ping, {
                radius: 3,
                fillColor: '#00f2fe',
                color: '#00f2fe',
                weight: 0,
                fillOpacity: 0.6
            }).addTo(map);
            bounds.push(ping);
        });
    }

    // 2. Fetch OSRM matched routes for road-snapped navigation polylines
    async function fetchRoadRoute(coords) {
        if (coords.length < 2) return null;

        // Downsample sequence if points exceed OSRM request caps (max ~100 points per call)
        let sampled = coords;
        if (coords.length > 80) {
            const step = Math.ceil(coords.length / 80);
            sampled = coords.filter((_, idx) => idx % step === 0);
            if (sampled[sampled.length - 1] !== coords[coords.length - 1]) {
                sampled.push(coords[coords.length - 1]);
            }
        }

        // Format: lng,lat;lng,lat
        const coordString = sampled.map(c => `${c[1]},${c[0]}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const data = await response.json();
            if (data.routes && data.routes.length > 0) {
                // Convert GeoJSON [lng, lat] back to Leaflet [lat, lng]
                return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
            }
        } catch (err) {
            console.warn("OSRM routing unavailable, falling back to direct line:", err);
        }
        return null;
    }

    // 3. Process lines with road routing + directional arrows
    if (Array.isArray(mapData.lines)) {
        mapData.lines.forEach(async (line) => {
            if (line.length < 2) return;

            // Try fetching road-snapped geometry; fallback to raw coordinates
            const roadGeometry = await fetchRoadRoute(line) || line;

            // Draw polyline
            L.polyline(roadGeometry, {
                color: '#00f2fe',
                weight: 4,
                opacity: 0.85,
                lineCap: 'round',
                lineJoin: 'round'
            }).addTo(map);

            // Draw direction arrows along the route
            const step = Math.max(1, Math.floor(roadGeometry.length / 8));
            for (let i = 0; i < roadGeometry.length - 1; i += step) {
                const p1 = roadGeometry[i];
                const p2 = roadGeometry[i + 1];

                const dy = p2[0] - p1[0];
                const dx = Math.cos(Math.PI / 180 * p1[0]) * (p2[1] - p1[1]);
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;

                // Inline SVG icon guarantees rendering on all devices without font dependencies
                const arrowSvg = `
        <svg width="14" height="14" viewBox="0 0 24 24" style="transform: rotate(${90 - angle}deg); display: block;">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" fill="#00f2fe" stroke="#000000" stroke-width="1.5"/>
        </svg>
    `;

                const arrowIcon = L.divIcon({
                    className: 'direction-arrow-icon',
                    html: arrowSvg,
                    iconSize: [14, 14],
                    iconAnchor: [7, 7]
                });

                L.marker([p1[0], p1[1]], { icon: arrowIcon, interactive: false }).addTo(map);
            }
        });
    }

    // 4. Draw visited places
    if (Array.isArray(mapData.places)) {
        mapData.places.forEach(place => {
            if (place.lat && place.lng) {
                L.circleMarker([place.lat, place.lng], {
                    radius: 6,
                    fillColor: '#ff0055',
                    color: '#ffffff',
                    weight: 1.5,
                    opacity: 1,
                    fillOpacity: 0.9
                }).bindPopup(`<b>${place.name}</b><br>${place.time}`).addTo(map);
                bounds.push([place.lat, place.lng]);
            }
        });
    }

    // Adjust view bounds to fit data
    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [30, 30] });
    }

    setTimeout(() => {
        map.invalidateSize();
        if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [40, 40] });
        }
    }, 200);

    window.addEventListener('resize', () => {
        map.invalidateSize();
    });
});


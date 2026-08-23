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

})

document.addEventListener('DOMContentLoaded', () => {
    const mapElement = document.getElementById('map');
    if (!mapElement) return;

    const rawAttribute = mapElement.getAttribute('data-timeline');
    if (!rawAttribute) return;

    let mapData;
    try {
        mapData = JSON.parse(rawAttribute);
    } catch (err) {
        console.error('Failed to parse timeline data attribute:', err);
        return;
    }

    // Initialize Leaflet map
    const map = L.map('map', { zoomSnap: 0.5 }).setView([0, 0], 2);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        crossOrigin: 'anonymous'
    }).addTo(map);

    const bounds = [];

    // Plot traces
    if (Array.isArray(mapData.lines)) {
        mapData.lines.forEach(line => {
            L.polyline(line, {
                color: '#00f2fe',
                weight: 3,
                opacity: 0.65,
                lineJoin: 'round'
            }).addTo(map);
            line.forEach(coord => bounds.push(coord));
        });
    }

    // Plot points
    if (Array.isArray(mapData.places)) {
        mapData.places.forEach(place => {
            if (place.lat && place.lng) {
                const marker = L.circleMarker([place.lat, place.lng], {
                    radius: 5,
                    fillColor: '#4facfe',
                    color: '#fff',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                });

                const popupContent = document.createElement('div');
                const titleEl = document.createElement('b');
                titleEl.textContent = place.name || 'Visited Location';

                const timeEl = document.createElement('span');
                timeEl.style.fontSize = '11px';
                timeEl.style.color = '#666';
                timeEl.style.display = 'block';
                timeEl.textContent = place.time || '';

                popupContent.appendChild(titleEl);
                popupContent.appendChild(document.createElement('br'));
                popupContent.appendChild(timeEl);

                marker.bindPopup(popupContent);
                marker.addTo(map);

                bounds.push([place.lat, place.lng]);
            }
        });
    }

    // Recalculate camera bounds
    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40] });
    } else {
        map.setView([35.198, -111.651], 11);
    }

    setTimeout(() => {
        map.invalidateSize();
        if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [40, 40] });
        }
    }, 200);

    // Keep map sized during panel or window resizes
    window.addEventListener('resize', () => {
        map.invalidateSize();
    });
});

